import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { ErrorAplicacion } from '../../../../compartido/dominio/errores.js';
import { exigirImagenAdmitida } from '../../dominio/archivos.js';
import { archivoDemasiadoGrande, datosInvalidos, imagenFormatoNoAdmitido } from '../../dominio/errores.js';
import { limitesDeArchivos } from '../../dominio/tipos.js';
import type { ImagenSaneada, SaneadorImagenSolicitud } from '../../aplicacion/puertos/archivos.js';

// Equivale a 4096 × 4096 con holgura. Evita decodificar una bomba de píxeles aunque su encabezado sea pequeño.
const pixelesMaximos = limitesDeArchivos.ladoMaximo * limitesDeArchivos.ladoMaximo;
const largoBase64Maximo = Math.ceil(limitesDeArchivos.bytesMaximosPorImagen / 3) * 4;
const calidadDeLaVariante = 80;

/** Decodifica Base64 canónico. Rechaza el contenido que no se recodifica idéntico y el que supera el tamaño máximo antes de decodificarlo. */
export function decodificarBase64Canonico(contenido: string): Buffer {
  if (typeof contenido !== 'string' || contenido.length < 4) throw datosInvalidos('contenidoBase64', 'Base64 no válido.');
  if (contenido.length > largoBase64Maximo) throw archivoDemasiadoGrande();
  if (contenido.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(contenido)) throw datosInvalidos('contenidoBase64', 'Base64 no válido.');
  const bytes = Buffer.from(contenido, 'base64');
  if (bytes.toString('base64') !== contenido) throw datosInvalidos('contenidoBase64', 'Base64 no canónico.');
  return bytes;
}

/**
 * Saneador propio de la 003. Duplica a propósito el de Prestadores en vez de importar sus internos (constitución: los módulos se consumen solo por su
 * `api-publica`). La duplicación queda registrada como deuda técnica en `implementation-status.md`. Valida el formato real y las dimensiones SIN decodificar
 * los píxeles, recodifica a WebP estático con la orientación aplicada y sin EXIF, GPS, XMP, IPTC ni perfil ICC, y limita el lado mayor a 1 600 px.
 */
export class SaneadorSharpSolicitudes implements SaneadorImagenSolicitud {
  async sanear(contenidoBase64: string, mimeDeclarado: string): Promise<ImagenSaneada> {
    const original = decodificarBase64Canonico(contenidoBase64);
    let metadatos: sharp.Metadata;
    try { metadatos = await sharp(original, { failOn: 'error', limitInputPixels: false, animated: false }).metadata(); }
    catch { throw imagenFormatoNoAdmitido('El contenido no corresponde a una imagen admitida.'); }
    exigirImagenAdmitida({ mimeDeclarado, formatoReal: metadatos.format, ancho: metadatos.width ?? 0, alto: metadatos.height ?? 0, bytes: original.length });
    if ((metadatos.width ?? 0) * (metadatos.height ?? 0) > pixelesMaximos) throw imagenFormatoNoAdmitido('La imagen supera el tamaño admitido.');
    try {
      // `rotate()` aplica la orientación EXIF. No se llama a withMetadata/keepMetadata, por lo que Sharp omite EXIF, GPS, XMP, IPTC e ICC.
      const { data, info } = await sharp(original, { failOn: 'error', limitInputPixels: pixelesMaximos, animated: false })
        .rotate()
        .resize({ width: limitesDeArchivos.ladoVariante, height: limitesDeArchivos.ladoVariante, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: calidadDeLaVariante })
        .toBuffer({ resolveWithObject: true });
      const salida = await sharp(data).metadata();
      if (salida.format !== 'webp' || salida.exif || salida.xmp || salida.iptc || salida.icc || (salida.pages ?? 1) !== 1) throw new Error('Variante no saneada.');
      return { bytes: data, ancho: info.width, alto: info.height, checksum: createHash('sha256').update(data).digest() };
    } catch (error) {
      if (error instanceof ErrorAplicacion) throw error;
      throw imagenFormatoNoAdmitido('El contenido no corresponde a una imagen admitida.');
    }
  }
}
