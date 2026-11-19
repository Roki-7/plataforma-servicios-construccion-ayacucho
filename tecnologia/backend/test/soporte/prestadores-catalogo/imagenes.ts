import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

export type FormatoPrueba = 'jpeg' | 'png' | 'webp' | 'gif' | 'tiff';
export const mimeDe: Record<FormatoPrueba, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', tiff: 'image/tiff' };

export interface OpcionesImagen {
  readonly ancho?: number; readonly alto?: number; readonly formato?: FormatoPrueba; readonly color?: string;
  /** Incluye EXIF con marcadores de GPS y de texto sensible de prueba. */
  readonly sensible?: boolean; readonly orientacion?: number;
}
/** Texto ficticio que debe desaparecer de la variante saneada. */
export const marcadorSensible = 'MARCADOR-SENSIBLE-PRUEBA-002';

export async function crearImagen(o: OpcionesImagen = {}): Promise<Buffer> {
  const { ancho = 64, alto = 48, formato = 'jpeg', color = '#336699', sensible = false, orientacion } = o;
  let img = sharp({ create: { width: ancho, height: alto, channels: 3, background: color } });
  if (sensible && formato === 'jpeg') {
    img = img.withExif({ IFD0: { Copyright: marcadorSensible, ImageDescription: marcadorSensible },
      IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '13/1 9/1 30/1', GPSLongitudeRef: 'W', GPSLongitude: '74/1 13/1 20/1' } });
  }
  if (orientacion) img = img.withMetadata({ orientation: orientacion });
  const salida = formato === 'jpeg' ? img.jpeg() : formato === 'png' ? img.png() : formato === 'webp' ? img.webp() : formato === 'gif' ? img.gif() : img.tiff();
  return salida.toBuffer();
}

/** PNG válido de ruido (incompresible) con exactamente `bytes` bytes. El relleno final se coloca después de IEND. */
export async function pngDeTamano(bytes: number): Promise<Buffer> {
  let lado = Math.floor(Math.sqrt(bytes / 3)) - 40;
  for (;;) {
    const png = await sharp(randomBytes(lado * lado * 3), { raw: { width: lado, height: lado, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    if (png.length <= bytes) return Buffer.concat([png, Buffer.alloc(bytes - png.length)]);
    lado -= 8;
  }
}
export const base64 = (b: Buffer) => b.toString('base64');
