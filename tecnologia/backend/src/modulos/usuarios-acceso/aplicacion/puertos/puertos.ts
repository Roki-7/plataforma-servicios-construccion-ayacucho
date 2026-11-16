import type { IdCuenta, PerfilHabilitado } from '../../dominio/identificadores.js';
import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
export type { ContextoTransaccion, UnidadDeTrabajo } from '../../../../compartido/aplicacion/transaccion.js';

export interface Reloj { ahora(): Date }
export interface GeneradorSecretos { secreto(): string; uuid(): string; digest(secreto: string): Uint8Array }
export interface HashContrasena { crear(contrasena: string): Promise<string>; verificar(contrasena: string, phc: string): Promise<boolean> }
export interface CatalogoContrasenasRechazadas { preparada(): Promise<boolean>; rechazada(contrasena: string): Promise<boolean> }
export interface IdentidadAutenticada {
  readonly cuentaId: IdCuenta; readonly sesionId: string; readonly perfiles: readonly PerfilHabilitado[];
  readonly autenticadaConContrasenaEn: Date | null; readonly versionSesion: bigint;
}
export interface LectorSesion { leer(token: string): Promise<IdentidadAutenticada | null> }
export interface CuentaLectura { readonly id: IdCuenta; readonly correo: string; readonly version: bigint; readonly versionCredencial: bigint; readonly contrasenaHash: string }
export interface RepositorioCuentas {
  buscarPorCorreo(correo: string, tx?: ContextoTransaccion): Promise<CuentaLectura | null>;
  bloquear(id: IdCuenta, tx: ContextoTransaccion): Promise<CuentaLectura | null>;
}
export interface RepositorioSesiones { revocarTodas(cuentaId: IdCuenta, tx: ContextoTransaccion): Promise<void> }
export interface FotografiaAlmacenada { readonly id: string; readonly objetoClave: string; readonly mime: string; readonly bytes: number; readonly checksum: Uint8Array }
export interface AlmacenamientoFotografias {
  almacenar(cuentaId: IdCuenta, base64: string, mime: string): Promise<FotografiaAlmacenada>;
  leerPropia(cuentaId: IdCuenta, fotografiaId: string): Promise<{ contenidoBase64: string; tipoContenido: string }>;
  eliminarObjeto(clave: string): Promise<void>;
}
export interface CorreoSeguridad {
  readonly tipo: 'recuperación' | 'verificar_correo' | 'contraseña_recuperada'; readonly destinatario: string;
  readonly asunto: string; readonly texto: string; readonly claveLogica: string;
  readonly desafioId?: string; readonly venceEn?: Date;
}
export interface ProgramarCorreoSeguridad { programar(correo: CorreoSeguridad, tx: ContextoTransaccion): Promise<void> }
