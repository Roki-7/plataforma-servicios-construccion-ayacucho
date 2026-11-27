// Cotizaciones consume a Solicitudes únicamente por su API pública. Este archivo fija el puerto con el nombre que usan los casos de uso de Cotizaciones.
export type { MotivoDeNoDisponibilidad, ResumenDeSolicitud, SolicitudesApi as LecturasDeSolicitudes, ValidacionDeClienteYDisponibilidad } from '../../../solicitudes/api-publica.js';
export { coincideConCobertura, tituloParaCotizar } from '../../../solicitudes/api-publica.js';
