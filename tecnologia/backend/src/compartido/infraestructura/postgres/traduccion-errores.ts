import { ErrorAplicacion } from '../../dominio/errores.js';
import type { CondicionBd } from '../../dominio/condicion-bd.js';
import { traducirConflictoReintentable } from '../../aplicacion/reintento-concurrencia.js';

/** Traductor de un módulo: devuelve el error de aplicación que corresponde a una condición esperada, o `undefined` si no la reconoce. */
export type TraductorDeCondicion = (condicion: CondicionBd) => ErrorAplicacion | undefined;

/** Lee el SQLSTATE, la restricción y la tabla de un error de `pg`, aunque TypeORM lo envuelva en `driverError` o `cause`. */
export function condicionDe(error: unknown): CondicionBd | undefined {
  let actual: unknown = error;
  for (let profundidad = 0; profundidad < 4 && actual !== null && typeof actual === 'object'; profundidad += 1) {
    const registro = actual as { code?: unknown; constraint?: unknown; table?: unknown; driverError?: unknown; cause?: unknown };
    if (typeof registro.code === 'string' && /^[0-9A-Z]{5}$/.test(registro.code)) {
      return {
        sqlstate: registro.code,
        ...(typeof registro.constraint === 'string' ? { restriccion: registro.constraint } : {}),
        ...(typeof registro.table === 'string' ? { tabla: registro.table } : {}),
      };
    }
    actual = registro.driverError ?? registro.cause;
  }
  return undefined;
}

/**
 * Convierte un error de persistencia en el error que debe ver el llamador:
 *  1. Un `ErrorAplicacion` ya traducido pasa intacto.
 *  2. Un interbloqueo (40P01) o un fallo de serialización (40001) se convierte en un conflicto reintentable.
 *  3. Una condición que el módulo reconoce (23505 o 23514 de una restricción conocida, 55P03) se convierte en su error de contrato.
 *  4. Cualquier otro error se devuelve SIN cambios: un fallo inesperado no se oculta ni se reinterpreta.
 * Debe llamarse DENTRO del trabajo de la unidad de trabajo: esta convierte en 503 genérico todo error que no sea `ErrorAplicacion`.
 */
export function traducirErrorBd(error: unknown, traductor: TraductorDeCondicion): unknown {
  if (error instanceof ErrorAplicacion) return error;
  const reintentable = traducirConflictoReintentable(error);
  if (reintentable !== error) return reintentable;
  const condicion = condicionDe(error);
  return (condicion ? traductor(condicion) : undefined) ?? error;
}

/** Ejecuta `trabajo` y traduce su fallo con `traducirErrorBd`. Es el envoltorio que usan los repositorios de la 003 en cada operación de escritura. */
export async function conTraduccionBd<T>(traductor: TraductorDeCondicion, trabajo: () => Promise<T>): Promise<T> {
  try { return await trabajo(); } catch (error) { throw traducirErrorBd(error, traductor); }
}
