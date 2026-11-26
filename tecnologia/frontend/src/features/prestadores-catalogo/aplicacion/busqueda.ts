import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { FiltrosBusqueda, PaginaPublica, PerfilPublico, PrestadorResumen, ServicioPublico, TipoResultado } from '../modelos/contratos.js';
import type { ApiBusqueda } from './puertos.js';

export const tamanoPagina = 20;
export const sinFiltros: FiltrosBusqueda = { pagina: 1, tamano: tamanoPagina };
export const hayFiltros = (f: FiltrosBusqueda) => f.categoria !== undefined || f.especialidad !== undefined || f.distrito !== undefined || f.disponibilidad !== undefined;
export const totalPaginas = (p: { total: number; tamano: number }) => Math.max(1, Math.ceil(p.total / p.tamano));
/** Mensaje claro para el visitante. Un perfil o servicio no visible se presenta igual que uno inexistente. */
export function mensajeBusqueda(error: unknown): string {
  if (error instanceof ErrorApi) {
    if (error.http === 404) return 'El contenido solicitado no está disponible.';
    if (error.codigo === 'DEPENDENCIA_NO_DISPONIBLE') return 'La búsqueda no está disponible por ahora. Reintente en unos minutos.';
    return error.message;
  }
  return 'No fue posible completar la consulta.';
}

/** Casos de uso públicos de lectura. Las consultas no requieren sesión ni claves de idempotencia. */
export class BusquedaWeb {
  constructor(private readonly api: ApiBusqueda) {}
  buscar(tipo: 'servicios', f: FiltrosBusqueda): Promise<PaginaPublica<ServicioPublico>>;
  buscar(tipo: 'prestadores', f: FiltrosBusqueda): Promise<PaginaPublica<PrestadorResumen>>;
  buscar(tipo: TipoResultado, f: FiltrosBusqueda): Promise<PaginaPublica<ServicioPublico> | PaginaPublica<PrestadorResumen>> {
    return tipo === 'servicios' ? this.api.buscarServicios(f) : this.api.buscarPrestadores(f);
  }
  servicio(id: string): Promise<ServicioPublico> { return this.api.obtenerServicio(id); }
  perfil(id: string, pagina = 1): Promise<PerfilPublico> { return this.api.obtenerPerfil(id, pagina, tamanoPagina); }
  /** Las imágenes se piden solo cuando el visitante las abre. */
  imagen(ruta: string) { return this.api.obtenerImagen(ruta); }
}
