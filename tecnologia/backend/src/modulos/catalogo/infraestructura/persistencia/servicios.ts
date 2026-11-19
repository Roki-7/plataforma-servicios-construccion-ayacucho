import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import { filasDe } from '../../../../compartido/infraestructura/postgres/filas.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { CambiosServicio, PaginaServicios, RepositorioServicios } from '../../aplicacion/puertos/servicios.js';
import type { EstadoServicio, Servicio } from '../../dominio/servicio.js';

interface Fila { id: string; prestador_id: string; categoria_id: string; titulo: string; descripcion: string; estado: EstadoServicio; version: number }
const columnas = 'id,prestador_id,categoria_id,titulo,descripcion,estado,version';
const aServicio = (f: Fila): Servicio => ({ id: f.id, prestadorId: f.prestador_id, categoriaId: f.categoria_id, titulo: f.titulo, descripcion: f.descripcion, estado: f.estado, version: f.version });

export class ServiciosPostgres implements RepositorioServicios {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}
  private async consultar<T>(tx: ContextoTransaccion | undefined, sql: string, parametros: unknown[] = []): Promise<T[]> {
    return filasDe<T>(await (tx ? this.uow.runner(tx) : this.uow.db).query(sql, parametros));
  }

  async crear(tx: ContextoTransaccion, s: Servicio): Promise<void> {
    await this.uow.runner(tx).query(`INSERT INTO catalogo_servicios(${columnas}) VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [s.id, s.prestadorId, s.categoriaId, s.titulo, s.descripcion, s.estado, s.version]);
  }
  async porId(servicioId: string, tx?: ContextoTransaccion, bloquear = false): Promise<Servicio | null> {
    const filas = await this.consultar<Fila>(tx, `SELECT ${columnas} FROM catalogo_servicios WHERE id=$1${bloquear && tx ? ' FOR UPDATE' : ''}`, [servicioId]);
    return filas[0] ? aServicio(filas[0]) : null;
  }
  async actualizar(tx: ContextoTransaccion, servicioId: string, c: CambiosServicio): Promise<number> {
    const filas = await this.consultar<{ version: number }>(tx, `UPDATE catalogo_servicios SET titulo=COALESCE($2,titulo),descripcion=COALESCE($3,descripcion),
      categoria_id=COALESCE($4,categoria_id),estado=COALESCE($5,estado),version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=$1 RETURNING version`,
    [servicioId, c.titulo ?? null, c.descripcion ?? null, c.categoriaId ?? null, c.estado ?? null]);
    if (!filas[0]) throw new Error('El servicio a actualizar no existe.');
    return filas[0].version;
  }
  async listarPropios(prestadorId: string, pagina: number, tamano: number): Promise<PaginaServicios> {
    const total = Number((await this.consultar<{ n: string }>(undefined, 'SELECT count(*)::text AS n FROM catalogo_servicios WHERE prestador_id=$1', [prestadorId]))[0]!.n);
    const filas = await this.consultar<Fila>(undefined, `SELECT ${columnas} FROM catalogo_servicios WHERE prestador_id=$1 ORDER BY creado_en, id LIMIT $2 OFFSET $3`,
      [prestadorId, tamano, (pagina - 1) * tamano]);
    return { elementos: filas.map(aServicio), total };
  }
  async clasificacionActiva(servicioId: string, tx?: ContextoTransaccion): Promise<boolean> {
    const filas = await this.consultar<unknown>(tx, `SELECT 1 FROM catalogo_servicios s JOIN catalogo_clasificaciones c ON c.id=s.categoria_id
      LEFT JOIN catalogo_clasificaciones p ON p.id=c.categoria_padre_id WHERE s.id=$1 AND c.activa AND (c.nivel=1 OR (p.nivel=1 AND p.activa))`, [servicioId]);
    return filas.length > 0;
  }
}
