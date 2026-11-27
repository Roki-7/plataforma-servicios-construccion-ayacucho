import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';

// Puertos de Cotizaciones hacia otros módulos distintos de Solicitudes. Los implementa la composición con las api-publica de Usuarios y acceso, Prestadores y Catálogo:
// este módulo solo importa la api-publica de Solicitudes.

export interface IdentidadDeCotizador { readonly cuentaId: string; readonly perfiles: readonly string[] }
/** Revalida la sesión con una conexión libre del pool, antes de abrir la transacción de escritura. */
export interface IdentidadesDeCotizaciones { exigir(token: string): Promise<IdentidadDeCotizador> }
/** Perfil profesional de la cuenta. `null` si no tiene. */
export interface PerfilesDePrestador { perfilDeCuenta(cuentaId: string, tx?: ContextoTransaccion): Promise<{ readonly prestadorId: string } | null> }
export interface CoberturaDePrestador {
  readonly categorias: ReadonlySet<string>;
  readonly distritos: readonly string[];
}
/**
 * Categorías cubiertas por servicios publicados y elegibles, y zonas de atención. Toma el bloqueo compartido de la revisión de Catálogo en la transacción: es el
 * paso 2 del orden único de bloqueos (idempotencia → revisión → solicitud → cotización).
 */
export interface CoberturasDePrestador { cargar(prestadorId: string, tx: ContextoTransaccion): Promise<CoberturaDePrestador> }
/** Traduce las condiciones de base de datos esperadas dentro de la transacción de escritura. */
export type TraducirEscrituraDeCotizacion = <T>(trabajo: () => Promise<T>) => Promise<T>;
