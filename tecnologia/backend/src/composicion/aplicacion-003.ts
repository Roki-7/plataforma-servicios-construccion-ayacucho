import { crearAplicacion } from './app.module.js';
import type { Configuracion } from './configuracion.js';
import { registroOferta002, type OpcionesOferta002 } from './oferta-002.js';
import { registroOferta003, type OpcionesOferta003 } from './oferta-003.js';

/**
 * Aplicación compuesta definitiva: las 17 operaciones de la 001, las 23 de la 002 y las 18 de la 003 en un solo Nest, con unidad de trabajo,
 * idempotencia e identidad compartidas. No modifica `crearAplicacionCompleta002`, que sigue arrancando las 40 operaciones.
 */
export function crearAplicacionCompleta003(config: Configuracion, opciones: OpcionesOferta002 & OpcionesOferta003 & { readonly worker?: boolean; readonly registrar?: (linea: string) => void }) {
  const registro002 = registroOferta002(opciones);
  const registro003 = registroOferta003(opciones);
  return crearAplicacion(config, { ...(opciones.worker === undefined ? {} : { worker: opciones.worker }), ...(opciones.registrar ? { registrar: opciones.registrar } : {}),
    oferta002: { ...registro002, modo: 'completa' }, oferta003: { ...registro003, modo: 'completa' } });
}
