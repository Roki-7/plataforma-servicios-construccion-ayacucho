import { crearApiCotizaciones } from '../features/solicitudes-cotizaciones/infraestructura/api-cotizaciones.js';
import { crearApiSolicitudes } from '../features/solicitudes-cotizaciones/infraestructura/api-solicitudes.js';
import { sesion } from './usuarios-acceso.js';

export const solicitudesWeb = crearApiSolicitudes(() => sesion.token(), () => sesion.invalidar());
export const cotizacionesWeb = crearApiCotizaciones(() => sesion.token(), () => sesion.invalidar());
