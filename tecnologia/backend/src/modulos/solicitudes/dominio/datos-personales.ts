/**
 * Detección de datos personales evidentes en el texto libre de una solicitud (FR-315, FR-316 y FR-348). Función pura: devuelve qué se detectó y nunca registra
 * ni devuelve el texto. Los criterios son los de la sección «Criterios verificables de datos personales» de la especificación. Ningún mensaje promete
 * que el texto esté protegido o verificado: la plataforma no puede garantizarlo.
 */
export type CodigoDeteccion = 'POSIBLE_CORREO' | 'POSIBLE_ENLACE_O_MENSAJERIA' | 'POSIBLE_TELEFONO' | 'POSIBLE_DOCUMENTO' | 'POSIBLE_DIRECCION';

/** Detecciones que bloquean una solicitud publicada. Las demás solo advierten. */
export const deteccionesBloqueantes: readonly CodigoDeteccion[] = ['POSIBLE_CORREO', 'POSIBLE_ENLACE_O_MENSAJERIA', 'POSIBLE_TELEFONO'];

export interface Deteccion { readonly codigo: CodigoDeteccion; readonly campo: string }
export interface AnalisisDeTexto { readonly rechazos: readonly Deteccion[]; readonly advertencias: readonly Deteccion[] }

const correo = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+/u;
/** Dirección completa, con su dominio: se retira antes de buscar enlaces para no contar `juan@correo.com` también como enlace. */
const correoCompleto = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*/gu;
const enlace = [/https?:\/\//i, /\bwww\./i, /\bwa\.me\b/i, /\bt\.me\b/i, /\bwhatsapp\b/i, /\btelegram\b/i, /\b[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.(?:com|pe|net|org)\b/iu];
const documento = /\b(?:DNI|documento|RUC)\b[^\d\n]{0,6}(?:\d{11}|\d{8})(?!\d)/giu;
const direccion = [/\b(?:Jr|Av|Psje|Mz|Lt)\.\s*[\p{L}\p{N}]/iu, /\bCalle\s+[\p{L}\p{N}]/iu];
/** Posible número: empieza en un dígito o `+` y admite espacios, guiones, puntos y paréntesis internos. */
const candidato = /\+?\d[\d\s\-.()]*\d|\d/g;
const indicadorMonetario = /(?:S\/\.?|PEN|USD|\$)\s*$/i;
const monedaDespues = /^\s*(?:soles|d[oó]lares)\b/i;
const unidadDespues = /^\s*(?:m²|m2|m\b|cm\b|mm\b|kg\b|l\b|und\b|%)/i;

function hayTelefono(texto: string): boolean {
  for (const m of texto.matchAll(candidato)) {
    const digitos = m[0].replace(/\D/g, '');
    if (digitos.length < 9) continue;
    const antes = texto.slice(0, m.index);
    const despues = texto.slice(m.index + m[0].length);
    // Exentos: montos con indicador monetario, medidas con unidad y porcentajes.
    if (indicadorMonetario.test(antes) || monedaDespues.test(despues) || unidadDespues.test(despues)) continue;
    return true;
  }
  return false;
}

/** Analiza un texto. `campo` solo etiqueta el resultado. */
export function detectarDatosPersonales(texto: string, campo: string): readonly Deteccion[] {
  const hallazgos: CodigoDeteccion[] = [];
  if (correo.test(texto)) hallazgos.push('POSIBLE_CORREO');
  const sinCorreos = texto.replace(correoCompleto, ' ');
  if (enlace.some(r => r.test(sinCorreos))) hallazgos.push('POSIBLE_ENLACE_O_MENSAJERIA');
  // Los dígitos de un documento no se cuentan además como teléfono.
  const sinDocumentos = texto.replace(documento, ' ');
  if (sinDocumentos !== texto) hallazgos.push('POSIBLE_DOCUMENTO');
  if (hayTelefono(sinDocumentos)) hallazgos.push('POSIBLE_TELEFONO');
  if (direccion.some(r => r.test(texto))) hallazgos.push('POSIBLE_DIRECCION');
  return hallazgos.map(codigo => ({ codigo, campo }));
}

/**
 * Clasifica las detecciones de varios campos. En una solicitud publicada, el correo, el enlace o mensajería y el teléfono se rechazan; el documento y la dirección
 * solo advierten. En una dirigida o un borrador, todo advierte.
 */
export function analizarTextos(campos: Readonly<Record<string, string | null | undefined>>, bloquea: boolean): AnalisisDeTexto {
  const rechazos: Deteccion[] = []; const advertencias: Deteccion[] = [];
  for (const [campo, texto] of Object.entries(campos)) {
    if (!texto) continue;
    for (const d of detectarDatosPersonales(texto, campo)) (bloquea && deteccionesBloqueantes.includes(d.codigo) ? rechazos : advertencias).push(d);
  }
  return { rechazos, advertencias };
}

/** Mensajes que no afirman protección ni verificación del texto libre. */
export const mensajesDeDeteccion: Readonly<Record<CodigoDeteccion, string>> = {
  POSIBLE_CORREO: 'Parece incluir un correo electrónico. Considere quitarlo: la plataforma no puede garantizar quién lee este texto.',
  POSIBLE_ENLACE_O_MENSAJERIA: 'Parece incluir un enlace o una referencia a mensajería. Considere quitarlo: la plataforma no puede garantizar quién lee este texto.',
  POSIBLE_TELEFONO: 'Parece incluir un número de teléfono. Considere quitarlo: la plataforma no puede garantizar quién lee este texto.',
  POSIBLE_DOCUMENTO: 'Parece incluir un número de documento. Considere quitarlo: la plataforma no puede garantizar quién lee este texto.',
  POSIBLE_DIRECCION: 'Parece incluir una dirección. Considere quitarla: la plataforma no puede garantizar quién lee este texto.',
};
