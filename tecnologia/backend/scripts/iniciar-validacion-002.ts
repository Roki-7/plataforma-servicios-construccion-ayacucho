import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { backend } from './entorno.js';
import { comprobarRuntime } from '../src/composicion/runtime.js';
import { leerConfiguracion002 } from './entorno-002.js';

const acciones = {
  migrar: { archivo: 'scripts/migrar-002.ts', tareas: 'T008 y T067' },
  storage: { archivo: 'scripts/inicializar-storage-002.ts', tareas: 'T029' },
  seed: { archivo: 'scripts/seed-prestadores-catalogo.ts', tareas: 'T067' },
} as const;

async function ejecutar(): Promise<void> {
  comprobarRuntime();
  const accion = process.argv[2];
  if (!accion || (accion !== 'iniciar' && !Object.hasOwn(acciones, accion))) throw new Error('Acción de validación 002 desconocida.');
  const env = await leerConfiguracion002();
  const args = process.argv.slice(3);
  if (args.length === 1 && args[0] === '--verificar-config') {
    process.stdout.write('Configuración dedicada de la 002 verificada.\n');
    return;
  }
  if (accion === 'iniciar') {
    const iniciar: unknown = Reflect.get(await import('../src/composicion/main.js'), 'iniciarValidacion002');
    if (typeof iniciar !== 'function') throw new Error('Arranque de la 002 pendiente de T066–T067.');
    await iniciar(env);
    return;
  }
  const entrada = acciones[accion as keyof typeof acciones];
  const archivo = resolve(backend, entrada.archivo);
  if (!existsSync(archivo)) throw new Error(`Acción ${accion} de la 002 pendiente de ${entrada.tareas}.`);
  const resultado = spawnSync(process.execPath, ['--import', 'tsx', archivo, ...args], { cwd: backend, env, stdio: 'inherit' });
  if (resultado.error || resultado.status === null) throw new Error(`No se pudo ejecutar la acción ${accion} de la 002.`);
  process.exitCode = resultado.status;
}

try {
  await ejecutar();
} catch (error) {
  // Los errores de lectura del sistema no necesitan revelar rutas locales o valores de configuración.
  const mensaje = error instanceof Error && !('code' in error) ? error.message : 'Prepare la configuración local de la 002 antes de ejecutar el comando.';
  process.stderr.write(`${mensaje}\n`);
  process.exitCode = 1;
}
