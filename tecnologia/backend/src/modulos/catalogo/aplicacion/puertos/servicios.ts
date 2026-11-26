import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { EstadoServicio, Servicio } from '../../dominio/servicio.js';

export interface CambiosServicio {
  readonly titulo?: string;
  readonly descripcion?: string;
  readonly categoriaId?: string;
  readonly estado?: EstadoServicio;
}
export interface PaginaServicios { readonly elementos: readonly Servicio[]; readonly total: number }

/** Persistencia de servicios bajo la propiedad de Catálogo. Con `tx` participa en la unidad de trabajo. */
export interface RepositorioServicios {
  crear(tx: ContextoTransaccion, servicio: Servicio): Promise<void>;
  porId(servicioId: string, tx?: ContextoTransaccion, bloquear?: boolean): Promise<Servicio | null>;
  /** Aplica los cambios, incrementa la versión y devuelve la versión nueva. */
  actualizar(tx: ContextoTransaccion, servicioId: string, cambios: CambiosServicio): Promise<number>;
  listarPropios(prestadorId: string, pagina: number, tamano: number): Promise<PaginaServicios>;
  /** Estado de actividad efectiva de la clasificación del servicio, resuelto con su jerarquía. */
  clasificacionActiva(servicioId: string, tx?: ContextoTransaccion): Promise<boolean>;
}
