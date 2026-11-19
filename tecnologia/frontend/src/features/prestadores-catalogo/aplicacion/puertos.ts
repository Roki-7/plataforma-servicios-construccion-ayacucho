import type { EntradaPerfil, EntradaTrabajo, EscrituraFotografia, FotografiaModificada, ImagenPublica, PerfilPrivado, TrabajoCreado, TrabajoPrivado } from '../modelos/contratos.js';

/** Puerto de la API de Prestadores. Cada mutación recibe su clave de idempotencia. */
export interface ApiPrestadores {
  obtenerPerfil(): Promise<PerfilPrivado>;
  guardarPerfil(version: number, entrada: EntradaPerfil, clave: string): Promise<PerfilPrivado>;
  crearTrabajo(versionPerfil: number, datos: EntradaTrabajo, clave: string): Promise<TrabajoCreado>;
  editarTrabajo(trabajoId: string, version: number, cambios: Partial<EntradaTrabajo>, clave: string): Promise<TrabajoPrivado>;
  agregarFotografia(trabajoId: string, escritura: EscrituraFotografia, clave: string): Promise<FotografiaModificada>;
  reemplazarFotografia(trabajoId: string, fotografiaId: string, escritura: EscrituraFotografia, clave: string): Promise<FotografiaModificada>;
  eliminarFotografia(trabajoId: string, fotografiaId: string, versionTrabajo: number, clave: string): Promise<{ versionTrabajo: number }>;
  obtenerFotografiaPublica(prestadorId: string, trabajoId: string, fotografiaId: string): Promise<ImagenPublica>;
}
