import { isAbsolute, relative, resolve } from 'node:path';
import { S3Client } from '@aws-sdk/client-s3';
import { clavesDeRespaldo, respaldarPortafolio, ErrorRespaldo } from '../src/modulos/prestadores/infraestructura/respaldo/respaldo-portafolio.js';
import { PortafolioS3 } from '../src/modulos/prestadores/infraestructura/archivos/portafolio-s3.js';
import { OrigenPostgresDocker } from '../src/composicion/respaldo-002.js';
import { tecnologia } from './entorno.js';
import { exigirBase002, leerConfiguracion002, proyecto002 } from './entorno-002.js';

/**
 * Respaldo coordinado del portafolio de la 002. Pausa brevemente las escrituras de portafolio y la limpieza (bloqueo SHARE) mientras abre la instantánea.
 * Uso: respaldar-portafolio-002.ts --confirmo ayacucho_002_validacion
 * Requiere RESPALDO_CLAVE (32 bytes en base64, fuera de Git) y RESPALDO_DIRECTORIO (ruta absoluta fuera del repositorio).
 */
try {
  const env = await leerConfiguracion002();
  const url = exigirBase002(env['DATABASE_URL']); const base = url.pathname.slice(1);
  const indice = process.argv.indexOf('--confirmo');
  if (indice < 0 || process.argv[indice + 1] !== base) throw new ErrorRespaldo('CONFIRMACION_REQUERIDA', 'Confirme el nombre exacto de la base de origen con --confirmo.');
  const directorio = process.env['RESPALDO_DIRECTORIO'] ?? '';
  if (!isAbsolute(directorio) || !relative(resolve(tecnologia, '..'), resolve(directorio)).startsWith('..')) throw new ErrorRespaldo('DIRECTORIO_NO_VALIDO', 'RESPALDO_DIRECTORIO debe ser una ruta absoluta fuera del repositorio.');
  const claves = clavesDeRespaldo(process.env['RESPALDO_CLAVE']);
  const cliente = new S3Client({ endpoint: env['S3_ENDPOINT']!, region: env['S3_REGION']!, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: env['S3_ACCESS_KEY_ID']!, secretAccessKey: env['S3_SECRET_ACCESS_KEY']! } });
  try {
    const m = await respaldarPortafolio({ origen: new OrigenPostgresDocker(url.href, `${proyecto002}-postgres-1`), almacen: new PortafolioS3(cliente, env['S3_BUCKET']!), claves, directorio,
      origenLogico: { baseLogica: base, bucket: env['S3_BUCKET']!, prefijo: 'portafolio/', espacioRedis: env['REDIS_NAMESPACE']! }, aplicacion: 'prestadores-catalogo-002' });
    process.stdout.write(`Respaldo ${m.estado}: ${m.backupId}\nReferencias: ${m.conteos.fotografiasVigentes}, objetos copiados: ${m.conteos.objetosCopiados}, preparaciones inconclusas: ${m.conteos.preparacionesInconclusas}, purgas pendientes: ${m.conteos.purgasPendientes}\n`);
  } finally { cliente.destroy(); }
} catch (error) {
  process.stderr.write(`${error instanceof ErrorRespaldo ? `${error.codigo}: ${error.message}` : 'No se pudo completar el respaldo del portafolio.'}\n`);
  process.exitCode = 1;
}
