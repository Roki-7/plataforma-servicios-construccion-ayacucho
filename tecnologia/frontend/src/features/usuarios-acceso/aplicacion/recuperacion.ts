import type { ApiUsuarios } from './puertos.js';
import { ErrorApi } from './puertos.js';
import { validarRegistroWeb } from './registro.js';
export interface EnlaceRecuperacion { token: string; version: number }
export function leerEnlaceRecuperacion(fragmento: string): EnlaceRecuperacion | null {
  const valores = new URLSearchParams(fragmento.replace(/^#/, '')); const token = valores.get('token'); const versionTexto = valores.get('version'); const version = Number(versionTexto);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !versionTexto || !/^[1-9]\d*$/.test(versionTexto) || !Number.isSafeInteger(version) || [...valores.keys()].some((k) => !['token', 'version'].includes(k)) || valores.getAll('token').length !== 1 || valores.getAll('version').length !== 1) return null;
  return { token, version };
}
export function validarNuevaContrasenaWeb(nuevaContrasena: string, confirmacionContrasena: string): Record<string, string> {
  const errores = validarRegistroWeb({ nombreMostrar: 'Control', correo: 'control@example.invalid', seleccion: 'cliente', aceptada: true, contrasena: nuevaContrasena, confirmacionContrasena });
  return Object.fromEntries(Object.entries(errores).filter(([k]) => k === 'contrasena' || k === 'confirmacionContrasena'));
}
export class RecuperacionWeb {
  private enlace: EnlaceRecuperacion | null = null; private intento: { cuerpo: string; clave: string } | undefined;
  enlaceInvalido = false;
  constructor(private readonly api: ApiUsuarios, private readonly nuevaClave: () => string, fragmento: string) { this.cargarEnlace(fragmento); }
  cargarEnlace(fragmento: string): void { this.enlace = leerEnlaceRecuperacion(fragmento); this.intento = undefined; this.enlaceInvalido = Boolean(fragmento) && !this.enlace; }
  tieneEnlace(): boolean { return this.enlace !== null; }
  solicitar(correo: string) { return this.api.enviar('solicitarRecuperacion', { correo }); }
  async consumir(nuevaContrasena: string, confirmacionContrasena: string) {
    if (!this.enlace) throw new ErrorApi(422, 'RECUPERACION_NO_VALIDA', 'El enlace no es válido. Solicite uno nuevo.');
    const errores = validarNuevaContrasenaWeb(nuevaContrasena, confirmacionContrasena); if (Object.keys(errores).length) throw new ErrorApi(400, 'DATOS_INVALIDOS', Object.values(errores)[0]!);
    const datos = { nuevaContrasena, confirmacionContrasena, version: this.enlace.version }; const cuerpo = JSON.stringify(datos);
    if (this.intento?.cuerpo !== cuerpo) this.intento = { cuerpo, clave: this.nuevaClave() };
    const resultado = await this.api.enviar('consumirRecuperacion', datos, { clave: this.intento.clave, parametros: { token: this.enlace.token } });
    this.enlace = null; this.intento = undefined;
    return resultado;
  }
}
