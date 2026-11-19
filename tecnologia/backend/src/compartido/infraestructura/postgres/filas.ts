/**
 * TypeORM devuelve `[filas, afectadas]` para UPDATE y DELETE con RETURNING en PostgreSQL y `filas` para SELECT.
 * Normaliza ambos resultados a la lista de filas.
 */
export function filasDe<T>(resultado: unknown): T[] {
  if (Array.isArray(resultado) && resultado.length === 2 && Array.isArray(resultado[0]) && typeof resultado[1] === 'number') return resultado[0] as T[];
  return resultado as T[];
}
