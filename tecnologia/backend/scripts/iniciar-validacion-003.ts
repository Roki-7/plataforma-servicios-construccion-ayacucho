import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { backend } from './entorno.js';
import { comprobarRuntime } from '../src/composicion/runtime.js';
import { leerConfiguracion003 } from './entorno-003.js';

// Punto de entrada de los comandos de validación de la 003 (T008): `iniciar`, `migrar`, `storage` y `seed`.
// Igual que `iniciar-validacion-002.ts`, delega en el script de cada acción. Los scripts de cada acción los crean las tareas indicadas;
// mientras no existan, la acción lo dice con claridad y falla sin tocar ninguna infraestructura.
const acciones = {
  migrar: { archivo: 'scripts/migrar-003.ts', tareas: 'T012 y T029' },
  storage: { archivo: 'scripts/inicializar-storage-003.ts', tareas: 'T041' },
  seed: { archivo: 'scripts/seed-solicitudes-cotizaciones.ts', tareas: 'T042' },
} as const;

async function ejecutar(): Promise<void> {
  comprobarRuntime();
  const accion = process.argv[2];
  if (!accion || (accion !== 'iniciar' && !Object.hasOwn(acciones, accion))) throw new Error('Acción de validación 003 desconocida.');
  const env = await leerConfiguracion003();
  const args = process.argv.slice(3);
  if (args.length === 1 && args[0] === '--verificar-config') {
    process.stdout.write('Configuración dedicada de la 003 verificada.\n');
    return;
  }
  if (accion === 'iniciar') {
    const iniciar: unknown = Reflect.get(await import('../src/composicion/main.js'), 'iniciarValidacion003');
    if (typeof iniciar !== 'function') throw new Error('Arranque de la 003 pendiente de T013.');
    await iniciar(env);
    return;
  }
  const entrada = acciones[accion as keyof typeof acciones];
  const archivo = resolve(backend, entrada.archivo);
  if (!existsSync(archivo)) throw new Error(`Acción ${accion} de la 003 pendiente de ${entrada.tareas}.`);
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', archivo, ...args], { cwd: backend, env, stdio: 'inherit' });
  if (resultado.error || resultado.status === null) throw new Error(`No se pudo ejecutar la acción ${accion} de la 003.`);
  process.exitCode = resultado.status;
}

try {
  await ejecutar();
} catch (error) {
  // Los errores de lectura del sistema no necesitan revelar rutas locales o valores de configuración.
  const mensaje = error instanceof Error && !('code' in error) ? error.message : 'Prepare la configuración local de la 003 antes de ejecutar el comando.';
  process.stderr.write(`${mensaje}\n`);
  process.exitCode = 1;
}
