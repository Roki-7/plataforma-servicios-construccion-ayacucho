import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ProteccionCsrf } from '../../aplicacion/puertos/sesiones.js';
export class CsrfHmac implements ProteccionCsrf {
  constructor(private readonly claves: ReadonlyMap<string, Buffer>, private readonly actual: string) { if (!claves.has(actual)) throw new Error('Falta clave CSRF.'); }
  private mac(renovacion: string, clave: Buffer): string { return createHmac('sha256', clave).update('usuarios-acceso:renovacion:csrf\0').update(renovacion).digest('base64url'); }
  emitir(renovacion: string): string { return `${this.actual}.${this.mac(renovacion, this.claves.get(this.actual)!)}`; }
  verificar(csrf: string | undefined, renovacion: string): boolean { if (!csrf || csrf.length > 100) return false; const [id, valor, extra] = csrf.split('.'); const clave = id ? this.claves.get(id) : undefined; if (!clave || !valor || extra !== undefined) return false; const esperado = Buffer.from(this.mac(renovacion, clave)); const presentado = Buffer.from(valor); return esperado.length === presentado.length && timingSafeEqual(esperado, presentado); }
}
