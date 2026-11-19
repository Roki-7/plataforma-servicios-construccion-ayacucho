import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import { dependenciaNoDisponible } from '../../../../compartido/dominio/errores.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { RevisionDeOferta } from '../../api-publica.js';

type Fila = { revision: string };
const consultar = 'SELECT revision::text AS revision FROM catalogo_revision_oferta WHERE unica';
function revision(filas: Fila[]): bigint {
  const valor = filas[0]?.revision;
  if (!valor || !/^[1-9]\d*$/.test(valor)) throw dependenciaNoDisponible();
  return BigInt(valor);
}

export class RevisionDeOfertaPostgres implements RevisionDeOferta {
  private readonly exclusivas = new WeakSet<ContextoTransaccion>();
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}

  async vigente(tx?: ContextoTransaccion): Promise<bigint> {
    if (tx) return revision(await this.uow.runner(tx).query(consultar));
    // El modo explícito conserva la lectura en el primario incluso si se añade replicación.
    const q = this.uow.db.createQueryRunner('master');
    try { return revision(await q.query(consultar)); }
    catch { throw dependenciaNoDisponible(); }
    finally { await q.release(); }
  }

  async bloquear(tx: ContextoTransaccion, modo: 'compartido' | 'exclusivo'): Promise<bigint> {
    const filas: Fila[] = await this.uow.runner(tx).query(`${consultar} ${modo === 'exclusivo' ? 'FOR UPDATE' : 'FOR SHARE'}`);
    if (modo === 'exclusivo') this.exclusivas.add(tx);
    return revision(filas);
  }

  async incrementar(tx: ContextoTransaccion): Promise<bigint> {
    const q = this.uow.runner(tx);
    if (!this.exclusivas.has(tx)) throw new Error('Se requiere el bloqueo exclusivo de la revisión de Catálogo.');
    await q.query('UPDATE catalogo_revision_oferta SET revision=revision+1 WHERE unica');
    return this.vigente(tx);
  }
}
