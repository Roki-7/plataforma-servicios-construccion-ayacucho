import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { crearImagen, marcadorSensible, pngDeTamano } from '../test/soporte/prestadores-catalogo/imagenes.js';
import { local } from './entorno.js';

/**
 * T076 · Corpus de imágenes FICTICIAS para los recorridos de navegador de HU03 (CA-PRE-04 a CA-PRE-08). Se escribe solo dentro de tecnologia/.local/evidencia/002
 * (carpeta indicada con --salida) y se retira al terminar la serie. Contiene archivos válidos en los límites, formatos reales no permitidos con extensión de imagen,
 * archivos que superan los límites y una fotografía con coordenadas GPS y un marcador sensible de prueba.
 */
const salida = process.argv.find((a) => a.startsWith('--salida='))?.slice('--salida='.length);
try {
  if (!salida) throw new Error('Falta --salida=<carpeta>.');
  const destino = resolve(salida); const desplazamiento = relative(resolve(local, 'evidencia/002'), destino);
  if (isAbsolute(desplazamiento) || desplazamiento === '..' || desplazamiento.startsWith(`..${sep}`)) throw new Error('El corpus debe escribirse dentro de tecnologia/.local/evidencia/002.');
  await mkdir(destino, { recursive: true });
  const plano = async (ancho: number, alto: number, formato: 'png' | 'jpeg' | 'webp', color: string) => {
    const base = sharp({ create: { width: ancho, height: alto, channels: 3, background: color } });
    return formato === 'png' ? base.png().toBuffer() : formato === 'jpeg' ? base.jpeg().toBuffer() : base.webp().toBuffer();
  };
  const archivos: Record<string, Buffer> = {
    'valida.jpg': await crearImagen({ formato: 'jpeg', ancho: 240, alto: 160, color: '#2e7d32' }),
    'valida.png': await crearImagen({ formato: 'png', ancho: 240, alto: 160, color: '#1565c0' }),
    'valida.webp': await crearImagen({ formato: 'webp', ancho: 240, alto: 160, color: '#6a1b9a' }),
    'sensible.jpg': await crearImagen({ formato: 'jpeg', sensible: true, ancho: 200, alto: 100, color: '#cc3300' }),
    'reemplazo.png': await crearImagen({ formato: 'png', ancho: 180, alto: 120, color: '#ef6c00' }),
    'reemplazo-sensible.jpg': await crearImagen({ formato: 'jpeg', sensible: true, ancho: 220, alto: 140, color: '#00838f' }),
    // Dentro de ambos límites: 4096 px por lado exactos y 10 000 000 bytes exactos.
    'limite-4096.png': await plano(4096, 4096, 'png', '#455a64'),
    'limite-10mb.png': await pngDeTamano(10_000_000),
    // Formatos reales no permitidos con extensión de imagen.
    'gif-con-extension.jpg': await crearImagen({ formato: 'gif' }),
    'tiff-con-extension.png': await crearImagen({ formato: 'tiff' }),
    // Superan los límites.
    'mayor-10mb.png': await pngDeTamano(10_000_001),
    'ancho-4097.png': await plano(4097, 8, 'png', '#8d6e63'),
    'alto-4097.png': await plano(8, 4097, 'png', '#8d6e63'),
  };
  const manifiesto: Record<string, { bytes: number; sha256: string; ancho?: number | undefined; alto?: number | undefined; formato?: string | undefined }> = {};
  for (const [nombre, datos] of Object.entries(archivos)) {
    await writeFile(resolve(destino, nombre), datos);
    const meta = await sharp(datos).metadata().catch(() => ({} as sharp.Metadata));
    manifiesto[nombre] = { bytes: datos.length, sha256: createHash('sha256').update(datos).digest('hex'), ancho: meta.width, alto: meta.height, formato: meta.format };
  }
  await writeFile(resolve(destino, 'manifiesto.json'), JSON.stringify({ marcadorSensible, archivos: manifiesto }, null, 2));
  process.stdout.write(`Corpus de ${Object.keys(archivos).length} imágenes ficticias generado.\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo generar el corpus de imágenes.'}\n`);
  process.exitCode = 1;
}
