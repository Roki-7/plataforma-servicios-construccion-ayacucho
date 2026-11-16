import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { GeneradorSecretos, Reloj } from '../../aplicacion/puertos/puertos.js';

export class RelojServidor implements Reloj { ahora(): Date { return new Date(); } }
export class SecretosCrypto implements GeneradorSecretos {
  secreto(): string { return randomBytes(32).toString('base64url'); }
  uuid(): string { return randomUUID(); }
  digest(secreto: string): Uint8Array { return createHash('sha256').update(secreto, 'utf8').digest(); }
}
