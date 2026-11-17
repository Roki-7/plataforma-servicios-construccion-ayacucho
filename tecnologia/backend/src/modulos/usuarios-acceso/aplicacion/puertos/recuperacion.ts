import type { ContextoTransaccion } from './puertos.js';
import type { IdCuenta } from '../../dominio/identificadores.js';
import type { Recuperacion } from '../../dominio/recuperacion.js';
export interface RepositorioRecuperaciones {
  crear(r: Recuperacion, tx: ContextoTransaccion): Promise<void>;
  buscarPorDigest(digest: Uint8Array): Promise<Recuperacion | null>;
  bloquear(id: string, tx: ContextoTransaccion): Promise<Recuperacion | null>;
  establecerContrasena(id: IdCuenta, phc: string, ahora: Date, tx: ContextoTransaccion): Promise<void>;
  consumir(r: Recuperacion, ahora: Date, tx: ContextoTransaccion): Promise<void>;
}
export interface PlantillasRecuperacion {
  recuperacion(token: string, version: number): { asunto: string; texto: string };
  avisoRecuperacion(): { asunto: string; texto: string };
}
