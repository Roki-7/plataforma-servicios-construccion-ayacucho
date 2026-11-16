import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { DataSource } from 'typeorm';
import type { ContextoTransaccion, AlmacenamientoFotografias, FotografiaAlmacenada } from '../../aplicacion/puertos/puertos.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { IdCuenta } from '../../dominio/identificadores.js';
import { idCuenta } from '../../dominio/identificadores.js';
import { datosInvalidos, dependenciaNoDisponible, ErrorAplicacion } from '../../dominio/errores.js';

export async function validarImagen(base64: string, mime: string): Promise<Buffer> {
  if (base64.length > 13333336) throw new ErrorAplicacion(413, 'ARCHIVO_DEMASIADO_GRANDE', 'La imagen supera 10 MB.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime) || base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw datosInvalidos('Imagen no válida.');
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > 10000000) throw new ErrorAplicacion(413, 'ARCHIVO_DEMASIADO_GRANDE', 'La imagen supera 10 MB.');
  if (bytes.length === 0 || bytes.toString('base64') !== base64) throw datosInvalidos('Imagen no válida.');
  try {
    const imagen = sharp(bytes, { failOn: 'error' });
    const metadata = await imagen.metadata();
    if (`image/${metadata.format}` !== mime || !metadata.width || !metadata.height) throw datosInvalidos('Imagen no válida.');
    await imagen.stats();
  } catch { throw datosInvalidos('El contenido no corresponde a una imagen admitida.'); }
  return bytes;
}
interface FilaFoto { objeto_clave: string; mime: string; checksum: Buffer }
export class FotografiasS3 implements AlmacenamientoFotografias {
  constructor(readonly cliente: S3Client, readonly bucket: string, private readonly db: DataSource, private readonly uow: UnidadDeTrabajoPostgres, readonly prefijo = 'usuarios/') {
    if (prefijo !== 'usuarios/' && !/^pruebas\/[a-f0-9-]{36}\/usuarios\/$/.test(prefijo)) throw datosInvalidos();
  }
  async almacenar(cuentaId: IdCuenta, base64: string, mime: string): Promise<FotografiaAlmacenada> {
    idCuenta(cuentaId); const bytes = await validarImagen(base64, mime);
    const id = randomUUID(); const objetoClave = `${this.prefijo}${cuentaId}/${id}`;
    try { await this.cliente.send(new PutObjectCommand({ Bucket: this.bucket, Key: objetoClave, Body: bytes, ContentType: mime }), { abortSignal: AbortSignal.timeout(8000) }); }
    catch { throw dependenciaNoDisponible(); }
    return { id, objetoClave, mime, bytes: bytes.length, checksum: createHash('sha256').update(bytes).digest() };
  }
  async registrarTemporal(cuentaId: IdCuenta, foto: FotografiaAlmacenada, tx: ContextoTransaccion): Promise<void> {
    await this.uow.runner(tx).query("INSERT INTO fotografias_perfil(id,usuario_id,objeto_clave,mime,bytes,checksum,estado) VALUES($1,$2,$3,$4,$5,$6,'temporal')", [foto.id, cuentaId, foto.objetoClave, foto.mime, foto.bytes, Buffer.from(foto.checksum)]);
  }
  async leerPropia(cuentaId: IdCuenta, fotografiaId: string): Promise<{ contenidoBase64: string; tipoContenido: string }> {
    idCuenta(fotografiaId);
    if (!this.db.isInitialized) throw dependenciaNoDisponible();
    const filas: FilaFoto[] = await this.db.query("SELECT objeto_clave,mime,checksum FROM fotografias_perfil WHERE id=$1 AND usuario_id=$2 AND estado IN ('temporal','activa')", [fotografiaId, cuentaId]);
    const foto = filas[0]; if (!foto) throw new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.');
    try {
      const objeto = await this.cliente.send(new GetObjectCommand({ Bucket: this.bucket, Key: foto.objeto_clave }), { abortSignal: AbortSignal.timeout(8000) });
      if (!objeto.Body || (objeto.ContentLength ?? 0) > 10000000) throw dependenciaNoDisponible();
      const bytes = await objeto.Body.transformToByteArray();
      if (bytes.length > 10000000 || !createHash('sha256').update(bytes).digest().equals(foto.checksum)) throw dependenciaNoDisponible();
      return { contenidoBase64: Buffer.from(bytes).toString('base64'), tipoContenido: foto.mime };
    } catch { throw dependenciaNoDisponible(); }
  }
  async eliminarObjeto(clave: string): Promise<void> {
    if (!clave.startsWith(this.prefijo) || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/i.test(clave.slice(this.prefijo.length))) throw datosInvalidos();
    try { await this.cliente.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: clave }), { abortSignal: AbortSignal.timeout(8000) }); }
    catch { throw dependenciaNoDisponible(); }
  }
}
