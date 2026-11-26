import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { RepositorioDeAutoria } from '../../aplicacion/puertos/autoria.js';

const esUuid = (valor: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);

/**
 * Lecturas de autoría: una sola sentencia de solo lectura por llamada, sobre la tabla propia `cotizaciones` y sus índices parciales
 * (`cotizaciones_por_solicitud` y `cotizaciones_autoria`). Un identificador que no es UUID equivale a «no existe» y no consulta la base de datos.
 */
export class AutoriaPostgres implements RepositorioDeAutoria {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}

  private ejecutor(tx?: ContextoTransaccion) { return tx ? this.uow.runner(tx) : this.uow.db; }

  async autoresNoRetirados(solicitudId: string, tx?: ContextoTransaccion): Promise<readonly string[]> {
    if (!esUuid(solicitudId)) return [];
    const filas = await this.ejecutor(tx).query(`SELECT DISTINCT prestador_cuenta_id AS id FROM cotizaciones WHERE solicitud_id = $1::uuid AND estado <> 'RETIRADA' ORDER BY 1`, [solicitudId]) as { id: string }[];
    return filas.map(f => f.id);
  }

  async solicitudesConNoRetirada(cuentaId: string, tx?: ContextoTransaccion): Promise<readonly string[]> {
    if (!esUuid(cuentaId)) return [];
    const filas = await this.ejecutor(tx).query(`SELECT DISTINCT solicitud_id AS id FROM cotizaciones WHERE prestador_cuenta_id = $1::uuid AND estado <> 'RETIRADA' ORDER BY 1`, [cuentaId]) as { id: string }[];
    return filas.map(f => f.id);
  }

  async tieneNoRetirada(solicitudId: string, cuentaId: string, tx?: ContextoTransaccion): Promise<boolean> {
    if (!esUuid(solicitudId) || !esUuid(cuentaId)) return false;
    const filas = await this.ejecutor(tx).query(`SELECT EXISTS (SELECT 1 FROM cotizaciones WHERE solicitud_id = $1::uuid AND prestador_cuenta_id = $2::uuid AND estado <> 'RETIRADA') AS tiene`, [solicitudId, cuentaId]) as { tiene: boolean }[];
    return filas[0]?.tiene === true;
  }
}
