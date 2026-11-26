import type { ContextoTransaccion } from '../../../compartido/aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from '../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { tiposAvisoNegocio, type AvisoNegocio, type AvisosNegocioApi } from '../api-publica.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida un aviso. Es un error de programación, no de usuario: el llamador construye los avisos a partir de datos ya validados. */
function validar(aviso: AvisoNegocio): void {
  if (!tiposAvisoNegocio.includes(aviso.tipo)) throw new TypeError('Tipo de aviso de negocio no válido.');
  if (!uuid.test(aviso.cuentaDestinatarioId) || !uuid.test(aviso.solicitudId)) throw new TypeError('Los identificadores del aviso deben ser UUID.');
  const cierre = aviso.tipo === 'SOLICITUD_CERRADA';
  if (cierre ? aviso.versionTrabajo !== null : aviso.versionTrabajo === null || !Number.isSafeInteger(aviso.versionTrabajo) || aviso.versionTrabajo < 1) {
    throw new TypeError('La versión de trabajo del aviso no corresponde a su tipo.');
  }
}

/** Clave lógica `tipo:solicitudId:versión:cuentaId`. Para el cierre, la versión es `cierre`. */
export const claveLogicaDeAviso = (a: AvisoNegocio): string => `${a.tipo}:${a.solicitudId.toLowerCase()}:${a.versionTrabajo ?? 'cierre'}:${a.cuentaDestinatarioId.toLowerCase()}`;

export class AvisosNegocioPostgres implements AvisosNegocioApi {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}

  /**
   * Una sola sentencia para todo el lote, en la transacción del llamador: si la operación falla, los avisos se revierten con ella.
   * `ON CONFLICT (clave_logica) DO NOTHING` hace idempotente el registro, también con repetidos dentro del mismo lote.
   */
  async registrar(avisos: readonly AvisoNegocio[], tx: ContextoTransaccion): Promise<number> {
    for (const aviso of avisos) validar(aviso);
    if (avisos.length === 0) return 0;
    const filas = await this.uow.runner(tx).query(`INSERT INTO avisos_negocio (cuenta_destinatario_id, tipo, solicitud_id, version_trabajo, clave_logica)
      SELECT * FROM unnest($1::uuid[], $2::text[], $3::uuid[], $4::integer[], $5::text[]) ON CONFLICT (clave_logica) DO NOTHING RETURNING id`,
      [avisos.map(a => a.cuentaDestinatarioId), avisos.map(a => a.tipo), avisos.map(a => a.solicitudId), avisos.map(a => a.versionTrabajo), avisos.map(claveLogicaDeAviso)]) as unknown[];
    return filas.length;
  }
}
