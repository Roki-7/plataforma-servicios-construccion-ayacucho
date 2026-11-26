import { randomUUID } from 'node:crypto';
import type { ContextoTransaccion } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import type { PrevisualizacionDesactivacion } from '../api-publica.js';
import type { Clasificacion } from '../dominio/clasificacion.js';
import type { FilaConfirmacion, RepositorioClasificaciones } from './puertos/clasificaciones.js';

const confirmacionInvalida = () => new ErrorAplicacion(409, 'CONFIRMACION_NO_VALIDA', 'La confirmación no es válida. Solicite una vista previa nueva.',
  [{ campo: 'confirmacionId', motivo: 'No es válida, venció o ya se usó.' }]);
const impactoDesactualizado = () => new ErrorAplicacion(409, 'IMPACTO_DESACTUALIZADO', 'El impacto cambió desde la vista previa. Solicite una nueva.',
  [{ campo: 'confirmacionId', motivo: 'El impacto cambió.' }]);
const versionDesactualizada = () => new ErrorAplicacion(409, 'VERSION_DESACTUALIZADA', 'La versión enviada ya no es la vigente.',
  [{ campo: 'version', motivo: 'La versión enviada ya no es la vigente.' }]);

/** Cuenta servicios distintos que perderían visibilidad o elegibilidad, incluidos los de subcategorías efectivamente activas. Vence a los cinco minutos. */
export async function calcularImpacto(repo: RepositorioClasificaciones, tx: ContextoTransaccion,
  e: { clasificacionId: string; version: number; revision: bigint; actor: string }): Promise<PrevisualizacionDesactivacion> {
  const afectados = await repo.contarAfectados(tx, e.clasificacionId);
  const confirmacionId = randomUUID();
  const venceEn = await repo.crearConfirmacion(tx, { id: confirmacionId, actor: e.actor, clasificacionId: e.clasificacionId, version: e.version, revision: e.revision, afectados });
  return { confirmacionId, afectados, venceEn };
}

/** Revalida actor, clasificación, vigencia, uso único, versión, revisión y recuento bajo bloqueo. Cualquier diferencia exige una vista previa nueva. */
export async function validarConfirmacion(repo: RepositorioClasificaciones, tx: ContextoTransaccion,
  e: { confirmacionId: string; actor: string; clasificacion: Clasificacion; revision: bigint; versionEnviada: number }): Promise<FilaConfirmacion> {
  const c = await repo.bloquearConfirmacion(tx, e.confirmacionId);
  if (!c || c.actorCuentaId !== e.actor || c.clasificacionId !== e.clasificacion.id || c.consumida || !c.vigente) throw confirmacionInvalida();
  if (e.clasificacion.version !== e.versionEnviada) throw versionDesactualizada();
  if (c.version !== e.clasificacion.version || c.revision !== e.revision || c.afectados !== await repo.contarAfectados(tx, e.clasificacion.id)) throw impactoDesactualizado();
  return c;
}
