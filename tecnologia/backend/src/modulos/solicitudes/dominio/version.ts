import type { EstadoSolicitud } from './tipos.js';

/**
 * Versionado de una solicitud (FR-307 a FR-312). Hay dos contadores:
 *  - la versión de control (`version`) sube con CUALQUIER modificación y protege la concurrencia;
 *  - la versión de trabajo (`versionTrabajo`) es 0 mientras sea borrador, 1 desde la primera publicación y solo sube con cambios relevantes del trabajo.
 * Todo es puro: compara estados canónicos y decide qué efectos produce un cambio.
 */

/** Campos cuyo cambio, en una solicitud ABIERTA, crea una versión de trabajo (FR-308). */
export const camposRelevantes = ['descripcion', 'medidas', 'archivos', 'categoriaId', 'distrito', 'fechaDesde', 'fechaHasta'] as const;
export type CampoRelevante = typeof camposRelevantes[number];

export interface EstadoCanonico {
  readonly descripcion: string | null;
  readonly medidas: string | null;
  readonly categoriaId: string | null;
  readonly distrito: string | null;
  readonly fechaDesde: string | null;
  readonly fechaHasta: string | null;
  /** Identificadores de los archivos CONFIRMADOS, sin importar el orden. */
  readonly archivosIds: readonly string[];
  readonly compartirFotografias: boolean;
}

export type TipoBitacora = 'CREADA' | 'BORRADOR_EDITADO' | 'PUBLICADA' | 'EDITADA' | 'PRIVACIDAD_CAMBIADA' | 'CERRADA';

const texto = (v: string | null | undefined): string | null => { const t = v?.trim(); return t ? t : null; };

/** Normaliza para comparar: texto recortado (vacío = ausente), UUID en minúsculas y archivos ordenados y sin repetidos. */
export function estadoCanonico(d: { descripcion?: string | null; medidas?: string | null; categoriaId?: string | null; distrito?: string | null;
  fechaDesde?: string | null; fechaHasta?: string | null; archivosIds?: readonly string[]; compartirFotografias?: boolean }): EstadoCanonico {
  return {
    descripcion: texto(d.descripcion), medidas: texto(d.medidas), categoriaId: d.categoriaId?.toLowerCase() ?? null, distrito: d.distrito ?? null,
    fechaDesde: d.fechaDesde ?? null, fechaHasta: d.fechaHasta ?? null,
    archivosIds: [...new Set((d.archivosIds ?? []).map(a => a.toLowerCase()))].sort(), compartirFotografias: d.compartirFotografias ?? false,
  };
}

export interface PlanDeEdicion {
  /** Edición idéntica al estado vigente: no crea versión, bitácora ni aviso. */
  readonly sinCambios: boolean;
  /** Campos relevantes del trabajo que cambiaron. */
  readonly relevantes: readonly CampoRelevante[];
  /** Cambió el permiso de compartir fotografías. */
  readonly privacidad: boolean;
  /** Todos los campos que cambiaron, para la bitácora (solo nombres, nunca valores). */
  readonly camposCambiados: readonly string[];
}

function mismo(a: EstadoCanonico, b: EstadoCanonico, campo: CampoRelevante): boolean {
  if (campo === 'archivos') return a.archivosIds.length === b.archivosIds.length && a.archivosIds.every((id, i) => id === b.archivosIds[i]);
  return a[campo] === b[campo];
}

export function compararEstados(antes: EstadoCanonico, despues: EstadoCanonico): PlanDeEdicion {
  const relevantes = camposRelevantes.filter(c => !mismo(antes, despues, c));
  const privacidad = antes.compartirFotografias !== despues.compartirFotografias;
  const camposCambiados = [...relevantes, ...(privacidad ? ['compartirFotografias'] : [])];
  return { sinCambios: camposCambiados.length === 0, relevantes, privacidad, camposCambiados };
}

export interface Efectos {
  readonly version: number;
  readonly versionTrabajo: number;
  /** Se guarda una copia inmutable del trabajo como versión `versionTrabajo`. */
  readonly creaVersionDeTrabajo: boolean;
  /** Entradas de bitácora, en orden. */
  readonly bitacora: readonly TipoBitacora[];
  /** Los interesados reciben un aviso REGISTRADO (FR-344). */
  readonly avisaAInteresados: boolean;
}
const sinEfectos = (version: number, versionTrabajo: number): Efectos => ({ version, versionTrabajo, creaVersionDeTrabajo: false, bitacora: [], avisaAInteresados: false });

/**
 * Efectos de editar una solicitud. Un borrador solo sube la versión de control. Una ABIERTA con cambios relevantes crea una versión de trabajo (una sola
 * aunque el cambio sea mixto), avisa a los interesados y registra además el cambio de privacidad si lo hubo. Un cambio solo de privacidad sube la versión de
 * control y deja bitácora, sin versión de trabajo ni aviso. Una edición idéntica no tiene efectos. Una CERRADA no admite edición (lo decide el llamador).
 */
export function efectosDeEdicion(estado: EstadoSolicitud, version: number, versionTrabajo: number, plan: PlanDeEdicion): Efectos {
  if (plan.sinCambios) return sinEfectos(version, versionTrabajo);
  if (estado === 'BORRADOR') return { version: version + 1, versionTrabajo: 0, creaVersionDeTrabajo: false, bitacora: ['BORRADOR_EDITADO'], avisaAInteresados: false };
  if (plan.relevantes.length === 0) return { version: version + 1, versionTrabajo, creaVersionDeTrabajo: false, bitacora: ['PRIVACIDAD_CAMBIADA'], avisaAInteresados: false };
  return {
    version: version + 1, versionTrabajo: versionTrabajo + 1, creaVersionDeTrabajo: true,
    bitacora: plan.privacidad ? ['EDITADA', 'PRIVACIDAD_CAMBIADA'] : ['EDITADA'], avisaAInteresados: true,
  };
}

/** La primera publicación crea la versión de trabajo 1. No deja cotizaciones pendientes de revisión y solo avisa al destinatario de una dirigida. */
export function efectosDePublicacion(version: number, esDirigida: boolean): Efectos & { readonly avisaAlDestinatario: boolean } {
  return { version: version + 1, versionTrabajo: 1, creaVersionDeTrabajo: true, bitacora: ['PUBLICADA'], avisaAInteresados: false, avisaAlDestinatario: esDirigida };
}

/** Cerrar no crea versión de trabajo. Cerrar una ABIERTA avisa a los interesados; descartar un borrador no avisa a nadie (FR-311 y FR-312). */
export function efectosDeCierre(estado: EstadoSolicitud, version: number, versionTrabajo: number): Efectos {
  return { version: version + 1, versionTrabajo, creaVersionDeTrabajo: false, bitacora: ['CERRADA'], avisaAInteresados: estado === 'ABIERTA' };
}
