import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type {
  BloqueoDeFila, EntradaGuardada, NuevaBitacora, NuevaVersion, PaginaDeFilas, RepositorioSolicitudes, ResumenDeFila, VersionGuardada,
} from '../../aplicacion/puertos/repositorios.js';
import type { Solicitud } from '../../dominio/solicitud.js';
import type { EstadoSolicitud } from '../../dominio/tipos.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Las fechas de calendario se leen como texto para que el controlador del driver no las convierta a la zona del servidor. */
const columnas = `id, cliente_cuenta_id, tipo, estado, prestador_id, prestador_cuenta_id, servicio_id, servicio_titulo, servicio_categoria_id, descripcion, medidas, categoria_id,
  distrito_codigo, to_char(fecha_desde, 'YYYY-MM-DD') AS fecha_desde, to_char(fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta, compartir_fotografias, version, version_trabajo,
  creada_en, actualizada_en, publicada_en, cerrada_en`;

interface Fila {
  id: string; cliente_cuenta_id: string; tipo: Solicitud['tipo']; estado: Solicitud['estado']; prestador_id: string | null; prestador_cuenta_id: string | null;
  servicio_id: string | null; servicio_titulo: string | null; servicio_categoria_id: string | null; descripcion: string | null; medidas: string | null; categoria_id: string | null;
  distrito_codigo: string | null; fecha_desde: string | null; fecha_hasta: string | null; compartir_fotografias: boolean; version: number; version_trabajo: number;
  creada_en: Date; actualizada_en: Date; publicada_en: Date | null; cerrada_en: Date | null;
}
const aSolicitud = (f: Fila): Solicitud => ({
  id: f.id, clienteCuentaId: f.cliente_cuenta_id, tipo: f.tipo, estado: f.estado, prestadorId: f.prestador_id, prestadorCuentaId: f.prestador_cuenta_id,
  servicio: f.servicio_id && f.servicio_titulo && f.servicio_categoria_id ? { servicioId: f.servicio_id, titulo: f.servicio_titulo, categoriaId: f.servicio_categoria_id } : null,
  descripcion: f.descripcion, medidas: f.medidas, categoriaId: f.categoria_id, distrito: f.distrito_codigo, fechaDesde: f.fecha_desde, fechaHasta: f.fecha_hasta,
  compartirFotografias: f.compartir_fotografias, version: f.version, versionTrabajo: f.version_trabajo, creadaEn: f.creada_en, actualizadaEn: f.actualizada_en,
  publicadaEn: f.publicada_en, cerradaEn: f.cerrada_en,
});
const valoresDe = (s: Solicitud) => [s.id, s.clienteCuentaId, s.tipo, s.estado, s.prestadorId, s.prestadorCuentaId, s.servicio?.servicioId ?? null, s.servicio?.titulo ?? null,
  s.servicio?.categoriaId ?? null, s.descripcion, s.medidas, s.categoriaId, s.distrito, s.fechaDesde, s.fechaHasta, s.compartirFotografias, s.version, s.versionTrabajo, s.publicadaEn, s.cerradaEn];

interface FilaResumen { total: number; id: string | null; tipo: Solicitud['tipo']; estado: Solicitud['estado']; categoria_id: string | null; distrito_codigo: string | null;
  fecha_desde: string | null; corta: string | null; version: number; version_trabajo: number; actualizada_en: Date; es_destinatario?: boolean }
const aResumen = (f: FilaResumen): ResumenDeFila => ({ solicitudId: f.id!, tipo: f.tipo, estado: f.estado, categoriaId: f.categoria_id, distrito: f.distrito_codigo, fechaDesde: f.fecha_desde,
  descripcionCorta: f.corta, version: f.version, versionTrabajo: f.version_trabajo, actualizadaEn: f.actualizada_en, esDestinatario: f.es_destinatario === true });

/**
 * Sentencia de página con total de la MISMA lectura: la ventana `f` se materializa una vez y el total y la página salen de ella, así que son coherentes y el
 * número de sentencias no depende del tamaño de página. Con una página vacía sigue devolviendo el total.
 */
