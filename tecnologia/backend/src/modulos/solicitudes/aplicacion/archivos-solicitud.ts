import { createHash } from 'node:crypto';
import type { Idempotencia002, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import { conReintentoDeConcurrencia } from '../../../compartido/aplicacion/reintento-concurrencia.js';
import type { UnidadDeTrabajo } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import { caducidadDeCarga } from '../dominio/archivos.js';
import { archivoExpirado, dependenciaNoDisponible, limiteArchivos, recursoNoDisponible, solicitudNoAbierta } from '../dominio/errores.js';
import { decidirAcceso } from '../dominio/politica-acceso.js';
import { limitesDeArchivos } from '../dominio/tipos.js';
import { exigirCliente, vistaDeArchivo, type ActorSolicitudes, type PerfilesDeUsuarios } from './solicitudes.js';
import type { AlmacenArchivosSolicitud, SaneadorImagenSolicitud } from './puertos/archivos.js';
import type { AutoriaDeCotizacion } from './puertos/cotizaciones.js';
import type { ArchivoGuardado, RepositorioArchivos, RepositorioSolicitudes, TraducirEscrituraSolicitud } from './puertos/repositorios.js';

/** Máximo de intentos distintos de una misma carga idempotente: tras un fallo de almacenamiento, el reintento con la misma clave usa un identificador nuevo. */
const intentosPorClave = 5;

export interface DependenciasArchivos {
  readonly repositorio: RepositorioSolicitudes;
  readonly archivos: RepositorioArchivos;
  readonly almacen: AlmacenArchivosSolicitud;
  readonly saneador: SaneadorImagenSolicitud;
  readonly idempotencia: Idempotencia002;
  readonly unidad: UnidadDeTrabajo;
  readonly usuarios: PerfilesDeUsuarios;
  readonly autoria: AutoriaDeCotizacion;
  readonly traducirEscritura: TraducirEscrituraSolicitud;
  readonly ahora?: () => Date;
}
export interface CargaDeArchivo { readonly tipoMime: string; readonly contenidoBase64: string }

/** Identificador determinista de un intento de carga: una repetición con la misma clave encuentra la misma fila en vez de crear otra. */
export function idDeIntento(cuentaId: string, solicitudId: string, clave: string, intento: number): string {
  const h = createHash('sha256').update(`${cuentaId}|${solicitudId}|${clave}|${intento}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x40; h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}
const iguales = (a: Uint8Array, b: Uint8Array) => a.length === b.length && Buffer.from(a).equals(Buffer.from(b));

/**
 * Archivos de una solicitud (FR-317 a FR-323 y FR-347). La carga se registra en TRES TIEMPOS con compensación entre PostgreSQL y el almacenamiento:
 *  1. Reserva: una transacción descarta los caducados, evalúa el cupo y registra el archivo PREPARANDO con su entrada de limpieza. El cupo se consume aquí.
 *  2. Guardado del objeto en el almacenamiento, sin bloqueos. Si falla, se descarta la reserva (y con ella el cupo) y se responde 503.
 *  3. Publicación idempotente: PREPARANDO → PREPARADO. Si el proceso se interrumpe antes, la fila caduca a las 24 horas y el objeto queda para la limpieza.
 */
export class ArchivosSolicitudServicio {
  constructor(private readonly d: DependenciasArchivos) {}
  private ahora(): Date { return this.d.ahora?.() ?? new Date(); }

  private async propia(solicitudId: string, cuentaId: string) {
    const s = await this.d.repositorio.obtener(solicitudId);
    if (!s || s.clienteCuentaId !== cuentaId) throw recursoNoDisponible();
    if (s.estado === 'CERRADA') throw solicitudNoAbierta();
    return s;
  }

  async cargar(actor: ActorSolicitudes, clave: string, solicitudIdEntrada: string, entrada: CargaDeArchivo): Promise<ResultadoIdempotente> {
    exigirCliente(actor.identidad);
    const solicitudId = uuidEnMinusculas(solicitudIdEntrada);
    const cuentaId = (await this.d.usuarios.exigir(actor.token)).cuentaId;
    await this.propia(solicitudId, cuentaId);
    // Un archivo inválido se rechaza aquí, antes de reservar cupo o escribir ningún objeto.
    const imagen = await this.d.saneador.sanear(entrada.contenidoBase64, entrada.tipoMime);
    const original = Buffer.from(entrada.contenidoBase64, 'base64');
    const candidatos = Array.from({ length: intentosPorClave }, (_, n) => idDeIntento(cuentaId, solicitudId, clave, n));

    const reserva = await this.reservar(cuentaId, solicitudId, candidatos, imagen);
    const reciente = reserva.estado === 'PREPARANDO';
    if (reciente) await this.guardarObjeto(reserva, imagen.bytes, imagen.checksum);
    try {
      return await conReintentoDeConcurrencia(() => this.d.idempotencia.ejecutar002({
        actor: cuentaId, metodo: 'POST', rutaLogica: '/solicitudes/{solicitudId}/archivos', clave, ids: { solicitudId }, cuerpo: { tipoMime: entrada.tipoMime },
        fotografia: original, autorizar: async () => cuentaId,
      }, tx => this.d.traducirEscritura(async () => {
        const solicitud = await this.d.repositorio.obtener(solicitudId, tx, 'actualizacion');
        if (!solicitud || solicitud.clienteCuentaId !== cuentaId) throw recursoNoDisponible();
        if (solicitud.estado === 'CERRADA') throw solicitudNoAbierta();
        const fila = await this.d.archivos.porId(reserva.id, tx);
        if (!fila || fila.estado !== 'PREPARANDO') throw recursoNoDisponible();
        if (fila.caducaEn && fila.caducaEn.getTime() <= this.ahora().getTime()) throw archivoExpirado();
        await this.d.archivos.marcarPreparado(tx, reserva.id);
        return { http: 201, cuerpo: vistaDeArchivo({ ...fila, estado: 'PREPARADO' }) };
      })));
    } catch (error) {
      // Una clave reutilizada con otros datos (409) u otro fallo del tiempo 3 no deja la reserva consumiendo cupo ni el objeto guardado.
      if (reciente) await this.compensar(reserva);
      throw error;
    }
  }

  /** Tiempo 1. Idempotente por clave: una repetición reutiliza la reserva viva, y una clave reutilizada con otra imagen es un conflicto. */
  private async reservar(cuentaId: string, solicitudId: string, candidatos: readonly string[], imagen: { bytes: Uint8Array; ancho: number; alto: number; checksum: Uint8Array }): Promise<ArchivoGuardado> {
    return conReintentoDeConcurrencia(() => this.d.unidad.ejecutar((tx) => this.d.traducirEscritura(async () => {
      const s = await this.d.repositorio.obtener(solicitudId, tx, 'actualizacion');
      if (!s || s.clienteCuentaId !== cuentaId) throw recursoNoDisponible();
      if (s.estado === 'CERRADA') throw solicitudNoAbierta();
      await this.d.archivos.caducar(tx, solicitudId);
      const existentes = new Map((await this.d.archivos.porIds(candidatos, tx)).map(a => [a.id, a]));
      for (const id of candidatos) {
        const previo = existentes.get(id);
        if (!previo) break;
        if (previo.estado === 'DESCARTADO' || previo.estado === 'ELIMINADO') continue;
        if (!iguales(previo.checksum, imagen.checksum)) throw new ErrorAplicacion(409, 'CLAVE_IDEMPOTENCIA_REUTILIZADA', 'La clave ya corresponde a otros datos.');
        return previo;
      }
      const id = candidatos.find(c => !existentes.has(c));
      if (!id) throw limiteArchivos();
      const vigentes = await this.d.archivos.listarVisibles(solicitudId, tx);
      // El disparador de contadores y las restricciones de `solicitudes` son la barrera definitiva; esto solo da la respuesta clara antes de escribir.
      if (vigentes.length >= limitesDeArchivos.maximoPorSolicitud || vigentes.reduce((n, a) => n + a.bytes, 0) + imagen.bytes.length > limitesDeArchivos.bytesMaximosPorSolicitud) throw limiteArchivos();
      const objetoClave = this.d.almacen.claveNueva(solicitudId, id);
      const nuevo = { id, solicitudId, objetoClave, bytes: imagen.bytes.length, ancho: imagen.ancho, alto: imagen.alto, checksum: imagen.checksum, caducaEn: caducidadDeCarga(this.ahora()) };
      await this.d.archivos.reservar(tx, nuevo);
      return { ...nuevo, estado: 'PREPARANDO' as const, creadoEn: this.ahora() };
    })));
  }

  /** Tiempo 2. Un fallo del almacenamiento libera el cupo (descarta la reserva) y responde 503 sin exponer detalles. */
  private async guardarObjeto(reserva: ArchivoGuardado, bytes: Uint8Array, checksum: Uint8Array): Promise<void> {
    try {
      await this.d.almacen.guardar(reserva.objetoClave, bytes);
      if (!iguales(createHash('sha256').update(await this.d.almacen.leer(reserva.objetoClave)).digest(), checksum)) throw dependenciaNoDisponible();
    } catch {
      await this.compensar(reserva);
      throw dependenciaNoDisponible();
    }
  }

  /** Libera la reserva: descarta la fila (y con ella el cupo) y retira el objeto, con la purga durable como respaldo. Nunca lanza. */
  private async compensar(reserva: ArchivoGuardado): Promise<void> {
    const purgar = await conReintentoDeConcurrencia(() => this.d.unidad.ejecutar(tx => this.d.traducirEscritura(async () => {
      await this.d.repositorio.obtener(reserva.solicitudId, tx, 'actualizacion');
      const fila = await this.d.archivos.porId(reserva.id, tx);
      if (fila?.estado === 'PREPARANDO') await this.d.archivos.descartarPreparacion(tx, fila.id);
      return fila?.estado === 'PREPARANDO' || fila?.estado === 'DESCARTADO' || fila?.estado === 'ELIMINADO';
    }))).catch(() => false);
    if (purgar) await this.d.almacen.eliminar(reserva.objetoClave).then(() => this.d.archivos.completarPurga(reserva.objetoClave)).catch(() => undefined);
  }

  /** Descarga autorizada por la política única: el dueño, o un prestador con acceso cuando las fotografías son visibles. Sin direcciones públicas ni firmadas. */
  async obtener(actor: ActorSolicitudes, solicitudIdEntrada: string, archivoIdEntrada: string): Promise<Uint8Array> {
    const solicitudId = uuidEnMinusculas(solicitudIdEntrada); const archivoId = uuidEnMinusculas(archivoIdEntrada);
    const s = await this.d.repositorio.obtener(solicitudId);
    const archivo = s ? await this.d.archivos.porId(archivoId) : null;
    if (!s || !archivo || archivo.solicitudId !== solicitudId) throw recursoNoDisponible();
    const esDueno = s.clienteCuentaId === actor.identidad.cuentaId;
    if (esDueno) {
      const vigente = archivo.estado === 'CONFIRMADO' || (archivo.estado === 'PREPARADO' && archivo.caducaEn !== null && archivo.caducaEn.getTime() > this.ahora().getTime());
      if (!vigente) throw recursoNoDisponible();
    } else {
      if (archivo.estado !== 'CONFIRMADO') throw recursoNoDisponible();
      const tienePerfilPrestador = actor.identidad.perfiles.includes('prestador');
      const autorNoRetirado = tienePerfilPrestador && s.estado !== 'BORRADOR' ? await this.d.autoria.tieneNoRetirada(s.id, actor.identidad.cuentaId) : false;
      const decision = decidirAcceso({ solicitud: { tipo: s.tipo, estado: s.estado, clienteCuentaId: s.clienteCuentaId, prestadorCuentaId: s.prestadorCuentaId, compartirFotografias: s.compartirFotografias },
        actor: { cuentaId: actor.identidad.cuentaId, tienePerfilPrestador }, compatible: false, autorNoRetirado });
      if (decision.fotografias !== 'VISIBLES') throw recursoNoDisponible();
    }
    let bytes: Uint8Array;
    try { bytes = await this.d.almacen.leer(archivo.objetoClave); } catch { throw dependenciaNoDisponible(); }
    if (!iguales(createHash('sha256').update(bytes).digest(), archivo.checksum)) throw dependenciaNoDisponible();
    return bytes;
  }
}
