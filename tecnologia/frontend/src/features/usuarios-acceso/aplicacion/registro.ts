import type { ApiUsuarios } from './puertos.js';
import type { Registro, HabilitarPerfil, OperacionesUsuarios } from '../modelos/contratos.js';
import { motivoDistrito, motivoNombre, motivoTelefono } from './validacion-contacto.js';
export const PRIVACIDAD_VERSION = '001-v1';
export interface FormularioRegistro { nombreMostrar: string; correo: string; contrasena: string; confirmacionContrasena: string; seleccion: string; aceptada: boolean; telefono?: string; distrito?: string }
export function validarRegistroWeb(d: FormularioRegistro): Record<string, string> {
  const errores: Record<string, string> = {};
  const valido = (s: string, max: number) => !s.includes('\u0000') && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s) && [...s].length <= max;
  const nombre = motivoNombre(d.nombreMostrar); if (nombre) errores['nombreMostrar'] = nombre;
  const telefono = d.telefono === undefined ? null : motivoTelefono(d.telefono); if (telefono) errores['telefono'] = telefono;
  const distrito = d.distrito === undefined ? null : motivoDistrito(d.distrito); if (distrito) errores['distrito'] = distrito;
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
