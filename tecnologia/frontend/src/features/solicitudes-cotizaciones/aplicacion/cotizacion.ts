import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { ApiCotizaciones, Cotizacion, DatosCotizacion, EstadoCotizacion, MotivoNoAceptable, TipoCotizacion, VersionDeCotizacion } from '../modelos/cotizaciones.js';

/** Texto de cada campo del formulario; el precio se escribe en soles y la vigencia como fecha de calendario de Lima. */
export interface FormularioCotizacion {
  tipo: TipoCotizacion;
  alcance: string;
  exclusiones: string;
  materiales: string;
  manoDeObra: string;
  precio: string;
  formaCalculo: string;
  plazoDias: string;
  vigenteHasta: string;
  condicionesPago: string;
}

export const formularioVacio = (): FormularioCotizacion => ({
  tipo: 'ESTIMADA', alcance: '', exclusiones: '', materiales: '', manoDeObra: '', precio: '', formaCalculo: '', plazoDias: '', vigenteHasta: '', condicionesPago: '',
});

// ─── Dinero y fechas ──────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un precio escrito en soles a céntimos sin pasar por coma flotante. Acepta separador de miles con espacio o coma y hasta dos decimales con punto o coma.
 * Devuelve `undefined` si está vacío y `null` si no es un importe válido mayor que cero.
 */
export function precioACentimos(texto: string): number | undefined | null {
  const limpio = texto.trim().replace(/\s+/g, '');
  if (!limpio) return undefined;
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(limpio) ?? /^(\d+)(?:[.,](\d{1,2}))?$/.exec(limpio);
  if (!m) return null;
  const centimos = Number(m[1]!.replaceAll(',', '')) * 100 + Number((m[2] ?? '').padEnd(2, '0') || '0');
  return Number.isSafeInteger(centimos) && centimos > 0 ? centimos : null;
}

export function centimosAPrecio(centimos: number): string {
  const enteros = Math.trunc(centimos / 100); const resto = centimos % 100;
  return resto === 0 ? String(enteros) : `${enteros}.${String(resto).padStart(2, '0')}`;
}

export const formatoSoles = (centimos: number) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(centimos / 100);

/** Hoy en Lima como «AAAA-MM-DD». */
export function fechaDeHoyEnLima(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora);
  return ['year', 'month', 'day'].map(t => partes.find(p => p.type === t)?.value).join('-');
}

