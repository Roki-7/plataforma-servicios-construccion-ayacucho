import { crearAplicacion } from './app.module.js';
import type { Configuracion } from './configuracion.js';
import { registroOferta002, type OpcionesOferta002 } from './oferta-002.js';

/** Aplicación compuesta: las 17 operaciones de la 001 y las 23 de la 002 en un solo Nest, con unidad de trabajo, idempotencia e identidad compartidas. */
export function crearAplicacionCompleta002(config: Configuracion, opciones: OpcionesOferta002 & { readonly worker?: boolean; readonly registrar?: (linea: string) => void }) {
  const registro = registroOferta002(opciones);
  return crearAplicacion(config, { ...(opciones.worker === undefined ? {} : { worker: opciones.worker }), ...(opciones.registrar ? { registrar: opciones.registrar } : {}),
    oferta002: { ...registro, modo: 'completa' } });
}
