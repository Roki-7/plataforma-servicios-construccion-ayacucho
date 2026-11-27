import { S3Client } from '@aws-sdk/client-s3';
import { cargarConfiguracion003 } from '../src/composicion/configuracion-003.js';
import { crearDataSource } from '../src/compartido/infraestructura/postgres/data-source.js';
import { LimpiezaSolicitudes, leerConfiguracionDeLimpieza, limpiezaPorOmision } from '../src/modulos/solicitudes/infraestructura/archivos/limpieza-solicitudes.js';
import { SolicitudesS3 } from '../src/modulos/solicitudes/infraestructura/archivos/solicitudes-s3.js';
import { exigirBase003, leerConfiguracion003 } from './entorno-003.js';

// `solicitudes:limpiar:003`. Una pasada del proceso de limpieza física sobre la base dedicada de la 003 y el bucket único (prefijo `solicitudes/`).
// Imprime solo conteos agregados: nunca claves, identificadores de solicitud ni datos personales. Termina con código distinto de cero si la pasada no pudo ejecutarse.
const comando = process.argv[2] === 'verificar' ? 'verificar' : 'limpiar';
let db: ReturnType<typeof crearDataSource> | undefined; let cliente: S3Client | undefined;
try {
  const env = await leerConfiguracion003();
  const config = cargarConfiguracion003({ ...env, DATABASE_URL: exigirBase003(env['DATABASE_URL']).href });
  const { umbralSegundos } = leerConfiguracionDeLimpieza(env);
  db = crearDataSource(config.databaseUrl); await db.initialize();
  cliente = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey } });
  const limpieza = new LimpiezaSolicitudes(db, new SolicitudesS3(cliente, config.s3.bucket), { ...limpiezaPorOmision, umbralSegundos });
  if (comando === 'limpiar') {
    const r = await limpieza.ejecutar();
    process.stdout.write(`Limpieza 003: ${JSON.stringify(r)}\n`);
  } else {
    const informe = await limpieza.verificar();
    process.stdout.write(`Verificación 003: ${JSON.stringify(informe)}\n`);
    // Todos los hallazgos del control dejan un código de salida distinto de cero.
    if (informe.hallazgos > 0) process.exitCode = 2;
  }
} catch {
  process.stderr.write(`No se pudo ejecutar ${comando === 'limpiar' ? 'la limpieza' : 'la verificación'} de archivos de la 003.\n`);
  process.exitCode = 1;
} finally {
  cliente?.destroy();
  if (db?.isInitialized) await db.destroy();
}
