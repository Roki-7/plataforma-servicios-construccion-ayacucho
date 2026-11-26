import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { leerConfiguracion003 } from '../../../scripts/entorno-003.js';

/** Cada suite usa un prefijo propio con esta forma, dentro del bucket único de la composición. Cualquier otro prefijo se rechaza. */
export const patronPrefijoPrueba003 = /^pruebas\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/solicitudes\/$/;

export function prefijoDePrueba003(): string {
  return `pruebas/${randomUUID()}/solicitudes/`;
}

export interface ClienteDeAlmacenamiento { send: (comando: never) => Promise<unknown> }

/**
 * Elimina todos los objetos bajo un prefijo de prueba. Es idempotente, pagina el listado y solo acepta prefijos `pruebas/<uuid>/solicitudes/`:
 * nunca puede vaciar `solicitudes/`, `usuarios/`, `portafolio/` ni el bucket entero.
 */
export async function retirarPrefijo003(cliente: ClienteDeAlmacenamiento, bucket: string, prefijo: string): Promise<number> {
  if (!patronPrefijoPrueba003.test(prefijo)) throw new Error('Solo se pueden retirar prefijos de prueba pruebas/<uuid>/solicitudes/.');
  let eliminados = 0;
  let token: string | undefined;
  do {
    const pagina = await cliente.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefijo, ContinuationToken: token }) as never) as
      { Contents?: { Key?: string }[]; IsTruncated?: boolean; NextContinuationToken?: string };
    for (const { Key } of pagina.Contents ?? []) {
      if (!Key || !Key.startsWith(prefijo)) throw new Error('El listado devolvió una clave fuera del prefijo de prueba.');
      await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key }) as never);
      eliminados += 1;
    }
    token = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
  } while (token);
  return eliminados;
}

/** Cliente S3 de la instancia de validación 003. Las credenciales salen de la configuración local y nunca se registran. */
export async function clienteAlmacenamiento003(): Promise<{ cliente: S3Client; bucket: string }> {
  const env = await leerConfiguracion003();
  const accessKeyId = env['S3_ACCESS_KEY_ID'];
  const secretAccessKey = env['S3_SECRET_ACCESS_KEY'];
  if (!accessKeyId || !secretAccessKey) throw new Error('Falta la identidad de almacenamiento de la 003: ejecute storage:init:003.');
  const cliente = new S3Client({ endpoint: env['S3_ENDPOINT']!, region: env['S3_REGION']!, forcePathStyle: true, maxAttempts: 2,
    requestChecksumCalculation: 'WHEN_REQUIRED', credentials: { accessKeyId, secretAccessKey } });
  return { cliente, bucket: env['S3_BUCKET']! };
}

/** Prefijo propio de la suite con su limpieza. `cerrar` retira los objetos creados y destruye el cliente; es idempotente. */
export async function almacenamientoAislado003(): Promise<{ cliente: S3Client; bucket: string; prefijo: string; cerrar: () => Promise<number> }> {
  const { cliente, bucket } = await clienteAlmacenamiento003();
  const prefijo = prefijoDePrueba003();
  let cerrado = false;
  return {
    cliente, bucket, prefijo,
    cerrar: async () => {
      if (cerrado) return 0;
      cerrado = true;
      try { return await retirarPrefijo003(cliente, bucket, prefijo); } finally { cliente.destroy(); }
    },
  };
}
