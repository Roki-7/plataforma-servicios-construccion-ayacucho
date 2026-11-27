import { datosInvalidos, limiteComparacion } from './errores.js';
import type { EstadoCotizacion, MotivoNoAceptable, TipoCotizacion } from './cotizacion.js';

/**
 * Reglas puras de la comparación (FR-343, RF19). Neutral por diseño: NO suma importes, NO calcula totales ni promedios y NO ordena ni clasifica («mejor»,
 * puntaje, posición). Conserva el orden recibido. Las estimadas se rotulan y no se presentan como un precio final. Lo ausente se muestra como «No indicado».
 */

export const NO_INDICADO = 'No indicado';
/** Máximo de cotizaciones por comparación (CA-COT-12). */
export const MAXIMO_COMPARACION = 10;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Interpreta el parámetro `ids` (separado por comas). Quita repetidos, conserva el orden, pasa a minúsculas y exige entre 1 y 10 identificadores:
 * más de 10 es 422 `LIMITE_COMPARACION`; un identificador mal formado o una lista vacía, 400 `DATOS_INVALIDOS`.
 */
export function idsDeComparacion(texto: string): string[] {
  const partes = texto.split(',').map(p => p.trim());
  if (!partes.length || partes.some(p => !UUID.test(p))) throw datosInvalidos('ids', 'Indique identificadores de cotización válidos separados por comas.');
  const ids = [...new Set(partes.map(p => p.toLowerCase()))];
  if (ids.length > MAXIMO_COMPARACION) throw limiteComparacion();
  return ids;
}

export interface VersionDeComparacion {
  readonly numero: number;
  readonly tipo: TipoCotizacion;
  readonly alcance: string;
  readonly exclusiones?: string | undefined;
  readonly materiales?: string | undefined;
  readonly manoDeObra?: string | undefined;
  readonly precioCentimos?: number | undefined;
  readonly formaCalculo?: string | undefined;
  readonly plazoDias?: number | undefined;
  readonly vigenteHasta: Date;
  readonly condicionesPago?: string | undefined;
}
export interface EntradaDeComparacion {
  readonly cotizacionId: string;
  /** Solo si el llamador comprobó el título de acceso (cliente dueño). Sin nombre autorizado se muestra «No indicado». */
  readonly prestadorNombre?: string | undefined;
  readonly estado: EstadoCotizacion;
  readonly vencida: boolean;
  readonly requiereRevision: boolean;
  readonly solicitudCerrada: boolean;
  readonly version: VersionDeComparacion;
}

/** Todos los campos de RF17, siempre presentes y en este orden. */
export type CampoComparable = 'tipo' | 'precio' | 'plazo' | 'vigencia' | 'alcance' | 'exclusiones' | 'materiales' | 'manoDeObra' | 'formaCalculo' | 'condicionesPago';
export interface ColumnaDeComparacion {
  readonly cotizacionId: string;
  readonly prestador: string;
  readonly tipo: TipoCotizacion;
  readonly rotuloDeTipo: 'Estimada' | 'Definitiva';
  readonly esEstimada: boolean;
  /** Solo una definitiva expresa un precio final. */
  readonly precioEsFinal: boolean;
  readonly estado: EstadoCotizacion;
  readonly senales: readonly MotivoNoAceptable[];
  readonly campos: Readonly<Record<CampoComparable, string>>;
}
export interface VistaDeComparacion {
  readonly columnas: readonly ColumnaDeComparacion[];
  readonly advertencias: readonly string[];
}

const texto = (valor: string | undefined) => valor?.trim() ? valor : NO_INDICADO;
const soles = (centimos: number) => `S/ ${new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(centimos / 100)}`;
const fecha = (d: Date) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(d);

export function vistaDeComparacion(entradas: readonly EntradaDeComparacion[]): VistaDeComparacion {
  const columnas = entradas.map((e): ColumnaDeComparacion => {
    const v = e.version;
    const senales: MotivoNoAceptable[] = [
      ...(e.estado === 'RETIRADA' ? ['RETIRADA' as const] : []), ...(e.vencida ? ['VENCIDA' as const] : []),
      ...(e.requiereRevision ? ['PENDIENTE_REVISION' as const] : []), ...(e.solicitudCerrada ? ['SOLICITUD_CERRADA' as const] : []),
    ];
    const estimada = v.tipo === 'ESTIMADA';
    return {
      cotizacionId: e.cotizacionId, prestador: texto(e.prestadorNombre), tipo: v.tipo, rotuloDeTipo: estimada ? 'Estimada' : 'Definitiva', esEstimada: estimada, precioEsFinal: !estimada,
      estado: e.estado, senales,
      campos: {
        tipo: estimada ? 'Estimada' : 'Definitiva', precio: v.precioCentimos === undefined ? NO_INDICADO : soles(v.precioCentimos),
        plazo: v.plazoDias === undefined ? NO_INDICADO : `${v.plazoDias} ${v.plazoDias === 1 ? 'día' : 'días'}`, vigencia: fecha(v.vigenteHasta), alcance: texto(v.alcance),
        exclusiones: texto(v.exclusiones), materiales: texto(v.materiales), manoDeObra: texto(v.manoDeObra), formaCalculo: texto(v.formaCalculo), condicionesPago: texto(v.condicionesPago),
      },
    };
  });
  const advertencias = columnas.some(c => c.esEstimada) ? ['Las cotizaciones estimadas no son un precio final y no son comparables con las definitivas.'] : [];
  return { columnas, advertencias };
}
