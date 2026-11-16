import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { cargarLocal, local } from './entorno.js';
import { CatalogoLocal } from '../src/modulos/usuarios-acceso/infraestructura/seguridad/catalogo-contrasenas.js';
import { cargarConfiguracion } from '../src/composicion/configuracion.js';

cargarLocal();
const config = cargarConfiguracion();
if (process.argv.includes('--fixture')) {
  if (!config.validacion) throw new Error('El catálogo fixture solo se admite en validación.');
  const carpeta = resolve(local, 'catalogo'); await mkdir(carpeta, { recursive: true });
  const comunes = JSON.stringify(['passwordpassword', 'contraseña común de prueba', '123456789012345']) + '\n';
  const comprometidas = ['comprometida ficticia 001', 'otra comprometida ficticia 001'].map((s) => createHash('sha1').update(s).digest('hex').toUpperCase()).sort().join('\n') + '\n';
  await writeFile(resolve(carpeta, 'comunes.json'), comunes, { mode: 0o600 });
  await writeFile(resolve(carpeta, 'comprometidas.sha1'), comprometidas, { mode: 0o600 });
  const checksum = (s: string) => createHash('sha256').update(s).digest('hex');
  await writeFile(config.catalogo, JSON.stringify({ version: 'fixture-001-v1', fecha: '2026-11-16', tipo: 'fixture', aprobado: true,
    comunes: { archivo: 'comunes.json', sha256: checksum(comunes) }, comprometidas: { archivo: 'comprometidas.sha1', sha256: checksum(comprometidas), registros: 2 } }, null, 2), { mode: 0o600 });
}
const catalogo = new CatalogoLocal(config.catalogo, config.validacion);
await catalogo.inicializar();
if (!await catalogo.preparada()) throw new Error('No se pudo verificar el catálogo local.');
process.stdout.write('Catálogo local verificado; fixture nunca habilitado para producción.\n');
