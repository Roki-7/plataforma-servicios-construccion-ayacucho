import type { IdCuenta } from '../../dominio/identificadores.js';
import type { PerfilCuenta } from '../../dominio/cuenta.js';
import type { ContextoTransaccion, AlmacenamientoFotografias, FotografiaAlmacenada } from './puertos.js';
export interface RepositorioConsentimientos {
  efectivo(id: IdCuenta, telefono: string | null, tx: ContextoTransaccion): Promise<boolean>;
  decidir(id: IdCuenta, telefono: string | null, autorizar: boolean, ahora: Date, tx: ContextoTransaccion): Promise<void>;
}
export interface HuellasTelefono { actual(id: IdCuenta, telefono: string): Uint8Array; vigentes(id: IdCuenta, telefono: string): readonly Uint8Array[] }
export interface RepositorioPerfil {
  comprobarFoto(id: IdCuenta, foto: string, tx: ContextoTransaccion): Promise<void>;
  guardar(anterior: PerfilCuenta, nuevo: PerfilCuenta, ahora: Date, tx: ContextoTransaccion): Promise<void>;
}
export interface FotografiasPerfil extends AlmacenamientoFotografias { registrarTemporal(id: IdCuenta, foto: FotografiaAlmacenada, tx: ContextoTransaccion): Promise<void> }
