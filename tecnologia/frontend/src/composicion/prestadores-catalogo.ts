import { PortafolioWeb } from '../features/prestadores-catalogo/aplicacion/portafolio.js';
import { ApiPrestadoresHttp } from '../features/prestadores-catalogo/infraestructura/api-prestadores.js';
import { sesion } from './usuarios-acceso.js';

const api = new ApiPrestadoresHttp(() => sesion.token(), (...args) => fetch(...args), '/api/v1', () => sesion.invalidar());
export const portafolioWeb = new PortafolioWeb(api);
