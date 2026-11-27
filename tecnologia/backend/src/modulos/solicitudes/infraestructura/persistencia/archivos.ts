import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import { filasDe } from '../../../../compartido/infraestructura/postgres/filas.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ArchivoGuardado, NuevoArchivo, RepositorioArchivos, ResultadoDeConfirmacion } from '../../aplicacion/puertos/repositorios.js';
import type { EstadoDeArchivo } from '../../dominio/tipos.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
interface Fila { id: string; solicitud_id: string; estado: EstadoDeArchivo; objeto_clave: string; bytes: number; ancho: number; alto: number; checksum: Buffer; creado_en: Date; caduca_en: Date | null }
const columnas = 'id, solicitud_id, estado, objeto_clave, bytes, ancho, alto, checksum, creado_en, caduca_en';
const aArchivo = (f: Fila): ArchivoGuardado => ({ id: f.id, solicitudId: f.solicitud_id, estado: f.estado, objetoClave: f.objeto_clave, bytes: f.bytes, ancho: f.ancho, alto: f.alto,
  checksum: new Uint8Array(f.checksum), creadoEn: f.creado_en, caducaEn: f.caduca_en });

/**
 * Archivos de solicitudes. Toda baja lógica (descarte, caducidad, eliminación) inserta su entrada `PURGA` en la MISMA sentencia o transacción: así el borrado físico
 * es durable aunque el intento inmediato falle. Los contadores de la solicitud los mantiene solo el disparador de `solicitudes_archivos`.
 */
