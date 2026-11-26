import type { DetalleError } from './errores.js';

// Texto plano: sin caracteres de control (salvo saltos de línea en textos largos) ni marcado ejecutable.
// eslint-disable-next-line no-control-regex
const controlMultilinea = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
// eslint-disable-next-line no-control-regex
const controlLinea = /[\u0000-\u001F\u007F]/;
const marcado = /<\s*[a-zA-Z/!?]/;

/** Valida un texto obligatorio de hasta `maximo` caracteres y acumula el motivo del rechazo, sin reflejar el valor recibido. */
export function textoPlano(campo: string, valor: unknown, maximo: number, errores: DetalleError[], multilinea = false): string {
  if (typeof valor !== 'string') { errores.push({ campo, motivo: 'Debe ser texto.' }); return ''; }
  if (valor.trim() === '') errores.push({ campo, motivo: 'Es obligatorio.' });
  else if ([...valor].length > maximo) errores.push({ campo, motivo: `Admite hasta ${maximo} caracteres.` });
  else if ((multilinea ? controlMultilinea : controlLinea).test(valor) || !valor.isWellFormed()) errores.push({ campo, motivo: 'Contiene caracteres no admitidos.' });
  else if (marcado.test(valor)) errores.push({ campo, motivo: 'No admite marcado HTML.' });
  return valor;
}
