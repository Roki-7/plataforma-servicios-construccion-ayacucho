import { randomUUID } from 'node:crypto';
import type { Idempotencia002, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import type { ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import type { PrestadoresApi } from '../../prestadores/api-publica.js';
import type { IdentidadAcceso, UsuariosAcceso } from '../../usuarios-acceso/api-publica.js';
import type { ClasificacionesEfectivas, RevisionDeOferta } from '../api-publica.js';
import { exigirClasificacionActiva, exigirEditable, exigirPublicable, exigirTransicion, validarDatosServicio, type EstadoServicio, type Servicio } from '../dominio/servicio.js';
import type { RepositorioServicios } from './puertos/servicios.js';

/** Identidad ya autenticada por el guard. El token solo sirve para revalidar la sesión antes de devolver un replay. */
export interface ActorServicio { readonly token: string; readonly identidad: IdentidadAcceso }

const noDisponible = (motivo = 'Recurso no disponible.') => new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', motivo);
const versionDesactualizada = () => new ErrorAplicacion(409, 'VERSION_DESACTUALIZADA', 'La versión enviada ya no es la vigente.', [{ campo: 'version', motivo: 'La versión enviada ya no es la vigente.' }]);

/** El perfil de prestador se verifica en el servidor, nunca desde datos del cliente. */
export function exigirPrestadorHabilitado(identidad: IdentidadAcceso): void {
  if (!identidad.perfiles.includes('prestador')) throw new ErrorAplicacion(403, 'SIN_PERMISO', 'Se requiere un perfil de prestador habilitado.');
}

export const servicioPrivado = (s: Servicio) => ({
  servicioId: s.id, prestadorId: s.prestadorId, titulo: s.titulo, descripcion: s.descripcion, categoriaId: s.categoriaId, estado: s.estado, version: s.version,
});

export interface DependenciasServicios {
  readonly repositorio: RepositorioServicios;
  readonly idempotencia: Idempotencia002;
  readonly usuarios: Pick<UsuariosAcceso, 'exigir'>;
  readonly revision: RevisionDeOferta;
  readonly clasificaciones: ClasificacionesEfectivas;
  readonly prestadores: PrestadoresApi;
}

export class ServiciosPropiosServicio {
  constructor(private readonly d: DependenciasServicios) {}

  /**
   * Revalida la sesión y el perfil de prestador ANTES de abrir la transacción. Hacerlo dentro de la transacción exigiría una segunda
   * conexión del pool mientras la primera está ocupada y, con tantas escrituras simultáneas como conexiones, agotaría el pool.
   */
  private async revalidar(actor: ActorServicio): Promise<string> {
    const vigente = await this.d.usuarios.exigir(actor.token);
    exigirPrestadorHabilitado(vigente);
    return vigente.cuentaId;
  }

  /** Orden global de bloqueos: idempotencia, revisión de Catálogo, servicio. La oferta pública cambia, por lo que la revisión es exclusiva. */
  private async propio(tx: Parameters<RepositorioServicios['crear']>[0], cuentaId: string, servicioId: string): Promise<Servicio> {
    const perfil = await this.d.prestadores.perfilDeCuenta(cuentaId, tx);
    const servicio = perfil ? await this.d.repositorio.porId(servicioId, tx, true) : null;
    // Un servicio ajeno es indistinguible de uno inexistente: no se revela su existencia.
    if (!perfil || !servicio || servicio.prestadorId !== perfil.prestadorId) throw noDisponible();
    return servicio;
  }

  async publicar(actor: ActorServicio, clave: string, original: { titulo: string; descripcion: string; categoriaId: string }): Promise<ResultadoIdempotente> {
    exigirPrestadorHabilitado(actor.identidad);
    const entrada = { ...original, categoriaId: uuidEnMinusculas(original.categoriaId) };
    const datos = validarDatosServicio(entrada) as { titulo: string; descripcion: string };
    const cuentaId = await this.revalidar(actor);
    return this.d.idempotencia.ejecutar002({
      actor: cuentaId, metodo: 'POST', rutaLogica: '/servicios', clave, ids: {}, cuerpo: { ...datos, categoriaId: entrada.categoriaId }, autorizar: async () => cuentaId,
    }, async (tx) => {
      await this.d.revision.bloquear(tx, 'exclusivo');
      const perfil = await this.d.prestadores.perfilDeCuenta(cuentaId, tx);
      if (!perfil) throw noDisponible('Cree primero su perfil profesional.');
      exigirClasificacionActiva((await this.d.clasificaciones.efectivamenteActivas(tx, [entrada.categoriaId])).has(entrada.categoriaId));
      const servicio: Servicio = { id: randomUUID(), prestadorId: perfil.prestadorId, categoriaId: entrada.categoriaId, ...datos, estado: 'PUBLICADO', version: 1 };
      await this.d.repositorio.crear(tx, servicio);
      await this.d.revision.incrementar(tx);
      return { http: 201, cuerpo: servicioPrivado(servicio) as ValorJson };
    });
  }

  async editar(actor: ActorServicio, clave: string, servicioIdEntrada: string, entrada: { version: number; titulo?: string; descripcion?: string; categoriaId?: string }): Promise<ResultadoIdempotente> {
    exigirPrestadorHabilitado(actor.identidad);
    const servicioId = uuidEnMinusculas(servicioIdEntrada);
    const { version, categoriaId: categoriaEntrada, ...texto } = entrada;
    const categoriaId = categoriaEntrada ? uuidEnMinusculas(categoriaEntrada) : undefined;
    const cambios = { ...validarDatosServicio(texto, true), ...(categoriaId ? { categoriaId } : {}) };
    const cuentaId = await this.revalidar(actor);
    return this.d.idempotencia.ejecutar002({
      actor: cuentaId, metodo: 'PATCH', rutaLogica: '/servicios/{servicioId}', clave, ids: { servicioId }, version, cuerpo: cambios as ValorJson, autorizar: async () => cuentaId,
    }, async (tx) => {
      await this.d.revision.bloquear(tx, 'exclusivo');
      const actual = await this.propio(tx, cuentaId, servicioId);
      exigirEditable(actual.estado);
      if (actual.version !== version) throw versionDesactualizada();
      // Un cambio de clasificación valida la clasificación aplicable. Editar solo el texto no depende de ella.
      if (categoriaId && categoriaId !== actual.categoriaId) exigirClasificacionActiva((await this.d.clasificaciones.efectivamenteActivas(tx, [categoriaId])).has(categoriaId));
      const nueva = await this.d.repositorio.actualizar(tx, actual.id, cambios);
      await this.d.revision.incrementar(tx);
      return { http: 200, cuerpo: servicioPrivado({ ...actual, ...cambios, version: nueva }) as ValorJson };
    });
  }

  async cambiarEstado(actor: ActorServicio, clave: string, servicioIdEntrada: string, entrada: { version: number; destino: EstadoServicio }): Promise<ResultadoIdempotente> {
    exigirPrestadorHabilitado(actor.identidad);
    const servicioId = uuidEnMinusculas(servicioIdEntrada);
    const cuentaId = await this.revalidar(actor);
    return this.d.idempotencia.ejecutar002({
      actor: cuentaId, metodo: 'POST', rutaLogica: '/servicios/{servicioId}/transiciones', clave, ids: { servicioId }, version: entrada.version, cuerpo: { destino: entrada.destino },
      autorizar: async () => cuentaId,
    }, async (tx) => {
      await this.d.revision.bloquear(tx, 'exclusivo');
      const actual = await this.propio(tx, cuentaId, servicioId);
      exigirTransicion(actual.estado, entrada.destino);
      if (actual.version !== entrada.version) throw versionDesactualizada();
      // Reactivar vuelve a comprobar las condiciones vigentes. Si fallan, el servicio sigue PAUSADO.
      if (entrada.destino === 'PUBLICADO') exigirPublicable(actual, await this.d.repositorio.clasificacionActiva(actual.id, tx));
      const nueva = await this.d.repositorio.actualizar(tx, actual.id, { estado: entrada.destino });
      await this.d.revision.incrementar(tx);
      return { http: 200, cuerpo: servicioPrivado({ ...actual, estado: entrada.destino, version: nueva }) as ValorJson };
    });
  }

  /** Inventario del titular: incluye PUBLICADO, PAUSADO y RETIRADO. */
  async listarPropios(actor: ActorServicio, pagina: number, tamano: number): Promise<ValorJson> {
    exigirPrestadorHabilitado(actor.identidad);
    const perfil = await this.d.prestadores.perfilDeCuenta(actor.identidad.cuentaId);
    const { elementos, total } = perfil ? await this.d.repositorio.listarPropios(perfil.prestadorId, pagina, tamano) : { elementos: [], total: 0 };
    return { elementos: elementos.map(servicioPrivado), total, pagina, tamano } as ValorJson;
  }
}