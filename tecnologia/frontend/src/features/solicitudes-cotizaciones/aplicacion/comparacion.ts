import { etiquetasEstado, etiquetasTipo, fechaHoraLima, formatoSoles, textoDeMotivo } from './cotizacion.js';
import type { Cotizacion, EstadoCotizacion, MotivoNoAceptable, TipoCotizacion } from '../modelos/cotizaciones.js';

/**
 * Presentación neutral de la comparación (FR-343). Refleja las reglas del servidor: NO suma importes, NO calcula totales ni promedios y NO ordena ni clasifica
 * («mejor», puntaje, posición): conserva el orden en que el cliente eligió las cotizaciones. Las estimadas se rotulan y no se presentan como precio final. Lo
 * ausente se muestra como «No indicado». Las señales de estado nunca excluyen una cotización de la comparación.
 */

export const NO_INDICADO = 'No indicado';
export const MAXIMO_COMPARACION = 10;

export interface ColumnaDeComparacion {
  id: string;
  prestador: string;
  tipo: TipoCotizacion;
  rotuloDeTipo: string;
  esEstimada: boolean;
  estado: EstadoCotizacion;
  etiquetaDeEstado: string;
  senales: { motivo: MotivoNoAceptable; texto: string }[];
}
export interface FilaDeComparacion {
  clave: 'precio' | 'plazo' | 'vigencia' | 'alcance' | 'exclusiones' | 'materiales' | 'manoDeObra' | 'formaCalculo' | 'condicionesPago';
  etiqueta: string;
  /** Texto largo (se muestra en varias líneas) o dato breve (una línea). */
  largo: boolean;
  /** Una celda por columna, en el mismo orden. */
  celdas: string[];
}
export interface VistaDeComparacion { columnas: ColumnaDeComparacion[]; filas: FilaDeComparacion[]; advertencias: string[] }

const texto = (valor: string | undefined) => valor?.trim() ? valor : NO_INDICADO;

export function vistaDeComparacion(cotizaciones: readonly Cotizacion[]): VistaDeComparacion {
  const columnas = cotizaciones.map((c): ColumnaDeComparacion => {
    const motivos = c.motivosNoAceptable;
    return {
      id: c.cotizacionId, prestador: texto(c.prestadorNombrePublico), tipo: c.versionVigente.tipo, rotuloDeTipo: etiquetasTipo[c.versionVigente.tipo],
      esEstimada: c.versionVigente.tipo === 'ESTIMADA', estado: c.estado, etiquetaDeEstado: etiquetasEstado[c.estado], senales: motivos.map(motivo => ({ motivo, texto: textoDeMotivo[motivo] })),
    };
  });
  const por = (clave: FilaDeComparacion['clave'], etiqueta: string, largo: boolean, valor: (c: Cotizacion) => string): FilaDeComparacion => ({ clave, etiqueta, largo, celdas: cotizaciones.map(valor) });
  const v = (c: Cotizacion) => c.versionVigente;
  const filas = [
    por('precio', 'Precio', false, c => v(c).precioCentimos === undefined ? NO_INDICADO : formatoSoles(v(c).precioCentimos!)),
    por('plazo', 'Plazo', false, c => v(c).plazoDias === undefined ? NO_INDICADO : `${v(c).plazoDias} ${v(c).plazoDias === 1 ? 'día' : 'días'}`),
    por('vigencia', 'Válida hasta', false, c => fechaHoraLima(v(c).vigenteHasta)),
    por('alcance', 'Alcance', true, c => texto(v(c).alcance)),
    por('exclusiones', 'Exclusiones', true, c => texto(v(c).exclusiones)),
    por('materiales', 'Materiales', true, c => texto(v(c).materiales)),
    por('manoDeObra', 'Mano de obra', true, c => texto(v(c).manoDeObra)),
    por('formaCalculo', 'Forma de cálculo', true, c => texto(v(c).formaCalculo)),
    por('condicionesPago', 'Condiciones de pago', true, c => texto(v(c).condicionesPago)),
  ];
  const advertencias = columnas.some(c => c.esEstimada) ? ['Las cotizaciones estimadas no son un precio final y no son comparables con las definitivas.'] : [];
  return { columnas, filas, advertencias };
}

/** Marca o desmarca una cotización respetando el máximo. Devuelve la misma selección si ya se alcanzó el límite. */
export function alternarSeleccion(seleccion: readonly string[], id: string): string[] {
  if (seleccion.includes(id)) return seleccion.filter(s => s !== id);
  return seleccion.length >= MAXIMO_COMPARACION ? [...seleccion] : [...seleccion, id];
}
