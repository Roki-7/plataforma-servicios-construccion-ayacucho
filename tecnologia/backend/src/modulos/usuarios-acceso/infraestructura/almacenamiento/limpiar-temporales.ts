import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { DataSource } from 'typeorm';
import type { FotografiasS3 } from './fotografias-s3.js';

export async function limpiarTemporales(db: DataSource, fotos: FotografiasS3, antiguedadMs = 3600000, ahora = new Date()): Promise<number> {
  if (!db.isInitialized || antiguedadMs < 60000) return 0;
  const limite = new Date(ahora.getTime() - antiguedadMs);
  const candidatas: { id: string; objeto_clave: string }[] = await db.transaction(async (manager) => {
    const rows: { id: string; objeto_clave: string }[] = await manager.query(`SELECT f.id,f.objeto_clave FROM fotografias_perfil f
      WHERE (f.estado='pendiente_eliminacion' OR (f.estado='temporal' AND f.creada_en<$1))
      AND NOT EXISTS(SELECT 1 FROM usuarios u WHERE u.fotografia_id=f.id) FOR UPDATE OF f SKIP LOCKED LIMIT 50`, [limite]);
    for (const row of rows) await manager.query("UPDATE fotografias_perfil SET estado='pendiente_eliminacion' WHERE id=$1", [row.id]);
    return rows;
  });
  let cantidad = 0;
  for (const row of candidatas) {
    await fotos.eliminarObjeto(row.objeto_clave);
    await db.query("DELETE FROM fotografias_perfil WHERE id=$1 AND estado='pendiente_eliminacion' AND NOT EXISTS(SELECT 1 FROM usuarios WHERE fotografia_id=$1)", [row.id]);
    cantidad++;
  }
  // También compensa objetos subidos antes de un rollback que no dejó fila en DB.
  let continuacion: string | undefined;
  do {
    const pagina = await fotos.cliente.send(new ListObjectsV2Command({ Bucket: fotos.bucket, Prefix: fotos.prefijo, ...(continuacion ? { ContinuationToken: continuacion } : {}) }), { abortSignal: AbortSignal.timeout(8000) });
    for (const obj of pagina.Contents ?? []) {
      if (!obj.Key || !obj.LastModified || obj.LastModified >= limite) continue;
      const filas: { existe: boolean }[] = await db.query('SELECT EXISTS(SELECT 1 FROM fotografias_perfil WHERE objeto_clave=$1) AS existe', [obj.Key]);
      if (filas[0]?.existe === false) { await fotos.eliminarObjeto(obj.Key); cantidad++; }
    }
    continuacion = pagina.NextContinuationToken;
  } while (continuacion);
  return cantidad;
}
