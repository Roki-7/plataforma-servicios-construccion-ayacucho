/** Tipos del dominio de Solicitudes compartidos con su API pública. Sin dependencias de otros módulos ni de infraestructura. */
export const tiposDeSolicitud = ['DIRIGIDA', 'PUBLICADA'] as const;
export type TipoSolicitud = typeof tiposDeSolicitud[number];

export const estadosDeSolicitud = ['BORRADOR', 'ABIERTA', 'CERRADA'] as const;
export type EstadoSolicitud = typeof estadosDeSolicitud[number];

export const estadosDeArchivo = ['PREPARANDO', 'PREPARADO', 'CONFIRMADO', 'DESCARTADO', 'ELIMINADO'] as const;
export type EstadoDeArchivo = typeof estadosDeArchivo[number];

/** Estados que cuentan para el cupo de 5 archivos y 30 000 000 bytes por solicitud. */
export const estadosQueCuentanParaElCupo: readonly EstadoDeArchivo[] = ['PREPARANDO', 'PREPARADO', 'CONFIRMADO'];

export const limitesDeArchivos = { maximoPorSolicitud: 5, bytesMaximosPorSolicitud: 30_000_000, bytesMaximosPorImagen: 10_000_000, ladoMaximo: 4096, ladoVariante: 1600, caducidadHoras: 24 } as const;
