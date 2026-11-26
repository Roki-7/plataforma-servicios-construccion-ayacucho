/**
 * Condición de base de datos reducida a lo que el dominio necesita para traducirla: el código SQLSTATE y, si PostgreSQL lo informó, el nombre de la
 * restricción y de la tabla. No contiene valores de columnas ni texto del servidor. La extrae la infraestructura (`traduccion-errores.ts`).
 */
export interface CondicionBd {
  readonly sqlstate: string;
  readonly restriccion?: string;
  readonly tabla?: string;
}

/** SQLSTATE que los módulos de la 003 distinguen. */
export const sqlstate = {
  violacionUnica: '23505',
  violacionCheck: '23514',
  bloqueoNoDisponible: '55P03',
  interbloqueo: '40P01',
  falloDeSerializacion: '40001',
} as const;
