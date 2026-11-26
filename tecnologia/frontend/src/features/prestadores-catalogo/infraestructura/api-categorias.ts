import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { ApiCategorias } from '../aplicacion/puertos.js';
import type { CategoriaPublica } from '../modelos/contratos.js';

const noDisponible = (m = 'No fue posible comunicarse con el servidor.') => new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', m);
const esCategoria = (v: unknown): v is CategoriaPublica => {
  const c = v as Partial<Record<keyof CategoriaPublica, unknown>> | null;
  return typeof c === 'object' && c !== null && typeof c.categoriaId === 'string' && typeof c.nombre === 'string' && (c.categoriaPadreId === null || typeof c.categoriaPadreId === 'string');
};

/** Cliente HTTP anónimo del mismo origen. Nunca envía credenciales ni identidad. */
export class ApiCategoriasHttp implements ApiCategorias {
  constructor(private readonly solicitar: typeof fetch = (...a) => fetch(...a), private readonly base = '/api/v1') {
    if (base !== '/api/v1') throw new Error('La API debe utilizar el mismo origen /api/v1.');
  }
  async listar(): Promise<readonly CategoriaPublica[]> {
    let r: Response;
    try { r = await this.solicitar(`${this.base}/categorias`, { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' }); }
    catch { throw noDisponible(); }
    let datos: unknown;
    try { datos = await r.json(); } catch { throw noDisponible('Respuesta del servidor no válida.'); }
    if (!r.ok) {
      const d = datos as { codigo?: unknown; mensaje?: unknown };
      throw typeof d?.codigo === 'string' && typeof d.mensaje === 'string' ? new ErrorApi(r.status, d.codigo, d.mensaje) : noDisponible('Respuesta del servidor no válida.');
    }
    const lista = (datos as { categorias?: unknown })?.categorias;
    if (!Array.isArray(lista) || !lista.every(esCategoria)) throw noDisponible('Respuesta del servidor no válida.');
    return lista;
  }
}
