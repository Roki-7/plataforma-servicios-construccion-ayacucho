import type { EstadoSolicitud, TipoSolicitud } from './tipos.js';

/**
 * Política ÚNICA de acceso a una solicitud y a sus fotografías (FR-324 a FR-328). Función pura: no consulta nada ni conoce infraestructura ni otros módulos.
 * Quien llama resuelve los hechos (compatibilidad con Catálogo y Prestadores, autoría con Cotizaciones) y esta función decide. Ningún otro código debe
 * repetir estas reglas: listados, detalle, historial, archivos y cotización las consumen de aquí.
 */

export interface EntradaDeAcceso {
  readonly solicitud: {
    readonly tipo: TipoSolicitud;
    readonly estado: EstadoSolicitud;
    readonly clienteCuentaId: string;
    /** Cuenta del prestador destinatario de una dirigida; `null` en una publicada. */
    readonly prestadorCuentaId: string | null;
    readonly compartirFotografias: boolean;
  };
  readonly actor: { readonly cuentaId: string; readonly tienePerfilPrestador: boolean };
  /** Título (b): categoría cubierta y distrito en sus zonas. Solo importa para una publicada ABIERTA. */
  readonly compatible: boolean;
  /** Título (c): autor de una cotización no retirada sobre la solicitud. */
  readonly autorNoRetirado: boolean;
}

export type TipoDeAcceso = 'DUENO' | 'PRESTADOR' | 'NINGUNO';
/** `NO_COMPARTIDAS`: el prestador solo puede saber que existen fotografías que el cliente no compartió. */
export type VisibilidadDeFotografias = 'VISIBLES' | 'NO_COMPARTIDAS' | 'OCULTAS';

export interface DecisionDeAcceso {
  readonly acceso: TipoDeAcceso;
  readonly titulos: { readonly destinatario: boolean; readonly compatible: boolean; readonly autor: boolean };
  readonly puedeLeer: boolean;
  /** Enviar una cotización nueva. Exige la solicitud ABIERTA y el título (a) o (b): el (c) solo permite actualizar o retirar la que ya existe. */
  readonly puedeCotizar: boolean;
  /** Aparece en las oportunidades del prestador: solo ABIERTAS, por el título (a) o (b). */
  readonly enOportunidades: boolean;
  readonly fotografias: VisibilidadDeFotografias;
  /** Historial de versiones de trabajo: dueño, destinatario y autores no retirados. */
  readonly puedeVerVersiones: boolean;
  /** Bitácora: solo el dueño. */
  readonly puedeVerBitacora: boolean;
}

const sinAcceso: DecisionDeAcceso = {
  acceso: 'NINGUNO', titulos: { destinatario: false, compatible: false, autor: false }, puedeLeer: false, puedeCotizar: false, enOportunidades: false,
  fotografias: 'OCULTAS', puedeVerVersiones: false, puedeVerBitacora: false,
};

export function decidirAcceso(entrada: EntradaDeAcceso): DecisionDeAcceso {
  const { solicitud, actor } = entrada;
  if (actor.cuentaId === solicitud.clienteCuentaId) {
    return { ...sinAcceso, acceso: 'DUENO', puedeLeer: true, fotografias: 'VISIBLES', puedeVerVersiones: true, puedeVerBitacora: true };
  }
  // Un borrador es solo del dueño, y sin perfil prestador no existe ningún título de prestador.
  if (!actor.tienePerfilPrestador || solicitud.estado === 'BORRADOR') return sinAcceso;

  const destinatario = solicitud.tipo === 'DIRIGIDA' && solicitud.prestadorCuentaId !== null && solicitud.prestadorCuentaId === actor.cuentaId;
  const compatible = solicitud.tipo === 'PUBLICADA' && solicitud.estado === 'ABIERTA' && entrada.compatible;
  const autor = entrada.autorNoRetirado;
  const puedeLeer = destinatario || compatible || autor;
  if (!puedeLeer) return sinAcceso;

  const abierta = solicitud.estado === 'ABIERTA';
  let fotografias: VisibilidadDeFotografias;
  if (solicitud.tipo === 'DIRIGIDA') fotografias = destinatario ? 'VISIBLES' : 'OCULTAS';
  else fotografias = solicitud.compartirFotografias ? 'VISIBLES' : 'NO_COMPARTIDAS';

  return {
    acceso: 'PRESTADOR', titulos: { destinatario, compatible, autor }, puedeLeer: true,
    puedeCotizar: abierta && (destinatario || compatible), enOportunidades: abierta && (destinatario || compatible),
    fotografias, puedeVerVersiones: destinatario || autor, puedeVerBitacora: false,
  };
}
