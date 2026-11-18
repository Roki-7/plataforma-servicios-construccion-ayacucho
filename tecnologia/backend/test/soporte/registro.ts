import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { cargarLocal } from '../../scripts/entorno.js';
import { cargarConfiguracion } from '../../src/composicion/configuracion.js';
import { crearAplicacion } from '../../src/composicion/app.module.js';
import { persistenciaFundacional } from '../../src/composicion/persistencia.js';
import { PRIVACIDAD_VERSION } from '../../src/modulos/usuarios-acceso/dominio/cuenta.js';
import { baseAislada } from './postgres.js';
export const origen = 'https://localhost:8443';
export const registroValido = () => ({ nombreMostrar: 'Empresa ficticia', correo: `${randomUUID()}@example.invalid`, contrasena: ' una frase privada de prueba ', confirmacionContrasena: ' una frase privada de prueba ', perfiles: ['cliente'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: PRIVACIDAD_VERSION });
export async function entornoRegistro(opciones: { registrarDiagnostico?: (linea: string) => void } = {}) {
  cargarLocal(); const config = cargarConfiguracion(); const aislada = await baseAislada(persistenciaFundacional, config.databaseUrl);
  const sistema = await crearAplicacion({ ...config, databaseUrl: aislada.db.options.type === 'postgres' ? String(aislada.db.options.url) : '' }, { worker: false, ...opciones });
  await sistema.app.listen(0, '127.0.0.1');
  const post = (ruta: string, cuerpo: object | undefined, clave = randomUUID(), token?: string) => { const peticion = request(sistema.app.getHttpServer()).post('/api/v1' + ruta).set('Origin', origen).set('Idempotency-Key', clave); if (token) peticion.set('Authorization', `Bearer ${token}`); return peticion.send(cuerpo); };
  const borrarSesion = (token?: string) => { const r = request(sistema.app.getHttpServer()).delete('/api/v1/sesiones/actual').set('Origin', origen); if (token) r.set('Authorization', `Bearer ${token}`); return r; };
  return { ...sistema, post, borrarSesion, cerrar: async () => { await sistema.app.close(); await aislada.cerrar(); } };
}
