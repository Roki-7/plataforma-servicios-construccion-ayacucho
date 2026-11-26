import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { ApiServicios } from '../aplicacion/puertos.js';
import type { EntradaServicio, EstadoServicio, PaginaServicios, ServicioPrivado } from '../modelos/contratos.js';

/** Cliente HTTP del mismo origen para servicios propios. La identidad viaja solo en el token Bearer en memoria. */
export class ApiServiciosHttp implements ApiServicios {
  constructor(private readonly acceso: () => string | undefined, private readonly solicitar: typeof fetch = (...a) => fetch(...a), private readonly base = '/api/v1',
    private readonly alNoAutenticado: () => void = () => undefined) {
    if (base !== '/api/v1') throw new Error('La API debe utilizar el mismo origen /api/v1.');
  }
  private async enviar<T>(metodo: string, ruta: string, cuerpo?: unknown, clave?: string): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' });
    const token = this.acceso(); if (token) headers.set('Authorization', `Bearer ${token}`);
    if (clave) headers.set('Idempotency-Key', clave);
    if (cuerpo !== undefined) headers.set('Content-Type', 'application/json');
    let r: Response;
    try { r = await this.solicitar(this.base + ruta, { method: metodo, headers, credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer', ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }) }); }
    catch { throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'No fue posible comunicarse con el servidor. Reintente la misma operación.'); }
    let datos: unknown;
    try { datos = await r.json(); } catch { throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Respuesta del servidor no válida.'); }
    if (!r.ok) {
      if (r.status === 401) this.alNoAutenticado();
      const d = datos as { codigo?: unknown; mensaje?: unknown; detalles?: unknown };
      if (typeof d?.codigo === 'string' && typeof d.mensaje === 'string') {
        const detalles = Array.isArray(d.detalles) ? d.detalles.filter((x): x is { campo?: string; motivo: string } => !!x && typeof x === 'object' && typeof (x as { motivo?: unknown }).motivo === 'string') : [];
        throw new ErrorApi(r.status, d.codigo, d.mensaje, detalles);
      }
      throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Respuesta del servidor no válida.');
    }
    return datos as T;
  }
  private id = (v: string) => encodeURIComponent(v);
  listarMios(pagina: number, tamano: number) { return this.enviar<PaginaServicios>('GET', `/servicios/mios?pagina=${pagina}&tamano=${tamano}`); }
  publicar(e: EntradaServicio, clave: string) { return this.enviar<ServicioPrivado>('POST', '/servicios', e, clave); }
  editar(servicioId: string, version: number, cambios: Partial<EntradaServicio>, clave: string) { return this.enviar<ServicioPrivado>('PATCH', `/servicios/${this.id(servicioId)}`, { version, ...cambios }, clave); }
  cambiarEstado(servicioId: string, version: number, destino: EstadoServicio, clave: string) { return this.enviar<ServicioPrivado>('POST', `/servicios/${this.id(servicioId)}/transiciones`, { version, destino }, clave); }
}
