import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { ApiSolicitudes, SolicitudPrivada, SolicitudVisible } from '../modelos/contratos.js';
import { crearTransporte } from './transporte.js';

const raiz = '/api/v1/solicitudes';
const recurso = (id: string) => '/' + encodeURIComponent(id);

export function crearApiSolicitudes(token: () => string | undefined, invalidar: () => void): ApiSolicitudes {
  const { solicitar, json } = crearTransporte(token, invalidar, raiz);
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
