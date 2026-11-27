import type { Pagina } from './contratos.js';

export type TipoCotizacion = 'ESTIMADA' | 'DEFINITIVA';
/** Estado efectivo con la prioridad RETIRADA > VENCIDA > PENDIENTE_REVISION > VIGENTE. */
export type EstadoCotizacion = 'RETIRADA' | 'VENCIDA' | 'PENDIENTE_REVISION' | 'VIGENTE';
export type MotivoNoAceptable = 'RETIRADA' | 'VENCIDA' | 'PENDIENTE_REVISION' | 'SOLICITUD_CERRADA';

/** Cuerpo de una versión de cotización. Los campos no informados se omiten. */
export interface DatosCotizacion {
  tipo: TipoCotizacion;
  alcance: string;
  exclusiones?: string;
  materiales?: string;
  manoDeObra?: string;
  /** Céntimos de PEN. */
  precioCentimos?: number;
  formaCalculo?: string;
  plazoDias?: number;
  /** Instante en UTC (ISO 8601). */
  vigenteHasta: string;
  condicionesPago?: string;
}

export interface VersionDeCotizacion extends DatosCotizacion {
  numero: number;
  versionTrabajoSolicitud: number;
  creadaEn: string;
  reemplazada: boolean;
}

export interface Cotizacion {
  cotizacionId: string;
  solicitudId: string;
  prestadorId: string;
  /** Solo para el cliente dueño de la solicitud. */
  prestadorNombrePublico?: string;
  estado: EstadoCotizacion;
  vencida: boolean;
  requiereRevision: boolean;
  solicitudCerrada: boolean;
  motivosNoAceptable: MotivoNoAceptable[];
  /** Versión de control: se envía al actualizar o retirar. */
  version: number;
  versionVigente: VersionDeCotizacion;
  creadaEn: string;
  retiradaEn?: string;
}

export interface CotizacionDetalle extends Cotizacion {
  versiones: VersionDeCotizacion[];
}

export type AutorDeAclaracion = 'CLIENTE' | 'PRESTADOR';
/** Mensaje de un hilo de aclaraciones: texto plano, inmutable, asociado a la cotización. */
export interface Aclaracion {
  aclaracionId: string;
  numero: number;
  autor: AutorDeAclaracion;
  texto: string;
  versionCotizacion: number;
  creadaEn: string;
}

export interface ApiCotizaciones {
  enviar(solicitudId: string, datos: DatosCotizacion & { versionTrabajoSolicitud: number }, clave: string): Promise<Cotizacion>;
  actualizar(cotizacionId: string, datos: DatosCotizacion & { versionTrabajoSolicitud: number; versionCotizacion: number }, clave: string): Promise<Cotizacion>;
  retirar(cotizacionId: string, versionCotizacion: number, clave: string): Promise<Cotizacion>;
  obtener(cotizacionId: string): Promise<CotizacionDetalle>;
  mias(pagina: number): Promise<Pagina<Cotizacion>>;
  /** Cliente dueño: cotizaciones de su solicitud, en orden de llegada. Con `ids` (hasta 10), las que se comparan. */
  deSolicitud(solicitudId: string, pagina: number, ids?: readonly string[]): Promise<Pagina<Cotizacion>>;
  aclaraciones(cotizacionId: string, pagina: number): Promise<Pagina<Aclaracion>>;
  enviarAclaracion(cotizacionId: string, texto: string, clave: string): Promise<Aclaracion>;
}
