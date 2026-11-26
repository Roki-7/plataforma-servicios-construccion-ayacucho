import { ErrorAplicacion, type DetalleError } from '../../../compartido/dominio/errores.js';
import { textoPlano } from './perfil-profesional.js';

export const limitesPortafolio = {
  trabajosPorPrestador: 10, fotografiasPorTrabajo: 4, fotografiasPorPrestador: 40,
  tituloTrabajo: 120, descripcionTrabajo: 2000,
  bytesMaximos: 10_000_000, ladoMaximo: 4096, ladoVariante: 1600, calidadVariante: 80,
} as const;
export const formatosAdmitidos = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

export interface DatosTrabajo { readonly titulo: string; readonly descripcion: string }
export interface FotografiaPortafolio {
  readonly id: string; readonly trabajoId: string; readonly objetoClave: string;
  readonly ancho: number; readonly alto: number; readonly bytes: number; readonly checksum: Uint8Array;
}
export interface TrabajoAnterior extends DatosTrabajo {
  readonly id: string; readonly prestadorId: string; readonly version: number; readonly fotografias: readonly FotografiaPortafolio[];
}

export function validarDatosTrabajo(entrada: { titulo?: unknown; descripcion?: unknown }, parcial = false): Partial<DatosTrabajo> {
  const errores: DetalleError[] = [];
  const salida: { titulo?: string; descripcion?: string } = {};
  if (!parcial || entrada.titulo !== undefined) salida.titulo = textoPlano('titulo', entrada.titulo, limitesPortafolio.tituloTrabajo, errores).trim();
  if (!parcial || entrada.descripcion !== undefined) salida.descripcion = textoPlano('descripcion', entrada.descripcion, limitesPortafolio.descripcionTrabajo, errores, true).trim();
  if (parcial && entrada.titulo === undefined && entrada.descripcion === undefined) errores.push({ motivo: 'Indique al menos un campo para editar.' });
  if (errores.length) throw new ErrorAplicacion(400, 'DATOS_INVALIDOS', 'Revise los datos enviados.', errores);
  return salida;
}

const limite = (campo: string, motivo: string) => new ErrorAplicacion(422, 'LIMITE_PORTAFOLIO', motivo, [{ campo, motivo }]);
export function exigirCupoTrabajo(trabajosVigentes: number): void {
  if (trabajosVigentes >= limitesPortafolio.trabajosPorPrestador) throw limite('trabajos', `El portafolio admite hasta ${limitesPortafolio.trabajosPorPrestador} trabajos.`);
}
export function exigirCupoFotografia(cuenta: { fotografiasEnTrabajo: number; fotografiasEnPerfil: number }): void {
  if (cuenta.fotografiasEnTrabajo >= limitesPortafolio.fotografiasPorTrabajo) throw limite('fotografias', `Cada trabajo admite hasta ${limitesPortafolio.fotografiasPorTrabajo} fotografías.`);
  if (cuenta.fotografiasEnPerfil >= limitesPortafolio.fotografiasPorPrestador) throw limite('fotografias', `El portafolio admite hasta ${limitesPortafolio.fotografiasPorPrestador} fotografías.`);
}

export interface DescripcionImagen { readonly mimeDeclarado: string; readonly formatoReal: string | undefined; readonly ancho: number; readonly alto: number; readonly bytes: number }
/** Política de archivos: el formato real manda sobre la extensión o el tipo declarado. */
export function exigirImagenAdmitida(imagen: DescripcionImagen): void {
  if (imagen.bytes <= 0) throw new ErrorAplicacion(422, 'IMAGEN_FORMATO_NO_ADMITIDO', 'El archivo está vacío.', [{ campo: 'contenidoBase64', motivo: 'El archivo está vacío.' }]);
  if (imagen.bytes > limitesPortafolio.bytesMaximos) throw new ErrorAplicacion(413, 'ARCHIVO_DEMASIADO_GRANDE', 'La imagen supera 10 MB.', [{ campo: 'contenidoBase64', motivo: 'La imagen supera 10 MB.' }]);
  const real = imagen.formatoReal ? (formatosAdmitidos as Record<string, string>)[imagen.formatoReal] : undefined;
  if (!real) throw new ErrorAplicacion(422, 'IMAGEN_FORMATO_NO_ADMITIDO', 'El formato real del archivo no es JPG, PNG ni WEBP.', [{ campo: 'contenidoBase64', motivo: 'Solo se admiten JPG, PNG y WEBP.' }]);
  if (real !== imagen.mimeDeclarado) throw new ErrorAplicacion(422, 'IMAGEN_FORMATO_NO_ADMITIDO', 'El tipo declarado no coincide con el contenido.', [{ campo: 'tipoMime', motivo: 'El tipo declarado no coincide con el contenido.' }]);
  if (imagen.ancho > limitesPortafolio.ladoMaximo || imagen.alto > limitesPortafolio.ladoMaximo) {
    throw new ErrorAplicacion(422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS', 'La imagen supera 4096 píxeles por lado.', [{ campo: 'contenidoBase64', motivo: 'La imagen supera 4096 píxeles de ancho o alto.' }]);
  }
}
