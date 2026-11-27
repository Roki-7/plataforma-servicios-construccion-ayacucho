import { type DetalleError } from '../../../compartido/dominio/errores.js';
import { analizarTextos, mensajesDeDeteccion } from './datos-personales.js';
import { campoNoModificable, datosInvalidos, datosPersonalesEnTexto, fechaNoValida, solicitudIncompleta } from './errores.js';
import { esFechaDeCalendario, esAnterior } from './fechas.js';
import type { EstadoSolicitud, TipoSolicitud } from './tipos.js';
import { tiposDeSolicitud } from './tipos.js';

/** Los cinco distritos admitidos (catálogo geográfico de la plataforma). No se pide dirección exacta ni título (FR-303). */
export const distritosAdmitidos = ['ayacucho', 'carmen-alto', 'san-juan-bautista', 'jesus-nazareno', 'andres-avelino-caceres-dorregaray'] as const;
export const limitesDeTexto = { descripcion: 2000, medidas: 500, descripcionCorta: 200 } as const;

export interface CopiaDeServicio { readonly servicioId: string; readonly titulo: string; readonly categoriaId: string }

export interface Solicitud {
  readonly id: string;
  readonly clienteCuentaId: string;
  readonly tipo: TipoSolicitud;
  readonly estado: EstadoSolicitud;
  readonly prestadorId: string | null;
  readonly prestadorCuentaId: string | null;
  readonly servicio: CopiaDeServicio | null;
  readonly descripcion: string | null;
  readonly medidas: string | null;
  readonly categoriaId: string | null;
  readonly distrito: string | null;
  readonly fechaDesde: string | null;
  readonly fechaHasta: string | null;
  readonly compartirFotografias: boolean;
  readonly version: number;
  readonly versionTrabajo: number;
  readonly creadaEn: Date;
  readonly actualizadaEn: Date;
  readonly publicadaEn: Date | null;
  readonly cerradaEn: Date | null;
}

/** Entrada ya validada por el esquema del contrato. Todo es opcional salvo `tipo` al crear. */
export interface EntradaSolicitud {
  readonly tipo?: TipoSolicitud; readonly prestadorId?: string; readonly servicioId?: string;
  readonly descripcion?: string; readonly medidas?: string; readonly categoriaId?: string; readonly distrito?: string;
  readonly fechaDesde?: string; readonly fechaHasta?: string; readonly archivosIds?: readonly string[]; readonly compartirFotografias?: boolean;
}

export interface Advertencia { readonly codigo: string; readonly campo?: string; readonly mensaje: string }

const detalle = (campo: string, motivo: string): DetalleError => ({ campo, motivo });

/**
 * Valida y normaliza el formato de una entrada. No valida existencia ni elegibilidad (eso es de los casos de uso). Un texto en blanco no es un valor: se rechaza.
 * Longitudes y formatos inválidos → 400 `DATOS_INVALIDOS` con el detalle por campo.
 */
export function normalizarEntrada(entrada: EntradaSolicitud): EntradaSolicitud {
  const errores: DetalleError[] = [];
  const salida: { -readonly [K in keyof EntradaSolicitud]?: EntradaSolicitud[K] } = { ...entrada };
  for (const [campo, maximo] of [['descripcion', limitesDeTexto.descripcion], ['medidas', limitesDeTexto.medidas]] as const) {
    const valor = entrada[campo];
    if (valor === undefined) continue;
    if (typeof valor !== 'string' || !valor.isWellFormed()) { errores.push(detalle(campo, 'Texto no válido.')); continue; }
    const recortado = valor.trim();
    if (!recortado) errores.push(detalle(campo, 'No puede estar en blanco.'));
    else if (recortado.length > maximo) errores.push(detalle(campo, `Admite hasta ${maximo} caracteres.`));
    else salida[campo] = recortado;
  }
  if (entrada.tipo !== undefined && !tiposDeSolicitud.includes(entrada.tipo)) errores.push(detalle('tipo', 'Tipo no admitido.'));
  if (entrada.distrito !== undefined && !(distritosAdmitidos as readonly string[]).includes(entrada.distrito)) errores.push(detalle('distrito', 'El distrito no está en el catálogo admitido.'));
  for (const campo of ['fechaDesde', 'fechaHasta'] as const) if (entrada[campo] !== undefined && !esFechaDeCalendario(entrada[campo])) errores.push(detalle(campo, 'Fecha no válida.'));
  if (errores.length) throw datosInvalidos(errores);
  return salida;
}

