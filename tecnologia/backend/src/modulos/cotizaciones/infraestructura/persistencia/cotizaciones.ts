import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type {
  CotizacionGuardada, NuevaCotizacion, NuevaVersionDeCotizacion, PaginaDeCotizaciones, RepositorioCotizaciones, VersionGuardada,
} from '../../aplicacion/puertos/repositorio.js';
import type { DatosCotizacion, TipoCotizacion } from '../../dominio/cotizacion.js';

const esUuid = (valor: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);

interface FilaVersion {
  numero: number; version_trabajo_solicitud: number; tipo: TipoCotizacion; alcance: string; exclusiones: string | null; materiales: string | null; mano_de_obra: string | null;
  precio_centimos: string | null; forma_calculo: string | null; plazo_dias: number | null; vigente_hasta: Date; condiciones_pago: string | null; creada_en_version: Date;
}
interface FilaCotizacion extends FilaVersion {
  id: string; solicitud_id: string; prestador_id: string; prestador_cuenta_id: string; estado: 'ACTIVA' | 'RETIRADA'; version: number; creada_en: Date; retirada_en: Date | null;
}
const columnasVersion = `v.numero, v.version_trabajo_solicitud, v.tipo, v.alcance, v.exclusiones, v.materiales, v.mano_de_obra, v.precio_centimos, v.forma_calculo,
  v.plazo_dias, v.vigente_hasta, v.condiciones_pago, v.creada_en AS creada_en_version`;
const columnas = `c.id, c.solicitud_id, c.prestador_id, c.prestador_cuenta_id, c.estado, c.version, c.creada_en, c.retirada_en, ${columnasVersion}`;

const aDatos = (f: FilaVersion): DatosCotizacion => ({
  tipo: f.tipo, alcance: f.alcance, vigenteHasta: f.vigente_hasta,
  ...(f.exclusiones === null ? {} : { exclusiones: f.exclusiones }), ...(f.materiales === null ? {} : { materiales: f.materiales }),
  ...(f.mano_de_obra === null ? {} : { manoDeObra: f.mano_de_obra }),
  // `bigint` llega como texto: el precio máximo es 2^53 - 1, así que la conversión no pierde precisión.
  ...(f.precio_centimos === null ? {} : { precioCentimos: Number(f.precio_centimos) }), ...(f.forma_calculo === null ? {} : { formaCalculo: f.forma_calculo }),
  ...(f.plazo_dias === null ? {} : { plazoDias: f.plazo_dias }), ...(f.condiciones_pago === null ? {} : { condicionesPago: f.condiciones_pago }),
});
const aVersion = (f: FilaVersion): VersionGuardada => ({ numero: f.numero, versionTrabajoSolicitud: f.version_trabajo_solicitud, datos: aDatos(f), creadaEn: f.creada_en_version });
const aCotizacion = (f: FilaCotizacion): CotizacionGuardada => ({
  id: f.id, solicitudId: f.solicitud_id, prestadorId: f.prestador_id, prestadorCuentaId: f.prestador_cuenta_id, estado: f.estado, version: f.version,
  creadaEn: f.creada_en, retiradaEn: f.retirada_en, vigente: aVersion(f),
});
const valoresDeVersion = (v: NuevaVersionDeCotizacion) => [v.versionTrabajoSolicitud, v.datos.tipo, v.datos.alcance, v.datos.exclusiones ?? null, v.datos.materiales ?? null,
  v.datos.manoDeObra ?? null, v.datos.precioCentimos === undefined ? null : String(v.datos.precioCentimos), v.datos.formaCalculo ?? null, v.datos.plazoDias ?? null,
  v.datos.vigenteHasta, v.datos.condicionesPago ?? null];

/**
 * Persistencia de cotizaciones sobre las tablas propias. Cada lectura es una sola sentencia. El orden de bloqueos lo fija el caso de uso: solicitud `FOR SHARE`
 * y luego la cotización `FOR UPDATE`. La unicidad de la posición no retirada la garantiza el índice parcial `cotizaciones_unica_no_retirada`.
 */
