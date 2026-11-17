import type { DataSource } from 'typeorm';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ContextoTransaccion } from '../../aplicacion/puertos/puertos.js';
import type { CuentaAutenticable, RepositorioAutenticacion } from '../../aplicacion/puertos/sesiones.js';
import type { ControlIntentos } from '../../dominio/control-intentos.js';
import type { Sesion } from '../../dominio/sesion.js';
import { idCuenta, type IdCuenta } from '../../dominio/identificadores.js';
import { dependenciaNoDisponible } from '../../dominio/errores.js';
interface Fila { id: string; usuario_id: string; acceso_digest: Buffer; renovacion_digest: Buffer; acceso_vence_en: Date; renovacion_vence_en: Date; autenticada_con_contrasena_en: Date | null; creada_en: Date; renovada_en: Date; revocada_en: Date | null; version: string }
export class RepositorioSesionesPostgres implements RepositorioAutenticacion {
  constructor(private readonly db: DataSource, private readonly uow: UnidadDeTrabajoPostgres) {}
  async bloquearCuenta(id: IdCuenta, tx: ContextoTransaccion): Promise<CuentaAutenticable | null> { const filas: { id: string; version_credencial: string; fallos_consecutivos: number; bloqueada_hasta: Date | null }[] = await this.uow.runner(tx).query('SELECT id,version_credencial,fallos_consecutivos,bloqueada_hasta FROM usuarios WHERE id=$1 FOR UPDATE', [id]); const f = filas[0]; return f ? { id: idCuenta(f.id), versionCredencial: BigInt(f.version_credencial), fallosConsecutivos: f.fallos_consecutivos, bloqueadaHasta: f.bloqueada_hasta } : null; }
  async guardarIntentos(id: IdCuenta, c: ControlIntentos, tx: ContextoTransaccion): Promise<void> { await this.uow.runner(tx).query('UPDATE usuarios SET fallos_consecutivos=$2,bloqueada_hasta=$3 WHERE id=$1', [id, c.fallosConsecutivos, c.bloqueadaHasta]); }
  async crear(s: Sesion, tx: ContextoTransaccion): Promise<void> { await this.uow.runner(tx).query('INSERT INTO sesiones(id,usuario_id,acceso_digest,acceso_vence_en,renovacion_digest,renovacion_vence_en,autenticada_con_contrasena_en,creada_en,renovada_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8)', [s.id, s.usuarioId, Buffer.from(s.accesoDigest), s.accesoVenceEn, Buffer.from(s.renovacionDigest), s.renovacionVenceEn, s.autenticadaConContrasenaEn, s.creadaEn]); }
  async localizarRenovacion(digest: Uint8Array): Promise<{ id: string; usuarioId: IdCuenta } | null> { try { const filas: { id: string; usuario_id: string }[] = await this.db.query('SELECT id,usuario_id FROM sesiones WHERE renovacion_digest=$1', [Buffer.from(digest)]); return filas[0] ? { id: filas[0].id, usuarioId: idCuenta(filas[0].usuario_id) } : null; } catch { throw dependenciaNoDisponible(); } }
  async bloquearSesion(id: string, tx: ContextoTransaccion, credencial: { tipo: 'acceso' | 'renovacion'; digest: Uint8Array }): Promise<Sesion | null> {
    const columna = credencial.tipo === 'acceso' ? 'acceso_digest' : 'renovacion_digest';
    const filas: Fila[] = await this.uow.runner(tx).query(`SELECT * FROM sesiones WHERE id=$1 AND ${columna}=$2 FOR UPDATE`, [id, Buffer.from(credencial.digest)]); const f = filas[0];
    return f ? { id: f.id, usuarioId: idCuenta(f.usuario_id), accesoDigest: f.acceso_digest, renovacionDigest: f.renovacion_digest, accesoVenceEn: f.acceso_vence_en, renovacionVenceEn: f.renovacion_vence_en, autenticadaConContrasenaEn: f.autenticada_con_contrasena_en, creadaEn: f.creada_en, renovadaEn: f.renovada_en, revocadaEn: f.revocada_en, version: BigInt(f.version) } : null;
  }
  async rotar(s: Sesion, tx: ContextoTransaccion): Promise<void> { await this.uow.runner(tx).query('UPDATE sesiones SET acceso_digest=$2,renovacion_digest=$3,acceso_vence_en=$4,renovada_en=$5,version=version+1 WHERE id=$1', [s.id, Buffer.from(s.accesoDigest), Buffer.from(s.renovacionDigest), s.accesoVenceEn, s.renovadaEn]); }
  async revocar(id: string, ahora: Date, tx: ContextoTransaccion): Promise<void> { await this.uow.runner(tx).query('UPDATE sesiones SET revocada_en=$2,version=version+1 WHERE id=$1', [id, ahora]); }
  async revocarTodas(id: IdCuenta, tx: ContextoTransaccion): Promise<void> { await this.uow.runner(tx).query('UPDATE sesiones SET revocada_en=clock_timestamp(),version=version+1 WHERE usuario_id=$1 AND revocada_en IS NULL', [id]); }
}
