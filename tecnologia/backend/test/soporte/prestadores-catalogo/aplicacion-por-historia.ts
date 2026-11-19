import { crearAplicacion } from '../../../src/composicion/app.module.js';
import { persistencia002, type RegistroPersistencia002 } from '../../../src/composicion/persistencia.js';
import { baseAislada002 } from './postgres.js';
import { configuracionDePrueba002 } from './entorno.js';
import { datasetFicticio002, type Historia002 } from './dataset-ficticio.js';

type Aplicacion = Awaited<ReturnType<typeof crearAplicacion>>;
type Opciones = NonNullable<Parameters<typeof crearAplicacion>[1]>;
type Registro = Extract<NonNullable<Opciones['oferta002']>, { modo: 'prueba' }>;
type Dataset = ReturnType<typeof datasetFicticio002>;
type Preparador<D> = {
  cargar(app: Aplicacion, datos: Dataset): Promise<D>;
  verificar(app: Aplicacion, datos: D): Promise<boolean>;
};

async function migrar(url: string, registro: readonly RegistroPersistencia002[]) {
  const db = persistencia002(url, registro);
  await db.initialize();
  try { await db.runMigrations({ transaction: 'each' }); }
  finally { await db.destroy(); }
}

export async function aplicacionPorHistoria<D>(historia: Historia002, registro: Omit<Registro, 'modo'>, preparador: Preparador<D>,
  observabilidad: Pick<Opciones, 'registrar' | 'registrarDiagnostico'> = {}) {
  const aislada = await baseAislada002();
  let app: Aplicacion | undefined;
  const cerrar = async () => {
    try { await app?.app.close(); }
    finally { await aislada.cerrar(); }
  };
  try {
    const config = await configuracionDePrueba002(aislada.url);
    await migrar(aislada.url, registro.persistencia ?? []);
    app = await crearAplicacion(config, { ...observabilidad, worker: false, oferta002: { ...registro, modo: 'prueba' } });
    const datos = await preparador.cargar(app, datasetFicticio002(historia));
    if (!await preparador.verificar(app, datos)) throw new Error(`Los datos de ${historia} no están listos para la prueba HTTP.`);
    return { ...app, config, datos, cerrar };
  } catch (error) {
    await cerrar();
    throw error;
  }
}
