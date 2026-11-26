import { ErrorAplicacion } from '../dominio/errores.js';

/** Interbloqueo detectado por PostgreSQL. */
export const INTERBLOQUEO = '40P01';
/** Fallo de serialización. */
export const FALLO_DE_SERIALIZACION = '40001';

const MENSAJE = 'Hubo un conflicto con otra operación simultánea. Intente de nuevo.';

/** Conflicto concurrente que el ayudante puede reintentar. Lo producen los adaptadores al traducir un interbloqueo o un fallo de serialización. */
export class ConflictoReintentable extends ErrorAplicacion {
  constructor() { super(409, 'CONFLICTO_CONCURRENTE', MENSAJE); this.name = 'ConflictoReintentable'; }
}

/** Código SQLSTATE de un error de PostgreSQL, tal como lo expone `pg` o lo envuelve TypeORM (`driverError` o `cause`). */
export function codigoPostgres(error: unknown): string | undefined {
  let actual: unknown = error;
  for (let profundidad = 0; profundidad < 4 && actual !== null && typeof actual === 'object'; profundidad += 1) {
    const registro = actual as { code?: unknown; driverError?: unknown; cause?: unknown };
    if (typeof registro.code === 'string' && /^[0-9A-Z]{5}$/.test(registro.code)) return registro.code;
    actual = registro.driverError ?? registro.cause;
  }
  return undefined;
}

/**
 * Traduce un interbloqueo (40P01) o un fallo de serialización (40001) a un conflicto reintentable. Cualquier otro error se devuelve sin cambios:
 * no se oculta ni se reinterpreta. Pensado para los adaptadores de persistencia, que traducen dentro de la transacción antes de que la unidad
 * de trabajo la revierta y oculte el código original.
 */
export function traducirConflictoReintentable(error: unknown): unknown {
  const codigo = codigoPostgres(error);
  return codigo === INTERBLOQUEO || codigo === FALLO_DE_SERIALIZACION ? new ConflictoReintentable() : error;
}

export function esReintentable(error: unknown): boolean {
  if (error instanceof ConflictoReintentable) return true;
  const codigo = codigoPostgres(error);
  return codigo === INTERBLOQUEO || codigo === FALLO_DE_SERIALIZACION;
}

export interface OpcionesReintento {
  /** Reintentos adicionales al primer intento. Por omisión, 2. */
  readonly reintentos?: number;
  /** Espera antes de cada reintento, en milisegundos. Por omisión, aleatoria entre 10 y 49 ms. */
  readonly esperaMs?: (reintento: number) => number;
  /** Sustituible en pruebas. */
  readonly dormir?: (ms: number) => Promise<void>;
}

const esperaAleatoria = (): number => 10 + Math.floor(Math.random() * 40);
const dormirReal = (ms: number): Promise<void> => new Promise(resolver => { setTimeout(resolver, ms); });

/**
 * Ejecuta `trabajo` (una unidad de trabajo completa) y, si falla por un interbloqueo o un fallo de serialización, lo repite hasta `reintentos` veces
 * con una espera corta y aleatoria. Si el conflicto persiste responde 409 `CONFLICTO_CONCURRENTE`. Cualquier otro error, esperado o no,
 * se propaga sin reintentar y sin modificarlo. `trabajo` debe abrir su propia transacción en cada llamada.
 */
export async function conReintentoDeConcurrencia<T>(trabajo: (intento: number) => Promise<T>, opciones: OpcionesReintento = {}): Promise<T> {
  const reintentos = opciones.reintentos ?? 2;
  const espera = opciones.esperaMs ?? esperaAleatoria;
  const dormir = opciones.dormir ?? dormirReal;
  for (let intento = 0; ; intento += 1) {
    try {
      return await trabajo(intento);
    } catch (error) {
      if (!esReintentable(error)) throw error;
      if (intento >= reintentos) throw new ErrorAplicacion(409, 'CONFLICTO_CONCURRENTE', MENSAJE);
      await dormir(espera(intento + 1));
    }
  }
}
