import { operaciones, type OperacionesUsuarios } from '../modelos/contratos.js';
import { ErrorApi, type ApiUsuarios, type OpcionesPeticion } from '../aplicacion/puertos.js';

export function claveIdempotencia(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, '0')).join('');
}
export class ApiUsuariosHttp implements ApiUsuarios {
  constructor(private readonly accesoEnMemoria: () => string | undefined, private readonly solicitar: typeof fetch = (...args) => fetch(...args), private readonly base = '/api/v1', private readonly alNoAutenticado: () => void = () => undefined) {
    if (base !== '/api/v1') throw new Error('La API debe utilizar el mismo origen /api/v1.');
  }
  async enviar<K extends keyof OperacionesUsuarios>(nombre: K, entrada: OperacionesUsuarios[K]['entrada'], opciones: OpcionesPeticion = {}): Promise<OperacionesUsuarios[K]['salida']> {
    const operacion = operaciones[nombre]; const headers = new Headers({ Accept: 'application/json' });
    const ruta = operacion.ruta.replace(/\{([^}]+)\}/g, (_match, campo: string) => {
      const valor = opciones.parametros?.[campo]; if (!valor) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Falta un parámetro requerido.'); return encodeURIComponent(valor);
    });
    if (operacion.protegida) { const token = this.accesoEnMemoria(); if (token) headers.set('Authorization', `Bearer ${token}`); }
    if (operacion.idempotente) { if (!opciones.clave) throw new ErrorApi(400, 'CABECERA_REQUERIDA', 'Falta la clave de la operación.'); headers.set('Idempotency-Key', opciones.clave); }
    if (operacion.csrf && opciones.csrf) headers.set('X-CSRF-Token', opciones.csrf);
    if (entrada !== undefined) headers.set('Content-Type', 'application/json');
    let respuesta: Response;
    try { respuesta = await this.solicitar(this.base + ruta, { method: operacion.metodo, headers, credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer', ...(entrada === undefined ? {} : { body: JSON.stringify(entrada) }) }); }
    catch { throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'No fue posible comunicarse con el servidor. Reintente la misma operación.'); }
    if (respuesta.status === 204) return undefined as OperacionesUsuarios[K]['salida'];
    let datos: unknown;
    try { datos = await respuesta.json(); } catch { throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Respuesta del servidor no válida.'); }
    if (!respuesta.ok) {
      if (respuesta.status === 401 && operacion.protegida) this.alNoAutenticado();
      if (datos && typeof datos === 'object' && 'codigo' in datos && typeof datos.codigo === 'string' && 'mensaje' in datos && typeof datos.mensaje === 'string') {
        const detalles = 'detalles' in datos && Array.isArray(datos.detalles) ? datos.detalles.filter((d): d is { campo?: string; motivo: string } => d && typeof d === 'object' && typeof d.motivo === 'string' && (d.campo === undefined || typeof d.campo === 'string')) : [];
        throw new ErrorApi(respuesta.status, datos.codigo, datos.mensaje, detalles);
      }
      throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Respuesta del servidor no válida.');
    }
    return datos as OperacionesUsuarios[K]['salida'];
  }
}
