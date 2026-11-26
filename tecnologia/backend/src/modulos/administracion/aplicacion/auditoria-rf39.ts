import type { ContextoTransaccion } from '../../../compartido/aplicacion/transaccion.js';
import type { AuditoriaRf39 } from './puertos.js';

export type AccionAuditada = 'CATEGORIA_CREADA' | 'CATEGORIA_EDITADA' | 'CATEGORIA_ACTIVADA' | 'CATEGORIA_DESACTIVADA' | 'PERMISO_RF39_CONCEDIDO' | 'PERMISO_RF39_REVOCADO';

/** Registra un cambio de categoría en la misma unidad de trabajo. El responsable es la cuenta autenticada, nunca un dato del cliente. */
export function auditarCategoria(auditoria: AuditoriaRf39, tx: ContextoTransaccion, e: { responsable: string; accion: AccionAuditada; categoriaId: string; motivo: string }): Promise<void> {
  return auditoria.registrar(tx, { responsable: e.responsable, accion: e.accion, recursoTipo: 'CLASIFICACION', recursoId: e.categoriaId, motivo: e.motivo });
}
