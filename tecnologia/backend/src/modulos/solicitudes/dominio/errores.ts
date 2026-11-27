import { ErrorAplicacion, type DetalleError } from '../../../compartido/dominio/errores.js';
import { sqlstate, type CondicionBd } from '../../../compartido/dominio/condicion-bd.js';

// Errores de Solicitudes con los códigos y estados HTTP del contrato (specs/003-.../contracts/README.md). Todos son `ErrorAplicacion`: la unidad de trabajo
// los propaga intactos tras revertir. Los mensajes no incluyen valores del cliente ni detalles internos.

/** Nombres de las restricciones que mantienen los contadores de archivos de `solicitudes`. La migración 1796000000001 las crea con estos nombres. */
export const restriccionesDeContadores = ['solicitudes_archivos_cantidad_rango', 'solicitudes_archivos_bytes_rango'] as const;

const error = (http: number, codigo: string, mensaje: string, detalles: readonly DetalleError[] = []) => new ErrorAplicacion(http, codigo, mensaje, detalles);

export const recursoNoDisponible = () => error(404, 'RECURSO_NO_DISPONIBLE', 'El recurso no está disponible.');
export const versionDesactualizada = () => error(409, 'VERSION_DESACTUALIZADA', 'La solicitud cambió desde que la consultó. Vuelva a cargarla.');
export const conflictoConcurrente = () => error(409, 'CONFLICTO_CONCURRENTE', 'Hubo un conflicto con otra operación simultánea. Intente de nuevo.');
export const solicitudNoAbierta = () => error(409, 'SOLICITUD_NO_ABIERTA', 'La solicitud no está abierta.');
export const solicitudIncompleta = (campos: readonly string[]) => error(422, 'SOLICITUD_INCOMPLETA', 'Faltan datos para publicar la solicitud.', campos.map(campo => ({ campo, motivo: 'Campo obligatorio para publicar.' })));
export const campoNoModificable = (campo: string) => error(422, 'CAMPO_NO_MODIFICABLE', 'Este dato no puede cambiarse después de publicar.', [{ campo, motivo: 'No modificable tras publicar.' }]);
export const autodireccionNoPermitida = () => error(422, 'AUTODIRECCION_NO_PERMITIDA', 'No puede dirigir una solicitud a su propio perfil.');
export const prestadorNoDisponible = () => error(422, 'PRESTADOR_NO_DISPONIBLE', 'El prestador indicado no está disponible.');
export const servicioNoElegible = () => error(422, 'SERVICIO_NO_ELEGIBLE', 'El servicio indicado no está disponible para solicitudes.');
export const servicioNoPerteneceAlPrestador = () => error(422, 'SERVICIO_NO_PERTENECE_AL_PRESTADOR', 'El servicio no pertenece al prestador indicado.');
export const categoriaNoCoincideConServicio = () => error(422, 'CATEGORIA_NO_COINCIDE_CON_SERVICIO', 'La categoría no coincide con la del servicio.');
export const categoriaNoActiva = () => error(422, 'CATEGORIA_NO_ACTIVA', 'La categoría indicada no está activa.');
export const fechaNoValida = (campo: string) => error(422, 'FECHA_NO_VALIDA', 'La fecha indicada no es válida.', [{ campo, motivo: 'Fecha no válida.' }]);
export const datosPersonalesEnTexto = (campo: string) => error(422, 'DATOS_PERSONALES_EN_TEXTO', 'El texto parece incluir datos de contacto. Quítelos para continuar.', [{ campo, motivo: 'Contiene datos de contacto.' }]);
export const limiteArchivos = () => error(422, 'LIMITE_ARCHIVOS', 'La solicitud admite hasta 5 archivos y 30 MB en total.');
export const archivoNoListo = () => error(422, 'ARCHIVO_NO_LISTO', 'El archivo todavía no está listo.');
export const archivoExpirado = () => error(422, 'ARCHIVO_EXPIRADO', 'El archivo caducó. Cárguelo de nuevo.');
export function datosInvalidos(detalles: readonly DetalleError[]): ErrorAplicacion;
export function datosInvalidos(campo: string, motivo: string): ErrorAplicacion;
export function datosInvalidos(primero: readonly DetalleError[] | string, motivo?: string): ErrorAplicacion {
  return error(400, 'DATOS_INVALIDOS', 'Revise los datos enviados.', typeof primero === 'string' ? [{ campo: primero, motivo: motivo ?? 'Valor no válido.' }] : primero);
}
export const archivoDemasiadoGrande = () => error(413, 'ARCHIVO_DEMASIADO_GRANDE', 'La imagen supera 10 MB.', [{ campo: 'contenidoBase64', motivo: 'La imagen supera 10 MB.' }]);
export const imagenFormatoNoAdmitido = (motivo: string, campo = 'contenidoBase64') => error(422, 'IMAGEN_FORMATO_NO_ADMITIDO', motivo, [{ campo, motivo }]);
export const imagenDimensionesNoAdmitidas = () => error(422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS', 'La imagen supera 4096 píxeles por lado.', [{ campo: 'contenidoBase64', motivo: 'La imagen supera 4096 píxeles de ancho o alto.' }]);
export const dependenciaNoDisponible = () => error(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio temporalmente no disponible.');

/**
 * Traduce las condiciones de base de datos esperadas de Solicitudes:
 *  - 23514 sobre un contador de archivos → `LIMITE_ARCHIVOS` (la segunda barrera del cupo de 5 archivos y 30 000 000 bytes);
 *  - 55P03 (espera de bloqueo agotada) → `CONFLICTO_CONCURRENTE`.
 * Cualquier otra condición, incluido un 23514 de otra restricción, se deja sin traducir: es un fallo inesperado y no se oculta.
 */
export function traducirCondicionSolicitudes(condicion: CondicionBd): ErrorAplicacion | undefined {
  if (condicion.sqlstate === sqlstate.bloqueoNoDisponible) return conflictoConcurrente();
  if (condicion.sqlstate === sqlstate.violacionCheck && condicion.restriccion !== undefined
      && (restriccionesDeContadores as readonly string[]).includes(condicion.restriccion)) return limiteArchivos();
  return undefined;
}