/** La cotización vale hasta el final del día elegido, hora de Lima (UTC-5, sin horario de verano). */
export const vigenciaAInstante = (fecha: string) => new Date(`${fecha}T23:59:59-05:00`).toISOString();
export const instanteAFechaLima = (instante: string) => fechaDeHoyEnLima(new Date(instante));
export const fechaHoraLima = (instante: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(instante));
export const fechaLima = (instante: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' }).format(new Date(instante));

// ─── Formulario ↔ contrato ────────────────────────────────────────────────────────────────────────────────────────

const camposTexto = ['exclusiones', 'materiales', 'manoDeObra', 'formaCalculo', 'condicionesPago'] as const;

export function formularioDe(v: VersionDeCotizacion): FormularioCotizacion {
  return {
    tipo: v.tipo, alcance: v.alcance, exclusiones: v.exclusiones ?? '', materiales: v.materiales ?? '', manoDeObra: v.manoDeObra ?? '',
    precio: v.precioCentimos === undefined ? '' : centimosAPrecio(v.precioCentimos), formaCalculo: v.formaCalculo ?? '', plazoDias: v.plazoDias === undefined ? '' : String(v.plazoDias),
    vigenteHasta: instanteAFechaLima(v.vigenteHasta), condicionesPago: v.condicionesPago ?? '',
  };
}

/** Requisitos por tipo (FR-337): estimada, alcance + vigencia + (precio o forma de cálculo); definitiva, además precio, plazo y condiciones de pago. */
export const requeridosPorTipo = (tipo: TipoCotizacion) => ({
  precio: tipo === 'DEFINITIVA', plazoDias: tipo === 'DEFINITIVA', condicionesPago: tipo === 'DEFINITIVA',
});

export type ErroresDeFormulario = Partial<Record<keyof FormularioCotizacion, string>>;

/** Validación previa al envío: mismas reglas que el servidor, para guiar al usuario. El servidor sigue siendo quien decide. */
export function validarFormulario(f: FormularioCotizacion, hoy = fechaDeHoyEnLima()): ErroresDeFormulario {
  const e: ErroresDeFormulario = {};
  if (!f.alcance.trim()) e.alcance = 'Describe el alcance del trabajo que cotizas.';
  const precio = precioACentimos(f.precio);
  if (precio === null) e.precio = 'Escribe un importe en soles mayor que cero, por ejemplo 2500 o 2 500,50.';
  if (f.tipo === 'ESTIMADA' && precio === undefined && !f.formaCalculo.trim()) {
    e.precio = 'Indica un precio o explica cómo se calculará.'; e.formaCalculo = 'Indica un precio o explica cómo se calculará.';
  }
  if (f.tipo === 'DEFINITIVA') {
    if (precio === undefined) e.precio = 'Una cotización definitiva exige un precio fijo.';
    if (!f.plazoDias.trim()) e.plazoDias = 'Indica el plazo de ejecución en días.';
    if (!f.condicionesPago.trim()) e.condicionesPago = 'Indica las condiciones de pago.';
  }
  if (f.plazoDias.trim() && !/^[1-9]\d{0,8}$/.test(f.plazoDias.trim())) e.plazoDias = 'Escribe un número entero de días mayor que cero.';
  if (!f.vigenteHasta) e.vigenteHasta = 'Indica hasta cuándo es válida tu cotización.';
  else if (f.vigenteHasta < hoy) e.vigenteHasta = 'La vigencia no puede ser anterior a hoy.';
  return e;
}

export function datosDeFormulario(f: FormularioCotizacion): DatosCotizacion {
  const datos: DatosCotizacion = { tipo: f.tipo, alcance: f.alcance.trim(), vigenteHasta: vigenciaAInstante(f.vigenteHasta) };
  for (const campo of camposTexto) { const valor = f[campo].trim(); if (valor) datos[campo] = valor; }
  const precio = precioACentimos(f.precio); if (typeof precio === 'number') datos.precioCentimos = precio;
  if (f.plazoDias.trim()) datos.plazoDias = Number(f.plazoDias.trim());
  return datos;
}

// ─── Estados y mensajes ───────────────────────────────────────────────────────────────────────────────────────────

export const etiquetasEstado: Record<EstadoCotizacion, string> = {
  VIGENTE: 'Vigente', VENCIDA: 'Vencida', PENDIENTE_REVISION: 'Requiere revisión', RETIRADA: 'Retirada',
};
export const etiquetasTipo: Record<TipoCotizacion, string> = { ESTIMADA: 'Estimada', DEFINITIVA: 'Definitiva' };

/**
 * Qué significa el estado para el prestador y qué puede hacer. Nunca afirma que se haya enviado, entregado ni leído ningún aviso: la 003 solo registra avisos,
 * y el estado se calcula al consultar.
 */
export function explicacionDeEstado(c: Pick<Cotizacion, 'estado' | 'solicitudCerrada' | 'versionVigente'>): string {
  if (c.estado === 'RETIRADA') return 'Retiraste esta cotización. Se conserva en lectura y ya no ocupa tu lugar en la solicitud.';
  if (c.solicitudCerrada) return 'La solicitud está cerrada. Tu cotización se conserva en lectura y ya no puede actualizarse ni retirarse.';
  if (c.estado === 'VENCIDA') return `Tu cotización venció (${fechaHoraLima(c.versionVigente.vigenteHasta)}). Actualízala con una nueva vigencia para que vuelva a estar vigente.`;
  if (c.estado === 'PENDIENTE_REVISION') return 'La solicitud cambió después de tu última versión. Revisa el trabajo y actualiza tu cotización para que vuelva a estar vigente.';
  return `Vigente hasta el ${fechaHoraLima(c.versionVigente.vigenteHasta)}`;
}

/** Lo mismo que `explicacionDeEstado`, dicho al cliente que recibe la cotización. Tampoco afirma que se haya avisado a nadie. */
export function explicacionParaCliente(c: Pick<Cotizacion, 'estado' | 'solicitudCerrada' | 'versionVigente'>): string {
  if (c.estado === 'RETIRADA') return 'El prestador retiró esta cotización. Se conserva en lectura.';
  if (c.solicitudCerrada) return 'Tu solicitud está cerrada. La cotización y su hilo de aclaraciones se conservan en lectura.';
  if (c.estado === 'VENCIDA') return `Esta cotización venció (${fechaHoraLima(c.versionVigente.vigenteHasta)}). El prestador puede actualizarla con una nueva vigencia.`;
  if (c.estado === 'PENDIENTE_REVISION') return 'Cambiaste la solicitud después de esta versión. El prestador debe revisarla y actualizarla.';
  return `Vigente hasta el ${fechaHoraLima(c.versionVigente.vigenteHasta)}`;
}

export const textoDeMotivo: Record<MotivoNoAceptable, string> = {
  RETIRADA: 'Está retirada.', VENCIDA: 'Su vigencia terminó.', PENDIENTE_REVISION: 'Hay cambios en la solicitud que aún no revisaste.', SOLICITUD_CERRADA: 'La solicitud está cerrada.',
};

/** La cotización admite actualizar o retirar mientras no esté retirada y la solicitud siga abierta. */
export const admiteCambios = (c: Pick<Cotizacion, 'estado' | 'solicitudCerrada'>) => c.estado !== 'RETIRADA' && !c.solicitudCerrada;

export interface FalloDeCotizacion { mensaje: string; campos: Partial<Record<string, string>>; solicitudCambio: boolean; versionVieja: boolean }

/** Mensajes comprensibles por código, sin reproducir datos del servidor y sin revelar si un recurso ajeno existe. */
export function falloDeCotizacion(e: unknown): FalloDeCotizacion {
  const base: FalloDeCotizacion = { mensaje: e instanceof Error ? e.message : 'No se pudo completar la operación.', campos: {}, solicitudCambio: false, versionVieja: false };
  if (!(e instanceof ErrorApi)) return base;
  const campos = Object.fromEntries(e.detalles.flatMap(d => d.campo ? [[d.campo === 'precioCentimos' ? 'precio' : d.campo, d.motivo]] : []));
  const porCodigo: Record<string, string> = {
    SOLICITUD_MODIFICADA: 'La solicitud cambió mientras preparabas tu cotización. Revisa el trabajo actualizado y vuelve a enviarla.',
    SOLICITUD_NO_ABIERTA: 'La solicitud ya no está abierta, así que no admite cotizaciones nuevas, cambios ni retiros.',
    COTIZACION_EXISTENTE: 'Ya tienes una cotización sin retirar para esta solicitud. Actualízala en lugar de enviar otra.',
    COTIZACION_RETIRADA: 'Esta cotización ya está retirada.',
    COTIZACION_PROPIA: 'No puedes cotizar tu propia solicitud.',
    VERSION_DESACTUALIZADA: 'La cotización cambió desde que la abriste. Vuelve a cargarla antes de continuar.',
    FECHA_NO_VALIDA: 'La vigencia debe ser posterior al momento actual.',
    COTIZACION_INCOMPLETA: 'Faltan datos obligatorios para este tipo de cotización.',
    RECURSO_NO_DISPONIBLE: 'Esta solicitud o cotización no está disponible. Puede haber cambiado o no corresponder a tus servicios y zonas.',
    SIN_PERMISO: 'Para cotizar, habilita el perfil de prestador en Mis perfiles.',
    LIMITE_ACLARACIONES: 'El hilo alcanzó el máximo de 20 mensajes. Ya no admite más.',
    LIMITE_COMPARACION: 'Puedes comparar hasta 10 cotizaciones a la vez.',
  };
  return {
    mensaje: porCodigo[e.codigo] ?? e.message, campos, solicitudCambio: e.codigo === 'SOLICITUD_MODIFICADA',
    versionVieja: e.codigo === 'VERSION_DESACTUALIZADA',
  };
}

/**
 * Busca la cotización sin retirar de la cuenta sobre una solicitud. El contrato no ofrece una consulta por solicitud para el prestador, así que se recorren
 * «mis cotizaciones» (de la más reciente a la más antigua, con el tamaño de página del servidor) hasta encontrarla o agotar un máximo de páginas.
 */
export async function buscarMiCotizacion(api: Pick<ApiCotizaciones, 'mias'>, solicitudId: string, maximoDePaginas = 10): Promise<Cotizacion | undefined> {
  for (let pagina = 1; pagina <= maximoDePaginas; pagina += 1) {
    const r = await api.mias(pagina);
    const hallada = r.elementos.find(c => c.solicitudId === solicitudId && c.estado !== 'RETIRADA');
    if (hallada) return hallada;
    if (pagina * r.tamano >= r.total) return undefined;
  }
  return undefined;
}
