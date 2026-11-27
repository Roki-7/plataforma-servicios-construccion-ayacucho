import { cotizacionRetirada, datosInvalidos, limiteAclaraciones, solicitudNoAbierta } from './errores.js';

/**
 * Reglas puras de las aclaraciones (FR-342, RF18). Un hilo pertenece a UNA cotización (por su identidad, no por su versión), de modo que sobrevive a las
 * actualizaciones; un retiro seguido de un reenvío crea otra cotización con un hilo vacío. Texto plano, sin adjuntos, mensajes inmutables (sin edición ni borrado).
 */

export const LIMITE_DE_TEXTO = 1000;
export const LIMITE_POR_HILO = 20;
export type AutorDeAclaracion = 'CLIENTE' | 'PRESTADOR';

/** Recorta el texto y exige entre 1 y 1 000 caracteres. No reproduce el contenido en el error. */
export function normalizarTextoDeAclaracion(texto: string): string {
  const limpio = texto.trim();
  if (!limpio) throw datosInvalidos('texto', 'Escriba un mensaje.');
  if (limpio.length > LIMITE_DE_TEXTO) throw datosInvalidos('texto', `El mensaje admite hasta ${LIMITE_DE_TEXTO} caracteres.`);
  return limpio;
}

/** Número del próximo mensaje: consecutivo desde 1; el vigésimo primero se rechaza con 422 `LIMITE_ACLARACIONES`. */
export function numeroDelSiguienteMensaje(mensajesExistentes: number): number {
  if (mensajesExistentes >= LIMITE_POR_HILO) throw limiteAclaraciones();
  return mensajesExistentes + 1;
}

/** Tras retirar la cotización o cerrar la solicitud el hilo queda en lectura (CA-ACL-03). */
export function exigirHiloAbierto(e: { readonly cotizacionRetirada: boolean; readonly solicitudAbierta: boolean }): void {
  if (e.cotizacionRetirada) throw cotizacionRetirada();
  if (!e.solicitudAbierta) throw solicitudNoAbierta();
}

/** Participantes del hilo: el cliente dueño de la solicitud y el prestador autor de la cotización. Cualquier otro, ninguno. */
export function autorDelHilo(e: { readonly esDuenoDeLaSolicitud: boolean; readonly esAutorDeLaCotizacion: boolean }): AutorDeAclaracion | null {
  if (e.esDuenoDeLaSolicitud) return 'CLIENTE';
  if (e.esAutorDeLaCotizacion) return 'PRESTADOR';
  return null;
}
