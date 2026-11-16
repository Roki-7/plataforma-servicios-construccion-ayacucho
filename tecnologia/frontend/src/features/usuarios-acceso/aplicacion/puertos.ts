import type { OperacionesUsuarios } from '../modelos/contratos.js';
export interface OpcionesPeticion { readonly clave?: string; readonly csrf?: string; readonly parametros?: Readonly<Record<string, string>> }
export interface ApiUsuarios {
  enviar<K extends keyof OperacionesUsuarios>(operacion: K, entrada: OperacionesUsuarios[K]['entrada'], opciones?: OpcionesPeticion): Promise<OperacionesUsuarios[K]['salida']>;
}
export class ErrorApi extends Error {
  constructor(readonly http: number, readonly codigo: string, mensaje: string) { super(mensaje); this.name = 'ErrorApi'; }
}
