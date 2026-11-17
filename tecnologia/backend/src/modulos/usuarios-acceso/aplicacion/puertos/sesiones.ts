import type { IdCuenta } from '../../dominio/identificadores.js';
import type { Sesion } from '../../dominio/sesion.js';
import type { ControlIntentos } from '../../dominio/control-intentos.js';
import type { ContextoTransaccion, RepositorioSesiones } from './puertos.js';
export interface CuentaAutenticable extends ControlIntentos { id: IdCuenta; versionCredencial: bigint }
export interface RepositorioAutenticacion extends RepositorioSesiones {
  bloquearCuenta(id: IdCuenta, tx: ContextoTransaccion): Promise<CuentaAutenticable | null>;
  guardarIntentos(id: IdCuenta, control: ControlIntentos, tx: ContextoTransaccion): Promise<void>;
  crear(sesion: Sesion, tx: ContextoTransaccion): Promise<void>;
  localizarRenovacion(digest: Uint8Array): Promise<{ id: string; usuarioId: IdCuenta } | null>;
  bloquearSesion(id: string, tx: ContextoTransaccion, credencial: { tipo: 'acceso' | 'renovacion'; digest: Uint8Array }): Promise<Sesion | null>;
  rotar(sesion: Sesion, tx: ContextoTransaccion): Promise<void>;
  revocar(id: string, ahora: Date, tx: ContextoTransaccion): Promise<void>;
}
export interface ProteccionCsrf { emitir(renovacion: string): string; verificar(csrf: string | undefined, renovacion: string): boolean }
export interface SesionResultado { tokenAcceso: string; tipo: 'Bearer'; expiraEnSegundos: 900; renovacionVenceEn: string; autenticacionConContrasenaEn: string; csrfToken: string }
export interface EmisionSesion { respuesta: SesionResultado; renovacion: string; venceEn: Date }
