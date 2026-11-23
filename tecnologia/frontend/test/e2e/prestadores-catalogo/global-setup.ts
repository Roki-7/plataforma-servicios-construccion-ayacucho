import { leerPreparacion } from './soporte.js';

/**
 * T075: antes de abrir ningún navegador se exige la preparación que generó el ejecutor del anfitrión
 * (independencia de base, Redis, bucket y puertos de la 002 respecto de la 001 y del ensayo de restauración, y semilla verificada).
 * Sin ella, o si pertenece a otra ejecución, las pruebas no comienzan.
 */
export default async function globalSetup(): Promise<void> {
  const preparacion = await leerPreparacion();
  if (preparacion.independencia.identidad002.origen !== 'https://localhost:8444') throw new Error('El origen de la 002 debe ser https://localhost:8444.');
}
