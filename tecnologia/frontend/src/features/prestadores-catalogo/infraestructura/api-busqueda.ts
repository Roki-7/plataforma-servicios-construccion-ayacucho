import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { ApiBusqueda } from '../aplicacion/puertos.js';
import type { FiltrosBusqueda, PaginaPublica, PerfilPublico, PrestadorResumen, ServicioPublico } from '../modelos/contratos.js';

/** Cliente HTTP anónimo del mismo origen. Nunca envía credenciales ni identidad. */
export class ApiBusquedaHttp implements ApiBusqueda {
  constructor(private readonly solicitar: typeof fetch = (...a) => fetch(...a), private readonly base = '/api/v1') {
    if (base !== '/api/v1') throw new Error('La API debe utilizar el mismo origen /api/v1.');
  }
  private async leer<T>(ruta: string): Promise<T> {
    let r: Response;
    try { r = await this.solicitar(this.base + ruta, { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }); }
    catch { throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'No fue posible comunicarse con el servidor.'); }
    let datos: unknown;
    try { datos = await r.json(); } catch { throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Respuesta del servidor no válida.'); }
    if (!r.ok) {
      const d = datos as { codigo?: unknown; mensaje?: unknown };
      throw typeof d?.codigo === 'string' && typeof d.mensaje === 'string' ? new ErrorApi(r.status, d.codigo, d.mensaje) : new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Respuesta del servidor no válida.');
    }
    return datos as T;
  }
  private consulta(f: FiltrosBusqueda): string {
    const q = new URLSearchParams();
    if (f.categoria) q.set('categoria', f.categoria);
    if (f.especialidad) q.set('especialidad', f.especialidad);
    if (f.distrito) q.set('distrito', f.distrito);
    if (f.disponibilidad !== undefined) q.set('disponibilidad', String(f.disponibilidad));
    q.set('pagina', String(f.pagina)); q.set('tamano', String(f.tamano));
    return `?${q.toString()}`;
  }
  buscarServicios(f: FiltrosBusqueda) { return this.leer<PaginaPublica<ServicioPublico>>(`/servicios${this.consulta(f)}`); }
  buscarPrestadores(f: FiltrosBusqueda) { return this.leer<PaginaPublica<PrestadorResumen>>(`/prestadores${this.consulta(f)}`); }
  obtenerServicio(id: string) { return this.leer<ServicioPublico>(`/servicios/${encodeURIComponent(id)}`); }
  obtenerPerfil(id: string, pagina: number, tamano: number) { return this.leer<PerfilPublico>(`/prestadores/${encodeURIComponent(id)}?pagina=${pagina}&tamano=${tamano}`); }
  obtenerImagen(ruta: string) {
    if (!/^\/api\/v1\/prestadores\/[0-9a-f-]{36}\/trabajos\/[0-9a-f-]{36}\/fotografias\/[0-9a-f-]{36}$/i.test(ruta)) return Promise.reject(new ErrorApi(400, 'DATOS_INVALIDOS', 'Ruta de imagen no válida.'));
    return this.leer<{ tipoMime: 'image/webp'; contenidoBase64: string }>(ruta.slice('/api/v1'.length));
  }
}
