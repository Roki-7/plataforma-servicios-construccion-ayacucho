/** Capacidad opaca: ningún puerto conoce QueryRunner, EntityManager ni SQL. */
export interface ContextoTransaccion { readonly id: string }
export interface UnidadDeTrabajo {
  ejecutar<T>(trabajo: (tx: ContextoTransaccion) => Promise<T>): Promise<T>;
}
export type ValorJson = null | boolean | number | string | readonly ValorJson[] | { readonly [campo: string]: ValorJson };
