import { randomUUID } from 'node:crypto';
import type { Idempotencia002, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import { conReintentoDeConcurrencia } from '../../../compartido/aplicacion/reintento-concurrencia.js';
import type { ContextoTransaccion, ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import type { ClasificacionesEfectivas, ElegibilidadServicio, RevisionDeOferta } from '../../catalogo/api-publica.js';
import type { AvisoNegocio, AvisosNegocioApi } from '../../notificaciones/api-publica.js';
import type { LecturasDePrestadores, PrestadoresApi } from '../../prestadores/api-publica.js';
import type { IdentidadAcceso, UsuariosAcceso } from '../../usuarios-acceso/api-publica.js';
import { planificarConfirmacion } from '../dominio/archivos.js';
import {
  autodireccionNoPermitida, categoriaNoActiva, categoriaNoCoincideConServicio, datosInvalidos, prestadorNoDisponible, recursoNoDisponible, servicioNoElegible,
  servicioNoPerteneceAlPrestador, solicitudNoAbierta, versionDesactualizada,
} from '../dominio/errores.js';
import { hoyEnLima } from '../dominio/fechas.js';
import { decidirAcceso } from '../dominio/politica-acceso.js';
import {
  advertenciasDeCobertura, descripcionCorta, evaluarTextoLibre, exigirCompleta, exigirFechaNoAnterior, exigirInmutables, exigirPeriodoCoherente, normalizarEntrada,
  type Advertencia, type CopiaDeServicio, type EntradaSolicitud, type Solicitud,
} from '../dominio/solicitud.js';
import type { EstadoSolicitud } from '../dominio/tipos.js';
import { compararEstados, efectosDeCierre, efectosDeEdicion, efectosDePublicacion, estadoCanonico } from '../dominio/version.js';
import type { AlmacenArchivosSolicitud } from './puertos/archivos.js';
import type { AutoriaDeCotizacion, PrestadoresInteresados } from './puertos/cotizaciones.js';
import type { ArchivoDeVersion, ArchivoGuardado, RepositorioArchivos, RepositorioSolicitudes, TraducirEscrituraSolicitud } from './puertos/repositorios.js';

export interface ActorSolicitudes { readonly token: string; readonly identidad: IdentidadAcceso }
export type PerfilesDeUsuarios = Pick<UsuariosAcceso, 'exigir'>;

export interface DependenciasSolicitudes {
  readonly repositorio: RepositorioSolicitudes;
  readonly archivos: RepositorioArchivos;
  readonly almacen: AlmacenArchivosSolicitud;
  readonly idempotencia: Idempotencia002;
  readonly usuarios: PerfilesDeUsuarios;
  readonly revision: RevisionDeOferta;
  readonly clasificaciones: ClasificacionesEfectivas;
  readonly elegibilidad: ElegibilidadServicio;
  readonly prestadores: PrestadoresApi & LecturasDePrestadores;
  readonly avisos: AvisosNegocioApi;
  readonly interesados: PrestadoresInteresados;
  readonly autoria: AutoriaDeCotizacion;
  readonly traducirEscritura: TraducirEscrituraSolicitud;
  readonly ahora?: () => Date;
}

export const exigirCliente = (identidad: IdentidadAcceso): void => {
  if (!identidad.perfiles.includes('cliente')) throw new ErrorAplicacion(403, 'SIN_PERMISO', 'Se requiere un perfil de cliente habilitado.');
};
export const exigirPrestadorHabilitado = (identidad: IdentidadAcceso): void => {
  if (!identidad.perfiles.includes('prestador')) throw new ErrorAplicacion(403, 'SIN_PERMISO', 'Se requiere un perfil de prestador habilitado.');
};

const tipoMime = 'image/webp' as const;
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

/** Vista de un archivo para la API. Nunca incluye la clave del objeto ni una dirección. */
export function vistaDeArchivo(a: ArchivoGuardado): ValorJson {
  return { archivoId: a.id, estado: a.estado === 'CONFIRMADO' ? 'CONFIRMADO' : 'PREPARADO', tipoMime, bytes: a.bytes, ancho: a.ancho, alto: a.alto,
    ...(a.estado === 'PREPARADO' && a.caducaEn ? { caducaEn: a.caducaEn.toISOString() } : {}) };
}
const metadatosDeVersion = (a: ArchivoGuardado): ArchivoDeVersion => ({ archivoId: a.id, tipoMime, bytes: a.bytes, ancho: a.ancho, alto: a.alto, sha256: hex(a.checksum) });

/** Vista del cliente dueño (`C003SolicitudPrivada`). */
export function vistaPrivada(s: Solicitud, archivos: readonly ArchivoGuardado[], advertencias: readonly Advertencia[]): ValorJson {
  return {
    solicitudId: s.id, tipo: s.tipo, estado: s.estado,
    ...(s.prestadorId ? { prestadorId: s.prestadorId } : {}),
    ...(s.servicio ? { servicio: { servicioId: s.servicio.servicioId, titulo: s.servicio.titulo, categoriaId: s.servicio.categoriaId } } : {}),
    ...(s.descripcion ? { descripcion: s.descripcion } : {}), ...(s.medidas ? { medidas: s.medidas } : {}),
    ...(s.categoriaId ? { categoriaId: s.categoriaId } : {}), ...(s.distrito ? { distrito: s.distrito } : {}),
    ...(s.fechaDesde ? { fechaDesde: s.fechaDesde } : {}), ...(s.fechaHasta ? { fechaHasta: s.fechaHasta } : {}),
    compartirFotografias: s.compartirFotografias, archivos: archivos.map(vistaDeArchivo), version: s.version, versionTrabajo: s.versionTrabajo,
    creadaEn: s.creadaEn.toISOString(), actualizadaEn: s.actualizadaEn.toISOString(),
    advertencias: advertencias.map(a => ({ codigo: a.codigo, ...(a.campo ? { campo: a.campo } : {}), mensaje: a.mensaje })),
  };
}

interface Referencias { readonly tipo: Solicitud['tipo']; readonly prestadorId: string | null; readonly prestadorCuentaId: string | null; readonly servicio: CopiaDeServicio | null; readonly categoriaId: string | null }
type Retraso = (() => Promise<void>)[];

export class SolicitudesServicio {
  constructor(private readonly d: DependenciasSolicitudes) {}
  private ahora(): Date { return this.d.ahora?.() ?? new Date(); }

  /** Revalida la sesión con una conexión libre del pool, ANTES de abrir la transacción de escritura. */
  private async revalidar(actor: ActorSolicitudes, rol: 'cliente' | 'prestador' = 'cliente'): Promise<string> {
    const vigente = await this.d.usuarios.exigir(actor.token);
    if (rol === 'cliente') exigirCliente(vigente); else exigirPrestadorHabilitado(vigente);
    return vigente.cuentaId;
  }

  /**
   * Ejecuta una escritura con idempotencia, traducción de errores de base de datos y reintento acotado de conflictos. El orden de bloqueos es: idempotencia
   * (dentro de `ejecutar002`) → revisión de Catálogo → solicitud. Las acciones posteriores a la confirmación (borrado físico inmediato) se ejecutan solo si la
   * transacción se confirmó y no fue un replay.
   */
  private async escribir(p: { cuentaId: string; metodo: 'POST' | 'PATCH'; ruta: string; clave: string; ids: Record<string, string>; version?: number; cuerpo: ValorJson },
    trabajo: (tx: ContextoTransaccion, despues: Retraso) => Promise<ResultadoIdempotente>): Promise<ResultadoIdempotente> {
    let despues: Retraso = [];
    const r = await conReintentoDeConcurrencia(() => this.d.idempotencia.ejecutar002({
      actor: p.cuentaId, metodo: p.metodo, rutaLogica: p.ruta, clave: p.clave, ids: p.ids, ...(p.version === undefined ? {} : { version: p.version }), cuerpo: p.cuerpo,
      autorizar: async () => p.cuentaId,
    }, (tx) => { despues = []; return this.d.traducirEscritura(() => trabajo(tx, despues)); }));
    for (const accion of despues) await accion().catch(() => undefined);
    return r;
  }

  private async purgar(claves: readonly string[]): Promise<void> {
    for (const clave of claves) {
      try { await this.d.almacen.eliminar(clave); await this.d.archivos.completarPurga(clave); } catch { /* la entrada de purga durable la completa la limpieza */ }
    }
  }

  // ─── Referencias (prestador, servicio, categoría) ───────────────────────────────────────────────────────────────
  private async validarPrestador(tx: ContextoTransaccion, cuentaId: string, prestadorId: string) {
    const perfil = await this.d.prestadores.perfilPorId(prestadorId, tx);
    if (!perfil || !perfil.publicable) throw prestadorNoDisponible();
    if (perfil.cuentaId === cuentaId) throw autodireccionNoPermitida();
    return perfil;
  }

  /** Comprueba la pertenencia y la elegibilidad del servicio (FR-304). Devuelve su copia. Con `tx` toma el bloqueo compartido de la revisión de Catálogo. */
  private async validarServicio(tx: ContextoTransaccion, servicioId: string, prestadorId: string): Promise<CopiaDeServicio> {
    const registro = await this.d.elegibilidad.registro(servicioId, tx);
    if (!registro) throw servicioNoElegible();
    if (registro.prestadorId !== prestadorId) throw servicioNoPerteneceAlPrestador();
    if (!(await this.d.elegibilidad.evaluar(servicioId, tx)).elegible) throw servicioNoElegible();
    return { servicioId: registro.servicioId, titulo: registro.titulo, categoriaId: registro.categoriaId };
  }

  private async exigirCategoriaActiva(tx: ContextoTransaccion, categoriaId: string): Promise<void> {
    if (!(await this.d.clasificaciones.efectivamenteActivas(tx, [categoriaId])).has(categoriaId)) throw categoriaNoActiva();
  }

  /** Resuelve tipo, destinatario, servicio y categoría de la solicitud resultante y valida lo que cambió (FR-302 a FR-306). */
  private async resolverReferencias(tx: ContextoTransaccion, cuentaId: string, actual: Solicitud | null, entrada: EntradaSolicitud): Promise<Referencias> {
    const tipo = entrada.tipo ?? actual?.tipo ?? 'PUBLICADA';
    if (tipo === 'PUBLICADA') {
      if (entrada.prestadorId !== undefined || entrada.servicioId !== undefined) throw datosInvalidos(entrada.prestadorId !== undefined ? 'prestadorId' : 'servicioId', 'No aplica a una solicitud publicada.');
      const categoriaId = entrada.categoriaId?.toLowerCase() ?? actual?.categoriaId ?? null;
      if (entrada.categoriaId !== undefined && categoriaId !== actual?.categoriaId) await this.exigirCategoriaActiva(tx, categoriaId!);
      return { tipo, prestadorId: null, prestadorCuentaId: null, servicio: null, categoriaId };
    }
    const cambiaTipo = actual !== null && actual.tipo !== 'DIRIGIDA';
    const prestadorId = entrada.prestadorId?.toLowerCase() ?? (cambiaTipo ? null : actual?.prestadorId) ?? null;
    let prestadorCuentaId = (cambiaTipo ? null : actual?.prestadorCuentaId) ?? null;
    if (prestadorId && (prestadorId !== actual?.prestadorId || cambiaTipo)) prestadorCuentaId = (await this.validarPrestador(tx, cuentaId, prestadorId)).cuentaId;
    if (entrada.servicioId !== undefined && !prestadorId) throw datosInvalidos('prestadorId', 'Indique el prestador del servicio.');
    let servicio = (cambiaTipo || prestadorId !== actual?.prestadorId ? null : actual?.servicio) ?? null;
    if (entrada.servicioId !== undefined && prestadorId && (entrada.servicioId.toLowerCase() !== servicio?.servicioId || prestadorId !== actual?.prestadorId)) {
      servicio = await this.validarServicio(tx, entrada.servicioId.toLowerCase(), prestadorId);
    }
    if (servicio) {
      if (entrada.categoriaId !== undefined && entrada.categoriaId.toLowerCase() !== servicio.categoriaId) throw categoriaNoCoincideConServicio();
      return { tipo, prestadorId, prestadorCuentaId, servicio, categoriaId: servicio.categoriaId };
    }
    const categoriaId = entrada.categoriaId?.toLowerCase() ?? actual?.categoriaId ?? null;
    if (entrada.categoriaId !== undefined && categoriaId !== actual?.categoriaId) await this.exigirCategoriaActiva(tx, categoriaId!);
    return { tipo, prestadorId, prestadorCuentaId, servicio: null, categoriaId };
  }

  private async advertencias(s: Solicitud, bloquea: boolean, tx?: ContextoTransaccion): Promise<Advertencia[]> {
    const lista = evaluarTextoLibre({ descripcion: s.descripcion, medidas: s.medidas }, bloquea);
    if (s.tipo === 'DIRIGIDA' && s.prestadorId) {
      lista.push(...advertenciasDeCobertura({ distrito: s.distrito, categoriaId: s.categoriaId, tieneServicio: s.servicio !== null,
        distritosDelPrestador: await this.d.prestadores.distritosDe(s.prestadorId, tx), especialidadesDelPrestador: await this.d.prestadores.especialidadesDe(s.prestadorId, tx) }));
    }
    return lista;
  }

  /** Confirma la lista final de archivos (FR-347) o, sin lista, deja el conjunto como está. Todo o nada: si algo falla lanza antes de modificar. */
  private async confirmarArchivos(tx: ContextoTransaccion, solicitudId: string, ids: readonly string[] | undefined, despues: Retraso): Promise<readonly ArchivoGuardado[]> {
    await this.d.archivos.caducar(tx, solicitudId);
    if (ids !== undefined) {
      const visibles = await this.d.archivos.listarVisibles(solicitudId, tx);
      const plan = planificarConfirmacion({ solicitudId, ids, encontrados: await this.d.archivos.porIds(ids, tx), confirmadosVigentes: visibles.filter(a => a.estado === 'CONFIRMADO'), ahora: this.ahora() });
      const r = await this.d.archivos.aplicarConfirmacion(tx, solicitudId, plan.confirmar, plan.quitar);
      if (r.clavesAPurgar.length) despues.push(() => this.purgar(r.clavesAPurgar));
    }
    return (await this.d.archivos.listarVisibles(solicitudId, tx)).filter(a => a.estado === 'CONFIRMADO');
  }

  private async cuentasInteresadas(s: Solicitud, tx: ContextoTransaccion): Promise<string[]> {
    const cuentas = new Set(await this.d.interesados.de(s.id, tx));
    if (s.tipo === 'DIRIGIDA' && s.prestadorCuentaId) cuentas.add(s.prestadorCuentaId);
    cuentas.delete(s.clienteCuentaId);
    return [...cuentas].sort();
  }
  private async avisar(s: Solicitud, tx: ContextoTransaccion, tipo: AvisoNegocio['tipo'], versionTrabajo: number | null): Promise<void> {
    const destinatarios = await this.cuentasInteresadas(s, tx);
    await this.d.avisos.registrar(destinatarios.map(cuentaDestinatarioId => ({ cuentaDestinatarioId, tipo, solicitudId: s.id, versionTrabajo })), tx);
  }

  private async cargarPropia(tx: ContextoTransaccion, id: string, cuentaId: string): Promise<Solicitud> {
    const s = await this.d.repositorio.obtener(id, tx, 'actualizacion');
    if (!s || s.clienteCuentaId !== cuentaId) throw recursoNoDisponible();
    return s;
  }

  // ─── Operaciones ────────────────────────────────────────────────────────────────────────────────────────────
  async crear(actor: ActorSolicitudes, clave: string, bruta: EntradaSolicitud): Promise<ResultadoIdempotente> {
    exigirCliente(actor.identidad);
    const entrada = normalizarEntrada(bruta);
    exigirPeriodoCoherente(entrada.fechaDesde ?? null, entrada.fechaHasta ?? null);
    const cuentaId = await this.revalidar(actor);
    return this.escribir({ cuentaId, metodo: 'POST', ruta: '/solicitudes', clave, ids: {}, cuerpo: bruta as unknown as ValorJson }, async (tx, despues) => {
      await this.d.revision.bloquear(tx, 'compartido');
      const refs = await this.resolverReferencias(tx, cuentaId, null, entrada);
      const ahora = this.ahora();
      const s: Solicitud = {
        id: randomUUID(), clienteCuentaId: cuentaId, ...refs, estado: 'BORRADOR', descripcion: entrada.descripcion ?? null, medidas: entrada.medidas ?? null, distrito: entrada.distrito ?? null,
        fechaDesde: entrada.fechaDesde ?? null, fechaHasta: entrada.fechaHasta ?? null, compartirFotografias: entrada.compartirFotografias ?? false, version: 1, versionTrabajo: 0,
        creadaEn: ahora, actualizadaEn: ahora, publicadaEn: null, cerradaEn: null,
      };
      const advertencias = await this.advertencias(s, false, tx);
      await this.d.repositorio.crear(tx, s);
      // Los archivos se cargan sobre una solicitud ya existente: un identificador ajeno o inexistente es un recurso inexistente (FR-347).
      const archivos = await this.confirmarArchivos(tx, s.id, entrada.archivosIds, despues);
      await this.d.repositorio.insertarBitacora(tx, { solicitudId: s.id, actorCuentaId: cuentaId, tipo: 'CREADA', version: 1, versionTrabajo: 0, camposCambiados: [] });
      return { http: 201, cuerpo: vistaPrivada(s, archivos, advertencias) };
    });
  }

  async editar(actor: ActorSolicitudes, clave: string, solicitudIdEntrada: string, bruta: EntradaSolicitud & { readonly version: number }): Promise<ResultadoIdempotente> {
    exigirCliente(actor.identidad);
    const solicitudId = uuidEnMinusculas(solicitudIdEntrada);
    const { version, ...resto } = bruta;
    const entrada = normalizarEntrada(resto);
    const cuentaId = await this.revalidar(actor);
    return this.escribir({ cuentaId, metodo: 'PATCH', ruta: '/solicitudes/{solicitudId}', clave, ids: { solicitudId }, version, cuerpo: bruta as unknown as ValorJson }, async (tx, despues) => {
      await this.d.revision.bloquear(tx, 'compartido');
      const actual = await this.cargarPropia(tx, solicitudId, cuentaId);
      if (actual.estado === 'CERRADA') throw solicitudNoAbierta();
      if (version !== actual.version) throw versionDesactualizada();
      exigirInmutables(actual, entrada);
      const refs = await this.resolverReferencias(tx, cuentaId, actual, entrada);
      const archivosAntes = (await this.d.archivos.listarVisibles(solicitudId, tx)).filter(a => a.estado === 'CONFIRMADO');
      const confirmados = await this.confirmarArchivos(tx, solicitudId, entrada.archivosIds, despues);
      const nuevo: Solicitud = {
        ...actual, ...refs, descripcion: entrada.descripcion ?? actual.descripcion, medidas: entrada.medidas ?? actual.medidas, distrito: entrada.distrito ?? actual.distrito,
        fechaDesde: entrada.fechaDesde ?? actual.fechaDesde, fechaHasta: entrada.fechaHasta ?? actual.fechaHasta, compartirFotografias: entrada.compartirFotografias ?? actual.compartirFotografias,
      };
      exigirPeriodoCoherente(nuevo.fechaDesde, nuevo.fechaHasta);
      if (entrada.fechaDesde !== undefined && entrada.fechaDesde !== actual.fechaDesde) exigirFechaNoAnterior(hoyEnLima(this.ahora()), nuevo.fechaDesde, nuevo.fechaHasta);
      const advertencias = await this.advertencias(nuevo, actual.estado === 'ABIERTA' && nuevo.tipo === 'PUBLICADA', tx);
      const plan = compararEstados(estadoCanonico({ ...actual, archivosIds: archivosAntes.map(a => a.id) }), estadoCanonico({ ...nuevo, archivosIds: confirmados.map(a => a.id) }));
      const efectos = efectosDeEdicion(actual.estado, actual.version, actual.versionTrabajo, plan);
      if (plan.sinCambios) return { http: 200, cuerpo: vistaPrivada(actual, await this.d.archivos.listarVisibles(solicitudId, tx), advertencias) };
      const guardada: Solicitud = { ...nuevo, version: efectos.version, versionTrabajo: efectos.versionTrabajo, actualizadaEn: this.ahora() };
      await this.d.repositorio.guardar(tx, guardada);
      if (efectos.creaVersionDeTrabajo) await this.d.repositorio.insertarVersion(tx, {
        solicitudId, numero: efectos.versionTrabajo, descripcion: guardada.descripcion!, medidas: guardada.medidas, categoriaId: guardada.categoriaId!, distrito: guardada.distrito!,
        fechaDesde: guardada.fechaDesde!, fechaHasta: guardada.fechaHasta, archivos: confirmados.map(metadatosDeVersion), creadaPorCuentaId: cuentaId });
      for (const tipo of efectos.bitacora) {
        await this.d.repositorio.insertarBitacora(tx, { solicitudId, actorCuentaId: cuentaId, tipo, version: efectos.version, versionTrabajo: efectos.versionTrabajo,
          camposCambiados: tipo === 'PRIVACIDAD_CAMBIADA' ? ['compartirFotografias'] : tipo === 'EDITADA' ? plan.relevantes : plan.camposCambiados });
      }
      if (efectos.avisaAInteresados) await this.avisar(guardada, tx, 'SOLICITUD_CAMBIADA', efectos.versionTrabajo);
      return { http: 200, cuerpo: vistaPrivada(guardada, await this.d.archivos.listarVisibles(solicitudId, tx), advertencias) };
    });
  }

  async publicar(actor: ActorSolicitudes, clave: string, solicitudIdEntrada: string, bruta: { readonly version: number; readonly archivosIds?: readonly string[]; readonly compartirFotografias?: boolean }): Promise<ResultadoIdempotente> {
    exigirCliente(actor.identidad);
    const solicitudId = uuidEnMinusculas(solicitudIdEntrada);
    const cuentaId = await this.revalidar(actor);
    return this.escribir({ cuentaId, metodo: 'POST', ruta: '/solicitudes/{solicitudId}/publicacion', clave, ids: { solicitudId }, version: bruta.version, cuerpo: bruta as unknown as ValorJson }, async (tx, despues) => {
      await this.d.revision.bloquear(tx, 'compartido');
      const actual = await this.cargarPropia(tx, solicitudId, cuentaId);
      if (actual.estado === 'CERRADA') throw solicitudNoAbierta();
      if (bruta.version !== actual.version) throw versionDesactualizada();
      if (actual.estado === 'ABIERTA') throw versionDesactualizada();
      const confirmados = await this.confirmarArchivos(tx, solicitudId, bruta.archivosIds, despues);
      const base: Solicitud = { ...actual, compartirFotografias: bruta.compartirFotografias ?? actual.compartirFotografias };
      exigirCompleta(base);
      exigirFechaNoAnterior(hoyEnLima(this.ahora()), base.fechaDesde, base.fechaHasta);
      let servicio = base.servicio;
      if (base.tipo === 'DIRIGIDA') {
        await this.validarPrestador(tx, cuentaId, base.prestadorId!);
        if (servicio) {
          // Se vuelve a evaluar: un servicio que ya no es elegible, o cuya categoría cambió, impide publicar (CA-BOR-04 y CA-BOR-05).
          const vigente = await this.validarServicio(tx, servicio.servicioId, base.prestadorId!);
          if (vigente.categoriaId !== servicio.categoriaId || vigente.categoriaId !== base.categoriaId) throw categoriaNoCoincideConServicio();
          servicio = vigente;
        }
      }
      await this.exigirCategoriaActiva(tx, base.categoriaId!);
      const advertencias = await this.advertencias({ ...base, servicio }, base.tipo === 'PUBLICADA', tx);
      const efectos = efectosDePublicacion(actual.version, base.tipo === 'DIRIGIDA');
      const ahora = this.ahora();
      const publicada: Solicitud = { ...base, servicio, estado: 'ABIERTA', version: efectos.version, versionTrabajo: efectos.versionTrabajo, publicadaEn: ahora, actualizadaEn: ahora };
      await this.d.repositorio.guardar(tx, publicada);
      await this.d.repositorio.insertarVersion(tx, { solicitudId, numero: 1, descripcion: publicada.descripcion!, medidas: publicada.medidas, categoriaId: publicada.categoriaId!, distrito: publicada.distrito!,
        fechaDesde: publicada.fechaDesde!, fechaHasta: publicada.fechaHasta, archivos: confirmados.map(metadatosDeVersion), creadaPorCuentaId: cuentaId });
      await this.d.repositorio.insertarBitacora(tx, { solicitudId, actorCuentaId: cuentaId, tipo: 'PUBLICADA', version: efectos.version, versionTrabajo: 1,
        camposCambiados: base.compartirFotografias !== actual.compartirFotografias ? ['compartirFotografias'] : [] });
      // Solo la primera publicación de una dirigida registra un aviso, para el destinatario (FR-344, caso 1). Una publicada no avisa a nadie.
      if (efectos.avisaAlDestinatario && publicada.prestadorCuentaId) {
        await this.d.avisos.registrar([{ cuentaDestinatarioId: publicada.prestadorCuentaId, tipo: 'SOLICITUD_DIRIGIDA_PUBLICADA', solicitudId, versionTrabajo: 1 }], tx);
      }
      return { http: 200, cuerpo: vistaPrivada(publicada, await this.d.archivos.listarVisibles(solicitudId, tx), advertencias) };
    });
  }

  async cerrar(actor: ActorSolicitudes, clave: string, solicitudIdEntrada: string, bruta: { readonly version: number }): Promise<ResultadoIdempotente> {
    exigirCliente(actor.identidad);
    const solicitudId = uuidEnMinusculas(solicitudIdEntrada);
    const cuentaId = await this.revalidar(actor);
    return this.escribir({ cuentaId, metodo: 'POST', ruta: '/solicitudes/{solicitudId}/cierre', clave, ids: { solicitudId }, version: bruta.version, cuerpo: bruta as unknown as ValorJson }, async (tx, despues) => {
      const actual = await this.cargarPropia(tx, solicitudId, cuentaId);
      if (actual.estado === 'CERRADA') throw solicitudNoAbierta();
      if (bruta.version !== actual.version) throw versionDesactualizada();
      const efectos = efectosDeCierre(actual.estado, actual.version, actual.versionTrabajo);
      const ahora = this.ahora();
      const cerrada: Solicitud = { ...actual, estado: 'CERRADA', version: efectos.version, cerradaEn: ahora, actualizadaEn: ahora };
      // Los archivos no confirmados se descartan en la misma transacción y se registra su purga. Los confirmados se conservan para el historial.
      const claves = await this.d.archivos.descartarNoConfirmados(tx, solicitudId);
      if (claves.length) despues.push(() => this.purgar(claves));
      await this.d.repositorio.guardar(tx, cerrada);
      await this.d.repositorio.insertarBitacora(tx, { solicitudId, actorCuentaId: cuentaId, tipo: 'CERRADA', version: efectos.version, versionTrabajo: efectos.versionTrabajo, camposCambiados: [] });
      if (efectos.avisaAInteresados) await this.avisar(cerrada, tx, 'SOLICITUD_CERRADA', null);
      return { http: 200, cuerpo: vistaPrivada(cerrada, await this.d.archivos.listarVisibles(solicitudId, tx), await this.advertencias(cerrada, false, tx)) };
    });
  }

  // ─── Lecturas ───────────────────────────────────────────────────────────────────────────────────────────────
  async listar(actor: ActorSolicitudes, consulta: { readonly rol?: 'cliente' | 'prestador'; readonly estado?: EstadoSolicitud; readonly pagina?: number; readonly tamano?: number }): Promise<ValorJson> {
    const pagina = consulta.pagina ?? 1; const tamano = consulta.tamano ?? 20;
    const rol = consulta.rol ?? 'cliente';
    let resultado; let conAutoria = new Set<string>();
    if (rol === 'cliente') {
      exigirCliente(actor.identidad);
      resultado = await this.d.repositorio.listarComoCliente(actor.identidad.cuentaId, consulta.estado, pagina, tamano);
    } else {
      exigirPrestadorHabilitado(actor.identidad);
      conAutoria = new Set(await this.d.autoria.solicitudesConNoRetirada(actor.identidad.cuentaId));
      resultado = await this.d.repositorio.listarComoPrestador(actor.identidad.cuentaId, [...conAutoria], consulta.estado, pagina, tamano);
    }
    return {
      elementos: resultado.elementos.map(f => ({
        solicitudId: f.solicitudId, tipo: f.tipo, estado: f.estado, ...(f.categoriaId ? { categoriaId: f.categoriaId } : {}), ...(f.distrito ? { distrito: f.distrito } : {}),
        ...(f.fechaDesde ? { fechaDesde: f.fechaDesde } : {}), ...(descripcionCorta(f.descripcionCorta) ? { descripcionCorta: descripcionCorta(f.descripcionCorta)! } : {}),
        version: f.version, versionTrabajo: f.versionTrabajo, actualizadaEn: f.actualizadaEn.toISOString(),
        ...(rol === 'prestador' ? { titulos: [...(f.esDestinatario ? ['DESTINATARIO'] : []), ...(conAutoria.has(f.solicitudId) ? ['AUTOR_DE_COTIZACION'] : [])] } : {}),
      })),
      total: resultado.total, pagina, tamano,
    };
  }

  async obtener(actor: ActorSolicitudes, solicitudIdEntrada: string): Promise<ValorJson> {
    const solicitudId = uuidEnMinusculas(solicitudIdEntrada);
    const s = await this.d.repositorio.obtener(solicitudId);
    if (!s) throw recursoNoDisponible();
    const cuentaId = actor.identidad.cuentaId;
    if (s.clienteCuentaId === cuentaId) {
      return vistaPrivada(s, await this.d.archivos.listarVisibles(solicitudId), await this.advertencias(s, false));
    }
    const decision = await this.decidirComoPrestador(s, actor);
    if (!decision.puedeLeer) throw recursoNoDisponible();
    const confirmados = (await this.d.archivos.listarVisibles(solicitudId)).filter(a => a.estado === 'CONFIRMADO');
    const titulos = [...(decision.titulos.destinatario ? ['DESTINATARIO'] : []), ...(decision.titulos.compatible ? ['COMPATIBLE'] : []), ...(decision.titulos.autor ? ['AUTOR_DE_COTIZACION'] : [])];
    return {
      solicitudId: s.id, tipo: s.tipo, estado: s.estado, descripcion: s.descripcion!, ...(s.medidas ? { medidas: s.medidas } : {}), categoriaId: s.categoriaId!, distrito: s.distrito!,
      fechaDesde: s.fechaDesde!, ...(s.fechaHasta ? { fechaHasta: s.fechaHasta } : {}),
      fotografias: { hay: confirmados.length > 0, compartidas: decision.fotografias === 'VISIBLES', archivos: decision.fotografias === 'VISIBLES' ? confirmados.map(vistaDeArchivo) : [] },
      versionTrabajo: s.versionTrabajo, titulos,
    };
  }

  /** La política única decide. La compatibilidad (título b) la aporta la historia de oportunidades; aquí se resuelven los títulos de destinatario y de autor. */
  async decidirComoPrestador(s: Solicitud, actor: ActorSolicitudes) {
    const tienePerfilPrestador = actor.identidad.perfiles.includes('prestador');
    const autorNoRetirado = tienePerfilPrestador && s.estado !== 'BORRADOR' ? await this.d.autoria.tieneNoRetirada(s.id, actor.identidad.cuentaId) : false;
    return decidirAcceso({
      solicitud: { tipo: s.tipo, estado: s.estado, clienteCuentaId: s.clienteCuentaId, prestadorCuentaId: s.prestadorCuentaId, compartirFotografias: s.compartirFotografias },
      actor: { cuentaId: actor.identidad.cuentaId, tienePerfilPrestador }, compatible: false, autorNoRetirado,
    });
  }

  async historial(actor: ActorSolicitudes, solicitudIdEntrada: string, tipo: 'versiones' | 'bitacora', pagina = 1, tamano = 20): Promise<ValorJson> {
    const solicitudId = uuidEnMinusculas(solicitudIdEntrada);
    const s = await this.d.repositorio.obtener(solicitudId);
    if (!s) throw recursoNoDisponible();
    const esDueno = s.clienteCuentaId === actor.identidad.cuentaId;
    const decision = esDueno ? null : await this.decidirComoPrestador(s, actor);
    if (!esDueno && !decision?.puedeLeer) throw recursoNoDisponible();
    if (tipo === 'bitacora') {
      // Solo el cliente dueño consulta la bitácora; cualquier otro, incluido un prestador autorizado para las versiones, recibe «inexistente».
      if (!esDueno) throw recursoNoDisponible();
      const p = await this.d.repositorio.bitacora(solicitudId, pagina, tamano);
      return { tipo: 'bitacora', elementos: p.elementos.map(e => ({ entradaId: e.entradaId, ocurridaEn: e.ocurridaEn.toISOString(), tipo: e.tipo, actorCuentaId: e.actorCuentaId,
        version: e.version, versionTrabajo: e.versionTrabajo, camposCambiados: [...e.camposCambiados] })), total: p.total, pagina, tamano };
    }
    if (!esDueno && !decision?.puedeVerVersiones) throw recursoNoDisponible();
    const verArchivos = esDueno || decision?.fotografias === 'VISIBLES';
    const p = await this.d.repositorio.versiones(solicitudId, pagina, tamano);
    const estados = new Map((await this.d.archivos.porIds(p.elementos.flatMap(v => v.archivos.map(a => a.archivoId)))).map(a => [a.id, a.estado]));
    return { tipo: 'versiones', elementos: p.elementos.map(v => ({
      numero: v.numero, creadaEn: v.creadaEn.toISOString(),
      contenido: { descripcion: v.descripcion, ...(v.medidas ? { medidas: v.medidas } : {}), categoriaId: v.categoriaId, distrito: v.distrito, fechaDesde: v.fechaDesde, ...(v.fechaHasta ? { fechaHasta: v.fechaHasta } : {}),
        // Un archivo se muestra como «retirado» cuando ya no está confirmado. Un prestador sin permiso de fotografías no recibe ni sus metadatos.
        archivos: verArchivos ? v.archivos.map(a => ({ archivoId: a.archivoId, retirado: estados.get(a.archivoId) !== 'CONFIRMADO', tipoMime: a.tipoMime, bytes: a.bytes })) : [] },
    })), total: p.total, pagina, tamano };
  }
}