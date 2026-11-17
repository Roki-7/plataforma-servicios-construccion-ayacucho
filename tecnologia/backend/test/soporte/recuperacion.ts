import { randomUUID } from 'node:crypto';
import { entornoRegistro } from './registro.js';
export const mensajeRecuperacion = 'Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar el acceso';
export const nuevaContrasena = ' nueva frase privada de recuperacion ';
export const datosRecuperacion = () => ({ nuevaContrasena, confirmacionContrasena: nuevaContrasena, version: 1 });
export type EntornoRecuperacion = Awaited<ReturnType<typeof entornoRegistro>>;
export async function emitirEnlace(e: EntornoRecuperacion, correo: string): Promise<{ token: string; id: string }> {
  await e.post('/recuperaciones', { correo }).expect(202);
  const filas = await e.db.query("SELECT id,destinatario,key_id,payload_cifrado,desafio_id FROM avisos_pendientes WHERE tipo='recuperación' AND destinatario=$1 ORDER BY creado_en DESC,id DESC LIMIT 1", [correo]); const f = filas[0];
  if (!f) throw new Error('Falta enlace ficticio en Outbox.');
  const texto = e.cifrado.descifrar(f.id, f.destinatario, f.key_id, f.payload_cifrado).texto; const token = /#token=([A-Za-z0-9_-]{43})&version=1/.exec(texto)?.[1];
  if (!token) throw new Error('Enlace de recuperación no conforme.');
  return { token, id: f.desafio_id as string };
}
export const claveRecuperacion = () => randomUUID();