/** Campos obligatorios que faltan para publicar, en un orden estable. */
export function camposFaltantesParaPublicar(s: Pick<Solicitud, 'tipo' | 'prestadorId' | 'descripcion' | 'categoriaId' | 'distrito' | 'fechaDesde'>): string[] {
  const faltan: string[] = [];
  if (s.tipo === 'DIRIGIDA' && !s.prestadorId) faltan.push('prestadorId');
  if (!s.descripcion) faltan.push('descripcion');
  if (!s.categoriaId) faltan.push('categoriaId');
  if (!s.distrito) faltan.push('distrito');
  if (!s.fechaDesde) faltan.push('fechaDesde');
  return faltan;
}
export function exigirCompleta(s: Parameters<typeof camposFaltantesParaPublicar>[0]): void {
  const faltan = camposFaltantesParaPublicar(s);
  if (faltan.length) throw solicitudIncompleta(faltan);
}

/** El periodo es coherente: `fechaHasta` no existe sin `fechaDesde` y no es anterior a ella. */
export function exigirPeriodoCoherente(desde: string | null, hasta: string | null): void {
  if (hasta && !desde) throw fechaNoValida('fechaHasta');
  if (desde && hasta && esAnterior(hasta, desde)) throw fechaNoValida('fechaHasta');
}
/** Al publicar o al cambiar las fechas, la fecha deseada no puede ser anterior a hoy en America/Lima. */
export function exigirFechaNoAnterior(hoy: string, desde: string | null, hasta: string | null): void {
  exigirPeriodoCoherente(desde, hasta);
  if (desde && esAnterior(desde, hoy)) throw fechaNoValida('fechaDesde');
}

/**
 * Tras publicar son inmutables el tipo, el prestador, el servicio y, si hay servicio, la categoría (FR-306). Enviar el mismo valor no es un cambio.
 * Devuelve el primer campo que intenta cambiar o lanza `CAMPO_NO_MODIFICABLE`.
 */
export function exigirInmutables(actual: Solicitud, entrada: EntradaSolicitud): void {
  if (!actual.publicadaEn) return;
  const igual = (a: string | null | undefined, b: string | null | undefined) => (a ?? null)?.toLowerCase() === (b ?? null)?.toLowerCase();
  if (entrada.tipo !== undefined && entrada.tipo !== actual.tipo) throw campoNoModificable('tipo');
  if (entrada.prestadorId !== undefined && !igual(entrada.prestadorId, actual.prestadorId)) throw campoNoModificable('prestadorId');
  if (entrada.servicioId !== undefined && !igual(entrada.servicioId, actual.servicio?.servicioId)) throw campoNoModificable('servicioId');
  if (actual.servicio && entrada.categoriaId !== undefined && !igual(entrada.categoriaId, actual.categoriaId)) throw campoNoModificable('categoriaId');
}

/**
 * Datos personales evidentes (FR-315 y FR-316). En una publicada (y al publicar) correo, enlace o mensajería y teléfono se rechazan con
 * `DATOS_PERSONALES_EN_TEXTO`. En una dirigida o un borrador solo se advierte. Devuelve las advertencias, sin texto.
 */
export function evaluarTextoLibre(textos: { descripcion?: string | null; medidas?: string | null }, bloquea: boolean): Advertencia[] {
  const { rechazos, advertencias } = analizarTextos(textos, bloquea);
  if (rechazos.length) throw datosPersonalesEnTexto(rechazos[0]!.campo);
  return advertencias.map(a => ({ codigo: a.codigo, campo: a.campo, mensaje: mensajesDeDeteccion[a.codigo] }));
}

/** Advertencias de cobertura de una dirigida (FR-305). Nunca bloquean. */
export function advertenciasDeCobertura(d: { distrito: string | null; categoriaId: string | null; tieneServicio: boolean; distritosDelPrestador: readonly string[]; especialidadesDelPrestador: readonly string[] }): Advertencia[] {
  const advertencias: Advertencia[] = [];
  if (d.distrito && !d.distritosDelPrestador.includes(d.distrito)) {
    advertencias.push({ codigo: 'DISTRITO_FUERA_DE_COBERTURA', campo: 'distrito', mensaje: 'El prestador no indica atender este distrito. Puede enviar la solicitud igualmente.' });
  }
  if (!d.tieneServicio && d.categoriaId && !d.especialidadesDelPrestador.includes(d.categoriaId)) {
    advertencias.push({ codigo: 'CATEGORIA_FUERA_DE_ESPECIALIDADES', campo: 'categoriaId', mensaje: 'El prestador no declara esta categoría entre sus especialidades. Puede enviar la solicitud igualmente.' });
  }
  return advertencias;
}

export const descripcionCorta = (texto: string | null): string | undefined => (texto ? texto.slice(0, limitesDeTexto.descripcionCorta) : undefined);
