import type { DataSource } from 'typeorm';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ContextoTransaccion } from '../../aplicacion/puertos/puertos.js';
import type { RepositorioRecuperaciones } from '../../aplicacion/puertos/recuperacion.js';
import type { Recuperacion } from '../../dominio/recuperacion.js';
import { idCuenta, type IdCuenta } from '../../dominio/identificadores.js';
import { dependenciaNoDisponible } from '../../dominio/errores.js';
interface Fila { id: string; usuario_id: string; token_digest: Buffer; emitida_en: Date; vence_en: Date; consumida_en: Date | null; invalidada_en: Date | null; version: string }
function mapear(f: Fila | undefined): Recuperacion | null { return f ? { id: f.id, usuarioId: idCuenta(f.usuario_id), proposito: 'recuperacion', tokenDigest: f.token_digest, emitidaEn: f.emitida_en, venceEn: f.vence_en, consumidaEn: f.consumida_en, invalidadaEn: f.invalidada_en, version: Number(f.version) } : null; }
export class RepositorioRecuperacionesPostgres implements RepositorioRecuperaciones {
  constructor(private readonly db: DataSource, private readonly uow: UnidadDeTrabajoPostgres) {}
  async crear(r: Recuperacion, tx: ContextoTransaccion): Promise<void> { await this.uow.runner(tx).query('INSERT INTO recuperaciones_acceso(id,usuario_id,token_digest,emitida_en,vence_en,version) VALUES($1,$2,$3,$4,$5,$6)', [r.id, r.usuarioId, Buffer.from(r.tokenDigest), r.emitidaEn, r.venceEn, r.version]); }
  async buscarPorDigest(digest: Uint8Array): Promise<Recuperacion | null> { try { const filas: Fila[] = await this.db.query('SELECT * FROM recuperaciones_acceso WHERE token_digest=$1', [Buffer.from(digest)]); return mapear(filas[0]); } catch { throw dependenciaNoDisponible(); } }
  async bloquear(id: string, tx: ContextoTransaccion): Promise<Recuperacion | null> { const filas: Fila[] = await this.uow.runner(tx).query('SELECT * FROM recuperaciones_acceso WHERE id=$1 FOR UPDATE', [id]); return mapear(filas[0]); }
  async establecerContrasena(id: IdCuenta, phc: string, ahora: Date, tx: ContextoTransaccion): Promise<void> { await this.uow.runner(tx).query('UPDATE usuarios SET contrasena_hash=$2,version_credencial=version_credencial+1,version=version+1,actualizada_en=$3 WHERE id=$1', [id, phc, ahora]); }
  async consumir(r: Recuperacion, ahora: Date, tx: ContextoTransaccion): Promise<void> { const q = this.uow.runner(tx); await q.query('UPDATE recuperaciones_acceso SET consumida_en=$2,version=version+1 WHERE id=$1', [r.id, ahora]); await q.query('UPDATE recuperaciones_acceso SET invalidada_en=$2,version=version+1 WHERE usuario_id=$1 AND consumida_en IS NULL AND invalidada_en IS NULL', [r.usuarioId, ahora]); }
}
