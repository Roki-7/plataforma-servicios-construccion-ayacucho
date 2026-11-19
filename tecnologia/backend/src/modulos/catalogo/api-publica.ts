import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';

export type { Clasificacion, DistritoCodigo } from './dominio/clasificacion.js';
export type { ProyeccionPublica, ProyeccionPrestador } from './aplicacion/puertos/proyeccion-publica.js';

export interface RevisionDeOferta {
  vigente(tx?: ContextoTransaccion): Promise<bigint>;
  bloquear(tx: ContextoTransaccion, modo: 'compartido' | 'exclusivo'): Promise<bigint>;
  incrementar(tx: ContextoTransaccion): Promise<bigint>;
}

// Dentro de cada nivel, adquirir las filas por identificador.
export const ordenBloqueosOferta = ['permiso-rf39', 'idempotencia', 'revision-oferta', 'clasificacion-raiz',
  'subcategoria', 'servicio', 'perfil', 'trabajo'] as const;

export { distritosCanonicos } from './dominio/clasificacion.js';

/** Contrato interno para validar clasificaciones declaradas. Resuelve la actividad efectiva con su jerarquía. */
export interface ClasificacionesEfectivas {
  efectivamenteActivas(tx: ContextoTransaccion, ids: readonly string[]): Promise<ReadonlySet<string>>;
}
