import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataSource } from 'typeorm';
import { cargarLocal, local } from '../../scripts/entorno.js';
import { cargarConfiguracion } from '../../src/composicion/configuracion.js';
import { persistenciaFundacional } from '../../src/composicion/persistencia.js';
import { HashArgon2id } from '../../src/modulos/usuarios-acceso/infraestructura/seguridad/argon2id.js';
import { exigirBaseValidacion } from './postgres.js';

export async function cuentaFicticia(db: DataSource, perfiles: readonly string[] = ['cliente'], correo?: string) {
  const id = randomUUID(); const sesionId = randomUUID(); const acceso = randomBytes(32).toString('base64url'); const renovacion = randomBytes(32).toString('base64url');
  const contrasena = 'Clave ficticia de validacion 001 '; const phc = await new HashArgon2id().crear(contrasena);
  const direccion = correo ?? `${id}@example.invalid`;
  await db.transaction(async (manager) => {
    const fechas: { ahora: Date }[] = await manager.query('SELECT clock_timestamp() AS ahora'); const ahora = fechas[0]?.ahora;
    if (!ahora) throw new Error('Reloj de validación no disponible.');
    await manager.query(`INSERT INTO usuarios(id,correo,nombre_mostrar,contrasena_hash,politica_privacidad_version,privacidad_aceptada_en) VALUES($1,$2,'Cuenta ficticia',$3,'validacion-v1',$4)`, [id, direccion, phc, ahora]);
    for (const perfil of perfiles) await manager.query('INSERT INTO perfiles_habilitados(usuario_id,perfil,confirmado_por_titular_en) VALUES($1,$2,$3)', [id, perfil, ahora]);
    await manager.query(`INSERT INTO sesiones(id,usuario_id,acceso_digest,acceso_vence_en,renovacion_digest,renovacion_vence_en,autenticada_con_contrasena_en,creada_en,renovada_en) VALUES($1,$2,$3,$4,$5,$6,$7,$7,$7)`,
      [sesionId, id, createHash('sha256').update(acceso).digest(), new Date(ahora.getTime() + 900000), createHash('sha256').update(renovacion).digest(), new Date(ahora.getTime() + 604800000), ahora]);
  });
  return { id, sesionId, correo: direccion, contrasena, acceso, renovacion, perfiles };
}
async function sembrar(): Promise<void> {
  cargarLocal(); const config = cargarConfiguracion();
  if (!config.validacion) throw new Error('No se pueden sembrar cuentas fuera de validación.');
  exigirBaseValidacion(config.databaseUrl); const db = persistenciaFundacional(config.databaseUrl);
  try {
    await db.initialize();
    const cliente = await cuentaFicticia(db, ['cliente']); const prestador = await cuentaFicticia(db, ['prestador']); const ambos = await cuentaFicticia(db, ['cliente', 'prestador']);
    const administrativa = await cuentaFicticia(db, ['cliente']);
    await writeFile(resolve(local, 'fixtures.json'), JSON.stringify({ cliente, prestador, ambos, administrativaReferencia: { ...administrativa, referenciaAdministrativa: true } }, null, 2), { mode: 0o600 });
    process.stdout.write('Cuentas y sesiones ficticias guardadas solo en .local; no se creó un rol administrativo.\n');
  } finally { if (db.isInitialized) await db.destroy(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await sembrar();
