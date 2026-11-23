export interface Identidad002 {
  readonly proyectoCompose?: string; readonly baseDatos?: string | undefined; readonly puertoBaseDatos?: number | undefined;
  readonly puertoRedis?: number | undefined; readonly espacioRedis?: string | undefined; readonly bucket?: string | undefined;
  readonly puertoObjetos?: number | undefined; readonly puertoApi?: number | undefined; readonly puertoWeb?: number;
  readonly puertoSmtp?: number | undefined; readonly puertoCorreoWeb?: number; readonly origen?: string | undefined;
}
export interface FilaClasificacion { readonly id: string; readonly nombre: string; readonly nivel: number; readonly padre: string; readonly activa: boolean }
export interface ResultadoIndependencia { ok: boolean; problemas: string[]; identidad002: Identidad002; referencia001: Identidad002 }
export interface ResultadoSemilla { ok: boolean; faltantes: string[]; alteradas: string[]; adicionales: number; estricta: boolean }

export const identidad002Esperada: Readonly<Required<Identidad002>>;
export const identidad001Referencia: Readonly<Required<Identidad002>>;
export const puertosEnsayoRestauracion: readonly number[];
export const semillaClasificaciones: readonly FilaClasificacion[];
export function leerEnv(texto: string): Record<string, string>;
export function identidadDesdeEnv(env: Record<string, string | undefined>): Identidad002;
export function validarIndependencia(entrada: { env002: Record<string, string | undefined>; env001?: Record<string, string | undefined> | undefined }): ResultadoIndependencia;
export function filasDeClasificaciones(salida: string): FilaClasificacion[];
export function validarSemilla(filas: readonly FilaClasificacion[], opciones?: { estricta?: boolean }): ResultadoSemilla;
export function entornoSeguro(identidad: Identidad002): Record<string, string | number>;
export const navegadores002: readonly ['chromium', 'firefox', 'webkit'];
export const anchos002: readonly [360, 768, 1366];
export const origen002: 'https://localhost:8444';
export interface RecursosEfimeros { id: string; baseDatos: string; bucket: string; espacioRedis: string }
export function recursosEfimeros(id: string): RecursosEfimeros;
export function validarRecursosEfimeros(recursos: { baseDatos?: string | undefined; bucket?: string | undefined; espacioRedis?: string | undefined }): { ok: boolean; problemas: string[] };
export function conteosDeTablas(salida: string): Record<string, number>;
export function diferenciaDeConteos(antes: Record<string, number>, despues: Record<string, number>): Record<string, { antes: number; despues: number }>;
export function elementosNuevos(antes: Iterable<string>, despues: Iterable<string>): string[];
export function clasificarPropietarioBloqueo(
  bloqueo: unknown,
  hechos: { anfitrion: string; pid: 'existe' | 'no-existe' | 'desconocido'; comando?: string | undefined },
): 'vivo' | 'muerto' | 'incierto';
