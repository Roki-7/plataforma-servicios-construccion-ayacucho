export interface FiltrosOferta {
  readonly categoria?: string;
  readonly especialidad?: string;
  readonly distrito?: string;
  readonly disponibilidad?: boolean;
  readonly pagina: number;
  readonly tamano: number;
}
export interface ServicioPublicoDto {
  readonly servicioId: string; readonly prestadorId: string; readonly titulo: string; readonly descripcion: string;
  readonly categoriaId: string; readonly estado: 'PUBLICADO';
}
export interface PrestadorResumenDto {
  readonly prestadorId: string; readonly nombrePublico: string; readonly tipo: string;
  readonly especialidadesIds: readonly string[]; readonly distritos: readonly string[]; readonly disponibilidadDeclarada: boolean;
}
export interface PaginaDto<T> { readonly elementos: readonly T[]; readonly total: number }

/** Lecturas públicas de la oferta. Cada página y su total salen de una misma instantánea de PostgreSQL. */
export interface ConsultasPublicas {
  buscarServicios(filtros: FiltrosOferta): Promise<PaginaDto<ServicioPublicoDto>>;
  buscarPrestadores(filtros: FiltrosOferta): Promise<PaginaDto<PrestadorResumenDto>>;
  /** Solo un servicio PUBLICADO, con clasificación efectivamente activa y de un prestador publicable. */
  servicioVisible(servicioId: string): Promise<ServicioPublicoDto | null>;
  serviciosVisiblesDe(prestadorId: string, pagina: number, tamano: number): Promise<PaginaDto<ServicioPublicoDto>>;
}
