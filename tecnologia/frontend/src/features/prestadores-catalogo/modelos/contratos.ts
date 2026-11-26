// Derivado del contrato OpenAPI 002 (HU03). Modelos puros: sin React ni HTTP.
export const distritos = [
  { codigo: 'ayacucho', etiqueta: 'Ayacucho' }, { codigo: 'carmen-alto', etiqueta: 'Carmen Alto' }, { codigo: 'san-juan-bautista', etiqueta: 'San Juan Bautista' },
  { codigo: 'jesus-nazareno', etiqueta: 'Jesús Nazareno' }, { codigo: 'andres-avelino-caceres-dorregaray', etiqueta: 'Andrés Avelino Cáceres Dorregaray' },
] as const;
export type Distrito = typeof distritos[number]['codigo'];
export const tiposPrestador = [
  { valor: 'TRABAJADOR_DE_OFICIO', etiqueta: 'Trabajador de oficio' }, { valor: 'TECNICO', etiqueta: 'Técnico' },
  { valor: 'PROFESIONAL', etiqueta: 'Profesional' }, { valor: 'EMPRESA', etiqueta: 'Empresa' },
] as const;
export type TipoPrestador = typeof tiposPrestador[number]['valor'];
export const tiposMimeEntrada = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type TipoMimeEntrada = typeof tiposMimeEntrada[number];
export const limites = { nombrePublico: 120, experiencia: 3000, titulo: 120, descripcion: 2000, trabajos: 10, fotografiasPorTrabajo: 4, fotografiasPorPrestador: 40, bytesImagen: 10_000_000, ladoImagen: 4096 } as const;

export interface FotografiaPrivada { readonly fotografiaId: string; readonly tipoMime: 'image/webp'; readonly ancho: number; readonly alto: number }
export interface TrabajoPrivado { readonly trabajoId: string; readonly version: number; readonly titulo: string; readonly descripcion: string; readonly fotografias: readonly FotografiaPrivada[] }
export interface PerfilPrivado {
  readonly prestadorId: string; readonly version: number; readonly nombrePublico: string; readonly tipo: TipoPrestador; readonly experiencia: string;
  readonly especialidadesIds: readonly string[]; readonly distritos: readonly Distrito[]; readonly disponibilidadDeclarada: boolean; readonly trabajos: readonly TrabajoPrivado[];
}
export interface EntradaPerfil {
  readonly nombrePublico: string; readonly tipo: TipoPrestador; readonly experiencia: string;
  readonly especialidadesIds: readonly string[]; readonly distritos: readonly Distrito[]; readonly disponibilidadDeclarada: boolean;
}
export interface EntradaTrabajo { readonly titulo: string; readonly descripcion: string }
export interface EscrituraFotografia { readonly versionTrabajo: number; readonly tipoMime: TipoMimeEntrada; readonly contenidoBase64: string }
export interface TrabajoCreado { readonly trabajo: TrabajoPrivado; readonly versionPerfil: number }
export interface FotografiaModificada { readonly fotografia: FotografiaPrivada; readonly versionTrabajo: number }
export interface ImagenPublica { readonly tipoMime: 'image/webp'; readonly contenidoBase64: string }

export type EstadoServicio = 'PUBLICADO' | 'PAUSADO' | 'RETIRADO';
export const limitesServicio = { titulo: 120, descripcion: 2000, pagina: 50 } as const;
export interface ServicioPrivado {
  readonly servicioId: string; readonly prestadorId: string; readonly titulo: string; readonly descripcion: string;
  readonly categoriaId: string; readonly estado: EstadoServicio; readonly version: number;
}
export interface EntradaServicio { readonly titulo: string; readonly descripcion: string; readonly categoriaId: string }
export interface PaginaServicios { readonly elementos: readonly ServicioPrivado[]; readonly total: number; readonly pagina: number; readonly tamano: number }

// Consultas públicas (HU05)
export interface ServicioPublico { readonly servicioId: string; readonly prestadorId: string; readonly titulo: string; readonly descripcion: string; readonly categoriaId: string; readonly estado: 'PUBLICADO' }
export interface PrestadorResumen {
  readonly prestadorId: string; readonly nombrePublico: string; readonly tipo: TipoPrestador; readonly especialidadesIds: readonly string[];
  readonly distritos: readonly Distrito[]; readonly disponibilidadDeclarada: boolean;
}
export interface PaginaPublica<T> { readonly elementos: readonly T[]; readonly total: number; readonly pagina: number; readonly tamano: number }
export interface FotografiaPublicaRef { readonly fotografiaId: string; readonly tipoMime: 'image/webp'; readonly ancho: number; readonly alto: number; readonly ruta: string }
export interface TrabajoPublico { readonly trabajoId: string; readonly titulo: string; readonly descripcion: string; readonly fotografias: readonly FotografiaPublicaRef[] }
/** Un aviso nulo indica que la fuente correspondiente está disponible. En la entrega 002 ambos son textos. */
export interface AvisosPublicos { readonly calificaciones: string | null; readonly verificaciones: string | null }
export interface PerfilPublico {
  readonly prestadorId: string; readonly nombrePublico: string; readonly tipo: TipoPrestador; readonly experiencia: string;
  readonly especialidadesIds: readonly string[]; readonly distritos: readonly Distrito[]; readonly disponibilidadDeclarada: boolean;
  readonly trabajos: readonly TrabajoPublico[]; readonly servicios: PaginaPublica<ServicioPublico>; readonly avisos: AvisosPublicos;
}
export type TipoResultado = 'servicios' | 'prestadores';
export interface FiltrosBusqueda { readonly categoria?: string; readonly especialidad?: string; readonly distrito?: Distrito; readonly disponibilidad?: boolean; readonly pagina: number; readonly tamano: number }

/** Clasificación efectivamente activa de la consulta pública de categorías. Solo identificador, padre y nombre. */
export interface CategoriaPublica { readonly categoriaId: string; readonly categoriaPadreId: string | null; readonly nombre: string }
