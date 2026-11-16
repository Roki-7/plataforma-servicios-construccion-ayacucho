import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { cargarLocal } from './entorno.js';
import { cargarConfiguracion } from '../src/composicion/configuracion.js';
cargarLocal(); const config = cargarConfiguracion();
if (!config.validacion) throw new Error('Este script solo verifica el bucket local de validación; no aprovisiona producción.');
const cliente = new S3Client({ endpoint: config.s3.endpoint, region: config.s3.region, credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey }, forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED' });
try { await cliente.send(new HeadBucketCommand({ Bucket: config.s3.bucket }), { abortSignal: AbortSignal.timeout(8000) }); process.stdout.write('Bucket local privado disponible.\n'); }
catch { process.stderr.write('El bucket local no está preparado. Verifique la salud de Garage.\n'); process.exitCode = 1; }
finally { cliente.destroy(); }
