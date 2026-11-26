import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';
import type { EstadoSolicitud, TipoSolicitud } from './dominio/tipos.js';

export type { EstadoSolicitud, TipoSolicitud } from './dominio/tipos.js';

/**
 * Datos mínimos de una solicitud que otros módulos pueden leer. Nunca incluye la cuenta del cliente, la descripción, las medidas, los archivos ni datos
 * de contacto. Los identificadores externos son opacos para quien los lee.
 */
export interface ResumenDeSolicitud {
  readonly solicitudId: string;
  readonly tipo: TipoSolicitud;
  readonly estado: EstadoSolicitud;
  /** 0 mientras sea borrador; desde la primera publicación, la versión de trabajo vigente. */
  readonly versionTrabajo: number;
  readonly categoriaId: string | null;
  readonly distritoCodigo: string | null;
  /** Prestador destinatario de una dirigida; `null` en una publicada. */
  readonly prestadorId: string | null;
}

/**
 * API interna de Solicitudes para Cotizaciones (003) y para la 004. No registra rutas HTTP ni expone repositorios. Con `tx` participa en la transacción del
 * llamador; sin ella lee del primario. Se implementa con las tareas de la historia correspondiente: aquí solo se fija el contrato.
 */
export interface SolicitudesApi {
  /** Estado y versión de trabajo de varias solicitudes en UNA sola lectura (una página de cotizaciones). Omite las que no existen. */
  resumenes(solicitudIds: readonly string[], tx?: ContextoTransaccion): Promise<ReadonlyMap<string, ResumenDeSolicitud>>;
  /**
   * Toma el bloqueo compartido de la solicitud hasta el commit del llamador y devuelve su resumen vigente, o `null` si no existe. Impide que se cierre o se
   * edite mientras se escribe una cotización sobre ella. Exige una transacción.
   */
  bloquearCompartido(solicitudId: string, tx: ContextoTransaccion): Promise<ResumenDeSolicitud | null>;
  /** Valida que la cuenta sea la del cliente dueño de la solicitud, sin revelar quién lo es. `false` si no existe. */
  esClienteDe(solicitudId: string, cuentaId: string, tx?: ContextoTransaccion): Promise<boolean>;
}
