import { randomUUID } from 'node:crypto';
import type { Idempotencia002, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import { conReintentoDeConcurrencia } from '../../../compartido/aplicacion/reintento-concurrencia.js';
import type { ContextoTransaccion, ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import {
  evaluarCotizacion, exigirCotizacionCompleta, normalizarDatosCotizacion, type DatosCotizacion, type EvaluacionDeCotizacion, type TipoCotizacion,
} from '../dominio/cotizacion.js';
import {
  cotizacionPropia, cotizacionRetirada, fechaNoValida, recursoNoDisponible, solicitudModificada, solicitudNoAbierta, versionDesactualizada,
} from '../dominio/errores.js';
import { autorDelHilo, exigirHiloAbierto, normalizarTextoDeAclaracion, numeroDelSiguienteMensaje, type AutorDeAclaracion } from '../dominio/aclaracion.js';
import { idsDeComparacion } from '../dominio/comparacion.js';
import type { CoberturasDePrestador, IdentidadDeCotizador, IdentidadesDeCotizaciones, NombresPublicosDePrestadores, PerfilesDePrestador, TraducirEscrituraDeCotizacion } from './puertos/entorno.js';
import type { CotizacionGuardada, RepositorioCotizaciones, VersionGuardada } from './puertos/repositorio.js';
import type { AclaracionGuardada, RepositorioAclaraciones } from './puertos/repositorio-aclaraciones.js';
import { coincideConCobertura, tituloParaCotizar, type LecturasDeSolicitudes, type ResumenDeSolicitud } from './puertos/solicitudes.js';

export interface ActorCotizaciones { readonly token: string; readonly identidad: IdentidadDeCotizador }

/** Cuerpo de `C003CotizacionEnvio`. La vigencia llega como texto ISO 8601 y se convierte aquí. */
export interface EntradaDeCotizacion {
  readonly tipo: TipoCotizacion;
  readonly alcance: string;
  readonly exclusiones?: string;
  readonly materiales?: string;
  readonly manoDeObra?: string;
  readonly precioCentimos?: number;
  readonly formaCalculo?: string;
  readonly plazoDias?: number;
  readonly vigenteHasta: string;
  readonly condicionesPago?: string;
}
export type EnvioDeCotizacion = EntradaDeCotizacion & { readonly versionTrabajoSolicitud: number };
export type ActualizacionDeCotizacion = EnvioDeCotizacion & { readonly versionCotizacion: number };

export interface DependenciasCotizaciones {
  readonly repositorio: RepositorioCotizaciones;
  readonly solicitudes: LecturasDeSolicitudes;
  readonly idempotencia: Idempotencia002;
  readonly identidades: IdentidadesDeCotizaciones;
  readonly prestadores: PerfilesDePrestador;
  readonly coberturas: CoberturasDePrestador;
  readonly aclaraciones: RepositorioAclaraciones;
  readonly nombres: NombresPublicosDePrestadores;
  readonly traducirEscritura: TraducirEscrituraDeCotizacion;
  readonly ahora?: () => Date;
}

const exigirPrestador = (identidad: IdentidadDeCotizador): void => {
  if (!identidad.perfiles.includes('prestador')) throw new ErrorAplicacion(403, 'SIN_PERMISO', 'Se requiere un perfil de prestador habilitado.');
};

function datosDe(entrada: EntradaDeCotizacion): DatosCotizacion {
  const vigenteHasta = new Date(entrada.vigenteHasta);
  if (Number.isNaN(vigenteHasta.getTime())) throw fechaNoValida('vigenteHasta');
  return normalizarDatosCotizacion({
    tipo: entrada.tipo, alcance: entrada.alcance, vigenteHasta, exclusiones: entrada.exclusiones, materiales: entrada.materiales, manoDeObra: entrada.manoDeObra,
    precioCentimos: entrada.precioCentimos, formaCalculo: entrada.formaCalculo, plazoDias: entrada.plazoDias, condicionesPago: entrada.condicionesPago,
  });
}

function vistaDeVersion(v: VersionGuardada, reemplazada: boolean): { [campo: string]: ValorJson } {
  const d = v.datos;
  return {
    numero: v.numero, versionTrabajoSolicitud: v.versionTrabajoSolicitud, tipo: d.tipo, alcance: d.alcance,
    ...(d.exclusiones ? { exclusiones: d.exclusiones } : {}), ...(d.materiales ? { materiales: d.materiales } : {}), ...(d.manoDeObra ? { manoDeObra: d.manoDeObra } : {}),
    ...(d.precioCentimos === undefined ? {} : { precioCentimos: d.precioCentimos }), ...(d.formaCalculo ? { formaCalculo: d.formaCalculo } : {}),
    ...(d.plazoDias === undefined ? {} : { plazoDias: d.plazoDias }), vigenteHasta: d.vigenteHasta.toISOString(),
    ...(d.condicionesPago ? { condicionesPago: d.condicionesPago } : {}), creadaEn: v.creadaEn.toISOString(), reemplazada,
  };
}

/** Evalúa el estado con la hora oficial del sistema y la solicitud leída. Si la solicitud no se pudo leer, no se afirma cierre ni revisión. */
export function evaluarContraSolicitud(c: CotizacionGuardada, solicitud: ResumenDeSolicitud | undefined, ahora: Date): EvaluacionDeCotizacion {
  return evaluarCotizacion({
    retirada: c.estado === 'RETIRADA', vigenteHasta: c.vigente.datos.vigenteHasta, versionTrabajoCotizada: c.vigente.versionTrabajoSolicitud,
    versionTrabajoSolicitud: solicitud?.versionTrabajo ?? c.vigente.versionTrabajoSolicitud, solicitudCerrada: solicitud?.estado === 'CERRADA', ahora,
  });
}

/** Vista de `C003Aclaracion`. No incluye la cuenta del autor: solo su rol. */
export function vistaDeAclaracion(a: AclaracionGuardada): { [campo: string]: ValorJson } {
  return { aclaracionId: a.id, numero: a.numero, autor: a.autor, texto: a.texto, versionCotizacion: a.versionCotizacion, creadaEn: a.creadaEn.toISOString() };
}

/**
 * Vista de `C003Cotizacion`. El nombre público solo se incluye cuando el llamador comprobó el título de acceso (cliente dueño de la solicitud). Nunca incluye la
 * cuenta del prestador.
 */
export function vistaDeCotizacion(c: CotizacionGuardada, solicitud: ResumenDeSolicitud | undefined, ahora: Date, nombrePublico?: string): { [campo: string]: ValorJson } {
  const e = evaluarContraSolicitud(c, solicitud, ahora);
  return {
    cotizacionId: c.id, solicitudId: c.solicitudId, prestadorId: c.prestadorId, ...(nombrePublico ? { prestadorNombrePublico: nombrePublico } : {}), estado: e.estado, vencida: e.vencida, requiereRevision: e.requiereRevision,
    solicitudCerrada: e.solicitudCerrada, motivosNoAceptable: [...e.motivosNoAceptable], version: c.version, versionVigente: vistaDeVersion(c.vigente, false),
    creadaEn: c.creadaEn.toISOString(), ...(c.retiradaEn ? { retiradaEn: c.retiradaEn.toISOString() } : {}),
  };
}

/**
 * Casos de uso de HU10 (RF17 y RF18). Orden único de bloqueos del plan: idempotencia (dentro de `ejecutar002`) → revisión de Catálogo (compartida) → solicitud
 * (`FOR SHARE`) → cotización (`FOR UPDATE`) → filas hijas. Las comprobaciones de estado y de versión se hacen con las filas ya bloqueadas. La autorización y la
 * privacidad se deciden aquí, nunca en la interfaz: un recurso sin título responde como inexistente.
 */
export class CotizacionesServicio {
  constructor(private readonly d: DependenciasCotizaciones) {}
  private ahora(): Date { return this.d.ahora?.() ?? new Date(); }

  /** Revalida la sesión con una conexión libre del pool, ANTES de abrir la transacción de escritura. */
  private async revalidar(actor: ActorCotizaciones, exigirPerfil = true): Promise<string> {
    const vigente = await this.d.identidades.exigir(actor.token);
    if (exigirPerfil) exigirPrestador(vigente);
    return vigente.cuentaId;
  }

  private async escribir(p: { cuentaId: string; ruta: string; clave: string; ids: Record<string, string>; version?: number; cuerpo: ValorJson },
    trabajo: (tx: ContextoTransaccion) => Promise<ResultadoIdempotente>): Promise<ResultadoIdempotente> {
    return conReintentoDeConcurrencia(() => this.d.idempotencia.ejecutar002({
      actor: p.cuentaId, metodo: 'POST', rutaLogica: p.ruta, clave: p.clave, ids: p.ids, ...(p.version === undefined ? {} : { version: p.version }), cuerpo: p.cuerpo,
      autorizar: async () => p.cuentaId,
    }, tx => this.d.traducirEscritura(() => trabajo(tx))));
  }

  /** Cotización propia con la solicitud bloqueada `FOR SHARE` y la cotización `FOR UPDATE`. Lo ajeno responde como inexistente. */
  private async bloquearPropia(tx: ContextoTransaccion, cotizacionId: string, cuentaId: string): Promise<{ cotizacion: CotizacionGuardada; solicitud: ResumenDeSolicitud }> {
    const referencia = await this.d.repositorio.referencia(cotizacionId, tx);
    if (!referencia || referencia.prestadorCuentaId !== cuentaId) throw recursoNoDisponible();
    const solicitud = await this.d.solicitudes.bloquearCompartido(referencia.solicitudId, tx);
    if (!solicitud) throw recursoNoDisponible();
    const cotizacion = await this.d.repositorio.bloquear(cotizacionId, tx);
    if (!cotizacion) throw recursoNoDisponible();
    return { cotizacion, solicitud };
  }

  // ─── Operaciones ──────────────────────────────────────────────────────────────────────────────────────────────
  async enviar(actor: ActorCotizaciones, clave: string, solicitudIdEntrada: string, cuerpo: EnvioDeCotizacion): Promise<ResultadoIdempotente> {
    const solicitudId = uuidEnMinusculas(solicitudIdEntrada);
    const cuentaId = await this.revalidar(actor);
    return this.escribir({ cuentaId, ruta: '/solicitudes/{solicitudId}/cotizaciones', clave, ids: { solicitudId }, cuerpo: cuerpo as unknown as ValorJson }, async tx => {
      if (await this.d.solicitudes.esClienteDe(solicitudId, cuentaId, tx)) throw cotizacionPropia();
      const perfil = await this.d.prestadores.perfilDeCuenta(cuentaId, tx);
      if (!perfil) throw recursoNoDisponible();
      const cobertura = await this.d.coberturas.cargar(perfil.prestadorId, tx);
      const solicitud = await this.d.solicitudes.bloquearCompartido(solicitudId, tx);
      if (!solicitud || solicitud.estado === 'BORRADOR') throw recursoNoDisponible();
      const titulo = tituloParaCotizar({
        tipo: solicitud.tipo, esDestinatario: solicitud.prestadorId !== null && solicitud.prestadorId === perfil.prestadorId,
        coincideConCobertura: coincideConCobertura({ categoriaId: solicitud.categoriaId, distrito: solicitud.distritoCodigo }, cobertura.categorias, cobertura.distritos),
      });
      if (!titulo) throw recursoNoDisponible();
      if (solicitud.estado !== 'ABIERTA') throw solicitudNoAbierta();
      if (cuerpo.versionTrabajoSolicitud !== solicitud.versionTrabajo) throw solicitudModificada();
      const datos = datosDe(cuerpo);
      const ahora = this.ahora();
      exigirCotizacionCompleta(datos, ahora);
      const id = randomUUID();
      await this.d.repositorio.insertar(tx, { id, solicitudId, prestadorId: perfil.prestadorId, prestadorCuentaId: cuentaId }, { versionTrabajoSolicitud: solicitud.versionTrabajo, datos });
      const creada = await this.d.repositorio.obtener(id, tx);
      return { http: 201, cuerpo: vistaDeCotizacion(creada!, solicitud, ahora) };
    });
  }

  async actualizar(actor: ActorCotizaciones, clave: string, cotizacionIdEntrada: string, cuerpo: ActualizacionDeCotizacion): Promise<ResultadoIdempotente> {
    const cotizacionId = uuidEnMinusculas(cotizacionIdEntrada);
    const cuentaId = await this.revalidar(actor);
    return this.escribir({ cuentaId, ruta: '/cotizaciones/{cotizacionId}/versiones', clave, ids: { cotizacionId }, version: cuerpo.versionCotizacion, cuerpo: cuerpo as unknown as ValorJson }, async tx => {
      const { cotizacion, solicitud } = await this.bloquearPropia(tx, cotizacionId, cuentaId);
      if (cotizacion.estado === 'RETIRADA') throw cotizacionRetirada();
      if (cuerpo.versionCotizacion !== cotizacion.version) throw versionDesactualizada();
      // Perder la compatibilidad no impide actualizar (FR-326): el título de autor lo conserva. Una solicitud cerrada rechaza toda actualización (FR-311).
      if (solicitud.estado !== 'ABIERTA') throw solicitudNoAbierta();
      if (cuerpo.versionTrabajoSolicitud !== solicitud.versionTrabajo) throw solicitudModificada();
      const datos = datosDe(cuerpo);
      const ahora = this.ahora();
      exigirCotizacionCompleta(datos, ahora);
      await this.d.repositorio.agregarVersion(tx, cotizacionId, { versionTrabajoSolicitud: solicitud.versionTrabajo, datos });
      const actualizada = await this.d.repositorio.obtener(cotizacionId, tx);
      return { http: 201, cuerpo: vistaDeCotizacion(actualizada!, solicitud, ahora) };
    });
  }

  async retirar(actor: ActorCotizaciones, clave: string, cotizacionIdEntrada: string, cuerpo: { readonly versionCotizacion: number }): Promise<ResultadoIdempotente> {
    const cotizacionId = uuidEnMinusculas(cotizacionIdEntrada);
    const cuentaId = await this.revalidar(actor);
    return this.escribir({ cuentaId, ruta: '/cotizaciones/{cotizacionId}/retiro', clave, ids: { cotizacionId }, version: cuerpo.versionCotizacion, cuerpo: cuerpo as unknown as ValorJson }, async tx => {
      const { cotizacion, solicitud } = await this.bloquearPropia(tx, cotizacionId, cuentaId);
      if (cotizacion.estado === 'RETIRADA') throw cotizacionRetirada();
      if (cuerpo.versionCotizacion !== cotizacion.version) throw versionDesactualizada();
      if (solicitud.estado !== 'ABIERTA') throw solicitudNoAbierta();
      await this.d.repositorio.retirar(tx, cotizacionId);
      const retirada = await this.d.repositorio.obtener(cotizacionId, tx);
      return { http: 200, cuerpo: vistaDeCotizacion(retirada!, solicitud, this.ahora()) };
    });
  }

  // ─── Lecturas ─────────────────────────────────────────────────────────────────────────────────────────────────
  /** Las cotizaciones propias, paginadas, con una sola lectura de las solicitudes de la página (sin consultas por elemento). */
  async listarMias(actor: ActorCotizaciones, pagina = 1, tamano = 20): Promise<ValorJson> {
    exigirPrestador(actor.identidad);
    const resultado = await this.d.repositorio.listarDeCuenta(actor.identidad.cuentaId, pagina, tamano);
    const solicitudes = resultado.elementos.length ? await this.d.solicitudes.resumenes(resultado.elementos.map(c => c.solicitudId)) : new Map<string, ResumenDeSolicitud>();
    const ahora = this.ahora();
    return { elementos: resultado.elementos.map(c => vistaDeCotizacion(c, solicitudes.get(c.solicitudId), ahora)), total: resultado.total, pagina, tamano };
  }

  /** Detalle con todas las versiones. Lo leen el prestador autor y el cliente dueño de la solicitud; cualquier otra cuenta recibe «inexistente». */
  async obtener(actor: ActorCotizaciones, cotizacionIdEntrada: string): Promise<ValorJson> {
    const cotizacionId = uuidEnMinusculas(cotizacionIdEntrada);
    const cuentaId = actor.identidad.cuentaId;
    const referencia = await this.d.repositorio.referencia(cotizacionId);
    if (!referencia) throw recursoNoDisponible();
    const esAutor = referencia.prestadorCuentaId === cuentaId;
    const esDueno = !esAutor && await this.d.solicitudes.esClienteDe(referencia.solicitudId, cuentaId);
    if (!esAutor && !esDueno) throw recursoNoDisponible();
    const [cotizacion, versiones, solicitudes] = await Promise.all([
      this.d.repositorio.obtener(cotizacionId), this.d.repositorio.versiones(cotizacionId), this.d.solicitudes.resumenes([referencia.solicitudId]),
    ]);
    if (!cotizacion) throw recursoNoDisponible();
    // El cliente dueño ve el nombre público del autor de las cotizaciones de SU solicitud; el autor no necesita el suyo.
    const nombre = esDueno ? (await this.d.nombres.nombresPublicos([cotizacion.prestadorId])).get(cotizacion.prestadorId) : undefined;
    const vista = vistaDeCotizacion(cotizacion, solicitudes.get(referencia.solicitudId), this.ahora(), nombre);
    return { ...vista, versiones: versiones.map(v => vistaDeVersion(v, v.numero !== cotizacion.vigente.numero)) };
  }

  // ─── HU11: lista y comparación del cliente dueño, y aclaraciones ──────────────────────────────────────────────────
  /**
   * Cotizaciones de una solicitud para su cliente dueño, en orden de llegada y sin clasificación de «mejor». Con `ids` (hasta 10) devuelve esas cotizaciones para
   * compararlas. Cualquier otra cuenta, y cualquier identificador que no sea de esta solicitud, responde como inexistente. Presupuesto constante de sentencias:
   * titularidad, página, solicitud y nombres públicos, uno por lectura masiva e independiente del tamaño de página.
   */
  async listarDeSolicitud(actor: ActorCotizaciones, solicitudIdEntrada: string, consulta: { readonly ids?: string; readonly pagina?: number; readonly tamano?: number }): Promise<ValorJson> {
    const solicitudId = uuidEnMinusculas(solicitudIdEntrada);
    if (!(await this.d.solicitudes.esClienteDe(solicitudId, actor.identidad.cuentaId))) throw recursoNoDisponible();
    let pagina = consulta.pagina ?? 1; let tamano = consulta.tamano ?? 20;
    let elementos: readonly CotizacionGuardada[]; let total: number;
    if (consulta.ids !== undefined) {
      const ids = idsDeComparacion(consulta.ids);
      const halladas = new Map((await this.d.repositorio.obtenerVarias(solicitudId, ids)).map(c => [c.id, c]));
      if (halladas.size !== ids.length) throw recursoNoDisponible();
      elementos = ids.map(id => halladas.get(id)!); total = ids.length; pagina = 1; tamano = Math.max(tamano, ids.length);
    } else {
      ({ elementos, total } = await this.d.repositorio.listarDeSolicitud(solicitudId, pagina, tamano));
    }
    if (!elementos.length) return { elementos: [], total, pagina, tamano };
    const [solicitudes, nombres] = await Promise.all([
      this.d.solicitudes.resumenes([solicitudId]), this.d.nombres.nombresPublicos([...new Set(elementos.map(c => c.prestadorId))]),
    ]);
    const ahora = this.ahora();
    return { elementos: elementos.map(c => vistaDeCotizacion(c, solicitudes.get(solicitudId), ahora, nombres.get(c.prestadorId))), total, pagina, tamano };
  }

  /** Participante del hilo: el cliente dueño o el prestador autor. Cualquier otra cuenta, o una cotización inexistente, responde igual (404). */
  private async participante(cotizacionId: string, cuentaId: string, tx?: ContextoTransaccion): Promise<{ readonly solicitudId: string; readonly autor: AutorDeAclaracion }> {
    const referencia = await this.d.repositorio.referencia(cotizacionId, tx);
    if (!referencia) throw recursoNoDisponible();
    const esAutorDeLaCotizacion = referencia.prestadorCuentaId === cuentaId;
    const esDuenoDeLaSolicitud = !esAutorDeLaCotizacion && await this.d.solicitudes.esClienteDe(referencia.solicitudId, cuentaId, tx);
    const autor = autorDelHilo({ esDuenoDeLaSolicitud, esAutorDeLaCotizacion });
    if (!autor) throw recursoNoDisponible();
    return { solicitudId: referencia.solicitudId, autor };
  }

  /** Mensajes del hilo, por número ascendente. Se leen también con la cotización retirada o la solicitud cerrada (CA-ACL-03). */
  async listarAclaraciones(actor: ActorCotizaciones, cotizacionIdEntrada: string, pagina = 1, tamano = 20): Promise<ValorJson> {
    const cotizacionId = uuidEnMinusculas(cotizacionIdEntrada);
    await this.participante(cotizacionId, actor.identidad.cuentaId);
    const r = await this.d.aclaraciones.listar(cotizacionId, pagina, tamano);
    return { elementos: r.elementos.map(vistaDeAclaracion), total: r.total, pagina, tamano };
  }

  /**
   * Escribe un mensaje en el hilo. Orden de bloqueos: solicitud `FOR SHARE` y cotización `FOR UPDATE`, que además serializa la numeración (el mensaje 21 recibe 422 aunque
   * lleguen dos a la vez). Con la cotización retirada o la solicitud cerrada el hilo es de solo lectura.
   */
  async enviarAclaracion(actor: ActorCotizaciones, clave: string, cotizacionIdEntrada: string, cuerpo: { readonly texto: string }): Promise<ResultadoIdempotente> {
    const cotizacionId = uuidEnMinusculas(cotizacionIdEntrada);
    const identidad = await this.d.identidades.exigir(actor.token);
    const cuentaId = identidad.cuentaId;
    return this.escribir({ cuentaId, ruta: '/cotizaciones/{cotizacionId}/aclaraciones', clave, ids: { cotizacionId }, cuerpo: cuerpo as unknown as ValorJson }, async tx => {
      const { solicitudId, autor } = await this.participante(cotizacionId, cuentaId, tx);
      const perfil = autor === 'CLIENTE' ? 'cliente' : 'prestador';
      if (!identidad.perfiles.includes(perfil)) throw new ErrorAplicacion(403, 'SIN_PERMISO', `Se requiere un perfil de ${perfil} habilitado.`);
      const solicitud = await this.d.solicitudes.bloquearCompartido(solicitudId, tx);
      const cotizacion = await this.d.repositorio.bloquear(cotizacionId, tx);
      if (!solicitud || !cotizacion) throw recursoNoDisponible();
      exigirHiloAbierto({ cotizacionRetirada: cotizacion.estado === 'RETIRADA', solicitudAbierta: solicitud.estado === 'ABIERTA' });
      const texto = normalizarTextoDeAclaracion(cuerpo.texto);
      const numero = numeroDelSiguienteMensaje(await this.d.aclaraciones.contar(cotizacionId, tx));
      const creada = await this.d.aclaraciones.insertar(tx, { id: randomUUID(), cotizacionId, numero, autorCuentaId: cuentaId, autor, texto, versionCotizacion: cotizacion.vigente.numero });
      return { http: 201, cuerpo: vistaDeAclaracion(creada) };
    });
  }
}
