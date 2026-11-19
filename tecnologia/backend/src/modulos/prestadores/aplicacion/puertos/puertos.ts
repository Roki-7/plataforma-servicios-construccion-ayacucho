import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { DatosPerfil, PerfilProfesional } from '../../dominio/perfil-profesional.js';
import type { DatosTrabajo, FotografiaPortafolio, TrabajoAnterior } from '../../dominio/portafolio.js';

export interface ImagenSaneada {
  /** Variante WebP estática, sin metadatos de origen. */
  readonly bytes: Uint8Array;
  readonly ancho: number;
  readonly alto: number;
  readonly checksum: Uint8Array;
  /** Bytes decodificados de la entrada. Solo identifican el intento idempotente. */
  readonly original: Uint8Array;
}
export interface SaneadorImagen {
  sanear(contenidoBase64: string, mimeDeclarado: string): Promise<ImagenSaneada>;
}

export interface ObjetoListado { readonly clave: string; readonly modificado: Date }
/** Almacén privado de portafolio. Sus claves son opacas, inmutables y propias de 002. */
export interface AlmacenPortafolio {
  claveNueva(prestadorId: string): string;
  guardar(clave: string, bytes: Uint8Array): Promise<void>;
  leer(clave: string): Promise<Uint8Array>;
  eliminar(clave: string): Promise<void>;
  listar(): AsyncIterable<ObjetoListado>;
  /** Comprueba que la clave pertenezca al ámbito del portafolio de 002. */
  pertenece(clave: string): boolean;
}

export interface NuevaFotografia {
  readonly id: string; readonly objetoClave: string; readonly ancho: number; readonly alto: number;
  readonly bytes: number; readonly checksum: Uint8Array;
}

/** Persistencia de Prestadores. Con `tx` participa en la unidad de trabajo. Sin `tx` lee del primario. */
export interface RepositorioPrestadores {
  perfilPorCuenta(cuentaId: string, tx?: ContextoTransaccion, bloquear?: boolean): Promise<PerfilProfesional | null>;
  trabajos(prestadorId: string, tx?: ContextoTransaccion): Promise<TrabajoAnterior[]>;
  trabajoDe(prestadorId: string, trabajoId: string, tx?: ContextoTransaccion, bloquear?: boolean): Promise<TrabajoAnterior | null>;
  contarTrabajos(prestadorId: string, tx?: ContextoTransaccion): Promise<number>;
  contarFotografias(prestadorId: string, tx?: ContextoTransaccion): Promise<number>;
  crearPerfil(tx: ContextoTransaccion, perfil: PerfilProfesional): Promise<void>;
  actualizarPerfil(tx: ContextoTransaccion, id: string, datos: DatosPerfil, version: number): Promise<void>;
  avanzarVersionPerfil(tx: ContextoTransaccion, id: string): Promise<number>;
  crearTrabajo(tx: ContextoTransaccion, trabajo: Omit<TrabajoAnterior, 'fotografias'>): Promise<void>;
  actualizarTrabajo(tx: ContextoTransaccion, id: string, datos: Partial<DatosTrabajo>): Promise<number>;
  registrarPreparacion(clave: string, prestadorId: string, venceEn: Date): Promise<void>;
  agregarFotografia(tx: ContextoTransaccion, trabajoId: string, foto: NuevaFotografia): Promise<number>;
  reemplazarFotografia(tx: ContextoTransaccion, trabajoId: string, foto: NuevaFotografia, prestadorId: string): Promise<number>;
  eliminarFotografia(tx: ContextoTransaccion, trabajoId: string, fotografiaId: string, prestadorId: string): Promise<number>;
  fotografiaPublica(prestadorId: string, trabajoId: string, fotografiaId: string): Promise<FotografiaPortafolio | null>;
}
