import { randomUUID } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import type { ContextoTransaccion, UnidadDeTrabajo } from '../../aplicacion/transaccion.js';
import { dependenciaNoDisponible, ErrorAplicacion } from '../../dominio/errores.js';
import { registrarFallo, type EtapaFallo } from '../diagnostico-fallos.js';

export class UnidadDeTrabajoPostgres implements UnidadDeTrabajo {
  private readonly contextos = new WeakMap<ContextoTransaccion, QueryRunner>();
  constructor(readonly db: DataSource) {}
  runner(tx: ContextoTransaccion): QueryRunner {
    const runner = this.contextos.get(tx);
    if (!runner?.isTransactionActive) throw new Error('Contexto de transacción no vigente.');
    return runner;
  }
  async ejecutar<T>(trabajo: (tx: ContextoTransaccion) => Promise<T>): Promise<T> {
    if (!this.db.isInitialized) { registrarFallo('db.disponibilidad', undefined, 'no_inicializada'); throw dependenciaNoDisponible(); }
    const runner = this.db.createQueryRunner();
    const tx: ContextoTransaccion = Object.freeze({ id: randomUUID() });
    let etapa: EtapaFallo = 'db.conexion';
    try {
      await runner.connect(); etapa = 'db.inicio'; await runner.startTransaction('READ COMMITTED');
      etapa = 'db.configuracion';
      await runner.query("SELECT set_config('lock_timeout', '5000ms', true)");
      this.contextos.set(tx, runner);
      etapa = 'db.trabajo'; const resultado = await trabajo(tx);
      etapa = 'db.commit'; await runner.commitTransaction();
      return resultado;
    } catch (error) {
      if (!(error instanceof ErrorAplicacion) || error.http >= 500) registrarFallo(etapa, error);
      if (runner.isTransactionActive) { try { await runner.rollbackTransaction(); } catch (fallo) { registrarFallo('db.rollback', fallo); } }
      if (error instanceof ErrorAplicacion) throw error;
      throw dependenciaNoDisponible();
    } finally { this.contextos.delete(tx); await this.liberar(runner); }
  }
  private async liberar(runner: QueryRunner): Promise<void> {
    try { await runner.release(); } catch (error) { registrarFallo('db.liberacion', error); throw error; }
  }
}
