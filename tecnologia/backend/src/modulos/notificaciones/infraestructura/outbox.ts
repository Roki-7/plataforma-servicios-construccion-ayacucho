import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import type { QueryRunner } from 'typeorm';
import type { ContextoTransaccion } from '../../../compartido/aplicacion/transaccion.js';
import type { NotificacionesApi, CorreoSeguridad } from '../api-publica.js';
import { datosInvalidos, dependenciaNoDisponible } from '../../../compartido/dominio/errores.js';
import { registrarFallo } from '../../../compartido/infraestructura/diagnostico-fallos.js';

export class CifradoOutbox {
  constructor(private readonly claves: ReadonlyMap<string, Buffer>, readonly actual: string) { if (!claves.has(actual) || [...claves.values()].some((k) => k.length !== 32)) throw new Error('Claves AEAD no válidas.'); }
  cifrar(id: string, destinatario: string, datos: { asunto: string; texto: string }): Buffer {
    const clave = this.claves.get(this.actual); if (!clave) { registrarFallo('outbox.cifrado', undefined, 'clave_no_disponible'); throw dependenciaNoDisponible(); }
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', clave, iv); cipher.setAAD(Buffer.from(JSON.stringify([id, destinatario])));
    const contenido = Buffer.concat([cipher.update(JSON.stringify(datos), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), contenido]);
  }
  descifrar(id: string, destinatario: string, keyId: string, datos: Buffer): { asunto: string; texto: string } {
    try {
      const clave = this.claves.get(keyId); if (!clave || datos.length < 29) throw dependenciaNoDisponible();
      const decipher = createDecipheriv('aes-256-gcm', clave, datos.subarray(0, 12)); decipher.setAAD(Buffer.from(JSON.stringify([id, destinatario]))); decipher.setAuthTag(datos.subarray(12, 28));
      const contenido: unknown = JSON.parse(Buffer.concat([decipher.update(datos.subarray(28)), decipher.final()]).toString('utf8'));
      if (!contenido || typeof contenido !== 'object' || !('asunto' in contenido) || !('texto' in contenido) || typeof contenido.asunto !== 'string' || typeof contenido.texto !== 'string') throw dependenciaNoDisponible();
      return { asunto: contenido.asunto, texto: contenido.texto };
    } catch { throw dependenciaNoDisponible(); }
  }
}
export class OutboxPostgres implements NotificacionesApi {
  constructor(private readonly resolver: (tx: ContextoTransaccion) => QueryRunner, private readonly cifrado: CifradoOutbox) {}
  async programar(correo: CorreoSeguridad, tx: ContextoTransaccion): Promise<void> {
    if (!correo.destinatario.includes('@') || /[\r\n]/.test(correo.destinatario + correo.asunto) || !correo.claveLogica) throw datosInvalidos();
    const id = randomUUID();
    await this.resolver(tx).query(`INSERT INTO avisos_pendientes(id,tipo,destinatario,payload_cifrado,key_id,desafio_id,vence_en,clave_logica) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(clave_logica) DO NOTHING`,
      [id, correo.tipo, correo.destinatario, this.cifrado.cifrar(id, correo.destinatario, { asunto: correo.asunto, texto: correo.texto }), this.cifrado.actual, correo.desafioId ?? null, correo.venceEn ?? null, correo.claveLogica]);
  }
}
