import { ApiUsuariosHttp, claveIdempotencia } from '../features/usuarios-acceso/infraestructura/api-usuarios.js';
import { operacionesRegistro } from '../features/usuarios-acceso/aplicacion/registro.js';
import type { Perfil } from '../features/usuarios-acceso/modelos/contratos.js';
let acceso: string | undefined;
export const usuarios = operacionesRegistro(new ApiUsuariosHttp(() => acceso), claveIdempotencia);
// Solo el build explícito de validación puede importar un módulo fixture interceptado
// por Playwright. En producción no se solicita ni se instala ninguna sesión fixture.
export async function sesionValidacion(): Promise<Perfil | undefined> {
  if (import.meta.env.MODE !== 'validation') return undefined;
  const ruta = '/__validacion__/sesion.js';
  try { const modulo = await import(/* @vite-ignore */ ruta) as { default: { token: string; perfil: Perfil } }; acceso = modulo.default.token; return modulo.default.perfil; } catch { return undefined; }
}
