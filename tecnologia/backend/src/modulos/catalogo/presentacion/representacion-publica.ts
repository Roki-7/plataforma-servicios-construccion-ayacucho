import type { PrestadorResumenDto, ServicioPublicoDto } from '../aplicacion/puertos/consultas-publicas.js';

/** Representaciones públicas por lista explícita de campos: nunca se copia un registro completo. */
export const servicioPublico = (s: ServicioPublicoDto) => ({
  servicioId: s.servicioId, prestadorId: s.prestadorId, titulo: s.titulo, descripcion: s.descripcion, categoriaId: s.categoriaId, estado: 'PUBLICADO' as const,
});
export const prestadorResumen = (p: PrestadorResumenDto) => ({
  prestadorId: p.prestadorId, nombrePublico: p.nombrePublico, tipo: p.tipo, especialidadesIds: [...p.especialidadesIds], distritos: [...p.distritos], disponibilidadDeclarada: p.disponibilidadDeclarada,
});
export const paginaPublica = <T, R>(p: { elementos: readonly T[]; total: number; pagina: number; tamano: number }, presentar: (x: T) => R) => ({
  elementos: p.elementos.map(presentar), total: p.total, pagina: p.pagina, tamano: p.tamano,
});
