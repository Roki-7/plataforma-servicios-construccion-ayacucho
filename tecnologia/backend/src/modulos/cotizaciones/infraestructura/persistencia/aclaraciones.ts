import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { AclaracionGuardada, NuevaAclaracion, RepositorioAclaraciones } from '../../aplicacion/puertos/repositorio-aclaraciones.js';
import type { AutorDeAclaracion } from '../../dominio/aclaracion.js';

const esUuid = (valor: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
interface Fila { id: string; numero: number; autor_rol: AutorDeAclaracion; texto: string; version_cotizacion: number; creada_en: Date }
const columnas = 'id, numero, autor_rol, texto, version_cotizacion, creada_en';
const aAclaracion = (f: Fila): AclaracionGuardada => ({ id: f.id, numero: f.numero, autor: f.autor_rol, texto: f.texto, versionCotizacion: f.version_cotizacion, creadaEn: f.creada_en });

/**
 * Aclaraciones sobre `cotizaciones_aclaraciones`. La numeración consecutiva la protegen la cotización bloqueada `FOR UPDATE` por el caso de uso y, como segunda barrera,
 * `UNIQUE (cotizacion_id, numero)` y `CHECK (numero BETWEEN 1 AND 20)`; ambas se traducen a `CONFLICTO_CONCURRENTE` y `LIMITE_ACLARACIONES`.
 */
export class RepositorioAclaracionesPostgres implements RepositorioAclaraciones {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}

  async contar(cotizacionId: string, tx: ContextoTransaccion): Promise<number> {
    const filas = await this.uow.runner(tx).query('SELECT count(*)::int AS n FROM cotizaciones_aclaraciones WHERE cotizacion_id = $1::uuid', [cotizacionId]) as { n: number }[];
    return filas[0]?.n ?? 0;
  }

  async insertar(tx: ContextoTransaccion, a: NuevaAclaracion): Promise<AclaracionGuardada> {
    const q = this.uow.runner(tx);
    await q.query(`INSERT INTO cotizaciones_aclaraciones (id, cotizacion_id, numero, autor_cuenta_id, autor_rol, texto, version_cotizacion) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [a.id, a.cotizacionId, a.numero, a.autorCuentaId, a.autor, a.texto, a.versionCotizacion]);
    const filas = await q.query(`SELECT ${columnas} FROM cotizaciones_aclaraciones WHERE id = $1::uuid`, [a.id]) as Fila[];
    return aAclaracion(filas[0]!);
  }

  async listar(cotizacionId: string, pagina: number, tamano: number) {
    if (!esUuid(cotizacionId)) return { elementos: [], total: 0 };
    const filas = await this.uow.db.query(`WITH f AS MATERIALIZED (
        SELECT ${columnas}, count(*) OVER ()::int AS cantidad FROM cotizaciones_aclaraciones WHERE cotizacion_id = $1::uuid
      ), pagina AS (SELECT * FROM f ORDER BY numero LIMIT $2 OFFSET $3)
      SELECT COALESCE(p.cantidad, (SELECT cantidad FROM f LIMIT 1), 0) AS total, p.id, p.numero, p.autor_rol, p.texto, p.version_cotizacion, p.creada_en
      FROM (SELECT 1) x LEFT JOIN pagina p ON true ORDER BY p.numero`, [cotizacionId, tamano, (pagina - 1) * tamano]) as (Fila & { total: number })[];
    return { total: filas[0]?.total ?? 0, elementos: filas.filter(f => f.id !== null).map(aAclaracion) };
  }
}
