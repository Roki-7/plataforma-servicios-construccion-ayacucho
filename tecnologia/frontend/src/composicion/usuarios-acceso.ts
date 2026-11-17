import {CorreoWeb} from '../features/usuarios-acceso/aplicacion/correo.js';
import { ApiUsuariosHttp, claveIdempotencia } from '../features/usuarios-acceso/infraestructura/api-usuarios.js';
import { operacionesRegistro } from '../features/usuarios-acceso/aplicacion/registro.js';
import { SesionWeb } from '../features/usuarios-acceso/aplicacion/sesion.js';
import { CoordinadorRenovacionNavegador } from '../features/usuarios-acceso/infraestructura/coordinador-renovacion.js';
import { RecuperacionWeb } from '../features/usuarios-acceso/aplicacion/recuperacion.js';
import { PerfilWeb } from '../features/usuarios-acceso/aplicacion/perfil.js';
declare global { interface Window { __recuperacionInicial?: string; __correoInicial?: string } }
const api: ApiUsuariosHttp = new ApiUsuariosHttp(() => sesion.token(), (...args) => fetch(...args), '/api/v1', () => sesion.invalidar());
export const sesion: SesionWeb = new SesionWeb(api, new CoordinadorRenovacionNavegador());
export const usuarios = operacionesRegistro(api, claveIdempotencia);
export const perfilWeb = new PerfilWeb(api, claveIdempotencia);
const fragmento = window.__recuperacionInicial ?? ''; delete window.__recuperacionInicial;
export const recuperacion = new RecuperacionWeb(api, claveIdempotencia, fragmento);

export const correoWeb=new CorreoWeb(api,claveIdempotencia); correoWeb.cargarEnlace(window.__correoInicial??''); delete window.__correoInicial;
