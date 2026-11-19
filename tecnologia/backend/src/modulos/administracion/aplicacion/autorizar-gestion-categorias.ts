import type { ContextoTransaccion } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import type { UsuariosAcceso } from '../../usuarios-acceso/api-publica.js';
import type { PermisosRf39 } from './puertos.js';

const sinPermiso = () => new ErrorAplicacion(403, 'SIN_PERMISO', 'No cuenta con el permiso para gestionar categorías.');

/**
 * El permiso RF39 se consulta en PostgreSQL en cada lectura y se bloquea dentro de cada mutación, antes de la idempotencia y de las filas de Catálogo.
 * El permiso no depende de la sesión ni de los perfiles de cliente o prestador: revocar bloquea la operación siguiente aunque la sesión siga abierta.
 */
export class AutorizarGestionCategorias {
  constructor(private readonly usuarios: Pick<UsuariosAcceso, 'exigir'>, private readonly permisos: PermisosRf39) {}

  /** Revalida la sesión 001 y devuelve la cuenta. Se llama ANTES de abrir la transacción para no ocupar dos conexiones del pool. */
  async identificar(token: string): Promise<string> {
    return (await this.usuarios.exigir(token)).cuentaId;
  }
  async exigirParaLectura(cuentaId: string): Promise<void> {
    if (!await this.permisos.vigente(cuentaId)) throw sinPermiso();
  }
  /** Bloquea la fila del permiso hasta el fin de la transacción y exige que siga vigente. Devuelve la cuenta ya verificada. */
  async exigirEnTransaccion(tx: ContextoTransaccion, cuentaId: string): Promise<string> {
    const permiso = await this.permisos.bloquear(tx, cuentaId);
    if (permiso?.estado !== 'VIGENTE') throw sinPermiso();
    return cuentaId;
  }
}
