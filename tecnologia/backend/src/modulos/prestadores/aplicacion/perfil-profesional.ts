import { randomUUID } from 'node:crypto';
import type { Idempotencia002, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import type { ContextoTransaccion, ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import type { ClasificacionesEfectivas, DistritoCodigo, ProyeccionPublica, RevisionDeOferta } from '../../catalogo/api-publica.js';
import type { IdentidadAcceso, UsuariosAcceso } from '../../usuarios-acceso/api-publica.js';
import { validarEntradaPerfil, type EntradaPerfil, type PerfilProfesional } from '../dominio/perfil-profesional.js';
import { exigirCupoTrabajo, validarDatosTrabajo, type TrabajoAnterior } from '../dominio/portafolio.js';
import type { RepositorioPrestadores } from './puertos/puertos.js';

/** Identidad ya autenticada por el guard. El token se conserva solo para revalidar antes de un replay. */
export interface ActorPrestador { readonly token: string; readonly identidad: IdentidadAcceso }
export type Autorizador = Pick<UsuariosAcceso, 'exigir'>;

export const noDisponible = () => new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.');
export const versionDesactualizada = (motivo = 'La versión enviada ya no es la vigente.') =>
  new ErrorAplicacion(409, 'VERSION_DESACTUALIZADA', motivo, [{ campo: 'version', motivo }]);

/** El perfil de prestador se verifica en el servidor, nunca desde datos del cliente. */
export function exigirPrestador(identidad: IdentidadAcceso): void {
  if (!identidad.perfiles.includes('prestador')) throw new ErrorAplicacion(403, 'SIN_PERMISO', 'Se requiere un perfil de prestador habilitado.');
}
/**
 * Revalida la sesión y el perfil de prestador con la conexión libre del pool, ANTES de abrir la transacción de escritura.
 * Hacerlo dentro de la transacción exigiría una segunda conexión mientras la primera permanece ocupada y agotaría el pool.
 */
export async function revalidarActor(usuarios: Autorizador, actor: ActorPrestador): Promise<string> {
  const vigente = await usuarios.exigir(actor.token);
  exigirPrestador(vigente);
  return vigente.cuentaId;
}

export const trabajoPrivado = (t: TrabajoAnterior) => ({
  trabajoId: t.id, version: t.version, titulo: t.titulo, descripcion: t.descripcion,
  fotografias: t.fotografias.map(f => ({ fotografiaId: f.id, tipoMime: 'image/webp', ancho: f.ancho, alto: f.alto })),
});
export const perfilPrivado = (p: PerfilProfesional, trabajos: readonly TrabajoAnterior[]) => ({
  prestadorId: p.id, version: p.version, nombrePublico: p.nombrePublico, tipo: p.tipo, experiencia: p.experiencia,
  especialidadesIds: [...p.especialidadesIds], distritos: [...p.distritos], disponibilidadDeclarada: p.disponibilidadDeclarada,
  trabajos: trabajos.map(trabajoPrivado),
});

export interface DependenciasPerfil {
  readonly repositorio: RepositorioPrestadores;
  readonly idempotencia: Idempotencia002;
  readonly usuarios: Autorizador;
  readonly revision: RevisionDeOferta;
  readonly proyeccion: ProyeccionPublica;
  readonly clasificaciones: ClasificacionesEfectivas;
  /** Códigos de los distritos canónicos del catálogo. */
  readonly cobertura: ReadonlySet<string>;
}

export class PerfilProfesionalServicio {
  constructor(private readonly d: DependenciasPerfil) {}

  async obtener(actor: ActorPrestador): Promise<ValorJson> {
    exigirPrestador(actor.identidad);
    const perfil = await this.d.repositorio.perfilPorCuenta(actor.identidad.cuentaId);
    if (!perfil) throw noDisponible();
    return perfilPrivado(perfil, await this.d.repositorio.trabajos(perfil.id)) as ValorJson;
  }

  async guardar(actor: ActorPrestador, clave: string, entrada: EntradaPerfil & { readonly version: number }): Promise<ResultadoIdempotente> {
    exigirPrestador(actor.identidad);
    const datos = validarEntradaPerfil({ ...entrada, especialidadesIds: Array.isArray(entrada.especialidadesIds) ? entrada.especialidadesIds.map(id => (typeof id === 'string' ? uuidEnMinusculas(id) : id)) : entrada.especialidadesIds }, this.d.cobertura);
    const cuentaId = await revalidarActor(this.d.usuarios, actor);
    return this.d.idempotencia.ejecutar002({
      actor: cuentaId, metodo: 'PUT', rutaLogica: '/prestadores/perfil', clave, ids: {}, version: entrada.version,
      cuerpo: { ...datos, especialidadesIds: [...datos.especialidadesIds], distritos: [...datos.distritos] },
      autorizar: async () => cuentaId,
    }, async (tx) => {
      // Orden global: revisión de Catálogo antes que las filas de perfil. La proyección cambia filtros públicos.
      await this.d.revision.bloquear(tx, 'exclusivo');
      const actual = await this.d.repositorio.perfilPorCuenta(cuentaId, tx, true);
      if (entrada.version !== (actual?.version ?? 0)) throw versionDesactualizada();
      const previas = new Set(actual?.especialidadesIds ?? []);
      const nuevas = datos.especialidadesIds.filter(id => !previas.has(id));
      if (nuevas.length > 0) await this.exigirActivas(tx, nuevas);
      let perfil: PerfilProfesional;
      if (actual) {
        perfil = { ...actual, ...datos, version: actual.version + 1 };
        await this.d.repositorio.actualizarPerfil(tx, actual.id, datos, perfil.version);
      } else {
        perfil = { id: randomUUID(), cuentaId, ...datos, version: 1 };
        await this.d.repositorio.crearPerfil(tx, perfil);
      }
      await this.d.proyeccion.actualizar(tx, {
        prestadorId: perfil.id, nombrePublico: perfil.nombrePublico, tipo: perfil.tipo, disponibilidadDeclarada: perfil.disponibilidadDeclarada,
        especialidades: perfil.especialidadesIds, distritos: perfil.distritos as readonly DistritoCodigo[], publicable: true,
      });
      await this.d.revision.incrementar(tx);
      const trabajos = await this.d.repositorio.trabajos(perfil.id, tx);
      return { http: actual ? 200 : 201, cuerpo: perfilPrivado(perfil, trabajos) as ValorJson };
    });
  }

  async crearTrabajo(actor: ActorPrestador, clave: string, entrada: { versionPerfil: number; titulo: string; descripcion: string }): Promise<ResultadoIdempotente> {
    exigirPrestador(actor.identidad);
    const datos = validarDatosTrabajo(entrada) as { titulo: string; descripcion: string };
    const cuentaId = await revalidarActor(this.d.usuarios, actor);
    return this.d.idempotencia.ejecutar002({
      actor: cuentaId, metodo: 'POST', rutaLogica: '/prestadores/perfil/trabajos', clave, ids: {}, version: entrada.versionPerfil, cuerpo: datos,
      autorizar: async () => cuentaId,
    }, async (tx) => {
      const perfil = await this.d.repositorio.perfilPorCuenta(cuentaId, tx, true);
      if (!perfil) throw noDisponible();
      if (perfil.version !== entrada.versionPerfil) throw versionDesactualizada();
      exigirCupoTrabajo(await this.d.repositorio.contarTrabajos(perfil.id, tx));
      const trabajo = { id: randomUUID(), prestadorId: perfil.id, ...datos, version: 1 };
      await this.d.repositorio.crearTrabajo(tx, trabajo);
      const versionPerfil = await this.d.repositorio.avanzarVersionPerfil(tx, perfil.id);
      return { http: 201, cuerpo: { trabajo: trabajoPrivado({ ...trabajo, fotografias: [] }), versionPerfil } as ValorJson };
    });
  }

  async editarTrabajo(actor: ActorPrestador, clave: string, trabajoIdEntrada: string,
    entrada: { version: number; titulo?: string; descripcion?: string }): Promise<ResultadoIdempotente> {
    exigirPrestador(actor.identidad);
    const trabajoId = uuidEnMinusculas(trabajoIdEntrada);
    const { version, ...resto } = entrada;
    const cambios = validarDatosTrabajo(resto, true);
    const cuentaId = await revalidarActor(this.d.usuarios, actor);
    return this.d.idempotencia.ejecutar002({
      actor: cuentaId, metodo: 'PATCH', rutaLogica: '/prestadores/perfil/trabajos/{trabajoId}', clave, ids: { trabajoId }, version,
      cuerpo: cambios as ValorJson, autorizar: async () => cuentaId,
    }, async (tx) => {
      const perfil = await this.d.repositorio.perfilPorCuenta(cuentaId, tx, true);
      const trabajo = perfil ? await this.d.repositorio.trabajoDe(perfil.id, trabajoId, tx, true) : null;
      if (!perfil || !trabajo) throw noDisponible();
      if (trabajo.version !== version) throw versionDesactualizada();
      const nueva = await this.d.repositorio.actualizarTrabajo(tx, trabajo.id, cambios);
      return { http: 200, cuerpo: trabajoPrivado({ ...trabajo, ...cambios, version: nueva }) as ValorJson };
    });
  }

  private async exigirActivas(tx: ContextoTransaccion, ids: readonly string[]): Promise<void> {
    const activas = await this.d.clasificaciones.efectivamenteActivas(tx, ids);
    const inactivas = ids.filter(id => !activas.has(id));
    if (inactivas.length > 0) {
      throw new ErrorAplicacion(422, 'CATEGORIA_NO_ACTIVA', 'Una especialidad no está activa en el catálogo.',
        inactivas.map(id => ({ campo: 'especialidadesIds', motivo: `La clasificación ${id} no está activa.` })));
    }
  }
}
