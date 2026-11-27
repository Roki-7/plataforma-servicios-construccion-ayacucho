import type { ContextoTransaccion } from '../../compartido/aplicacion/transaccion.js';
import type { EstadoSolicitud, TipoSolicitud } from './dominio/tipos.js';

export type { EstadoSolicitud, TipoSolicitud } from './dominio/tipos.js';
/** Reglas puras de acceso que Cotizaciones reutiliza para no repetir la política (FR-324, FR-333, FR-335). */
export { coincideConCobertura, tituloParaCotizar } from './dominio/politica-acceso.js';

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
  /**
   * Solo lectura, para la 004 (E2). Comprueba que la cuenta sea el cliente dueño y que la solicitud esté disponible para contratar (ABIERTA), con los motivos.
   * Para quien no es el dueño no revela nada más que `NO_ES_EL_CLIENTE`. No cambia ningún estado ni produce selección o contratación.
   */
  validarClienteYDisponibilidad(solicitudId: string, actorCuentaId: string, tx?: ContextoTransaccion): Promise<ValidacionDeClienteYDisponibilidad>;
}

export type MotivoDeNoDisponibilidad = 'SOLICITUD_INEXISTENTE' | 'NO_ES_EL_CLIENTE' | 'SOLICITUD_NO_ABIERTA';
export interface ValidacionDeClienteYDisponibilidad {
  readonly esCliente: boolean;
  readonly disponible: boolean;
  /** Versión de trabajo vigente; `null` si el actor no es el cliente dueño. */
  readonly versionTrabajo: number | null;
  readonly motivos: readonly MotivoDeNoDisponibilidad[];
}
// La implementación (`ApiSolicitudes`) vive en `aplicacion/api-solicitudes.ts` y la conecta la composición: reexportarla desde aquí crearía un ciclo.
