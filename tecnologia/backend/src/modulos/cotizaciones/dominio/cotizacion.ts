import { cotizacionIncompleta, datosInvalidos, fechaNoValida } from './errores.js';

/**
 * Reglas puras de una cotización (FR-337 a FR-339, RF17). Sin framework, base de datos ni otros módulos. Las versiones de una cotización son inmutables:
 * este módulo solo valida los datos de una versión y deriva su estado efectivo; nada se modifica en el sitio.
 */

export type TipoCotizacion = 'ESTIMADA' | 'DEFINITIVA';
/** Estado efectivo con la prioridad RETIRADA > VENCIDA > PENDIENTE_REVISION > VIGENTE. Los estados de la 004 no existen aquí. */
export type EstadoCotizacion = 'RETIRADA' | 'VENCIDA' | 'PENDIENTE_REVISION' | 'VIGENTE';
export type MotivoNoAceptable = 'RETIRADA' | 'VENCIDA' | 'PENDIENTE_REVISION' | 'SOLICITUD_CERRADA';

/** Mayor entero que JSON representa sin pérdida: el único máximo del precio (sin máximo de negocio). */
export const PRECIO_MAXIMO_CENTIMOS = Number.MAX_SAFE_INTEGER;
const PLAZO_MAXIMO_DIAS = 2_147_483_647;

export interface DatosCotizacion {
  readonly tipo: TipoCotizacion;
  readonly alcance: string;
  readonly exclusiones?: string | undefined;
  readonly materiales?: string | undefined;
  readonly manoDeObra?: string | undefined;
  /** Céntimos de PEN. */
  readonly precioCentimos?: number | undefined;
  readonly formaCalculo?: string | undefined;
  readonly plazoDias?: number | undefined;
  readonly vigenteHasta: Date;
  readonly condicionesPago?: string | undefined;
}

const textosOpcionales = ['exclusiones', 'materiales', 'manoDeObra', 'formaCalculo', 'condicionesPago'] as const;

/** Recorta los textos y trata un texto vacío como no informado (se muestra «No indicado»). */
export function normalizarDatosCotizacion(datos: DatosCotizacion): DatosCotizacion {
  const salida: { -readonly [K in keyof DatosCotizacion]: DatosCotizacion[K] } = { ...datos, alcance: datos.alcance.trim() };
  for (const campo of textosOpcionales) {
    const valor = datos[campo]?.trim();
    if (valor) salida[campo] = valor; else delete salida[campo];
  }
  for (const campo of ['precioCentimos', 'plazoDias'] as const) if (datos[campo] === undefined) delete salida[campo];
  return salida;
}

const informado = (valor: unknown): boolean => valor !== undefined && valor !== null && !(typeof valor === 'string' && valor.trim() === '');

/**
 * Exige los datos de una versión. Estimada: alcance, vigencia y precio o forma de cálculo. Definitiva: además precio, plazo y condiciones de pago.
 * Informa todos los campos que faltan a la vez (`COTIZACION_INCOMPLETA`), sin reproducir valores. Después valida precio, plazo y vigencia.
 */
export function exigirCotizacionCompleta(datos: DatosCotizacion, ahora: Date): void {
  const faltan: string[] = [];
  if (!informado(datos.alcance)) faltan.push('alcance');
  if (datos.tipo === 'ESTIMADA') {
    if (!informado(datos.precioCentimos) && !informado(datos.formaCalculo)) faltan.push('precioCentimos', 'formaCalculo');
  } else {
    if (!informado(datos.precioCentimos)) faltan.push('precioCentimos');
    if (!informado(datos.plazoDias)) faltan.push('plazoDias');
    if (!informado(datos.condicionesPago)) faltan.push('condicionesPago');
  }
  if (faltan.length) throw cotizacionIncompleta(faltan);
  if (datos.precioCentimos !== undefined && (!Number.isSafeInteger(datos.precioCentimos) || datos.precioCentimos < 1 || datos.precioCentimos > PRECIO_MAXIMO_CENTIMOS)) {
    throw datosInvalidos('precioCentimos', 'Indique un entero mayor que cero, en céntimos de PEN.');
  }
  if (datos.plazoDias !== undefined && (!Number.isInteger(datos.plazoDias) || datos.plazoDias < 1 || datos.plazoDias > PLAZO_MAXIMO_DIAS)) {
    throw datosInvalidos('plazoDias', 'Indique un número entero de días mayor que cero.');
  }
  if (Number.isNaN(datos.vigenteHasta.getTime()) || datos.vigenteHasta.getTime() <= ahora.getTime()) throw fechaNoValida('vigenteHasta');
}

export interface EntradaDeEstado {
  readonly retirada: boolean;
  readonly vigenteHasta: Date;
  /** Versión de trabajo de la solicitud sobre la que se elaboró la versión vigente de la cotización. */
  readonly versionTrabajoCotizada: number;
  /** Versión de trabajo vigente de la solicitud. */
  readonly versionTrabajoSolicitud: number;
  readonly solicitudCerrada: boolean;
  readonly ahora: Date;
}

export interface EvaluacionDeCotizacion {
  readonly estado: EstadoCotizacion;
  readonly vencida: boolean;
  readonly requiereRevision: boolean;
  readonly solicitudCerrada: boolean;
  readonly motivosNoAceptable: readonly MotivoNoAceptable[];
}

/** VENCIDA cuando la vigencia es menor o igual a la hora oficial. */
export const estaVencida = (vigenteHasta: Date, ahora: Date): boolean => vigenteHasta.getTime() <= ahora.getTime();

export function estadoEfectivo(e: EntradaDeEstado): EstadoCotizacion {
  if (e.retirada) return 'RETIRADA';
  if (estaVencida(e.vigenteHasta, e.ahora)) return 'VENCIDA';
  if (e.versionTrabajoCotizada < e.versionTrabajoSolicitud) return 'PENDIENTE_REVISION';
  return 'VIGENTE';
}

/** Estado efectivo, indicadores y motivos de no aceptabilidad. Vacío no significa «aceptable»: la aceptación es de la 004. */
export function evaluarCotizacion(e: EntradaDeEstado): EvaluacionDeCotizacion {
  const vencida = estaVencida(e.vigenteHasta, e.ahora);
  const requiereRevision = e.versionTrabajoCotizada < e.versionTrabajoSolicitud;
  const motivosNoAceptable: MotivoNoAceptable[] = [
    ...(e.retirada ? ['RETIRADA' as const] : []), ...(vencida ? ['VENCIDA' as const] : []),
    ...(requiereRevision ? ['PENDIENTE_REVISION' as const] : []), ...(e.solicitudCerrada ? ['SOLICITUD_CERRADA' as const] : []),
  ];
  return { estado: estadoEfectivo(e), vencida, requiereRevision, solicitudCerrada: e.solicitudCerrada, motivosNoAceptable };
}