import type { ApiUsuarios } from './puertos.js';
import type { Registro, HabilitarPerfil, OperacionesUsuarios } from '../modelos/contratos.js';
export const PRIVACIDAD_VERSION = '001-v1';
export interface FormularioRegistro { nombreMostrar: string; correo: string; contrasena: string; confirmacionContrasena: string; seleccion: string; aceptada: boolean }
export function validarRegistroWeb(d: FormularioRegistro): Record<string, string> {
  const errores: Record<string, string> = {};
  const valido = (s: string, max: number) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s) && [...s].length <= max;
  if (!d.nombreMostrar.trim() || !valido(d.nombreMostrar, 200)) errores['nombreMostrar'] = 'Ingrese el nombre para mostrar.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo) || !valido(d.correo, 320)) errores['correo'] = 'Ingrese un correo válido.';
  if (!valido(d.contrasena, 128) || [...d.contrasena].length < 15) errores['contrasena'] = 'Use entre 15 y 128 caracteres.';
  if (d.confirmacionContrasena !== d.contrasena) errores['confirmacionContrasena'] = 'Las contraseñas deben coincidir.';
  if (!['cliente', 'prestador', 'ambos'].includes(d.seleccion)) errores['perfiles'] = 'Seleccione cliente, prestador o ambos.';
  if (!d.aceptada) errores['privacidad'] = 'Debe aceptar la política de privacidad.';
  return errores;
}
// Conserva la clave tras un fallo de red. Cambiar cualquier dato genera otra clave.
export function operacionesRegistro(api: ApiUsuarios, nuevaClave: () => string) {
  const pendientes = new Map<string, { cuerpo: string; clave: string }>();
  async function enviar<K extends 'crearCuenta' | 'habilitarPerfil'>(operacion: K, entrada: OperacionesUsuarios[K]['entrada']): Promise<OperacionesUsuarios[K]['salida']> {
    const cuerpo = JSON.stringify(entrada); const anterior = pendientes.get(operacion); const clave = anterior?.cuerpo === cuerpo ? anterior.clave : nuevaClave(); pendientes.set(operacion, { cuerpo, clave });
    return api.enviar(operacion, entrada, { clave });
  }
  return { registrar: (d: Registro) => enviar('crearCuenta', d), habilitar: (d: HabilitarPerfil) => enviar('habilitarPerfil', d) };
}
