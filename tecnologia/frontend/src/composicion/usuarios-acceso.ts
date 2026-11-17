import { ApiUsuariosHttp, claveIdempotencia } from '../features/usuarios-acceso/infraestructura/api-usuarios.js';
import { operacionesRegistro } from '../features/usuarios-acceso/aplicacion/registro.js';
import { SesionWeb } from '../features/usuarios-acceso/aplicacion/sesion.js';
import { CoordinadorRenovacionNavegador } from '../features/usuarios-acceso/infraestructura/coordinador-renovacion.js';
const api: ApiUsuariosHttp = new ApiUsuariosHttp(() => sesion.token(), (...args) => fetch(...args), '/api/v1', () => sesion.invalidar());
export const sesion: SesionWeb = new SesionWeb(api, new CoordinadorRenovacionNavegador());
export const usuarios = operacionesRegistro(api, claveIdempotencia);
