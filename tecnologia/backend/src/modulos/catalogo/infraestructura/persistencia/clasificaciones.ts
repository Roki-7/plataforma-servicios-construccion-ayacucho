import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import { filasDe } from '../../../../compartido/infraestructura/postgres/filas.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ClasificacionAdmin, ClasificacionPublica } from '../../api-publica.js';
import type { FilaConfirmacion, RepositorioClasificaciones } from '../../aplicacion/puertos/clasificaciones.js';
import type { Clasificacion } from '../../dominio/clasificacion.js';

interface Fila { id: string; nombre: string; nivel: number; categoria_padre_id: string | null; activa: boolean; version: number }
const columnas = 'id,nombre,nivel,categoria_padre_id,activa,version';
const aClasificacion = (f: Fila): Clasificacion => f.nivel === 1
  ? { id: f.id, nombre: f.nombre, nivel: 1, categoriaPadreId: null, activa: f.activa, version: f.version }
  : { id: f.id, nombre: f.nombre, nivel: 2, categoriaPadreId: f.categoria_padre_id as string, activa: f.activa, version: f.version };

export class ClasificacionesPostgres implements RepositorioClasificaciones {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}
  private async q<T>(tx: ContextoTransaccion | undefined, sql: string, p: unknown[] = []): Promise<T[]> {
    return filasDe<T>(await (tx ? this.uow.runner(tx) : this.uow.db).query(sql, p));
  }

  async bloquear(tx: ContextoTransaccion, id: string) {
    // Raíz primero (nivel ascendente) y después la subcategoría: el mismo orden que usan los demás escritores.
    const filas = await this.q<Fila>(tx, `SELECT ${columnas} FROM catalogo_clasificaciones
      WHERE id=$1 OR id=(SELECT categoria_padre_id FROM catalogo_clasificaciones WHERE id=$1) ORDER BY nivel, id FOR UPDATE`, [id]);
    const propia = filas.find(f => f.id === id);
    if (!propia) return null;
    const padre = filas.find(f => f.id === propia.categoria_padre_id);
    return { clasificacion: aClasificacion(propia), padre: padre ? aClasificacion(padre) : null };
  }
  async insertar(tx: ContextoTransaccion, c: Clasificacion, nombreNormalizado: string): Promise<void> {
    await this.q(tx, 'INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id,activa,version) VALUES($1,$2::varchar,$3,$4,$5,$6,$7)',
      [c.id, c.nombre, nombreNormalizado, c.nivel, c.categoriaPadreId, c.activa, c.version]);
  }
  async actualizar(tx: ContextoTransaccion, id: string, c: { nombre?: string; nombreNormalizado?: string; activa?: boolean }): Promise<number> {
    const filas = await this.q<{ version: number }>(tx, `UPDATE catalogo_clasificaciones SET nombre=COALESCE($2::varchar,nombre), nombre_normalizado=COALESCE($3,nombre_normalizado),
      activa=COALESCE($4,activa), version=version+1, actualizada_en=CURRENT_TIMESTAMP WHERE id=$1 RETURNING version`, [id, c.nombre ?? null, c.nombreNormalizado ?? null, c.activa ?? null]);
    if (!filas[0]) throw new Error('La clasificación a actualizar no existe.');
    return filas[0].version;
  }
  async contarAfectados(tx: ContextoTransaccion, id: string): Promise<number> {
    const f = await this.q<{ n: string }>(tx, `SELECT count(DISTINCT s.id)::text AS n FROM catalogo_servicios s JOIN catalogo_clasificaciones c ON c.id=s.categoria_id
      LEFT JOIN catalogo_clasificaciones p ON p.id=c.categoria_padre_id
      WHERE s.estado='PUBLICADO' AND c.activa AND (c.nivel=1 OR p.activa) AND (c.id=$1 OR c.categoria_padre_id=$1)`, [id]);
    return Number(f[0]!.n);
  }
  async crearConfirmacion(tx: ContextoTransaccion, c: { id: string; actor: string; clasificacionId: string; version: number; revision: bigint; afectados: number }): Promise<string> {
    const f = await this.q<{ vence: string }>(tx, `INSERT INTO catalogo_confirmaciones_desactivacion(id,actor_cuenta_id,clasificacion_id,version,revision,afectados,vence_en)
      VALUES($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP + interval '5 minutes') RETURNING to_char(vence_en AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS vence`,
    [c.id, c.actor, c.clasificacionId, c.version, c.revision.toString(), c.afectados]);
    return f[0]!.vence;
  }
  async bloquearConfirmacion(tx: ContextoTransaccion, id: string): Promise<FilaConfirmacion | null> {
    const f = await this.q<{ id: string; actor_cuenta_id: string; clasificacion_id: string; version: number; revision: string; afectados: number; vigente: boolean; consumida: boolean }>(tx,
      `SELECT id,actor_cuenta_id,clasificacion_id,version,revision::text AS revision,afectados,(vence_en > CURRENT_TIMESTAMP) AS vigente,(consumida_en IS NOT NULL) AS consumida
       FROM catalogo_confirmaciones_desactivacion WHERE id=$1 FOR UPDATE`, [id]);
    const r = f[0];
    return r ? { id: r.id, actorCuentaId: r.actor_cuenta_id, clasificacionId: r.clasificacion_id, version: r.version, revision: BigInt(r.revision), afectados: r.afectados, vigente: r.vigente, consumida: r.consumida } : null;
  }
  async consumirConfirmacion(tx: ContextoTransaccion, id: string): Promise<void> {
    await this.q(tx, 'UPDATE catalogo_confirmaciones_desactivacion SET consumida_en=CURRENT_TIMESTAMP WHERE id=$1 AND consumida_en IS NULL', [id]);
  }
  async listarAdmin(): Promise<readonly ClasificacionAdmin[]> {
    const f = await this.q<Fila & { efectiva: boolean }>(undefined, `SELECT c.id,c.nombre,c.nivel,c.categoria_padre_id,c.activa,c.version,
      (c.activa AND (c.nivel=1 OR COALESCE(p.activa,false))) AS efectiva FROM catalogo_clasificaciones c LEFT JOIN catalogo_clasificaciones p ON p.id=c.categoria_padre_id
      ORDER BY c.nivel, lower(c.nombre), c.id`);
    return f.map(r => ({ categoriaId: r.id, categoriaPadreId: r.categoria_padre_id, nombre: r.nombre, activaPropia: r.activa, activaEfectiva: r.efectiva, version: r.version }));
  }
  async listarPublicas(): Promise<readonly ClasificacionPublica[]> {
    const f = await this.q<Fila>(undefined, `SELECT c.id,c.nombre,c.nivel,c.categoria_padre_id,c.activa,c.version FROM catalogo_clasificaciones c
      LEFT JOIN catalogo_clasificaciones p ON p.id=c.categoria_padre_id WHERE c.activa AND (c.nivel=1 OR p.activa) ORDER BY c.nivel, lower(c.nombre), c.id`);
    return f.map(r => ({ categoriaId: r.id, categoriaPadreId: r.categoria_padre_id, nombre: r.nombre }));
  }
}
