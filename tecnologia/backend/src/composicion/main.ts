import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { cargarConfiguracion } from './configuracion.js';
import { crearAplicacion } from './app.module.js';

export async function iniciar(): Promise<void> {
  const config = cargarConfiguracion();
  const { app } = await crearAplicacion(config);
  await app.listen(config.puerto, config.validacion ? '127.0.0.1' : '0.0.0.0');
  process.stdout.write('Backend iniciado con Usuarios y acceso (US1–US7).\n');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  iniciar().catch(() => { process.stderr.write('No fue posible iniciar el backend. Revise la configuración requerida.\n'); process.exitCode = 1; });
}
