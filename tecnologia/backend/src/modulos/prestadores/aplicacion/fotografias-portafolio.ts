import { createHash, randomUUID } from 'node:crypto';
import type { Idempotencia002, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import type { ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import { dependenciaNoDisponible, ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { exigirCupoFotografia } from '../dominio/portafolio.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import { revalidarActor, exigirPrestador, noDisponible, versionDesactualizada, type ActorPrestador, type Autorizador } from './perfil-profesional.js';
import type { AlmacenPortafolio, ImagenSaneada, RepositorioPrestadores, SaneadorImagen } from './puertos/puertos.js';

const vigenciaPreparacionMs = 10 * 60 * 1000;
export interface EscrituraFotografia { readonly versionTrabajo: number; readonly tipoMime: string; readonly contenidoBase64: string }

export interface DependenciasPortafolio {
  readonly repositorio: RepositorioPrestadores;
  readonly idempotencia: Idempotencia002;
  readonly usuarios: Autorizador;
  readonly saneador: SaneadorImagen;
  readonly almacen: AlmacenPortafolio;
  readonly ahora?: () => Date;
}

const iguales = (a: Uint8Array, b: Uint8Array) => a.length === b.length && Buffer.from(a).equals(Buffer.from(b));
const fotografiaPrivada = (id: string, i: ImagenSaneada) => ({ fotografiaId: id, tipoMime: 'image/webp', ancho: i.ancho, alto: i.alto });

export class FotografiasPortafolioServicio {
  constructor(private readonly d: DependenciasPortafolio) {}
  private ahora(): Date { return this.d.ahora?.() ?? new Date(); }

  agregar(actor: ActorPrestador, clave: string, trabajoId: string, entrada: EscrituraFotografia): Promise<ResultadoIdempotente> {
    return this.escribir(actor, clave, uuidEnMinusculas(trabajoId), undefined, entrada);
  }
  reemplazar(actor: ActorPrestador, clave: string, trabajoId: string, fotografiaId: string, entrada: EscrituraFotografia): Promise<ResultadoIdempotente> {
    return this.escribir(actor, clave, uuidEnMinusculas(trabajoId), uuidEnMinusculas(fotografiaId), entrada);
  }

  /** Orden: titularidad y cupo previos, saneamiento y escritura del objeto fuera de bloqueos, y vínculo transaccional al final. */
  private async escribir(actor: ActorPrestador, clave: string, trabajoId: string, fotografiaId: string | undefined, entrada: EscrituraFotografia): Promise<ResultadoIdempotente> {
    exigirPrestador(actor.identidad);
    const cuentaId = actor.identidad.cuentaId;
    const repo = this.d.repositorio;
    const perfil = await repo.perfilPorCuenta(cuentaId);
    const previo = perfil ? await repo.trabajoDe(perfil.id, trabajoId) : null;
    if (!perfil || !previo) throw noDisponible();
    if (fotografiaId && !previo.fotografias.some(f => f.id === fotografiaId)) throw noDisponible();
    if (!fotografiaId) exigirCupoFotografia({ fotografiasEnTrabajo: previo.fotografias.length, fotografiasEnPerfil: await repo.contarFotografias(perfil.id) });

    // Un archivo inválido se rechaza aquí y no altera ninguna imagen ya vinculada.
    const imagen = await this.d.saneador.sanear(entrada.contenidoBase64, entrada.tipoMime);
    const objetoClave = this.d.almacen.claveNueva(perfil.id);
    await repo.registrarPreparacion(objetoClave, perfil.id, new Date(this.ahora().getTime() + vigenciaPreparacionMs));
    await this.d.almacen.guardar(objetoClave, imagen.bytes);
    let leido: Uint8Array;
    try { leido = await this.d.almacen.leer(objetoClave); } catch { throw dependenciaNoDisponible(); }
    if (!iguales(createHash('sha256').update(leido).digest(), imagen.checksum)) throw dependenciaNoDisponible();

    // La sesión se revalida con una conexión libre del pool antes de abrir la transacción, incluso para devolver un replay.
    if (await revalidarActor(this.d.usuarios, actor) !== cuentaId) throw new ErrorAplicacion(401, 'NO_AUTENTICADO', 'Debe autenticarse.');
    let vinculada = false;
    const id = fotografiaId ?? randomUUID();
    try {
      return await this.d.idempotencia.ejecutar002({
        actor: cuentaId, metodo: fotografiaId ? 'PUT' : 'POST',
        rutaLogica: fotografiaId ? '/prestadores/perfil/trabajos/{trabajoId}/fotografias/{fotografiaId}' : '/prestadores/perfil/trabajos/{trabajoId}/fotografias',
        clave, ids: fotografiaId ? { trabajoId, fotografiaId } : { trabajoId }, version: entrada.versionTrabajo,
        cuerpo: { tipoMime: entrada.tipoMime }, fotografia: imagen.original, autorizar: async () => cuentaId,
      }, async (tx) => {
        const bloqueado = await repo.perfilPorCuenta(cuentaId, tx, true);
        const trabajo = bloqueado ? await repo.trabajoDe(bloqueado.id, trabajoId, tx, true) : null;
        if (!bloqueado || !trabajo) throw noDisponible();
        if (trabajo.version !== entrada.versionTrabajo) throw versionDesactualizada();
        const nueva = { id, objetoClave, ancho: imagen.ancho, alto: imagen.alto, bytes: imagen.bytes.length, checksum: imagen.checksum };
        let versionTrabajo: number;
        if (fotografiaId) {
          if (!trabajo.fotografias.some(f => f.id === fotografiaId)) throw noDisponible();
          versionTrabajo = await repo.reemplazarFotografia(tx, trabajoId, nueva, bloqueado.id);
        } else {
          exigirCupoFotografia({ fotografiasEnTrabajo: trabajo.fotografias.length, fotografiasEnPerfil: await repo.contarFotografias(bloqueado.id, tx) });
          versionTrabajo = await repo.agregarFotografia(tx, trabajoId, nueva);
        }
        vinculada = true;
        return { http: fotografiaId ? 200 : 201, cuerpo: { fotografia: fotografiaPrivada(id, imagen), versionTrabajo } as ValorJson };
      });
    } finally {
      // Un replay confirmado no consume la preparación. El objeto sobrante se descarta y la fila vence en el limpiador.
      if (!vinculada) await this.d.almacen.eliminar(objetoClave).catch(() => undefined);
    }
  }

  async eliminar(actor: ActorPrestador, clave: string, trabajoIdEntrada: string, fotografiaIdEntrada: string, versionTrabajo: number): Promise<ResultadoIdempotente> {
    exigirPrestador(actor.identidad);
    const trabajoId = uuidEnMinusculas(trabajoIdEntrada);
    const fotografiaId = uuidEnMinusculas(fotografiaIdEntrada);
    const cuentaId = await revalidarActor(this.d.usuarios, actor);
    const repo = this.d.repositorio;
    return this.d.idempotencia.ejecutar002({
      actor: cuentaId, metodo: 'DELETE', rutaLogica: '/prestadores/perfil/trabajos/{trabajoId}/fotografias/{fotografiaId}', clave,
      ids: { trabajoId, fotografiaId }, version: versionTrabajo, cuerpo: {}, autorizar: async () => cuentaId,
    }, async (tx) => {
      const perfil = await repo.perfilPorCuenta(cuentaId, tx, true);
      const trabajo = perfil ? await repo.trabajoDe(perfil.id, trabajoId, tx, true) : null;
      if (!perfil || !trabajo || !trabajo.fotografias.some(f => f.id === fotografiaId)) throw noDisponible();
      if (trabajo.version !== versionTrabajo) throw versionDesactualizada();
      // Quita el vínculo y programa la purga en la misma transacción: la entrega se revoca desde el commit.
      const nueva = await repo.eliminarFotografia(tx, trabajoId, fotografiaId, perfil.id);
      return { http: 200, cuerpo: { versionTrabajo: nueva } };
    });
  }

  /** Entrega pública: solo una variante confirmada, de un trabajo y perfil vigentes. */
  async obtenerPublica(prestadorId: string, trabajoId: string, fotografiaId: string): Promise<ValorJson> {
    const foto = await this.d.repositorio.fotografiaPublica(prestadorId, trabajoId, fotografiaId);
    if (!foto) throw noDisponible();
    let bytes: Uint8Array;
    try { bytes = await this.d.almacen.leer(foto.objetoClave); } catch { throw dependenciaNoDisponible(); }
    if (!iguales(createHash('sha256').update(bytes).digest(), foto.checksum)) throw new ErrorAplicacion(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio temporalmente no disponible.');
    return { tipoMime: 'image/webp', contenidoBase64: Buffer.from(bytes).toString('base64') };
  }
}
