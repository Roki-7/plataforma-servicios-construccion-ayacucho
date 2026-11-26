import { describe, expect, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { crc32 } from 'node:zlib';
import sharp from 'sharp';
import { SaneadorSharpSolicitudes } from '../../../src/modulos/solicitudes/infraestructura/archivos/sanear-imagen.js';

// T038 · saneador propio de imágenes de solicitudes. Formato real manda sobre el declarado; recodifica a WebP sin metadatos.
const saneador = new SaneadorSharpSolicitudes();
const b64 = (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64');
const lienzo = (ancho: number, alto: number) => sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 200, g: 120, b: 40 } } });
const jpeg = (ancho = 64, alto = 48) => lienzo(ancho, alto).jpeg().toBuffer();
const png = (ancho = 64, alto = 48) => lienzo(ancho, alto).png().toBuffer();
const webp = (ancho = 64, alto = 48) => lienzo(ancho, alto).webp().toBuffer();
const codigo = async (promesa: Promise<unknown>) => { const e = await promesa.then(() => undefined, (x: unknown) => x as { codigo?: string; http?: number }); return e ? [e.http, e.codigo] : undefined; };

/** JPEG válido de exactamente `bytes` bytes: se rellena con segmentos de comentario (COM), que cualquier decodificador ignora. */
async function jpegDeTamano(bytes: number): Promise<Buffer> {
  const base = await jpeg(); let falta = bytes - base.length; const partes: Buffer[] = [];
  while (falta > 0) {
    let segmento = Math.min(falta, 65537); // marcador (2) + longitud (2) + hasta 65 533 de datos
    if (falta - segmento > 0 && falta - segmento < 4) segmento = falta - 4; // el resto debe poder alojar otro segmento
    const cabecera = Buffer.alloc(4); cabecera.writeUInt16BE(0xfffe, 0); cabecera.writeUInt16BE(segmento - 2, 2);
    partes.push(cabecera, Buffer.alloc(segmento - 4, 0x20)); falta -= segmento;
  }
  const salida = Buffer.concat([base.subarray(0, 2), ...partes, base.subarray(2)]);
  expect(salida.length).toBe(bytes);
  return salida;
}
/** PNG cuyo encabezado declara dimensiones enormes con un contenido minúsculo (bomba de píxeles). */
function pngBomba(ancho: number, alto: number): Buffer {
  const trozo = (tipo: string, datos: Buffer) => { const cab = Buffer.alloc(4); cab.writeUInt32BE(datos.length, 0); const t = Buffer.from(tipo, 'ascii'); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, datos])) >>> 0, 0); return Buffer.concat([cab, t, datos, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(ancho, 0); ihdr.writeUInt32BE(alto, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', ihdr), trozo('IDAT', Buffer.from([0x78, 0x9c, 0x03, 0x00, 0x00, 0x00, 0x00, 0x01])), trozo('IEND', Buffer.alloc(0))]);
}

describe('formato real', () => {
  test.each([['image/jpeg', jpeg], ['image/png', png], ['image/webp', webp]] as const)('acepta %s y lo recodifica a WebP', async (mime, fabrica) => {
    const r = await saneador.sanear(b64(await fabrica()), mime);
    const meta = await sharp(r.bytes).metadata();
    expect(meta.format).toBe('webp');
    expect([r.ancho, r.alto]).toEqual([64, 48]);
    expect([meta.width, meta.height]).toEqual([64, 48]);
  });
  test('rechaza un PDF aunque se declare como imagen', async () => {
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
    for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) expect(await codigo(saneador.sanear(b64(pdf), mime))).toEqual([422, 'IMAGEN_FORMATO_NO_ADMITIDO']);
  });
  test('rechaza un formato falso: texto con extensión de imagen, GIF y bytes aleatorios', async () => {
    expect(await codigo(saneador.sanear(b64(Buffer.from('esto no es una imagen, solo texto plano')), 'image/png'))).toEqual([422, 'IMAGEN_FORMATO_NO_ADMITIDO']);
    expect(await codigo(saneador.sanear(b64(await lienzo(8, 8).gif().toBuffer()), 'image/gif'))).toEqual([422, 'IMAGEN_FORMATO_NO_ADMITIDO']);
    expect(await codigo(saneador.sanear(b64(Buffer.alloc(200, 7)), 'image/jpeg'))).toEqual([422, 'IMAGEN_FORMATO_NO_ADMITIDO']);
  });
  test('el formato real manda: un PNG declarado como JPEG se rechaza', async () => {
    expect(await codigo(saneador.sanear(b64(await png()), 'image/jpeg'))).toEqual([422, 'IMAGEN_FORMATO_NO_ADMITIDO']);
  });
  test('una imagen truncada o corrupta se rechaza', async () => {
    const buena = await jpeg(256, 256);
    expect(await codigo(saneador.sanear(b64(buena.subarray(0, Math.floor(buena.length / 2))), 'image/jpeg'))).toEqual([422, 'IMAGEN_FORMATO_NO_ADMITIDO']);
  });
});

describe('Base64', () => {
  test('exige Base64 canónico', async () => {
    const imagen = b64(await png());
    expect(await codigo(saneador.sanear('no es base64!', 'image/png'))).toEqual([400, 'DATOS_INVALIDOS']);
    expect(await codigo(saneador.sanear(imagen.slice(0, -1), 'image/png'))).toEqual([400, 'DATOS_INVALIDOS']);
    expect(await codigo(saneador.sanear(`${imagen}\n`, 'image/png'))).toEqual([400, 'DATOS_INVALIDOS']);
    expect(await codigo(saneador.sanear('', 'image/png'))).toEqual([400, 'DATOS_INVALIDOS']);
  });
});

describe('dimensiones y bomba de píxeles', () => {
  test('hasta 4 096 px por lado se acepta; 4 097 se rechaza con IMAGEN_DIMENSIONES_NO_ADMITIDAS', async () => {
    expect((await saneador.sanear(b64(await png(4096, 1)), 'image/png')).ancho).toBe(1600);
    expect(await codigo(saneador.sanear(b64(await png(4097, 1)), 'image/png'))).toEqual([422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS']);
    expect(await codigo(saneador.sanear(b64(await png(1, 4097)), 'image/png'))).toEqual([422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS']);
  });
  test('4 096 × 4 096 se acepta y se reduce', async () => {
    const r = await saneador.sanear(b64(await jpeg(4096, 4096)), 'image/jpeg');
    expect([r.ancho, r.alto]).toEqual([1600, 1600]);
  }, 60000);
  test('una bomba de píxeles (encabezado con 60 000 × 60 000 y datos mínimos) se rechaza sin decodificarla', async () => {
    const bomba = pngBomba(60000, 60000);
    expect(bomba.length).toBeLessThan(200);
    const inicio = Date.now();
    expect(await codigo(saneador.sanear(b64(bomba), 'image/png'))).toEqual([422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS']);
    expect(Date.now() - inicio).toBeLessThan(2000);
  });
});

describe('tamaño máximo de 10 000 000 bytes', () => {
  test('un archivo de exactamente 10 000 000 bytes se acepta y uno de 10 000 001 devuelve ARCHIVO_DEMASIADO_GRANDE (413)', async () => {
    expect((await saneador.sanear(b64(await jpegDeTamano(10_000_000)), 'image/jpeg')).ancho).toBe(64);
    expect(await codigo(saneador.sanear(b64(await jpegDeTamano(10_000_001)), 'image/jpeg'))).toEqual([413, 'ARCHIVO_DEMASIADO_GRANDE']);
  }, 60000);
  test('un contenido Base64 mucho mayor se rechaza antes de decodificarlo', async () => {
    expect(await codigo(saneador.sanear('A'.repeat(14_000_000), 'image/jpeg'))).toEqual([413, 'ARCHIVO_DEMASIADO_GRANDE']);
  });
});

describe('recodificación sin metadatos y límite de lado', () => {
  test('elimina EXIF y GPS: ni los metadatos ni sus valores sobreviven en los bytes', async () => {
    const original = await lienzo(120, 80).withExif({ IFD0: { Copyright: 'COPYRIGHT-SECRETO-XYZ', Artist: 'ARTISTA-SECRETO' }, IFD3: { GPSLatitudeRef: 'S', GPSLongitudeRef: 'W' } }).jpeg().toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    expect(original.includes(Buffer.from('COPYRIGHT-SECRETO-XYZ'))).toBe(true);
    const r = await saneador.sanear(b64(original), 'image/jpeg');
    const salida = await sharp(r.bytes).metadata();
    expect(salida).toMatchObject({ format: 'webp' });
    expect(salida.exif).toBeUndefined(); expect(salida.xmp).toBeUndefined(); expect(salida.iptc).toBeUndefined(); expect(salida.icc).toBeUndefined();
    expect(Buffer.from(r.bytes).includes(Buffer.from('COPYRIGHT-SECRETO-XYZ'))).toBe(false);
    expect(Buffer.from(r.bytes).includes(Buffer.from('ARTISTA-SECRETO'))).toBe(false);
    expect(Buffer.from(r.bytes).includes(Buffer.from('GPS'))).toBe(false);
  });
  test('aplica la orientación EXIF antes de descartarla', async () => {
    const girada = await lienzo(100, 40).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect((await sharp(girada).metadata()).orientation).toBe(6);
    const r = await saneador.sanear(b64(girada), 'image/jpeg');
    expect([r.ancho, r.alto]).toEqual([40, 100]);
  });
  test('el lado mayor de la variante es de hasta 1 600 px, conservando la proporción, y una imagen pequeña no se amplía', async () => {
    const grande = await saneador.sanear(b64(await jpeg(3000, 2000)), 'image/jpeg');
    expect([grande.ancho, grande.alto]).toEqual([1600, 1067]);
    const alta = await saneador.sanear(b64(await jpeg(1000, 4000)), 'image/jpeg');
    expect([alta.ancho, alta.alto]).toEqual([400, 1600]);
    const chica = await saneador.sanear(b64(await jpeg(300, 200)), 'image/jpeg');
    expect([chica.ancho, chica.alto]).toEqual([300, 200]);
  });
  test('devuelve un único cuadro WebP estático', async () => {
    const r = await saneador.sanear(b64(await png(50, 50)), 'image/png');
    expect((await sharp(r.bytes).metadata()).pages ?? 1).toBe(1);
  });
});

describe('resultado', () => {
  test('el checksum es el SHA-256 de los bytes devueltos y no se devuelve el original', async () => {
    const r = await saneador.sanear(b64(await jpeg()), 'image/jpeg');
    expect(r.checksum).toHaveLength(32);
    expect(Buffer.from(r.checksum).equals(createHash('sha256').update(r.bytes).digest())).toBe(true);
    expect(Object.keys(r).sort()).toEqual(['alto', 'ancho', 'bytes', 'checksum']);
  });
  test('es independiente de Prestadores: no importa nada de ese módulo', () => {
    const fuente = readFileSync(resolve('src/modulos/solicitudes/infraestructura/archivos/sanear-imagen.ts'), 'utf8');
    expect(fuente).not.toMatch(/from\s+['"][^'"]*prestadores/i);
    expect(fuente).not.toMatch(/import\(['"][^'"]*prestadores/i);
  });
});
