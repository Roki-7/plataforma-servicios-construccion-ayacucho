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
