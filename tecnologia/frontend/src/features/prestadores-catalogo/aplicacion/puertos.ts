import type { EntradaPerfil, EntradaServicio, EntradaTrabajo, EscrituraFotografia, EstadoServicio, FotografiaModificada, ImagenPublica, PaginaServicios, PerfilPrivado, ServicioPrivado, TrabajoCreado, TrabajoPrivado } from '../modelos/contratos.js';

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

/** Puerto de la API de servicios propios (HU04). */
export interface ApiServicios {
  listarMios(pagina: number, tamano: number): Promise<PaginaServicios>;
  publicar(entrada: EntradaServicio, clave: string): Promise<ServicioPrivado>;
  editar(servicioId: string, version: number, cambios: Partial<EntradaServicio>, clave: string): Promise<ServicioPrivado>;
  cambiarEstado(servicioId: string, version: number, destino: EstadoServicio, clave: string): Promise<ServicioPrivado>;
}
