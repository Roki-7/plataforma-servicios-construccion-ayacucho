import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { CategoriasDeOferta } from '../../api-publica.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Una sola sentencia de solo lectura. `visibles` aplica la misma regla de visibilidad de la búsqueda pública de la 002: servicio PUBLICADO con la
 * clasificación propia activa y, si es subcategoría, la categoría padre también activa. La clasificación de cada servicio visible aporta su
 * categoría y, si es subcategoría, además su padre. Un servicio en una categoría no aporta sus subcategorías.
 */
export const sqlCategoriasDeOferta = `WITH visibles AS (
    SELECT s.categoria_id, c.categoria_padre_id
    FROM catalogo_servicios s
    JOIN catalogo_clasificaciones c ON c.id = s.categoria_id
    LEFT JOIN catalogo_clasificaciones p ON p.id = c.categoria_padre_id
    WHERE s.prestador_id = $1::uuid AND s.estado = 'PUBLICADO' AND c.activa AND (c.nivel = 1 OR (p.nivel = 1 AND p.activa)))
  SELECT categoria_id AS id FROM visibles
  UNION
  SELECT categoria_padre_id AS id FROM visibles WHERE categoria_padre_id IS NOT NULL`;

export class CategoriasDeOfertaPostgres implements CategoriasDeOferta {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}

  async categoriasDeOferta(prestadorId: string, tx?: ContextoTransaccion): Promise<ReadonlySet<string>> {
    if (!uuid.test(prestadorId)) return new Set();
    const ejecutor = tx ? this.uow.runner(tx) : this.uow.db;
    const filas = await ejecutor.query(sqlCategoriasDeOferta, [prestadorId]) as { id: string }[];
    return new Set(filas.map(f => f.id));
  }
}
