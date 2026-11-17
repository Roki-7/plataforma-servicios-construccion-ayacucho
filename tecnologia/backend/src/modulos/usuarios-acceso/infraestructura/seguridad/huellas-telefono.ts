import { createHmac } from 'node:crypto';
import type { HuellasTelefono } from '../../aplicacion/puertos/perfil.js';
import type { IdCuenta } from '../../dominio/identificadores.js';
export class HuellasTelefonoHmac implements HuellasTelefono {
  constructor(private readonly claves: ReadonlyMap<string, Buffer>, private readonly actualId: string) { if (!claves.has(actualId)) throw new Error('Clave de consentimiento no disponible.'); }
  private calcular(clave: Buffer, id: IdCuenta, telefono: string): Uint8Array { return createHmac('sha256',clave).update(JSON.stringify(['consentimiento-telefono:001',id,telefono])).digest(); }
  actual(id: IdCuenta, telefono: string): Uint8Array { return this.calcular(this.claves.get(this.actualId)!,id,telefono); }
  vigentes(id: IdCuenta, telefono: string): readonly Uint8Array[] { return [...this.claves.values()].map(k => this.calcular(k,id,telefono)); }
}
