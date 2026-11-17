import type { ApiUsuarios } from './puertos.js';
import { ErrorApi } from './puertos.js';
import type { InicioSesion, SesionResultado } from '../modelos/contratos.js';
export interface CoordinadorRenovacion { exclusiva<T>(trabajo: () => Promise<T>): Promise<T> }
export class SesionWeb {
  private datos: SesionResultado | undefined; private venceAcceso = 0; private generacion = 0;
  private enVuelo: Promise<void> | undefined; private cerrando = false;
  private readonly oyentes = new Set<() => void>();
  constructor(private readonly api: ApiUsuarios, private readonly coordinador: CoordinadorRenovacion, private readonly ahora: () => number = Date.now) {}
  suscribir(oyente: () => void): () => void { this.oyentes.add(oyente); return () => { this.oyentes.delete(oyente); }; }
  private avisar(): void { this.oyentes.forEach((f) => f()); }
  private instalar(datos: SesionResultado): void { this.datos = datos; this.venceAcceso = this.ahora() + datos.expiraEnSegundos * 1000; this.avisar(); }
  token(): string | undefined { return this.ahora() < this.venceAcceso ? this.datos?.tokenAcceso : undefined; }
  estado() { return { autenticada: Boolean(this.token()), cerrando: this.cerrando, venceAcceso: this.venceAcceso, autenticacionConContrasenaEn: this.datos?.autenticacionConContrasenaEn, renovacionVenceEn: this.datos?.renovacionVenceEn }; }
  invalidar(): void { this.generacion++; this.datos = undefined; this.venceAcceso = 0; this.avisar(); }
  async entrar(datos: InicioSesion): Promise<void> {
    const generacion = ++this.generacion; this.datos = undefined; this.venceAcceso = 0; this.avisar();
    const resultado = await this.api.enviar('iniciarSesion', datos);
    if (this.generacion === generacion && !this.cerrando) this.instalar(resultado);
  }
  private async rotar(): Promise<SesionResultado> {
    // Se consulta la cookie vigente DESPUÉS de adquirir el bloqueo entre pestañas.
    const { csrfToken } = await this.api.enviar('obtenerCsrf', undefined);
    return this.api.enviar('renovarSesion', undefined, { csrf: csrfToken });
  }
  renovar(): Promise<void> {
    if (this.enVuelo) return this.enVuelo;
    if (this.cerrando) return Promise.reject(new ErrorApi(401, 'SESION_NO_VALIDA', 'Se está cerrando la sesión.'));
    const generacion = this.generacion;
    this.enVuelo = this.coordinador.exclusiva(async () => { const resultado = await this.rotar(); if (this.generacion === generacion) this.instalar(resultado); }).catch((error: unknown) => { this.invalidar(); throw error; }).finally(() => { this.enVuelo = undefined; });
    return this.enVuelo;
  }
  async restaurar(): Promise<boolean> { try { await this.renovar(); return Boolean(this.token()); } catch (error) { if (error instanceof ErrorApi && error.http === 401) return false; throw error; } }
  async cerrar(): Promise<void> {
    if (this.cerrando) return; this.cerrando = true; this.avisar();
    try { await this.enVuelo?.catch(() => undefined); await this.coordinador.exclusiva(async () => { if (!this.token()) this.instalar(await this.rotar()); await this.api.enviar('cerrarSesion', undefined); }); }
    finally { this.cerrando = false; this.invalidar(); }
  }
}
