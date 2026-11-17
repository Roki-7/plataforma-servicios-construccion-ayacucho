import { cargarLocal } from '../../scripts/entorno.js';
import { cargarConfiguracion } from '../../src/composicion/configuracion.js';
import { persistenciaFundacional } from '../../src/composicion/persistencia.js';
import { cuentaFicticia } from './fixtures.js';
import { exigirBaseValidacion } from './postgres.js';
import { idCuenta } from '../../src/modulos/usuarios-acceso/dominio/identificadores.js';
cargarLocal(); const config = cargarConfiguracion();
if (!config.validacion) throw new Error('Fixture exclusivamente de validación.');
exigirBaseValidacion(config.databaseUrl); const db = persistenciaFundacional(config.databaseUrl);
try {
  await db.initialize();
  async function crear() {
    const c = await cuentaFicticia(db);
    return { acceso: c.acceso, perfil: { cuentaId: c.id, nombreMostrar: 'Cuenta ficticia', correo: c.correo, telefono: null, distrito: null, fotografiaId: null, perfiles: ['cliente'], telefonoCompartible: false, version: 1 } };
  }
  if (process.argv[2] === 'crear') {
    process.stdout.write(JSON.stringify(await crear()));
  } else if (process.argv[2] === 'crear-matriz') {
    const matriz: Record<string, Awaited<ReturnType<typeof crear>>> = {};
    for (const motor of ['chromium', 'firefox', 'webkit']) for (const ancho of [360, 768, 1366]) matriz[`${motor}-${ancho}`] = await crear();
    process.stdout.write(JSON.stringify(matriz));
  } else if (process.argv[2] === 'cerrar') {
    if (process.argv.length < 4) throw new Error('Falta identidad ficticia.');
    for (const valor of process.argv.slice(3)) {
      const id = idCuenta(valor);
      await db.transaction(async (m) => { await m.query('DELETE FROM claves_idempotencia WHERE ambito=$1', [`usuario:${id}`]); await m.query('DELETE FROM sesiones WHERE usuario_id=$1', [id]); await m.query('DELETE FROM usuarios WHERE id=$1 AND nombre_mostrar=$2 AND politica_privacidad_version=$3', [id, 'Cuenta ficticia', 'validacion-v1']); });
    }
  } else throw new Error('Operación fixture no válida.');
} finally { await db.destroy(); }
