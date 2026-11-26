import { ErrorAplicacion, type DetalleError } from '../../../compartido/dominio/errores.js';
import { sqlstate, type CondicionBd } from '../../../compartido/dominio/condicion-bd.js';

// Errores de Cotizaciones con los códigos y estados HTTP del contrato. Todos son `ErrorAplicacion`. Sin valores del cliente ni detalles internos.

/** Restricciones que respaldan las reglas de Cotizaciones. La migración 1796000000002 las crea con estos nombres. */
export const restriccionesDeCotizaciones = {
  /** Índice único parcial `(solicitud_id, prestador_id) WHERE estado <> 'RETIRADA'`. */
  unicaNoRetirada: 'cotizaciones_unica_no_retirada',
  /** `UNIQUE (cotizacion_id, numero)` de las aclaraciones. */
  numeroDeAclaracionUnico: 'cotizaciones_aclaraciones_numero_unico',
  /** `CHECK (numero BETWEEN 1 AND 20)` de las aclaraciones. */
  numeroDeAclaracionRango: 'cotizaciones_aclaraciones_numero_rango',
} as const;

const error = (http: number, codigo: string, mensaje: string, detalles: readonly DetalleError[] = []) => new ErrorAplicacion(http, codigo, mensaje, detalles);

export const recursoNoDisponible = () => error(404, 'RECURSO_NO_DISPONIBLE', 'El recurso no está disponible.');
export const versionDesactualizada = () => error(409, 'VERSION_DESACTUALIZADA', 'La cotización cambió desde que la consultó. Vuelva a cargarla.');
export const conflictoConcurrente = () => error(409, 'CONFLICTO_CONCURRENTE', 'Hubo un conflicto con otra operación simultánea. Intente de nuevo.');
export const solicitudModificada = () => error(409, 'SOLICITUD_MODIFICADA', 'La solicitud cambió. Revise la versión vigente antes de cotizar.');
export const solicitudNoAbierta = () => error(409, 'SOLICITUD_NO_ABIERTA', 'La solicitud no está abierta.');
export const cotizacionExistente = () => error(409, 'COTIZACION_EXISTENTE', 'Ya tiene una cotización activa para esta solicitud.');
export const cotizacionRetirada = () => error(409, 'COTIZACION_RETIRADA', 'La cotización está retirada.');
export const cotizacionIncompleta = (campos: readonly string[]) => error(422, 'COTIZACION_INCOMPLETA', 'Faltan datos de la cotización.', campos.map(campo => ({ campo, motivo: 'Campo obligatorio.' })));
export const cotizacionPropia = () => error(422, 'COTIZACION_PROPIA', 'No puede cotizar su propia solicitud.');
export const fechaNoValida = (campo: string) => error(422, 'FECHA_NO_VALIDA', 'La fecha indicada no es válida.', [{ campo, motivo: 'Fecha no válida.' }]);
export const limiteAclaraciones = () => error(422, 'LIMITE_ACLARACIONES', 'La cotización admite hasta 20 mensajes de aclaración.');
export const limiteComparacion = () => error(422, 'LIMITE_COMPARACION', 'Puede comparar hasta 10 cotizaciones.');
export const dependenciaNoDisponible = () => error(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio temporalmente no disponible.');

/**
 * Traduce las condiciones de base de datos esperadas de Cotizaciones:
 *  - 23505 sobre el índice único de cotizaciones no retiradas → `COTIZACION_EXISTENTE`;
 *  - 23505 sobre el número de aclaración (dos mensajes simultáneos que toman el mismo número) → `CONFLICTO_CONCURRENTE`;
 *  - 23514 sobre el rango del número de aclaración → `LIMITE_ACLARACIONES`;
 *  - 55P03 (espera de bloqueo agotada) → `CONFLICTO_CONCURRENTE`.
 * Cualquier otra condición queda sin traducir: es un fallo inesperado y no se oculta.
 */
export function traducirCondicionCotizaciones(condicion: CondicionBd): ErrorAplicacion | undefined {
  const { sqlstate: codigo, restriccion } = condicion;
  if (codigo === sqlstate.bloqueoNoDisponible) return conflictoConcurrente();
  if (codigo === sqlstate.violacionUnica && restriccion === restriccionesDeCotizaciones.unicaNoRetirada) return cotizacionExistente();
  if (codigo === sqlstate.violacionUnica && restriccion === restriccionesDeCotizaciones.numeroDeAclaracionUnico) return conflictoConcurrente();
  if (codigo === sqlstate.violacionCheck && restriccion === restriccionesDeCotizaciones.numeroDeAclaracionRango) return limiteAclaraciones();
  return undefined;
}
