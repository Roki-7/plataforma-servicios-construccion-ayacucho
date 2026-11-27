import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';

const errorRed = () => new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'No se pudo completar la operación. Reintente en unos momentos.');

export interface OpcionesDeSolicitud { metodo?: string; datos?: object; clave?: string; imagen?: boolean; signal?: AbortSignal }

/** Transporte HTTP común de Solicitudes y Cotizaciones: Bearer en memoria, sin cookies ni caché, errores del contrato como `ErrorApi`. */
export function crearTransporte(token: () => string | undefined, invalidar: () => void, raiz: string) {
  async function solicitar(ruta: string, opciones: OpcionesDeSolicitud = {}) {
    const headers = new Headers({ Accept: opciones.imagen ? 'image/webp' : 'application/json' });
    const acceso = token();
    if (acceso) headers.set('Authorization', `Bearer ${acceso}`);
    if (opciones.clave) headers.set('Idempotency-Key', opciones.clave);
    if (opciones.datos) headers.set('Content-Type', 'application/json');
    let respuesta: Response;
    try {
      respuesta = await fetch(raiz + ruta, {
        method: opciones.metodo ?? 'GET', headers, credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer',
        ...(opciones.datos ? { body: JSON.stringify(opciones.datos) } : {}),
        ...(opciones.signal ? { signal: opciones.signal } : {}),
      });
    } catch { throw errorRed(); }
    if (respuesta.status === 401) invalidar();
    if (!respuesta.ok) {
      const error: unknown = await respuesta.json().catch(() => undefined);
      if (error && typeof error === 'object' && 'codigo' in error && typeof error.codigo === 'string' && 'mensaje' in error && typeof error.mensaje === 'string') {
        const detalles = 'detalles' in error && Array.isArray(error.detalles)
          ? error.detalles.filter((d): d is { campo?: string; motivo: string } => d && typeof d.motivo === 'string' && (d.campo === undefined || typeof d.campo === 'string'))
          : [];
        throw new ErrorApi(respuesta.status, error.codigo, error.mensaje, detalles);
      }
      throw errorRed();
    }
    return respuesta;
  }
  async function json<T>(ruta: string, opciones?: Parameters<typeof solicitar>[1]): Promise<T> {
    return (await solicitar(ruta, opciones)).json() as Promise<T>;
  }
  return { solicitar, json };
}