const sqlPagina = (filtro: string, extra: string, limite: string, salto: string) => `WITH f AS MATERIALIZED (
    SELECT id, tipo, estado, categoria_id, distrito_codigo, to_char(fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
      left(descripcion, 200) AS corta, version, version_trabajo, actualizada_en, count(*) OVER ()::int AS cantidad${extra}
    FROM solicitudes WHERE ${filtro}
  ), pagina AS (SELECT * FROM f ORDER BY actualizada_en DESC, id LIMIT ${limite} OFFSET ${salto})
  SELECT COALESCE(pagina.cantidad, (SELECT cantidad FROM f LIMIT 1), 0) AS total, pagina.* FROM (SELECT 1) x
  LEFT JOIN pagina ON true ORDER BY pagina.actualizada_en DESC, pagina.id`;

export class RepositorioSolicitudesPostgres implements RepositorioSolicitudes {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}
  private ejecutor(tx?: ContextoTransaccion) { return tx ? this.uow.runner(tx) : this.uow.db; }

  async obtener(id: string, tx?: ContextoTransaccion, bloqueo?: BloqueoDeFila): Promise<Solicitud | null> {
    if (!uuid.test(id)) return null;
    const cierre = bloqueo && tx ? (bloqueo === 'actualizacion' ? ' FOR UPDATE' : ' FOR SHARE') : '';
    const filas = await this.ejecutor(tx).query(`SELECT ${columnas} FROM solicitudes WHERE id = $1::uuid${cierre}`, [id]) as Fila[];
    return filas[0] ? aSolicitud(filas[0]) : null;
  }

  async crear(tx: ContextoTransaccion, s: Solicitud): Promise<void> {
    await this.uow.runner(tx).query(`INSERT INTO solicitudes (id, cliente_cuenta_id, tipo, estado, prestador_id, prestador_cuenta_id, servicio_id, servicio_titulo, servicio_categoria_id,
      descripcion, medidas, categoria_id, distrito_codigo, fecha_desde, fecha_hasta, compartir_fotografias, version, version_trabajo, publicada_en, cerrada_en)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`, valoresDe(s));
  }

  async guardar(tx: ContextoTransaccion, s: Solicitud): Promise<void> {
    await this.uow.runner(tx).query(`UPDATE solicitudes SET tipo=$3, estado=$4, prestador_id=$5, prestador_cuenta_id=$6, servicio_id=$7, servicio_titulo=$8, servicio_categoria_id=$9,
      descripcion=$10, medidas=$11, categoria_id=$12, distrito_codigo=$13, fecha_desde=$14, fecha_hasta=$15, compartir_fotografias=$16, version=$17, version_trabajo=$18,
      publicada_en=$19, cerrada_en=$20, actualizada_en=clock_timestamp() WHERE id=$1 AND cliente_cuenta_id=$2`, valoresDe(s));
  }

  async insertarVersion(tx: ContextoTransaccion, v: NuevaVersion): Promise<void> {
    await this.uow.runner(tx).query(`INSERT INTO solicitudes_versiones (solicitud_id, numero, descripcion, medidas, categoria_id, distrito_codigo, fecha_desde, fecha_hasta, archivos, creada_por_cuenta_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`, [v.solicitudId, v.numero, v.descripcion, v.medidas, v.categoriaId, v.distrito, v.fechaDesde, v.fechaHasta, JSON.stringify(v.archivos), v.creadaPorCuentaId]);
  }

  async insertarBitacora(tx: ContextoTransaccion, e: NuevaBitacora): Promise<void> {
    await this.uow.runner(tx).query(`INSERT INTO solicitudes_bitacora (id, solicitud_id, actor_cuenta_id, tipo, version, version_trabajo, campos_cambiados)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::text[])`, [e.solicitudId, e.actorCuentaId, e.tipo, e.version, e.versionTrabajo, [...e.camposCambiados]]);
  }

  async listarComoCliente(cuentaId: string, estado: EstadoSolicitud | undefined, pagina: number, tamano: number): Promise<PaginaDeFilas<ResumenDeFila>> {
    const filas = await this.uow.db.query(sqlPagina('cliente_cuenta_id = $1::uuid AND ($2::text IS NULL OR estado = $2::text)', '', '$3', '$4'),
      [cuentaId, estado ?? null, tamano, (pagina - 1) * tamano]) as FilaResumen[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(f => f.id !== null).map(aResumen) };
  }

  async listarComoPrestador(cuentaId: string, conAutoria: readonly string[], estado: EstadoSolicitud | undefined, pagina: number, tamano: number): Promise<PaginaDeFilas<ResumenDeFila>> {
    // Dirigidas a la cuenta en cualquier estado salvo borrador, y solicitudes donde tiene una cotización no retirada (también cerradas). Nunca un borrador ajeno.
    const filtro = `estado <> 'BORRADOR' AND ($2::text IS NULL OR estado = $2::text)
      AND ((tipo = 'DIRIGIDA' AND prestador_cuenta_id = $1::uuid) OR id = ANY($3::uuid[]))`;
    const filas = await this.uow.db.query(sqlPagina(filtro, `, (tipo = 'DIRIGIDA' AND prestador_cuenta_id = $1::uuid) AS es_destinatario`, '$4', '$5'),
      [cuentaId, estado ?? null, [...conAutoria], tamano, (pagina - 1) * tamano]) as FilaResumen[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(f => f.id !== null).map(aResumen) };
  }

  async versiones(solicitudId: string, pagina: number, tamano: number): Promise<PaginaDeFilas<VersionGuardada>> {
    const filas = await this.uow.db.query(`WITH f AS MATERIALIZED (SELECT numero, descripcion, medidas, categoria_id, distrito_codigo, to_char(fecha_desde,'YYYY-MM-DD') AS fecha_desde,
        to_char(fecha_hasta,'YYYY-MM-DD') AS fecha_hasta, archivos, creada_en FROM solicitudes_versiones WHERE solicitud_id = $1::uuid),
      pagina AS (SELECT * FROM f ORDER BY numero DESC LIMIT $2 OFFSET $3)
      SELECT (SELECT count(*) FROM f)::int AS total, pagina.* FROM (SELECT 1) x LEFT JOIN pagina ON true ORDER BY pagina.numero DESC`, [solicitudId, tamano, (pagina - 1) * tamano]) as
      { total: number; numero: number | null; descripcion: string; medidas: string | null; categoria_id: string; distrito_codigo: string; fecha_desde: string; fecha_hasta: string | null; archivos: VersionGuardada['archivos']; creada_en: Date }[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(f => f.numero !== null).map(f => ({ solicitudId, numero: f.numero!, descripcion: f.descripcion, medidas: f.medidas, categoriaId: f.categoria_id,
      distrito: f.distrito_codigo, fechaDesde: f.fecha_desde, fechaHasta: f.fecha_hasta, archivos: f.archivos, creadaEn: f.creada_en })) };
  }

  async bitacora(solicitudId: string, pagina: number, tamano: number): Promise<PaginaDeFilas<EntradaGuardada>> {
    const filas = await this.uow.db.query(`WITH f AS MATERIALIZED (SELECT id, ocurrida_en, actor_cuenta_id, tipo, version, version_trabajo, campos_cambiados FROM solicitudes_bitacora WHERE solicitud_id = $1::uuid),
      pagina AS (SELECT * FROM f ORDER BY ocurrida_en DESC, id LIMIT $2 OFFSET $3)
      SELECT (SELECT count(*) FROM f)::int AS total, pagina.* FROM (SELECT 1) x LEFT JOIN pagina ON true ORDER BY pagina.ocurrida_en DESC, pagina.id`, [solicitudId, tamano, (pagina - 1) * tamano]) as
      { total: number; id: string | null; ocurrida_en: Date; actor_cuenta_id: string; tipo: EntradaGuardada['tipo']; version: number; version_trabajo: number; campos_cambiados: string[] }[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(f => f.id !== null).map(f => ({ entradaId: f.id!, solicitudId, ocurridaEn: f.ocurrida_en, actorCuentaId: f.actor_cuenta_id, tipo: f.tipo,
      version: f.version, versionTrabajo: f.version_trabajo, camposCambiados: f.campos_cambiados })) };
  }
}
