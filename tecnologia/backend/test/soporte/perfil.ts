import request from 'supertest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { entornoRegistro, origen } from './registro.js';
import { FotografiasS3 } from '../../src/modulos/usuarios-acceso/infraestructura/almacenamiento/fotografias-s3.js';
export async function entornoPerfil() {
  const e = await entornoRegistro();
  const fotosPrueba = new FotografiasS3(e.fotos.cliente, e.fotos.bucket, e.db, e.uow, `pruebas/${randomUUID()}/usuarios/`);
  e.fotos.almacenar = fotosPrueba.almacenar.bind(fotosPrueba); e.fotos.leerPropia = fotosPrueba.leerPropia.bind(fotosPrueba); e.fotos.eliminarObjeto = fotosPrueba.eliminarObjeto.bind(fotosPrueba);
  const get = (token?: string, ruta = '/perfil') => { const r = request(e.app.getHttpServer()).get('/api/v1' + ruta); return token ? r.set('Authorization', `Bearer ${token}`) : r; };
  const patch = (token: string, cuerpo: object, clave = randomUUID()) => request(e.app.getHttpServer()).patch('/api/v1/perfil').set('Origin', origen).set('Authorization', `Bearer ${token}`).set('Idempotency-Key', clave).send(cuerpo);
  return { ...e, fotosPrueba, get, patch, cerrar: async () => { const filas: { objeto_clave: string }[] = await e.db.query('SELECT objeto_clave FROM fotografias_perfil'); for (const f of filas) if (f.objeto_clave.startsWith(fotosPrueba.prefijo)) await fotosPrueba.eliminarObjeto(f.objeto_clave); await e.cerrar(); } };
}
export const imagenPerfil = async () => ({ tipoContenido: 'image/png', contenidoBase64: (await sharp({ create: { width: 2, height: 2, channels: 3, background: 'blue' } }).png().toBuffer()).toString('base64') });
