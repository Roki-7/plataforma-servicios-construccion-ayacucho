import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';
import type { RepositorioPrestadores } from './aplicacion/puertos/puertos.js';

export type { TipoPrestador } from './dominio/perfil-profesional.js';

/** Perfil mínimo que otros módulos pueden consultar. No incluye cuenta, contacto ni objetos privados. */
export interface PerfilDePrestador { readonly prestadorId: string; readonly version: number }
export interface PrestadoresApi {
  perfilDeCuenta(cuentaId: string, tx?: ContextoTransaccion): Promise<PerfilDePrestador | null>;
}
/** API interna entre módulos: no registra rutas HTTP ni expone repositorios. */
export class ApiPrestadores implements PrestadoresApi {
  constructor(private readonly repositorio: Pick<RepositorioPrestadores, 'perfilPorCuenta'>) {}
  async perfilDeCuenta(cuentaId: string, tx?: ContextoTransaccion): Promise<PerfilDePrestador | null> {
    const perfil = await this.repositorio.perfilPorCuenta(cuentaId, tx);
    return perfil ? { prestadorId: perfil.id, version: perfil.version } : null;
  }
}
