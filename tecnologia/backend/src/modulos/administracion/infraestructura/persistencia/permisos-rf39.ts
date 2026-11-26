import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import { filasDe } from '../../../../compartido/infraestructura/postgres/filas.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { PERMISO_RF39, type PermisoRf39, type PermisosRf39 } from '../../aplicacion/puertos.js';

export class PermisosRf39Postgres implements PermisosRf39 {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}
  private async q<T>(tx: ContextoTransaccion | undefined, sql: string, p: unknown[]): Promise<T[]> {
    return filasDe<T>(await (tx ? this.uow.runner(tx) : this.uow.db).query(sql, p));
  }

  async vigente(cuentaId: string): Promise<boolean> {
    return (await this.q<unknown>(undefined, "SELECT 1 FROM administracion_permisos WHERE cuenta_id=$1 AND permiso=$2 AND estado='VIGENTE'", [cuentaId, PERMISO_RF39])).length > 0;
  }
  async bloquear(tx: ContextoTransaccion, cuentaId: string): Promise<PermisoRf39 | null> {
    const f = await this.q<{ cuenta_id: string; estado: 'VIGENTE' | 'REVOCADO'; version: number }>(tx,
      'SELECT cuenta_id,estado,version FROM administracion_permisos WHERE cuenta_id=$1 AND permiso=$2 FOR UPDATE', [cuentaId, PERMISO_RF39]);
    return f[0] ? { cuentaId: f[0].cuenta_id, estado: f[0].estado, version: f[0].version } : null;
  }
  async conceder(tx: ContextoTransaccion, cuentaId: string): Promise<void> {
    await this.q(tx, `INSERT INTO administracion_permisos(cuenta_id,permiso,estado) VALUES($1,$2,'VIGENTE')
      ON CONFLICT (cuenta_id,permiso) DO UPDATE SET estado='VIGENTE', revocado_en=NULL, concedido_en=CURRENT_TIMESTAMP, version=administracion_permisos.version+1`, [cuentaId, PERMISO_RF39]);
  }
  async revocar(tx: ContextoTransaccion, cuentaId: string): Promise<void> {
    await this.q(tx, "UPDATE administracion_permisos SET estado='REVOCADO', revocado_en=CURRENT_TIMESTAMP, version=version+1 WHERE cuenta_id=$1 AND permiso=$2", [cuentaId, PERMISO_RF39]);
  }
}
