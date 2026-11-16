import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { open, readFile, stat } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import type { CatalogoContrasenasRechazadas } from '../../aplicacion/puertos/puertos.js';
import { dependenciaNoDisponible } from '../../dominio/errores.js';
import { textoUnicode } from '../../dominio/identificadores.js';

interface ArchivoCatalogo { archivo: string; sha256: string }
interface Manifiesto {
  version: string; fecha: string; tipo: 'fixture' | 'completo'; aprobado: boolean;
  comunes: ArchivoCatalogo; comprometidas: ArchivoCatalogo & { registros: number };
}
export async function checksumArchivo(ruta: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const bloque of createReadStream(ruta)) hash.update(bloque as Buffer);
  return hash.digest('hex');
}
export class CatalogoLocal implements CatalogoContrasenasRechazadas {
  private lista: Set<string> | undefined;
  private rutaHashes = '';
  private cantidad = 0;
  private archivos: { ruta: string; size: number; mtimeMs: number }[] = [];
  constructor(private readonly manifiesto: string, private readonly validacion: boolean) {}
  private ruta(archivo: string): string {
    const base = resolve(dirname(this.manifiesto)); const destino = resolve(base, archivo);
    if (!destino.startsWith(base + sep)) throw dependenciaNoDisponible();
    return destino;
  }
  async inicializar(): Promise<void> {
    this.lista = undefined; this.archivos = [];
    try {
      const antesManifiesto = await stat(this.manifiesto);
      const m = JSON.parse(await readFile(this.manifiesto, 'utf8')) as Manifiesto;
      const despuesManifiesto = await stat(this.manifiesto);
      if (antesManifiesto.size !== despuesManifiesto.size || antesManifiesto.mtimeMs !== despuesManifiesto.mtimeMs) throw dependenciaNoDisponible();
      this.archivos.push({ ruta: this.manifiesto, size: despuesManifiesto.size, mtimeMs: despuesManifiesto.mtimeMs });
      if (!m.version || !Number.isFinite(Date.parse(m.fecha)) || !m.aprobado || !['fixture', 'completo'].includes(m.tipo) || (!this.validacion && m.tipo !== 'completo')) throw dependenciaNoDisponible();
      const comunes = this.ruta(m.comunes.archivo); const hashes = this.ruta(m.comprometidas.archivo);
      for (const [ruta, esperado] of [[comunes, m.comunes.sha256], [hashes, m.comprometidas.sha256]] as const) {
        const antes = await stat(ruta);
        if (!/^[a-f0-9]{64}$/.test(esperado) || await checksumArchivo(ruta) !== esperado) throw dependenciaNoDisponible();
        const despues = await stat(ruta);
        if (antes.size !== despues.size || antes.mtimeMs !== despues.mtimeMs) throw dependenciaNoDisponible();
        this.archivos.push({ ruta, size: despues.size, mtimeMs: despues.mtimeMs });
      }
      const lista: unknown = JSON.parse(await readFile(comunes, 'utf8'));
      if (!Array.isArray(lista) || lista.length === 0 || !lista.every((s): s is string => typeof s === 'string' && s.isWellFormed())) throw dependenciaNoDisponible();
      let anterior = ''; let cantidad = 0;
      for await (const linea of createInterface({ input: createReadStream(hashes), crlfDelay: Infinity })) {
        if (!/^[A-F0-9]{40}$/.test(linea) || (cantidad > 0 && linea <= anterior)) throw dependenciaNoDisponible();
        anterior = linea; cantidad++;
      }
      if (!Number.isSafeInteger(m.comprometidas.registros) || cantidad < 1 || cantidad !== m.comprometidas.registros || (await stat(hashes)).size !== cantidad * 41) throw dependenciaNoDisponible();
      this.lista = new Set(lista); this.rutaHashes = hashes; this.cantidad = cantidad;
    } catch { this.lista = undefined; throw dependenciaNoDisponible(); }
  }
  async preparada(): Promise<boolean> {
    if (!this.lista) return false;
    try { for (const a of this.archivos) { const actual = await stat(a.ruta); if (actual.size !== a.size || actual.mtimeMs !== a.mtimeMs) { this.lista = undefined; return false; } } return true; }
    catch { this.lista = undefined; return false; }
  }
  async rechazada(contrasena: string): Promise<boolean> {
    textoUnicode(contrasena, 128);
    if (!await this.preparada() || !this.lista) throw dependenciaNoDisponible();
    if (this.lista.has(contrasena)) return true;
    // SHA-1 se usa exclusivamente para buscar el corpus, nunca como credencial.
    const buscado = createHash('sha1').update(contrasena, 'utf8').digest('hex').toUpperCase();
    const archivo = await open(this.rutaHashes, 'r');
    try {
      let inferior = 0; let superior = this.cantidad;
      while (inferior < superior) {
        const medio = Math.floor((inferior + superior) / 2); const buffer = Buffer.alloc(41);
        const leido = await archivo.read(buffer, 0, 41, medio * 41);
        if (leido.bytesRead !== 41 || buffer[40] !== 10) throw dependenciaNoDisponible();
        const actual = buffer.subarray(0, 40).toString('ascii');
        if (actual === buscado) return true;
        if (actual < buscado) inferior = medio + 1; else superior = medio;
      }
      return false;
    } finally { await archivo.close(); }
  }
}
