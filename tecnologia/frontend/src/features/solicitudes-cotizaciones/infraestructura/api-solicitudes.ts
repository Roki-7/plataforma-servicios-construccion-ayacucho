import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { ApiSolicitudes, SolicitudPrivada, SolicitudVisible } from '../modelos/contratos.js';

const raiz = '/api/v1/solicitudes';
const recurso = (id: string) => '/' + encodeURIComponent(id);
const errorRed = () => new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'No se pudo completar la operación. Reintente en unos momentos.');

export function crearApiSolicitudes(token: () => string | undefined, invalidar: () => void): ApiSolicitudes {
  async function solicitar(ruta: string, opciones: { metodo?: string; datos?: object; clave?: string; imagen?: boolean; signal?: AbortSignal } = {}) {
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
  return {
    listar: (pagina, estado) => json('?' + new URLSearchParams({ rol: 'cliente', pagina: String(pagina), ...(estado ? { estado } : {}) })),
    oportunidades: pagina => json('/oportunidades?' + new URLSearchParams({ pagina: String(pagina) })),
    listarComoPrestador: (pagina, estado) => json('?' + new URLSearchParams({ rol: 'prestador', pagina: String(pagina), ...(estado ? { estado } : {}) })),
    obtenerVisible: async id => {
      const detalle = await json<SolicitudPrivada | SolicitudVisible>(recurso(id));
      if (!('titulos' in detalle)) throw new ErrorApi(409, 'SOLICITUD_PROPIA', 'Esta solicitud es tuya. Gestiónala desde Mis solicitudes.');
      return detalle;
    },
    obtener: async id => {
      const detalle = await json<SolicitudPrivada | { titulos: string[] }>(recurso(id));
      if ('titulos' in detalle) throw new Error('Solo puedes gestionar tus propias solicitudes.');
      return detalle;
    },
    crear: (datos, clave) => json('', { metodo: 'POST', datos, clave }),
    editar: (id, datos, clave) => json(recurso(id), { metodo: 'PATCH', datos, clave }),
    publicar: (id, datos, clave) => json(recurso(id) + '/publicacion', { metodo: 'POST', datos, clave }),
    cerrar: (id, version, clave) => json(recurso(id) + '/cierre', { metodo: 'POST', datos: { version }, clave }),
    cargar: (id, tipoMime, contenidoBase64, clave) => json(recurso(id) + '/archivos', { metodo: 'POST', datos: { tipoMime, contenidoBase64 }, clave }),
    foto: async (id, archivoId, signal) => (await solicitar(recurso(id) + '/archivos' + recurso(archivoId), { imagen: true, signal })).blob(),
    versiones: (id, pagina) => json(recurso(id) + '/historial?' + new URLSearchParams({ tipo: 'versiones', pagina: String(pagina) })),
  };
}
