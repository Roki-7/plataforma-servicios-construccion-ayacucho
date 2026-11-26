import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ClasificacionesEfectivas } from '../../api-publica.js';

export class ClasificacionesEfectivasPostgres implements ClasificacionesEfectivas {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}

  async efectivamenteActivas(tx: ContextoTransaccion, ids: readonly string[]): Promise<ReadonlySet<string>> {
    if (ids.length === 0) return new Set();
    const filas: { id: string }[] = await this.uow.runner(tx).query(
      `SELECT c.id FROM catalogo_clasificaciones c LEFT JOIN catalogo_clasificaciones p ON p.id = c.categoria_padre_id
       WHERE c.id = ANY($1::uuid[]) AND c.activa AND (c.nivel = 1 OR (p.nivel = 1 AND p.activa))`, [[...ids]]);
    return new Set(filas.map(f => f.id));
  }
}
