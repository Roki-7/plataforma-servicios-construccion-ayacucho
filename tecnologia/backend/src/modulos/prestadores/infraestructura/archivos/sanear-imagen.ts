import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ErrorAplicacion } from '../../../../compartido/dominio/errores.js';
import type { ImagenSaneada, SaneadorImagen } from '../../aplicacion/puertos/puertos.js';
import { exigirImagenAdmitida, limitesPortafolio } from '../../dominio/portafolio.js';

// Equivale a 4096 x 4096 con holgura. Evita decodificar una bomba de píxeles aunque su encabezado sea pequeño.
const pixelesMaximos = limitesPortafolio.ladoMaximo * limitesPortafolio.ladoMaximo;
const largoBase64Maximo = Math.ceil(limitesPortafolio.bytesMaximos / 3) * 4;

const formatoNoAdmitido = (motivo: string) => new ErrorAplicacion(422, 'IMAGEN_FORMATO_NO_ADMITIDO', motivo, [{ campo: 'contenidoBase64', motivo }]);

/** Decodifica Base64 canónico. Rechaza el contenido que no se recodifica idéntico. */
export function decodificarBase64Canonico(contenido: string): Buffer {
  if (typeof contenido !== 'string' || contenido.length < 4) throw new ErrorAplicacion(400, 'DATOS_INVALIDOS', 'Base64 no válido.', [{ campo: 'contenidoBase64', motivo: 'Base64 no válido.' }]);
  if (contenido.length > largoBase64Maximo) throw new ErrorAplicacion(413, 'ARCHIVO_DEMASIADO_GRANDE', 'La imagen supera 10 MB.', [{ campo: 'contenidoBase64', motivo: 'La imagen supera 10 MB.' }]);
  if (contenido.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(contenido)) throw new ErrorAplicacion(400, 'DATOS_INVALIDOS', 'Base64 no válido.', [{ campo: 'contenidoBase64', motivo: 'Base64 no válido.' }]);
  const bytes = Buffer.from(contenido, 'base64');
  if (bytes.toString('base64') !== contenido) throw new ErrorAplicacion(400, 'DATOS_INVALIDOS', 'Base64 no válido.', [{ campo: 'contenidoBase64', motivo: 'Base64 no canónico.' }]);
  return bytes;
}

export class SaneadorSharp implements SaneadorImagen {
  async sanear(contenidoBase64: string, mimeDeclarado: string): Promise<ImagenSaneada> {
    const original = decodificarBase64Canonico(contenidoBase64);
    let metadatos: sharp.Metadata;
    try { metadatos = await sharp(original, { failOn: 'error', limitInputPixels: false, animated: false }).metadata(); }
    catch { throw formatoNoAdmitido('El contenido no corresponde a una imagen admitida.'); }
    exigirImagenAdmitida({ mimeDeclarado, formatoReal: metadatos.format, ancho: metadatos.width ?? 0, alto: metadatos.height ?? 0, bytes: original.length });
    if ((metadatos.width ?? 0) * (metadatos.height ?? 0) > pixelesMaximos) throw formatoNoAdmitido('La imagen supera el tamaño admitido.');
    try {
      // `rotate()` aplica la orientación EXIF. No se llama a withMetadata/keepMetadata, por lo que Sharp omite EXIF, GPS, XMP, IPTC e ICC.
      const { data, info } = await sharp(original, { failOn: 'error', limitInputPixels: pixelesMaximos, animated: false })
        .rotate()
        .resize({ width: limitesPortafolio.ladoVariante, height: limitesPortafolio.ladoVariante, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: limitesPortafolio.calidadVariante })
        .toBuffer({ resolveWithObject: true });
      const salida = await sharp(data).metadata();
      if (salida.format !== 'webp' || salida.exif || salida.xmp || salida.iptc || salida.icc || (salida.pages ?? 1) !== 1) throw new Error('Variante no saneada.');
      return { bytes: data, ancho: info.width, alto: info.height, checksum: createHash('sha256').update(data).digest(), original };
    } catch (error) {
      if (error instanceof ErrorAplicacion) throw error;
      throw formatoNoAdmitido('El contenido no corresponde a una imagen admitida.');
    }
  }
}
