/**
 * El formato UUID admite mayúsculas y minúsculas, pero PostgreSQL y las referencias persistidas usan minúsculas.
 * Se normaliza solo un UUID ya validado por el contrato, antes de compararlo en memoria o de usarlo como parte de una clave.
 */
export const uuidEnMinusculas = (id: string): string => id.toLowerCase();
