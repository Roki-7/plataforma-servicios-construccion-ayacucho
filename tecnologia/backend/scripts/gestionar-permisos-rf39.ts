import { readFile } from 'node:fs/promises';
import { userInfo } from 'node:os';
import { cargarConfiguracion } from '../src/composicion/configuracion.js';
import { leerConfiguracionRf39 } from '../src/composicion/configuracion-rf39.js';
import { crearProcedimientoRf39 } from '../src/composicion/procedimiento-rf39.js';
import type { AprobacionFirmada } from '../src/modulos/administracion/aplicacion/gestionar-permisos-rf39.js';

/**
 * Procedimiento operativo de permisos RF39. Subcomandos:
 *   verificar-config            valida la configuración protegida sin tocar la base de datos.
 *   constancia                  lee el Bearer de la persona designada por la ENTRADA ESTÁNDAR (nunca por argumentos) y emite una constancia.
 *   conceder <aprobacion.json>  consume la aprobación firmada por el Product Owner y concede el permiso.
 *   revocar <aprobacion.json>   revoca el permiso de la cuenta indicada en la aprobación.
 * El ejecutor es el principal autenticado del sistema operativo. No se acepta ningún nombre de actor por argumentos o variables.
 */
async function entradaEstandar(): Promise<string> {
  const trozos: Buffer[] = [];
  for await (const t of process.stdin) trozos.push(Buffer.from(t as Uint8Array));
  return Buffer.concat(trozos).toString('utf8').trim();
}

async function ejecutar(): Promise<void> {
  const [orden, archivo] = process.argv.slice(2);
  const configuracionRf39 = await leerConfiguracionRf39();
  if (orden === 'verificar-config') { process.stdout.write('Configuración protegida de RF39 verificada.\n'); return; }
  if (orden !== 'constancia' && orden !== 'conceder' && orden !== 'revocar') throw new Error('Subcomando desconocido.');
  const principal = userInfo().username.toLowerCase();
  const { gestor, cerrar } = await crearProcedimientoRf39(cargarConfiguracion(process.env), configuracionRf39);
  try {
    if (orden === 'constancia') {
      const r = await gestor.emitirConstancia(principal, await entradaEstandar());
      process.stdout.write(`Constancia emitida: ${r.constanciaId}\nCuenta acreditada: ${r.cuentaId}\n`);
      return;
    }
    if (!archivo) throw new Error('Indique el archivo de aprobación firmada.');
    const firmada = JSON.parse(await readFile(archivo, 'utf8')) as AprobacionFirmada;
    await (orden === 'conceder' ? gestor.conceder(principal, firmada) : gestor.revocar(principal, firmada));
    process.stdout.write(orden === 'conceder' ? 'Permiso RF39 concedido.\n' : 'Permiso RF39 revocado.\n');
  } finally { await cerrar(); }
}

try { await ejecutar(); }
catch (error) {
  // Mensajes controlados: nunca se reflejan tokens, claves ni valores de configuración.
  process.stderr.write(`${error instanceof Error && 'codigo' in error ? String((error as { codigo: string }).codigo) : 'No se pudo completar el procedimiento RF39.'}\n`);
  process.exitCode = 1;
}