export class RepositorioArchivosPostgres implements RepositorioArchivos {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}
  private ejecutor(tx?: ContextoTransaccion) { return tx ? this.uow.runner(tx) : this.uow.db; }

  async caducar(tx: ContextoTransaccion, solicitudId: string): Promise<number> {
    const filas = filasDe(await this.uow.runner(tx).query(`WITH caducados AS (
        UPDATE solicitudes_archivos SET estado = 'DESCARTADO', retirado_en = clock_timestamp()
        WHERE solicitud_id = $1::uuid AND estado IN ('PREPARANDO','PREPARADO') AND caduca_en <= clock_timestamp() RETURNING objeto_clave, solicitud_id)
      INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion)
        SELECT objeto_clave, 'PURGA', solicitud_id, clock_timestamp() FROM caducados
        ON CONFLICT (clave) DO UPDATE SET tipo = 'PURGA', proxima_ejecucion = EXCLUDED.proxima_ejecucion, arrendado_hasta = NULL RETURNING clave`, [solicitudId]));
    return filas.length;
  }

  async listarVisibles(solicitudId: string, tx?: ContextoTransaccion): Promise<readonly ArchivoGuardado[]> {
    if (!uuid.test(solicitudId)) return [];
    const filas = await this.ejecutor(tx).query(`SELECT ${columnas} FROM solicitudes_archivos WHERE solicitud_id = $1::uuid
      AND (estado = 'CONFIRMADO' OR (estado = 'PREPARADO' AND caduca_en > clock_timestamp())) ORDER BY creado_en, id`, [solicitudId]) as Fila[];
    return filas.map(aArchivo);
  }

  async porIds(ids: readonly string[], tx?: ContextoTransaccion): Promise<readonly ArchivoGuardado[]> {
    const validos = ids.filter(i => uuid.test(i));
    if (!validos.length) return [];
    const filas = await this.ejecutor(tx).query(`SELECT ${columnas} FROM solicitudes_archivos WHERE id = ANY($1::uuid[])`, [validos]) as Fila[];
    return filas.map(aArchivo);
  }

  async porId(id: string, tx?: ContextoTransaccion): Promise<ArchivoGuardado | null> { return (await this.porIds([id], tx))[0] ?? null; }

  async reservar(tx: ContextoTransaccion, a: NuevoArchivo): Promise<void> {
    const q = this.uow.runner(tx);
    await q.query(`INSERT INTO solicitudes_archivos (id, solicitud_id, estado, objeto_clave, mime, bytes, ancho, alto, checksum, caduca_en)
      VALUES ($1, $2, 'PREPARANDO', $3, 'image/webp', $4, $5, $6, $7, $8)`, [a.id, a.solicitudId, a.objetoClave, a.bytes, a.ancho, a.alto, Buffer.from(a.checksum), a.caducaEn]);
    await q.query(`INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion) VALUES ($1, 'PREPARACION', $2, $3)
      ON CONFLICT (clave) DO NOTHING`, [a.objetoClave, a.solicitudId, a.caducaEn]);
  }

  async marcarPreparado(tx: ContextoTransaccion, id: string): Promise<void> {
    await this.uow.runner(tx).query("UPDATE solicitudes_archivos SET estado = 'PREPARADO' WHERE id = $1::uuid AND estado = 'PREPARANDO'", [id]);
  }

  async descartarPreparacion(tx: ContextoTransaccion, id: string): Promise<void> {
    await this.uow.runner(tx).query(`WITH d AS (UPDATE solicitudes_archivos SET estado = 'DESCARTADO', retirado_en = clock_timestamp()
        WHERE id = $1::uuid AND estado = 'PREPARANDO' RETURNING objeto_clave, solicitud_id)
      INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion) SELECT objeto_clave, 'PURGA', solicitud_id, clock_timestamp() FROM d
      ON CONFLICT (clave) DO UPDATE SET tipo = 'PURGA', proxima_ejecucion = EXCLUDED.proxima_ejecucion, arrendado_hasta = NULL`, [id]);
  }

  async aplicarConfirmacion(tx: ContextoTransaccion, solicitudId: string, confirmar: readonly string[], quitar: readonly string[]): Promise<ResultadoDeConfirmacion> {
    const q = this.uow.runner(tx);
    const confirmados = confirmar.length ? filasDe<{ id: string }>(await q.query(`UPDATE solicitudes_archivos SET estado = 'CONFIRMADO', confirmado_en = clock_timestamp(), caduca_en = NULL
      WHERE solicitud_id = $1::uuid AND id = ANY($2::uuid[]) AND estado = 'PREPARADO' RETURNING id`, [solicitudId, [...confirmar]])).map(f => f.id) : [];
    const retirados = quitar.length ? await q.query(`WITH e AS (UPDATE solicitudes_archivos SET estado = 'ELIMINADO', retirado_en = clock_timestamp()
        WHERE solicitud_id = $1::uuid AND id = ANY($2::uuid[]) AND estado = 'CONFIRMADO' RETURNING id, objeto_clave, solicitud_id),
      p AS (INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion) SELECT objeto_clave, 'PURGA', solicitud_id, clock_timestamp() FROM e
        ON CONFLICT (clave) DO UPDATE SET tipo = 'PURGA', proxima_ejecucion = EXCLUDED.proxima_ejecucion, arrendado_hasta = NULL RETURNING clave)
      SELECT id, objeto_clave FROM e`, [solicitudId, [...quitar]]) as { id: string; objeto_clave: string }[] : [];
    return { confirmados, quitados: retirados.map(r => r.id), clavesAPurgar: retirados.map(r => r.objeto_clave) };
  }

  async descartarNoConfirmados(tx: ContextoTransaccion, solicitudId: string): Promise<readonly string[]> {
    const filas = await this.uow.runner(tx).query(`WITH d AS (UPDATE solicitudes_archivos SET estado = 'DESCARTADO', retirado_en = clock_timestamp()
        WHERE solicitud_id = $1::uuid AND estado IN ('PREPARANDO','PREPARADO') RETURNING objeto_clave, solicitud_id),
      p AS (INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion) SELECT objeto_clave, 'PURGA', solicitud_id, clock_timestamp() FROM d
        ON CONFLICT (clave) DO UPDATE SET tipo = 'PURGA', proxima_ejecucion = EXCLUDED.proxima_ejecucion, arrendado_hasta = NULL RETURNING clave)
      SELECT objeto_clave FROM d`, [solicitudId]) as { objeto_clave: string }[];
    return filas.map(f => f.objeto_clave);
  }

  async completarPurga(clave: string): Promise<void> {
    await this.uow.db.query("DELETE FROM solicitudes_objetos_pendientes WHERE clave = $1 AND tipo = 'PURGA'", [clave]);
  }
}
