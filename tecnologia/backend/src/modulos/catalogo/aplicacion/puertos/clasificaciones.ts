import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { ClasificacionAdmin, ClasificacionPublica } from '../../api-publica.js';
import type { Clasificacion } from '../../dominio/clasificacion.js';

export interface FilaConfirmacion {
  readonly id: string; readonly actorCuentaId: string; readonly clasificacionId: string; readonly version: number;
  readonly revision: bigint; readonly afectados: number; readonly vigente: boolean; readonly consumida: boolean;
}
/** La base rechazó un nombre equivalente entre hermanas (índice único `catalogo_clasificaciones_hermanas_clave`). */
export class NombreDeClasificacionEnUso extends Error { constructor() { super('Nombre de clasificación en uso entre hermanas.'); this.name = 'NombreDeClasificacionEnUso'; } }

export interface RepositorioClasificaciones {
  /** ¿Existe otra clasificación (activa o no) con la misma clave de nombre bajo el mismo padre? `excluirId` omite la propia fila al editar. */
  existeHermanaConNombre(tx: ContextoTransaccion, padreId: string | null, nombre: string, excluirId: string | null): Promise<boolean>;
  /** Toma raíz y luego subcategoría con bloqueo exclusivo. Devuelve la clasificación y su padre. */
  bloquear(tx: ContextoTransaccion, id: string): Promise<{ clasificacion: Clasificacion; padre: Clasificacion | null } | null>;
  insertar(tx: ContextoTransaccion, c: Clasificacion, nombreNormalizado: string): Promise<void>;
  actualizar(tx: ContextoTransaccion, id: string, cambios: { nombre?: string; nombreNormalizado?: string; activa?: boolean }): Promise<number>;
  contarAfectados(tx: ContextoTransaccion, id: string): Promise<number>;
  crearConfirmacion(tx: ContextoTransaccion, c: { id: string; actor: string; clasificacionId: string; version: number; revision: bigint; afectados: number }): Promise<string>;
  bloquearConfirmacion(tx: ContextoTransaccion, id: string): Promise<FilaConfirmacion | null>;
  consumirConfirmacion(tx: ContextoTransaccion, id: string): Promise<void>;
  listarAdmin(): Promise<readonly ClasificacionAdmin[]>;
  listarPublicas(): Promise<readonly ClasificacionPublica[]>;
}
