import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { cargarConfiguracion } from './configuracion.js';
import { cargarConfiguracion002 } from './configuracion-002.js';
import { crearAplicacion } from './app.module.js';
import { entornoTrasRestauracion } from './puerta-restauracion-002.js';
import { crearAplicacionCompleta002 } from './aplicacion-002.js';
import { ClienteRedis002 } from '../modulos/catalogo/infraestructura/cache/cliente-redis.js';
import { PortafolioS3 } from '../modulos/prestadores/infraestructura/archivos/portafolio-s3.js';

/** Composición base: solo Usuarios y acceso (17 operaciones). No cambia con la 002. */
export async function iniciar(): Promise<void> {
  const config = cargarConfiguracion();
  const { app } = await crearAplicacion(config);
  await app.listen(config.puerto, config.validacion ? '127.0.0.1' : '0.0.0.0');
  process.stdout.write('Backend iniciado con Usuarios y acceso (US1–US7).\n');
}

/** Composición completa de la 002 (40 operaciones) con el almacenamiento y la caché dedicados. Las migraciones se aplican antes con `db:migrate:002`. */
export async function iniciarValidacion002(entorno: NodeJS.ProcessEnv = process.env): Promise<{ readonly cerrar: () => Promise<void> }> {
  const config = cargarConfiguracion002(entorno);
  // Una base restaurada solo arranca si la restauración se completó, y con el espacio Redis nuevo que esta fijó.
  const env = await entornoTrasRestauracion(config.databaseUrl, entorno);
  const cliente = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey } });
  const redis = new ClienteRedis002(env);
  try {
    const { app } = await crearAplicacionCompleta002(config, { prestadores: { almacen: new PortafolioS3(cliente, config.s3.bucket) },
      busqueda: { cache: { almacen: redis, entorno: 'validacion' } }, categorias: { cache: { almacen: redis, entorno: 'validacion' } } });
    app.getHttpServer().once('close', () => { cliente.destroy(); redis.cerrar(); });
    await app.listen(config.puerto, '127.0.0.1');
    process.stdout.write('Backend iniciado con Usuarios y acceso, Prestadores, Catálogo y Administración (40 operaciones).\n');
    return { cerrar: () => app.close() };
  } catch (error) { cliente.destroy(); redis.cerrar(); throw error; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  iniciar().catch(() => { process.stderr.write('No fue posible iniciar el backend. Revise la configuración requerida.\n'); process.exitCode = 1; });
}
