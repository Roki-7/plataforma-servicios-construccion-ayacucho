import { archivoDemasiadoGrande, imagenDimensionesNoAdmitidas, imagenFormatoNoAdmitido } from './errores.js';
import { limitesDeArchivos } from './tipos.js';

/** Formatos reales admitidos y su tipo MIME. El formato real manda sobre la extensión y sobre el tipo declarado. */
export const formatosDeImagenAdmitidos = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

export interface DescripcionDeImagen {
  readonly mimeDeclarado: string;
  readonly formatoReal: string | undefined;
  readonly ancho: number;
  readonly alto: number;
  readonly bytes: number;
}

/** Política de imágenes de una solicitud (FR-317 a FR-323): vacía, demasiado grande, formato real no admitido o no coincidente, o con más de 4 096 px por lado. */
export function exigirImagenAdmitida(imagen: DescripcionDeImagen): void {
  if (imagen.bytes <= 0) throw imagenFormatoNoAdmitido('El archivo está vacío.');
  if (imagen.bytes > limitesDeArchivos.bytesMaximosPorImagen) throw archivoDemasiadoGrande();
  const real = imagen.formatoReal ? (formatosDeImagenAdmitidos as Record<string, string>)[imagen.formatoReal] : undefined;
  if (!real) throw imagenFormatoNoAdmitido('El formato real del archivo no es JPG, PNG ni WEBP.');
  if (real !== imagen.mimeDeclarado) throw imagenFormatoNoAdmitido('El tipo declarado no coincide con el contenido.', 'tipoMime');
  if (imagen.ancho > limitesDeArchivos.ladoMaximo || imagen.alto > limitesDeArchivos.ladoMaximo) throw imagenDimensionesNoAdmitidas();
}
