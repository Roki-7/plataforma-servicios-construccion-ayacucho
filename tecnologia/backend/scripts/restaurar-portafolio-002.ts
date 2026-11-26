import { isAbsolute, relative, resolve } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { clavesDeRespaldo, ErrorRespaldo, restaurarPortafolio, validarDestino } from '../src/modulos/prestadores/infraestructura/respaldo/respaldo-portafolio.js';
import { PortafolioS3 } from '../src/modulos/prestadores/infraestructura/archivos/portafolio-s3.js';
import { DestinoPostgresDocker, migracionesEsperadas002 } from '../src/composicion/respaldo-002.js';
import { tecnologia } from './entorno.js';
import { exigirBase002, leerConfiguracion002, proyecto002 } from './entorno-002.js';

/**
 * Restauración coordinada del portafolio de la 002 en DESTINOS NUEVOS (nunca sobrescribe). Mantiene la puerta de restauración CERRADA hasta validar todo.
 * Uso: restaurar-portafolio-002.ts --backup-id <uuid> --base-destino ayacucho_002_restauracion_<sufijo> --prefijo-destino pruebas/<uuid>/portafolio/ --confirmo ayacucho_002_restauracion_<sufijo>
 * Requiere RESPALDO_CLAVE y RESPALDO_DIRECTORIO. Un bucket nuevo se indica con S3_BUCKET_DESTINO y el prefijo portafolio/.
 *
 * OPERACIÓN: la puerta de restauración protege el ARRANQUE de nuevas instancias sobre la base restaurada. NO detiene una API que ya esté en funcionamiento.
 * Antes de dirigir el tráfico a la base restaurada, detenga o aísle todas las réplicas antiguas (las que usan la base y el espacio Redis anteriores) y arranque
 * las nuevas solo después de que esta restauración termine con la puerta ABIERTA.
 */
const arg = (n: string) => { const i = process.argv.indexOf(n); return i < 0 ? undefined : process.argv[i + 1]; };
try {
  const env = await leerConfiguracion002();
  const origen = exigirBase002(env['DATABASE_URL']);
  const backupId = arg('--backup-id') ?? ''; const baseDestino = arg('--base-destino') ?? ''; const prefijo = arg('--prefijo-destino') ?? 'portafolio/';
  if (!/^[0-9a-f-]{36}$/.test(backupId)) throw new ErrorRespaldo('ARGUMENTO_NO_VALIDO', 'Indique --backup-id.');
  const destino = new URL(origen.href); destino.pathname = `/${baseDestino}`;
  const bucket = process.env['S3_BUCKET_DESTINO'] ?? env['S3_BUCKET']!;
  validarDestino({ urlBase: destino.href, urlOrigen: origen.href, bucket, prefijo, bucketOrigen: env['S3_BUCKET']!, prefijoOrigen: 'portafolio/', confirmo: arg('--confirmo') ?? '' });
  const directorio = process.env['RESPALDO_DIRECTORIO'] ?? '';
  if (!isAbsolute(directorio) || !relative(resolve(tecnologia, '..'), resolve(directorio)).startsWith('..')) throw new ErrorRespaldo('DIRECTORIO_NO_VALIDO', 'RESPALDO_DIRECTORIO debe ser una ruta absoluta fuera del repositorio.');
  const mayor = await DestinoPostgresDocker.mayorDe(origen.href);
  const cliente = new S3Client({ endpoint: env['S3_ENDPOINT']!, region: env['S3_REGION']!, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: env['S3_ACCESS_KEY_ID']!, secretAccessKey: env['S3_SECRET_ACCESS_KEY']! } });
  try {
    const r = await restaurarPortafolio({ directorio, backupId, claves: clavesDeRespaldo(process.env['RESPALDO_CLAVE']), destinoPostgres: new DestinoPostgresDocker(destino.href, `${proyecto002}-postgres-1`, mayor),
      almacenDestino: new PortafolioS3(cliente, bucket, prefijo), prefijoDestino: prefijo, postgresMayorOrigen: mayor, migracionesEsperadas: await migracionesEsperadas002() });
    process.stdout.write(`Restauración completada: ${r.backupId}\nObjetos: ${r.objetosRestaurados}, preparaciones descartadas: ${r.preparacionesDescartadas}, purgas conservadas: ${r.purgasConservadas}\nLa puerta quedó ABIERTA con un espacio Redis nuevo.\n`);
  } finally { cliente.destroy(); }
} catch (error) {
  process.stderr.write(`${error instanceof ErrorRespaldo ? `${error.codigo}: ${error.message}` : 'No se pudo completar la restauración. La puerta de restauración permanece CERRADA.'}\n`);
  process.exitCode = 1;
}
