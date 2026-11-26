import { randomUUID } from 'node:crypto';
import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import { filasDe } from '../../../../compartido/infraestructura/postgres/filas.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { AprobacionConsumida, AuditoriaRf39, Constancia, RegistroAuditoria, RegistroOperativo } from '../../aplicacion/puertos.js';

/** La auditoría usa la transacción del llamador: si falla, fallan también la mutación y el consumo de aprobaciones. */
export class AuditoriaRf39Postgres implements AuditoriaRf39 {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}
  async registrar(tx: ContextoTransaccion, r: RegistroAuditoria): Promise<void> {
    await this.uow.runner(tx).query(
      'INSERT INTO administracion_auditoria(id,responsable,aprobacion_id,accion,recurso_tipo,recurso_id,motivo) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [randomUUID(), r.responsable, r.aprobacionId ?? null, r.accion, r.recursoTipo, r.recursoId, r.motivo]);
  }
}

/** Constancias de identidad y registro de aprobaciones consumidas. */
export class RegistroOperativoPostgres implements RegistroOperativo {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}
  async crearConstancia(cuentaId: string, entorno: string, minutos: number): Promise<string> {
    const id = randomUUID();
    await this.uow.db.query("INSERT INTO administracion_constancias(id,cuenta_id,entorno,vence_en) VALUES($1,$2,$3,CURRENT_TIMESTAMP + make_interval(mins => $4))", [id, cuentaId, entorno, minutos]);
    return id;
  }
  async bloquearConstancia(tx: ContextoTransaccion, id: string): Promise<Constancia | null> {
    const f = filasDe<{ id: string; cuenta_id: string; entorno: string; vigente: boolean; consumida: boolean }>(await this.uow.runner(tx).query(
      'SELECT id,cuenta_id,entorno,(vence_en > CURRENT_TIMESTAMP) AS vigente,(consumida_en IS NOT NULL) AS consumida FROM administracion_constancias WHERE id=$1 FOR UPDATE', [id]));
    return f[0] ? { id: f[0].id, cuentaId: f[0].cuenta_id, entorno: f[0].entorno, vigente: f[0].vigente, consumida: f[0].consumida } : null;
  }
  async consumirConstancia(tx: ContextoTransaccion, id: string): Promise<void> {
    await this.uow.runner(tx).query('UPDATE administracion_constancias SET consumida_en=CURRENT_TIMESTAMP WHERE id=$1 AND consumida_en IS NULL', [id]);
  }
  async consumirAprobacion(tx: ContextoTransaccion, a: AprobacionConsumida): Promise<boolean> {
    const f = filasDe<{ id: string }>(await this.uow.runner(tx).query(`INSERT INTO administracion_aprobaciones(id,firmante,ejecutor,accion,cuenta_id,entorno,emitida_en,vence_en,motivo,constancia_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING RETURNING id`,
    [a.id, a.firmante, a.ejecutor, a.accion, a.cuentaId, a.entorno, a.emitidaEn, a.venceEn, a.motivo, a.constanciaId]));
    return f.length === 1;
  }
}
