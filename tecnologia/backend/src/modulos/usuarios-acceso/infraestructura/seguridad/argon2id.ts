import { argon2id, hash, verify } from 'argon2';
import { randomBytes } from 'node:crypto';
import type { HashContrasena } from '../../aplicacion/puertos/puertos.js';
import { textoUnicode } from '../../dominio/identificadores.js';
import { ErrorAplicacion } from '../../dominio/errores.js';
import { registrarFallo } from '../../../../compartido/infraestructura/diagnostico-fallos.js';

export class HashArgon2id implements HashContrasena {
  private activa = false;
  private readonly pendientes: (() => void)[] = [];
  private async acotado<T>(trabajo: () => Promise<T>): Promise<T> {
    if (this.activa) await new Promise<void>((resolve) => this.pendientes.push(resolve));
    this.activa = true;
    try { return await trabajo(); }
    finally { const siguiente = this.pendientes.shift(); if (siguiente) siguiente(); else this.activa = false; }
  }
  async crear(contrasena: string): Promise<string> {
    textoUnicode(contrasena, 128);
    if ([...contrasena].length < 15) throw new ErrorAplicacion(422, 'CONTRASENA_NO_ADMITIDA', 'La contraseña debe tener entre 15 y 128 caracteres.');
    return this.acotado(async () => { try { return await hash(Buffer.from(contrasena, 'utf8'), { type: argon2id, salt: randomBytes(16), hashLength: 32, memoryCost: 65536, timeCost: 3, parallelism: 4 }); } catch (error) { registrarFallo('contrasena.hash', error); throw error; } });
  }
  async verificar(contrasena: string, phc: string): Promise<boolean> {
    textoUnicode(contrasena, 128);
    if (!phc.startsWith('$argon2id$')) return false;
    return this.acotado(async () => { try { return await verify(phc, Buffer.from(contrasena, 'utf8')); } catch { return false; } });
  }
}
