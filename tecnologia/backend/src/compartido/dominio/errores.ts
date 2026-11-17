export interface DetalleError { readonly campo?: string; readonly motivo: string }
export class ErrorAplicacion extends Error {
  constructor(readonly http: number, readonly codigo: string, mensaje: string, readonly detalles: readonly DetalleError[] = [], readonly reintentarEnSegundos?: number) { super(mensaje); this.name = 'ErrorAplicacion'; }
}
export function datosInvalidos(motivo = 'Revise los datos enviados.', detalles: readonly DetalleError[] = []): ErrorAplicacion { return new ErrorAplicacion(400, 'DATOS_INVALIDOS', motivo, detalles); }
export function dependenciaNoDisponible(): ErrorAplicacion { return new ErrorAplicacion(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio temporalmente no disponible.'); }
