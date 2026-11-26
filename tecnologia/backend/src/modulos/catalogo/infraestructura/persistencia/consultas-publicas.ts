import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ConsultasPublicas, FiltrosOferta, PaginaDto, PrestadorResumenDto, ServicioPublicoDto } from '../../aplicacion/puertos/consultas-publicas.js';

interface FilaServicio { total: number; id: string | null; prestador_id: string; categoria_id: string; titulo: string; descripcion: string }
interface FilaPrestador { total: number; prestador_id: string | null; nombre_publico: string; tipo: string; especialidades: string[]; distritos: string[]; disponibilidad_declarada: boolean }

/** Servicio visible: PUBLICADO, con clasificación efectivamente activa (propia y de su padre). */
const visible = `s.estado = 'PUBLICADO' AND c.activa AND (c.nivel = 1 OR (p.nivel = 1 AND p.activa))`;
const origenBase = `catalogo_servicios s JOIN catalogo_clasificaciones c ON c.id = s.categoria_id LEFT JOIN catalogo_clasificaciones p ON p.id = c.categoria_padre_id`;
const unePrestador = `JOIN catalogo_proyeccion_prestadores pr ON pr.prestador_id = s.prestador_id AND pr.publicable`;
/** Todos los parámetros son valores enlazados. $1 categoría, $2 especialidad, $3 distrito, $4 disponibilidad. */
const filtrosProyeccion = `($2::uuid IS NULL OR pr.especialidades @> ARRAY[$2::uuid])
  AND ($3::text IS NULL OR pr.distritos @> ARRAY[$3::text])
  AND ($4::boolean IS NULL OR pr.disponibilidad_declarada = $4::boolean)`;
const filtroCategoria = `($1::uuid IS NULL OR s.categoria_id = $1::uuid OR c.categoria_padre_id = $1::uuid)`;

const aServicio = (f: FilaServicio): ServicioPublicoDto => ({ servicioId: f.id!, prestadorId: f.prestador_id, titulo: f.titulo, descripcion: f.descripcion, categoriaId: f.categoria_id, estado: 'PUBLICADO' });
const enlazados = (f: FiltrosOferta) => [f.categoria ?? null, f.especialidad ?? null, f.distrito ?? null, f.disponibilidad ?? null, f.tamano, (f.pagina - 1) * f.tamano];

export const sqlBuscarServicios = `WITH f AS MATERIALIZED (SELECT s.id, s.prestador_id, s.categoria_id, s.titulo, s.descripcion FROM ${origenBase} ${unePrestador}
    WHERE ${visible} AND ${filtroCategoria} AND ${filtrosProyeccion}),
  pagina AS (SELECT * FROM f ORDER BY id LIMIT $5 OFFSET $6)
  SELECT (SELECT count(*) FROM f)::int AS total, pagina.* FROM (SELECT 1) x LEFT JOIN pagina ON true ORDER BY pagina.id`;

export const sqlBuscarPrestadores = `WITH f AS MATERIALIZED (SELECT pr.prestador_id, pr.nombre_publico, pr.tipo, pr.especialidades, pr.distritos, pr.disponibilidad_declarada
    FROM catalogo_proyeccion_prestadores pr WHERE pr.publicable AND ${filtrosProyeccion}
    AND ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM ${origenBase} WHERE s.prestador_id = pr.prestador_id AND ${visible} AND ${filtroCategoria}))),
  pagina AS (SELECT * FROM f ORDER BY lower(nombre_publico), prestador_id LIMIT $5 OFFSET $6)
  SELECT (SELECT count(*) FROM f)::int AS total, pagina.* FROM (SELECT 1) x LEFT JOIN pagina ON true ORDER BY lower(pagina.nombre_publico), pagina.prestador_id`;

export class ConsultasPublicasPostgres implements ConsultasPublicas {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}

  /** Una sola sentencia: el total y la página provienen de la misma instantánea. Orden estable por UUID. */
  async buscarServicios(f: FiltrosOferta): Promise<PaginaDto<ServicioPublicoDto>> {
    const filas = await this.uow.db.query(sqlBuscarServicios, enlazados(f)) as FilaServicio[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(r => r.id !== null).map(aServicio) };
  }

  /** Con filtro de categoría se exige al menos un servicio visible del prestador que coincida. La raíz incluye sus subcategorías activas. */
  async buscarPrestadores(f: FiltrosOferta): Promise<PaginaDto<PrestadorResumenDto>> {
    const filas = await this.uow.db.query(sqlBuscarPrestadores, enlazados(f)) as FilaPrestador[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(r => r.prestador_id !== null).map(r => ({ prestadorId: r.prestador_id!, nombrePublico: r.nombre_publico, tipo: r.tipo,
      especialidadesIds: r.especialidades, distritos: r.distritos, disponibilidadDeclarada: r.disponibilidad_declarada })) };
  }

  async servicioVisible(servicioId: string): Promise<ServicioPublicoDto | null> {
    const filas = await this.uow.db.query(`SELECT s.id, s.prestador_id, s.categoria_id, s.titulo, s.descripcion, 1 AS total FROM ${origenBase} ${unePrestador} WHERE s.id = $1::uuid AND ${visible}`, [servicioId]) as FilaServicio[];
    return filas[0] ? aServicio(filas[0]) : null;
  }

  async serviciosVisiblesDe(prestadorId: string, pagina: number, tamano: number): Promise<PaginaDto<ServicioPublicoDto>> {
    const filas = await this.uow.db.query(`WITH f AS MATERIALIZED (SELECT s.id, s.prestador_id, s.categoria_id, s.titulo, s.descripcion FROM ${origenBase} ${unePrestador}
        WHERE s.prestador_id = $1::uuid AND ${visible}),
      pagina AS (SELECT * FROM f ORDER BY id LIMIT $2 OFFSET $3)
      SELECT (SELECT count(*) FROM f)::int AS total, pagina.* FROM (SELECT 1) x LEFT JOIN pagina ON true ORDER BY pagina.id`, [prestadorId, tamano, (pagina - 1) * tamano]) as FilaServicio[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(r => r.id !== null).map(aServicio) };
  }
}
