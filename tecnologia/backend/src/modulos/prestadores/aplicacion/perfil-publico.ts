import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import type { OfertaPublica } from '../../catalogo/api-publica.js';
import type { RepositorioPrestadores } from './puertos/puertos.js';

export const avisoCalificaciones = 'Calificaciones aún no disponibles';
export const avisoVerificaciones = 'Verificaciones aún no disponibles';

/** Disponibilidad independiente de las fuentes futuras: calificaciones (011) y verificaciones (012). En 002 ninguna está disponible. */
export interface FuentesPublicas { readonly calificaciones: boolean; readonly verificaciones: boolean }
export const sinFuentes: FuentesPublicas = { calificaciones: false, verificaciones: false };

/**
 * Presentador de avisos. Cada aviso depende solo de su propia fuente: un valor nulo reserva la representación de una fuente disponible.
 * «Sin valoraciones», las puntuaciones y los estados de verificación pertenecen a 011 y 012, y no se generan sin respaldo real.
 */
export function presentarAvisos(f: FuentesPublicas): { calificaciones: string | null; verificaciones: string | null } {
  return { calificaciones: f.calificaciones ? null : avisoCalificaciones, verificaciones: f.verificaciones ? null : avisoVerificaciones };
}

const noDisponible = () => new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.');

/** Perfil público por lista explícita de campos. Excluye cuenta, sesión, contacto, documentos y objetos privados. */
export class PerfilPublicoServicio {
  constructor(private readonly repositorio: Pick<RepositorioPrestadores, 'perfilPublicoPorId' | 'trabajos'>, private readonly oferta: OfertaPublica,
    private readonly fuentes: () => FuentesPublicas = () => sinFuentes) {}

  async obtener(prestadorIdEntrada: string, pagina: number, tamano: number) {
    const prestadorId = uuidEnMinusculas(prestadorIdEntrada);
    const perfil = await this.repositorio.perfilPublicoPorId(prestadorId);
    if (!perfil) throw noDisponible();
    const [trabajos, servicios] = await Promise.all([this.repositorio.trabajos(perfil.id), this.oferta.serviciosVisiblesDe(perfil.id, pagina, tamano)]);
    return {
      prestadorId: perfil.id, nombrePublico: perfil.nombrePublico, tipo: perfil.tipo, experiencia: perfil.experiencia,
      especialidadesIds: [...perfil.especialidadesIds], distritos: [...perfil.distritos], disponibilidadDeclarada: perfil.disponibilidadDeclarada,
      trabajos: trabajos.map(t => ({
        trabajoId: t.id, titulo: t.titulo, descripcion: t.descripcion,
        fotografias: t.fotografias.map(f => ({ fotografiaId: f.id, tipoMime: 'image/webp' as const, ancho: f.ancho, alto: f.alto,
          ruta: `/api/v1/prestadores/${perfil.id}/trabajos/${t.id}/fotografias/${f.id}` })),
      })),
      servicios: {
        elementos: servicios.elementos.map(s => ({ servicioId: s.servicioId, prestadorId: s.prestadorId, titulo: s.titulo, descripcion: s.descripcion, categoriaId: s.categoriaId, estado: 'PUBLICADO' as const })),
        total: servicios.total, pagina, tamano,
      },
      avisos: presentarAvisos(this.fuentes()),
    };
  }
}