export class RepositorioCotizacionesPostgres implements RepositorioCotizaciones {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}
  private ejecutor(tx?: ContextoTransaccion) { return tx ? this.uow.runner(tx) : this.uow.db; }

  async referencia(id: string, tx?: ContextoTransaccion) {
    if (!esUuid(id)) return null;
    const filas = await this.ejecutor(tx).query('SELECT solicitud_id, prestador_cuenta_id FROM cotizaciones WHERE id = $1::uuid', [id]) as { solicitud_id: string; prestador_cuenta_id: string }[];
    return filas[0] ? { solicitudId: filas[0].solicitud_id, prestadorCuentaId: filas[0].prestador_cuenta_id } : null;
  }

  async bloquear(id: string, tx: ContextoTransaccion): Promise<CotizacionGuardada | null> {
    if (!esUuid(id)) return null;
    // Se bloquea SOLO la fila de la cotización y después, con una sentencia nueva, se lee su versión vigente. Con un JOIN en la misma sentencia, tras esperar el bloqueo
    // PostgreSQL vuelve a evaluar la condición `v.numero = c.version_actual` con la fila vigente anterior y descartaría la cotización recién actualizada por otra transacción.
    const bloqueada = await this.uow.runner(tx).query('SELECT 1 AS ok FROM cotizaciones WHERE id = $1::uuid FOR UPDATE', [id]) as unknown[];
    return bloqueada.length ? this.obtener(id, tx) : null;
  }

  async obtener(id: string, tx?: ContextoTransaccion): Promise<CotizacionGuardada | null> {
    if (!esUuid(id)) return null;
    const filas = await this.ejecutor(tx).query(`SELECT ${columnas} FROM cotizaciones c JOIN cotizaciones_versiones v ON v.cotizacion_id = c.id AND v.numero = c.version_actual
      WHERE c.id = $1::uuid`, [id]) as FilaCotizacion[];
    return filas[0] ? aCotizacion(filas[0]) : null;
  }

  async versiones(id: string, tx?: ContextoTransaccion): Promise<readonly VersionGuardada[]> {
    if (!esUuid(id)) return [];
    const filas = await this.ejecutor(tx).query(`SELECT ${columnasVersion} FROM cotizaciones_versiones v WHERE v.cotizacion_id = $1::uuid ORDER BY v.numero DESC`, [id]) as FilaVersion[];
    return filas.map(aVersion);
  }

  async insertar(tx: ContextoTransaccion, c: NuevaCotizacion, v: NuevaVersionDeCotizacion): Promise<void> {
    await this.uow.runner(tx).query(`INSERT INTO cotizaciones (id, solicitud_id, prestador_id, prestador_cuenta_id, estado) VALUES ($1, $2, $3, $4, 'ACTIVA')`,
      [c.id, c.solicitudId, c.prestadorId, c.prestadorCuentaId]);
    await this.insertarVersion(tx, c.id, 1, v);
  }

  async agregarVersion(tx: ContextoTransaccion, id: string, v: NuevaVersionDeCotizacion): Promise<void> {
    // La cotización ya está bloqueada `FOR UPDATE` por el llamador: la lectura y la actualización no pueden competir. (TypeORM no devuelve las filas de un UPDATE.)
    const q = this.uow.runner(tx);
    const actual = (await q.query('SELECT version_actual FROM cotizaciones WHERE id = $1::uuid', [id]) as { version_actual: number }[])[0]!.version_actual;
    await q.query('UPDATE cotizaciones SET version = version + 1, version_actual = version_actual + 1 WHERE id = $1::uuid', [id]);
    await this.insertarVersion(tx, id, actual + 1, v);
  }

  async retirar(tx: ContextoTransaccion, id: string): Promise<void> {
    await this.uow.runner(tx).query(`UPDATE cotizaciones SET estado = 'RETIRADA', retirada_en = clock_timestamp(), version = version + 1 WHERE id = $1::uuid`, [id]);
  }

  async listarDeCuenta(cuentaId: string, pagina: number, tamano: number): Promise<PaginaDeCotizaciones> {
    if (!esUuid(cuentaId)) return { elementos: [], total: 0 };
    // Ventana materializada: el total sale de la misma lectura que la página y el número de sentencias no depende del tamaño.
    const filas = await this.uow.db.query(`WITH f AS MATERIALIZED (
        SELECT c.id, c.creada_en, count(*) OVER ()::int AS cantidad FROM cotizaciones c WHERE c.prestador_cuenta_id = $1::uuid
      ), pagina AS (SELECT * FROM f ORDER BY creada_en DESC, id LIMIT $2 OFFSET $3)
      SELECT COALESCE(p.cantidad, (SELECT cantidad FROM f LIMIT 1), 0) AS total, ${columnas}
      FROM (SELECT 1) x LEFT JOIN pagina p ON true
      LEFT JOIN cotizaciones c ON c.id = p.id LEFT JOIN cotizaciones_versiones v ON v.cotizacion_id = c.id AND v.numero = c.version_actual
      ORDER BY p.creada_en DESC, p.id`, [cuentaId, tamano, (pagina - 1) * tamano]) as (FilaCotizacion & { total: number })[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(f => f.id !== null).map(aCotizacion) };
  }

  private async insertarVersion(tx: ContextoTransaccion, id: string, numero: number, v: NuevaVersionDeCotizacion): Promise<void> {
    await this.uow.runner(tx).query(`INSERT INTO cotizaciones_versiones (cotizacion_id, numero, version_trabajo_solicitud, tipo, alcance, exclusiones, materiales, mano_de_obra,
      precio_centimos, forma_calculo, plazo_dias, vigente_hasta, condiciones_pago) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`, [id, numero, ...valoresDeVersion(v)]);
  }
}
