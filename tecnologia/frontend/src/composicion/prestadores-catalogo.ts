import { PortafolioWeb } from '../features/prestadores-catalogo/aplicacion/portafolio.js';
import { ApiPrestadoresHttp } from '../features/prestadores-catalogo/infraestructura/api-prestadores.js';
import { ServiciosWeb } from '../features/prestadores-catalogo/aplicacion/servicios.js';
import { ApiServiciosHttp } from '../features/prestadores-catalogo/infraestructura/api-servicios.js';
import { BusquedaWeb } from '../features/prestadores-catalogo/aplicacion/busqueda.js';
import { ApiBusquedaHttp } from '../features/prestadores-catalogo/infraestructura/api-busqueda.js';
import { CategoriasWeb } from '../features/prestadores-catalogo/aplicacion/categorias.js';
import { ApiCategoriasHttp } from '../features/prestadores-catalogo/infraestructura/api-categorias.js';
import { sesion } from './usuarios-acceso.js';

const api = new ApiPrestadoresHttp(() => sesion.token(), (...args) => fetch(...args), '/api/v1', () => sesion.invalidar());
export const portafolioWeb = new PortafolioWeb(api);

export const serviciosWeb = new ServiciosWeb(new ApiServiciosHttp(() => sesion.token(), (...args) => fetch(...args), '/api/v1', () => sesion.invalidar()));

/** Consultas públicas: anónimas, sin token ni sesión. */
export const busquedaWeb = new BusquedaWeb(new ApiBusquedaHttp((...args) => fetch(...args)));

/** Categorías activas: consulta pública anónima, compartida por la búsqueda, el perfil profesional y los servicios propios. */
export const categoriasWeb = new CategoriasWeb(new ApiCategoriasHttp((...args) => fetch(...args)));
