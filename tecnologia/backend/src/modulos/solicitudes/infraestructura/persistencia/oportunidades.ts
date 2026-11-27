import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { OportunidadDeFila, PaginaDeFilas, RepositorioOportunidades, ResumenDeFila } from '../../aplicacion/puertos/repositorios.js';
import type { EstadoSolicitud, TipoSolicitud } from '../../dominio/tipos.js';

export interface FilaResumen {
  total: number; id: string | null; tipo: TipoSolicitud; estado: EstadoSolicitud; categoria_id: string | null; distrito_codigo: string | null;
  fecha_desde: string | null; corta: string | null; version: number; version_trabajo: number; actualizada_en: Date; es_destinatario?: boolean;
}

export const paginaDeResumenes = (filas: readonly FilaResumen[]): PaginaDeFilas<ResumenDeFila> => ({
  total: filas[0]?.total ?? 0,
  elementos: filas.filter(f => f.id !== null).map(f => ({ solicitudId: f.id!, tipo: f.tipo, estado: f.estado, categoriaId: f.categoria_id,
    distrito: f.distrito_codigo, fechaDesde: f.fecha_desde, descripcionCorta: f.corta, version: f.version, versionTrabajo: f.version_trabajo,
    actualizadaEn: f.actualizada_en, esDestinatario: f.es_destinatario === true })),
});

/** Página y total de la misma lectura, incluso cuando el desplazamiento deja la página vacía. */
export const sqlPaginaDeSolicitudes = (filtro: string, extra: string, limite: string, salto: string) => `WITH f AS MATERIALIZED (
    SELECT id, tipo, estado, categoria_id, distrito_codigo, to_char(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
      left(descripcion, 200) AS corta, version, version_trabajo, actualizada_en, count(*) OVER ()::int AS cantidad${extra}
    FROM solicitudes WHERE ${filtro}
  ), pagina AS (SELECT * FROM f ORDER BY actualizada_en DESC, id LIMIT ${limite} OFFSET ${salto})
  SELECT COALESCE(pagina.cantidad, (SELECT cantidad FROM f LIMIT 1), 0) AS total, pagina.* FROM (SELECT 1) x
  LEFT JOIN pagina ON true ORDER BY pagina.actualizada_en DESC, pagina.id`;

interface FilaOportunidad {
  total: number; id: string | null; tipo: TipoSolicitud; categoria_id: string; distrito_codigo: string; fecha_desde: string;
  fecha_hasta: string | null; corta: string; cliente_cuenta_id: string; prestador_cuenta_id: string | null; compartir_fotografias: boolean;
  hay_fotografias: boolean; version_trabajo: number; publicada_en: Date;
}

const columnas = 'id, tipo, categoria_id, distrito_codigo, fecha_desde, fecha_hasta, descripcion, cliente_cuenta_id, prestador_cuenta_id, compartir_fotografias, version_trabajo, publicada_en';

export class RepositorioOportunidadesPostgres implements RepositorioOportunidades {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}

  async listarAbiertas(cuentaId: string, prestadorId: string, categorias: readonly string[], distritos: readonly string[], pagina: number, tamano: number): Promise<PaginaDeFilas<OportunidadDeFila>> {
    // Las ramas son disjuntas y conservan los predicados de sus respectivos índices parciales.
    const filas = await this.uow.db.query(`WITH compatibles AS (
        SELECT ${columnas} FROM solicitudes WHERE tipo = 'PUBLICADA' AND estado = 'ABIERTA' AND cliente_cuenta_id <> $1::uuid
          AND categoria_id = ANY($3::uuid[]) AND distrito_codigo = ANY($4::text[])
        UNION ALL
        SELECT ${columnas} FROM solicitudes WHERE tipo = 'DIRIGIDA' AND estado = 'ABIERTA' AND cliente_cuenta_id <> $1::uuid
          AND prestador_id = $2::uuid AND prestador_cuenta_id = $1::uuid
      ), f AS MATERIALIZED (
        SELECT *, count(*) OVER ()::int AS cantidad FROM compatibles
      ), pagina AS (SELECT * FROM f ORDER BY publicada_en DESC, id LIMIT $5 OFFSET $6)
      SELECT COALESCE(p.cantidad, (SELECT cantidad FROM f LIMIT 1), 0) AS total, p.id, p.tipo, p.categoria_id, p.distrito_codigo,
        to_char(p.fecha_desde, 'YYYY-MM-DD') AS fecha_desde, to_char(p.fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta,
        left(p.descripcion, 200) AS corta, p.cliente_cuenta_id, p.prestador_cuenta_id, p.compartir_fotografias, p.version_trabajo, p.publicada_en,
        EXISTS (SELECT 1 FROM solicitudes_archivos a WHERE a.solicitud_id = p.id AND a.estado = 'CONFIRMADO') AS hay_fotografias
      FROM (SELECT 1) x LEFT JOIN pagina p ON true ORDER BY p.publicada_en DESC, p.id`,
    [cuentaId, prestadorId, [...categorias], [...distritos], tamano, (pagina - 1) * tamano]) as FilaOportunidad[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(f => f.id !== null).map(f => ({ solicitudId: f.id!, tipo: f.tipo,
      categoriaId: f.categoria_id, distrito: f.distrito_codigo, fechaDesde: f.fecha_desde, fechaHasta: f.fecha_hasta, descripcionCorta: f.corta,
      clienteCuentaId: f.cliente_cuenta_id, prestadorCuentaId: f.prestador_cuenta_id, compartirFotografias: f.compartir_fotografias,
      hayFotografias: f.hay_fotografias, versionTrabajo: f.version_trabajo, publicadaEn: f.publicada_en })) };
  }

  async listarComoPrestador(cuentaId: string, conAutoria: readonly string[], estado: EstadoSolicitud | undefined, pagina: number, tamano: number): Promise<PaginaDeFilas<ResumenDeFila>> {
    const destinatario = "(tipo = 'DIRIGIDA' AND prestador_cuenta_id = $1::uuid)";
    const filtro = `estado <> 'BORRADOR' AND cliente_cuenta_id <> $1::uuid AND ($2::text IS NULL OR estado = $2::text)
      AND (${destinatario} OR id = ANY($3::uuid[]))`;
    const filas = await this.uow.db.query(sqlPaginaDeSolicitudes(filtro, `, ${destinatario} AS es_destinatario`, '$4', '$5'),
      [cuentaId, estado ?? null, [...conAutoria], tamano, (pagina - 1) * tamano]) as FilaResumen[];
    return paginaDeResumenes(filas);
  }
}
