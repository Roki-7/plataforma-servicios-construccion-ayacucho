import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';
import type { PerfilBasico, RepositorioPrestadores } from './aplicacion/puertos/puertos.js';

export type { TipoPrestador } from './dominio/perfil-profesional.js';
export type { PerfilBasico } from './aplicacion/puertos/puertos.js';

/** Perfil mínimo que otros módulos pueden consultar. No incluye cuenta, contacto ni objetos privados. */
export interface PerfilDePrestador { readonly prestadorId: string; readonly version: number }
export interface PrestadoresApi {
  perfilDeCuenta(cuentaId: string, tx?: ContextoTransaccion): Promise<PerfilDePrestador | null>;
}
/**
 * Lecturas aditivas para Solicitudes y Cotizaciones (003). Solo lectura. Con `tx` participan en la transacción del llamador; sin ella leen del primario.
 * Un identificador que no es UUID se trata como inexistente. Ninguna lee tablas de otro módulo ni expone contacto.
 */
export interface LecturasDePrestadores {
  /** Identificador, cuenta y si el perfil es publicable. Un perfil existente implica una cuenta con perfil habilitado. `null` si no existe. */
  perfilPorId(prestadorId: string, tx?: ContextoTransaccion): Promise<PerfilBasico | null>;
  /** Códigos de distrito que cubre el prestador, ordenados. */
  distritosDe(prestadorId: string, tx?: ContextoTransaccion): Promise<readonly string[]>;
  /** Identificadores de las categorías declaradas como especialidad, ordenados. Solo informativas: no conceden acceso. */
  especialidadesDe(prestadorId: string, tx?: ContextoTransaccion): Promise<readonly string[]>;
  /**
   * USO INTERNO entre módulos; nunca una respuesta HTTP directa. Nombre público por prestador, en una sola consulta (hasta 50 identificadores). Omite
   * los inexistentes. NO filtra por `publicable` ni comprueba quién pregunta: el llamador debe haber verificado antes el título de acceso del solicitante
   * (p. ej. el dueño de la solicitud que lista las cotizaciones recibidas) y pasar solo los autores de esas cotizaciones. Un caso de uso que lo exponga sin
   * esa comprobación permitiría enumerar nombres de perfiles por identificador (condición de T084; la prueba `nombres-publicos-alcance` vigila su uso).
   */
  nombresPublicos(prestadorIds: readonly string[], tx?: ContextoTransaccion): Promise<ReadonlyMap<string, string>>;
}
/** API interna entre módulos: no registra rutas HTTP ni expone repositorios. */
export class ApiPrestadores implements PrestadoresApi, LecturasDePrestadores {
  constructor(private readonly repositorio: Pick<RepositorioPrestadores, 'perfilPorCuenta' | 'perfilPorId' | 'distritosDe' | 'especialidadesDe' | 'nombresPublicos'>) {}
  async perfilDeCuenta(cuentaId: string, tx?: ContextoTransaccion): Promise<PerfilDePrestador | null> {
    const perfil = await this.repositorio.perfilPorCuenta(cuentaId, tx);
    return perfil ? { prestadorId: perfil.id, version: perfil.version } : null;
  }
  perfilPorId(prestadorId: string, tx?: ContextoTransaccion): Promise<PerfilBasico | null> { return this.repositorio.perfilPorId(prestadorId, tx); }
  distritosDe(prestadorId: string, tx?: ContextoTransaccion): Promise<readonly string[]> { return this.repositorio.distritosDe(prestadorId, tx); }
  especialidadesDe(prestadorId: string, tx?: ContextoTransaccion): Promise<readonly string[]> { return this.repositorio.especialidadesDe(prestadorId, tx); }
  nombresPublicos(prestadorIds: readonly string[], tx?: ContextoTransaccion): Promise<ReadonlyMap<string, string>> { return this.repositorio.nombresPublicos(prestadorIds, tx); }
}
