import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { dependenciaNoDisponible } from '../../dominio/errores.js';
import { limitesDeArchivos } from '../../dominio/tipos.js';
import type { AlmacenArchivosSolicitud, ObjetoListado } from '../../aplicacion/puertos/archivos.js';

const tiempoMs = 8000;
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const patronUuid = new RegExp(`^${uuid}$`);
const prefijoProduccion = 'solicitudes/';
const patronPrefijoPruebas = new RegExp(`^pruebas/${uuid}/solicitudes/$`);

/**
 * Archivos de solicitudes sobre el bucket privado ÚNICO de la composición (`config.s3.bucket`), con el prefijo lógico `solicitudes/`, la misma identidad de
 * la aplicación y sin variables ni recursos nuevos (research R-09). Garage concede permisos por identidad y bucket, no por prefijo: el aislamiento es de
 * aplicación. Por eso este adaptador solo opera sobre claves con la forma estricta `solicitudes/<uuid>/<uuid>` (o `pruebas/<uuid>/solicitudes/<uuid>/<uuid>`
 * en pruebas), acota el listado al prefijo, tiene tiempos máximos y no ofrece ninguna operación que genere enlaces públicos ni firmados.
 */
export class SolicitudesS3 implements AlmacenArchivosSolicitud {
  private readonly forma: RegExp;

  constructor(private readonly cliente: Pick<S3Client, 'send'>, private readonly bucket: string, readonly prefijo: string = prefijoProduccion) {
    if (prefijo !== prefijoProduccion && !patronPrefijoPruebas.test(prefijo)) throw new Error('Prefijo de solicitudes no válido.');
    this.forma = new RegExp(`^${prefijo.replaceAll('/', '\\/')}${uuid}\\/${uuid}$`);
  }

  claveNueva(solicitudId: string, archivoId: string): string {
    if (!patronUuid.test(solicitudId) || !patronUuid.test(archivoId)) throw new TypeError('Los identificadores de la clave deben ser UUID.');
    return `${this.prefijo}${solicitudId}/${archivoId}`;
  }

  pertenece(clave: string): boolean { return this.forma.test(clave); }

  async guardar(clave: string, bytes: Uint8Array): Promise<void> {
    this.exigir(clave);
    try {
      await this.cliente.send(new PutObjectCommand({ Bucket: this.bucket, Key: clave, Body: bytes, ContentType: 'image/webp', CacheControl: 'no-store' }), { abortSignal: AbortSignal.timeout(tiempoMs) });
    } catch { throw dependenciaNoDisponible(); }
  }

  async leer(clave: string): Promise<Uint8Array> {
    this.exigir(clave);
    try {
      const objeto = await this.cliente.send(new GetObjectCommand({ Bucket: this.bucket, Key: clave }), { abortSignal: AbortSignal.timeout(tiempoMs) });
      if (!objeto.Body || (objeto.ContentLength ?? 0) > limitesDeArchivos.bytesMaximosPorImagen) throw new Error('Objeto no admitido.');
      const bytes = await objeto.Body.transformToByteArray();
      if (bytes.length > limitesDeArchivos.bytesMaximosPorImagen) throw new Error('Objeto no admitido.');
      return bytes;
    } catch { throw dependenciaNoDisponible(); }
  }

  async eliminar(clave: string): Promise<void> {
    this.exigir(clave);
    try { await this.cliente.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: clave }), { abortSignal: AbortSignal.timeout(tiempoMs) }); }
    catch { throw dependenciaNoDisponible(); }
  }

  async *listar(): AsyncIterable<ObjetoListado> {
    let token: string | undefined;
    do {
      let pagina;
      try { pagina = await this.cliente.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: this.prefijo, ContinuationToken: token }), { abortSignal: AbortSignal.timeout(tiempoMs) }); }
      catch { throw dependenciaNoDisponible(); }
      for (const o of pagina.Contents ?? []) if (o.Key && o.LastModified && this.pertenece(o.Key)) yield { clave: o.Key, modificado: o.LastModified };
      token = pagina.IsTruncated ? pagina.NextContinuationToken : undefined;
    } while (token);
  }

  private exigir(clave: string): void { if (!this.pertenece(clave)) throw new Error('Clave fuera del ámbito de las solicitudes.'); }
}
