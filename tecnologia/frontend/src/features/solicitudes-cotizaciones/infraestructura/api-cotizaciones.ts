import type { ApiCotizaciones, Cotizacion, CotizacionDetalle } from '../modelos/cotizaciones.js';
import type { Pagina } from '../modelos/contratos.js';
import { crearTransporte } from './transporte.js';

const recurso = (id: string) => '/' + encodeURIComponent(id);

/** Cliente HTTP de HU10. Mismo transporte que Solicitudes: Bearer en memoria, sin cookies ni caché, y `Idempotency-Key` en cada mutación. */
export function crearApiCotizaciones(token: () => string | undefined, invalidar: () => void): ApiCotizaciones {
  const { json } = crearTransporte(token, invalidar, '/api/v1');
  return {
    enviar: (solicitudId, datos, clave) => json<Cotizacion>(`/solicitudes${recurso(solicitudId)}/cotizaciones`, { metodo: 'POST', datos, clave }),
    actualizar: (cotizacionId, datos, clave) => json<Cotizacion>(`/cotizaciones${recurso(cotizacionId)}/versiones`, { metodo: 'POST', datos, clave }),
    retirar: (cotizacionId, versionCotizacion, clave) => json<Cotizacion>(`/cotizaciones${recurso(cotizacionId)}/retiro`, { metodo: 'POST', datos: { versionCotizacion }, clave }),
    obtener: cotizacionId => json<CotizacionDetalle>(`/cotizaciones${recurso(cotizacionId)}`),
    mias: pagina => json<Pagina<Cotizacion>>('/cotizaciones?' + new URLSearchParams({ pagina: String(pagina) })),
  };
}
