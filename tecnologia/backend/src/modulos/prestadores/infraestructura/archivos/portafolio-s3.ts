import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { dependenciaNoDisponible } from '../../../../compartido/dominio/errores.js';
import type { AlmacenPortafolio, ObjetoListado } from '../../aplicacion/puertos/puertos.js';

const limiteLecturaBytes = 5_000_000;
const tiempoMs = 8000;
const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Bucket privado de portafolio. Las credenciales del bucket se limitan a este bucket y a esta clase de objetos. */
export class PortafolioS3 implements AlmacenPortafolio {
  private readonly forma: RegExp;
  constructor(private readonly cliente: S3Client, private readonly bucket: string, readonly prefijo = 'portafolio/') {
    if (prefijo !== 'portafolio/' && !new RegExp(`^pruebas/${uuid}/portafolio/$`).test(prefijo)) throw new Error('Prefijo de portafolio no válido.');
    this.forma = new RegExp(`^${prefijo.replaceAll('/', '\\/')}${uuid}\\/${uuid}$`);
  }
  claveNueva(prestadorId: string): string { return `${this.prefijo}${prestadorId}/${randomUUID()}`; }
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
      if (!objeto.Body || (objeto.ContentLength ?? 0) > limiteLecturaBytes) throw new Error('Objeto no admitido.');
      const bytes = await objeto.Body.transformToByteArray();
      if (bytes.length > limiteLecturaBytes) throw new Error('Objeto no admitido.');
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
  private exigir(clave: string): void { if (!this.pertenece(clave)) throw new Error('Clave fuera del ámbito del portafolio.'); }
}
