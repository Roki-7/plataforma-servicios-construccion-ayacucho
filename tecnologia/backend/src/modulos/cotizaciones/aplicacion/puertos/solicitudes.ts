// Cotizaciones consume a Solicitudes únicamente por su API pública. Este archivo fija el puerto con el nombre que usan los casos de uso de Cotizaciones.
export type { ResumenDeSolicitud, SolicitudesApi as LecturasDeSolicitudes } from '../../../solicitudes/api-publica.js';
