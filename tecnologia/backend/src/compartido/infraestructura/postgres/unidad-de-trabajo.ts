import { randomUUID } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import type { ContextoTransaccion, UnidadDeTrabajo } from '../../aplicacion/transaccion.js';
import { dependenciaNoDisponible, ErrorAplicacion } from '../../dominio/errores.js';

export class UnidadDeTrabajoPostgres implements UnidadDeTrabajo {
  private readonly contextos = new WeakMap<ContextoTransaccion, QueryRunner>();
  constructor(readonly db: DataSource) {}
  runner(tx: ContextoTransaccion): QueryRunner {
    const runner = this.contextos.get(tx);
    if (!runner?.isTransactionActive) throw new Error('Contexto de transacción no vigente.');
    return runner;
  }
  async ejecutar<T>(trabajo: (tx: ContextoTransaccion) => Promise<T>): Promise<T> {
    if (!this.db.isInitialized) throw dependenciaNoDisponible();
    const runner = this.db.createQueryRunner();
    const tx: ContextoTransaccion = Object.freeze({ id: randomUUID() });
    try {
      await runner.connect(); await runner.startTransaction('READ COMMITTED');
      await runner.query("SELECT set_config('lock_timeout', '5000ms', true)");
      this.contextos.set(tx, runner);
      const resultado = await trabajo(tx);
      await runner.commitTransaction();
      return resultado;
    } catch (error) {
      if (runner.isTransactionActive) { try { await runner.rollbackTransaction(); } catch { /* La respuesta sigue cerrada ante fallo de DB. */ } }
      if (error instanceof ErrorAplicacion) throw error;
      throw dependenciaNoDisponible();
    } finally { this.contextos.delete(tx); await runner.release(); }
  }
}
