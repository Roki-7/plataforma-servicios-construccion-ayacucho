import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { Oportunidad, TipoSolicitud, TituloAcceso } from '../modelos/contratos.js';

export const etiquetasTitulo: Record<TituloAcceso, string> = {
  DESTINATARIO: 'Dirigida a ti',
  COMPATIBLE: 'Compatible con tus servicios',
  AUTOR_DE_COTIZACION: 'Con tu cotización',
};

export const etiquetaTipo = (tipo: TipoSolicitud) => tipo === 'DIRIGIDA' ? 'Dirigida' : 'Pública';

/** Texto de la política de fotografías de una oportunidad: el prestador solo sabe si existen y si el cliente las compartió. */
export function estadoFotografias(o: Pick<Oportunidad, 'hayFotografias' | 'fotografiasCompartidas'>): string {
  if (!o.hayFotografias) return 'Sin fotografías';
  return o.fotografiasCompartidas ? 'Fotografías compartidas' : 'Fotografías no compartidas por el cliente';
}

/** Fecha de calendario («AAAA-MM-DD»). Se formatea en UTC para que ninguna zona horaria la desplace un día. */
export const fechaCalendario = (fecha: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${fecha}T00:00:00Z`));

export function periodo(desde: string | undefined, hasta: string | undefined): string | undefined {
  if (!desde) return undefined;
  return hasta && hasta !== desde ? `Del ${fechaCalendario(desde)} al ${fechaCalendario(hasta)}` : `Desde el ${fechaCalendario(desde)}`;
}

/**
 * Los mensajes no distinguen entre una solicitud inexistente y una a la que la cuenta no tiene acceso: el servidor responde igual (404) y la pantalla
 * tampoco debe sugerir que existe.
 */
export function mensajePrestador(error: unknown): string {
  if (error instanceof ErrorApi) {
    if (error.http === 404) return 'Esta solicitud no está disponible. Puede haber sido cerrada, haber cambiado o no corresponder a tus servicios y zonas.';
    if (error.http === 403) return 'Para consultar solicitudes, habilita el perfil de prestador en Mis perfiles.';
    if (error.codigo === 'SOLICITUD_PROPIA') return error.message;
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}
