import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { ApiPrestadores } from '../aplicacion/puertos.js';
import type { EntradaPerfil, EntradaTrabajo, EscrituraFotografia, FotografiaModificada, ImagenPublica, PerfilPrivado, TrabajoCreado, TrabajoPrivado } from '../modelos/contratos.js';

/** Cliente HTTP del mismo origen. El token de acceso permanece en memoria y la identidad nunca viaja en el cuerpo. */
export class ApiPrestadoresHttp implements ApiPrestadores {
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
  obtenerPerfil() { return this.enviar<PerfilPrivado>('GET', '/prestadores/perfil'); }
  guardarPerfil(version: number, e: EntradaPerfil, clave: string) { return this.enviar<PerfilPrivado>('PUT', '/prestadores/perfil', { version, ...e }, clave); }
  crearTrabajo(versionPerfil: number, d: EntradaTrabajo, clave: string) { return this.enviar<TrabajoCreado>('POST', '/prestadores/perfil/trabajos', { versionPerfil, ...d }, clave); }
  editarTrabajo(trabajoId: string, version: number, cambios: Partial<EntradaTrabajo>, clave: string) { return this.enviar<TrabajoPrivado>('PATCH', `/prestadores/perfil/trabajos/${this.id(trabajoId)}`, { version, ...cambios }, clave); }
  agregarFotografia(trabajoId: string, e: EscrituraFotografia, clave: string) { return this.enviar<FotografiaModificada>('POST', `/prestadores/perfil/trabajos/${this.id(trabajoId)}/fotografias`, e, clave); }
  reemplazarFotografia(trabajoId: string, fotografiaId: string, e: EscrituraFotografia, clave: string) { return this.enviar<FotografiaModificada>('PUT', `/prestadores/perfil/trabajos/${this.id(trabajoId)}/fotografias/${this.id(fotografiaId)}`, e, clave); }
  eliminarFotografia(trabajoId: string, fotografiaId: string, versionTrabajo: number, clave: string) { return this.enviar<{ versionTrabajo: number }>('DELETE', `/prestadores/perfil/trabajos/${this.id(trabajoId)}/fotografias/${this.id(fotografiaId)}?version=${versionTrabajo}`, undefined, clave); }
  obtenerFotografiaPublica(prestadorId: string, trabajoId: string, fotografiaId: string) { return this.enviar<ImagenPublica>('GET', `/prestadores/${this.id(prestadorId)}/trabajos/${this.id(trabajoId)}/fotografias/${this.id(fotografiaId)}`); }
}
