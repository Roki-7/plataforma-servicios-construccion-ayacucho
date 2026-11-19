import { ErrorAplicacion, type DetalleError } from '../../../compartido/dominio/errores.js';
import { textoPlano } from '../../../compartido/dominio/texto-plano.js';

export const estadosServicio = ['PUBLICADO', 'PAUSADO', 'RETIRADO'] as const;
export type EstadoServicio = typeof estadosServicio[number];
export const limitesServicio = { titulo: 120, descripcion: 2000 } as const;

export interface DatosServicio { readonly titulo: string; readonly descripcion: string }
/** Un propietario (`prestadorId`) y una clasificación por servicio. El registro RETIRADO se conserva. */
export interface Servicio extends DatosServicio {
  readonly id: string;
  readonly prestadorId: string;
  readonly categoriaId: string;
  readonly estado: EstadoServicio;
  readonly version: number;
}

/** Las cuatro transiciones del titular. RETIRADO es terminal. */
export const transicionesPermitidas: Readonly<Record<EstadoServicio, readonly EstadoServicio[]>> = {
  PUBLICADO: ['PAUSADO', 'RETIRADO'],
  PAUSADO: ['PUBLICADO', 'RETIRADO'],
  RETIRADO: [],
};

const retirado = () => new ErrorAplicacion(422, 'SERVICIO_RETIRADO', 'El servicio está retirado y es de solo lectura.', [{ campo: 'estado', motivo: 'Un servicio retirado no admite cambios.' }]);

/** La edición solo aplica en PUBLICADO o PAUSADO. */
export function exigirEditable(estado: EstadoServicio): void {
  if (estado === 'RETIRADO') throw retirado();
}
export function exigirTransicion(origen: EstadoServicio, destino: EstadoServicio): void {
  if (origen === 'RETIRADO') throw retirado();
  if (!transicionesPermitidas[origen].includes(destino)) {
    throw new ErrorAplicacion(422, 'TRANSICION_NO_ADMITIDA', `No se puede pasar de ${origen} a ${destino}.`, [{ campo: 'destino', motivo: `No se puede pasar de ${origen} a ${destino}.` }]);
  }
}

export function validarDatosServicio(entrada: { titulo?: unknown; descripcion?: unknown }, parcial = false): Partial<DatosServicio> {
  const errores: DetalleError[] = [];
  const salida: { titulo?: string; descripcion?: string } = {};
  if (!parcial || entrada.titulo !== undefined) salida.titulo = textoPlano('titulo', entrada.titulo, limitesServicio.titulo, errores).trim();
  if (!parcial || entrada.descripcion !== undefined) salida.descripcion = textoPlano('descripcion', entrada.descripcion, limitesServicio.descripcion, errores, true).trim();
  if (errores.length) throw new ErrorAplicacion(400, 'DATOS_INVALIDOS', 'Revise los datos enviados.', errores);
  return salida;
}

/** Publicar, cambiar de clasificación o reactivar exige una clasificación efectivamente activa. */
export function exigirClasificacionActiva(activa: boolean): void {
  if (!activa) {
    throw new ErrorAplicacion(422, 'CATEGORIA_NO_ACTIVA', 'La clasificación no admite nuevas publicaciones.', [{ campo: 'categoriaId', motivo: 'La clasificación no está activa.' }]);
  }
}

/** Condiciones vigentes para publicar o reactivar: datos conformes y clasificación efectivamente activa. */
export function exigirPublicable(servicio: DatosServicio, clasificacionActiva: boolean): void {
  validarDatosServicio(servicio);
  exigirClasificacionActiva(clasificacionActiva);
}

/** Visibilidad y elegibilidad para nuevas solicitudes. Un estado propio no se altera por la actividad de la clasificación. */
export function esElegible(servicio: Pick<Servicio, 'estado'>, clasificacionActiva: boolean): boolean {
  return servicio.estado === 'PUBLICADO' && clasificacionActiva;
}
