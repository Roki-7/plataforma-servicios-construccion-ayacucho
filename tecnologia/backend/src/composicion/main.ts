import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { cargarConfiguracion } from './configuracion.js';
import { cargarConfiguracion002 } from './configuracion-002.js';
import { crearAplicacion } from './app.module.js';
import { entornoTrasRestauracion } from './puerta-restauracion-002.js';
import { crearAplicacionCompleta002 } from './aplicacion-002.js';
import { crearAplicacionConHistorias003 } from './aplicacion-003.js';
import { cargarConfiguracion003 } from './configuracion-003.js';
import { iniciarLimpiezaPeriodica003 } from './solicitudes-003.js';
import { leerConfiguracionDeLimpieza, limpiezaPorOmision } from '../modulos/solicitudes/infraestructura/archivos/limpieza-solicitudes.js';
import { SolicitudesS3 } from '../modulos/solicitudes/infraestructura/archivos/solicitudes-s3.js';
import { ClienteRedis002 } from '../modulos/catalogo/infraestructura/cache/cliente-redis.js';
import { PortafolioS3 } from '../modulos/prestadores/infraestructura/archivos/portafolio-s3.js';

export type Composicion = 'base' | 'oferta-002' | 'oferta-003';

/**
 * Composición que arranca el punto de entrada. Por omisión es la base de Usuarios y acceso (17 operaciones), igual que antes de la 002. La composición completa
 * (40 operaciones) solo se activa de forma explícita con COMPOSICION=oferta-002. Cualquier otro valor se rechaza: no hay una composición implícita.
 */
export function composicionSolicitada(env: NodeJS.ProcessEnv): Composicion {
  const valor = env['COMPOSICION'];
  if (valor === undefined || valor === '' || valor === 'base') return 'base';
  if (valor === 'oferta-002') return 'oferta-002';
  if (valor === 'oferta-003') return 'oferta-003';
  throw new Error('COMPOSICION no es válida: use base, oferta-002 u oferta-003.');
}

/** Composición base: solo Usuarios y acceso (17 operaciones). Con COMPOSICION=oferta-002 arranca la composición completa de la 002. */
export async function iniciar(): Promise<{ readonly cerrar: () => Promise<void> }> {
  const composicion = composicionSolicitada(process.env);
  if (composicion === 'oferta-002') return iniciarOferta002(process.env);
  if (composicion === 'oferta-003') return iniciarOferta003(process.env);
  const config = cargarConfiguracion();
  const { app } = await crearAplicacion(config);
  await app.listen(config.puerto, config.validacion ? '127.0.0.1' : '0.0.0.0');
  process.stdout.write('Backend iniciado con Usuarios y acceso (US1–US7).\n');
  return { cerrar: () => app.close() };
}

/**
 * Composición completa de la 002 (40 operaciones) con el almacenamiento y la caché dedicados. Las migraciones se aplican antes con `db:migrate:002`.
 * El origen, las cookies de sesión y los controles de seguridad son los mismos de la base: la composición solo añade las operaciones de la 002. En validación
 * escucha solo en 127.0.0.1 (detrás del proxy TLS del entorno). Una base de restauración no arranca si su puerta no está ABIERTA.
 */
export async function iniciarOferta002(entorno: NodeJS.ProcessEnv = process.env): Promise<{ readonly cerrar: () => Promise<void> }> {
  const config = cargarConfiguracion002(entorno);
  // Una base restaurada solo arranca si la restauración se completó, y con el espacio Redis nuevo que esta fijó.
  const env = await entornoTrasRestauracion(config.databaseUrl, entorno);
  const cliente = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey } });
  const redis = new ClienteRedis002(env);
  const cache = { almacen: redis, entorno: config.validacion ? 'validacion' : 'produccion' };
  try {
    const { app } = await crearAplicacionCompleta002(config, { prestadores: { almacen: new PortafolioS3(cliente, config.s3.bucket) }, busqueda: { cache }, categorias: { cache } });
    app.getHttpServer().once('close', () => { cliente.destroy(); redis.cerrar(); });
    await app.listen(config.puerto, config.validacion ? '127.0.0.1' : '0.0.0.0');
    process.stdout.write('Backend iniciado con Usuarios y acceso, Prestadores, Catálogo y Administración (40 operaciones).\n');
    return { cerrar: () => app.close() };
  } catch (error) { cliente.destroy(); redis.cerrar(); throw error; }
}

/**
 * Composición con las historias de la 003 implementadas (hoy HU07: nueve operaciones de solicitudes y archivos) sobre las 40 de la 001 y la 002. Las migraciones se aplican antes
 * con `db:migrate:003`. Arranca además el proceso periódico de limpieza física de archivos de solicitudes. Mientras falten historias, la composición `completa` de las 58
 * operaciones no existe (T088): esta usa solo las operaciones registradas.
 */
export async function iniciarOferta003(entorno: NodeJS.ProcessEnv = process.env): Promise<{ readonly cerrar: () => Promise<void> }> {
  const config = cargarConfiguracion003(entorno);
  const limpieza = leerConfiguracionDeLimpieza(entorno);
  const cliente = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey } });
  // El adaptador de Catálogo reserva el prefijo 002. La instancia de validación sigue siendo la Redis dedicada de 003.
  const espacio = entorno['REDIS_NAMESPACE'];
  const redis = new ClienteRedis002({
    ...entorno,
    REDIS_NAMESPACE: espacio?.replace(/^ayacucho:003:/, 'ayacucho:002:003:'),
  });
  const cache = { almacen: redis, entorno: config.validacion ? 'validacion' : 'produccion' };
  let detenerLimpieza: (() => Promise<void>) | undefined;
  try {
    const almacen = new SolicitudesS3(cliente, config.s3.bucket);
    const { app, db } = await crearAplicacionConHistorias003(config, { prestadores: { almacen: new PortafolioS3(cliente, config.s3.bucket) }, busqueda: { cache }, categorias: { cache }, solicitudes: { almacen } });
    detenerLimpieza = iniciarLimpiezaPeriodica003(db, almacen, limpieza.intervaloSegundos, { ...limpiezaPorOmision, umbralSegundos: limpieza.umbralSegundos },
      conteos => process.stdout.write(`Limpieza periódica 003: ${JSON.stringify(conteos)}\n`));
    app.getHttpServer().once('close', () => { void detenerLimpieza?.(); cliente.destroy(); redis.cerrar(); });
    await app.listen(config.puerto, config.validacion ? '127.0.0.1' : '0.0.0.0');
    process.stdout.write('Backend iniciado con Usuarios y acceso, Prestadores, Catálogo, Administración y Solicitudes (HU07).\n');
    return { cerrar: () => app.close() };
  } catch (error) { await detenerLimpieza?.(); cliente.destroy(); redis.cerrar(); throw error; }
}
export const iniciarValidacion003 = iniciarOferta003;

/** Nombre anterior de la composición completa en validación. Se conserva para `start:validation:002` y las pruebas. */
export const iniciarValidacion002 = iniciarOferta002;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  iniciar().catch(() => { process.stderr.write('No fue posible iniciar el backend. Revise la configuración requerida.\n'); process.exitCode = 1; });
}
