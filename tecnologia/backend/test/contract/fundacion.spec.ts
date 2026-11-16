import 'reflect-metadata';
import { Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { beforeAll, afterAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { configurarApi } from '../../src/compartido/infraestructura/http/configurar-api.js';
import { ESTADO_SALUD, SaludController } from '../../src/compartido/infraestructura/http/salud.controller.js';
import { cargarContrato, validarRespuesta } from '../soporte/contrato.js';

describe('Contrato fundacional: salud y middleware, sin endpoints de historias', () => {
  let app: INestApplication; let lista = true;
  beforeAll(async () => {
    @Module({ controllers: [SaludController], providers: [{ provide: ESTADO_SALUD, useValue: { disponible: async () => lista } }] }) class ModuloPrueba {}
    app = await NestFactory.create(ModuloPrueba, { logger: false, bodyParser: false });
    await configurarApi(app, { origen: 'https://localhost:8443', contrato: resolve('contracts/openapi.json') }); await app.init();
  });
  afterAll(async () => { await app?.close(); });
  test('El contrato empaquetado coincide con la fuente normativa', async () => {
    expect(JSON.parse(await readFile(resolve('contracts/openapi.json'), 'utf8'))).toEqual(await cargarContrato());
  });
  test('Salud 200 sin secretos y 503 conforme al catálogo de errores', async () => {
    const ok = await request(app.getHttpServer()).get('/api/v1/salud').expect(200);
    await validarRespuesta('Salud', ok.body); expect(ok.headers['cache-control']).toBe('no-store'); expect(ok.headers['set-cookie']).toBeUndefined();
    lista = false;
    const no = await request(app.getHttpServer()).get('/api/v1/salud').expect(503);
    await validarRespuesta('Error', no.body); expect(no.body.codigo).toBe('DEPENDENCIA_NO_DISPONIBLE'); lista = true;
  });
  test('Cuerpo inesperado se rechaza; límite exacto no se confunde con exceso de un byte', async () => {
    await request(app.getHttpServer()).get('/api/v1/salud').set('Content-Type', 'application/json').send('1' + ' '.repeat(65535)).expect(400);
    const demasiado = await request(app.getHttpServer()).get('/api/v1/salud').set('Content-Type', 'application/json').send('1' + ' '.repeat(65536)).expect(413);
    expect(demasiado.body.codigo).toBe('CUERPO_DEMASIADO_GRANDE');
  });
  test('Origin ausente, malformado y ajeno tienen rechazos distintos', async () => {
    const body = { correo: 'ficticio@example.invalid', contrasena: 'clave ficticia de control' };
    const ausente = await request(app.getHttpServer()).post('/api/v1/sesiones').send(body).expect(400); expect(ausente.body.codigo).toBe('CABECERA_REQUERIDA');
    const invalido = await request(app.getHttpServer()).post('/api/v1/sesiones').set('Origin', 'no-es-uri').send(body).expect(400); expect(invalido.body.codigo).toBe('DATOS_INVALIDOS');
    const ajeno = await request(app.getHttpServer()).post('/api/v1/sesiones').set('Origin', 'https://ajeno.example.invalid').send(body).expect(403); expect(ajeno.body.codigo).toBe('ORIGEN_NO_ADMITIDO');
    await request(app.getHttpServer()).post('/api/v1/sesiones').set('Origin', 'https://localhost:8443').send(body).expect(404);
  });
  test('Propiedades extra, Unicode inválido y UUID/token malformados no pasan el middleware', async () => {
    const extra = await request(app.getHttpServer()).post('/api/v1/sesiones').set('Origin', 'https://localhost:8443').send({ correo: 'ficticio@example.invalid', contrasena: 'clave ficticia de control', administrador: true }).expect(400);
    expect(extra.body.codigo).toBe('PROPIEDAD_NO_ADMITIDA');
    await request(app.getHttpServer()).post('/api/v1/sesiones').set('Origin', 'https://localhost:8443').send({ correo: 'ficticio@example.invalid', contrasena: '\ud800' }).expect(400);
    await request(app.getHttpServer()).get('/api/v1/perfil/fotografias/no-es-uuid').expect(400);
    await request(app.getHttpServer()).post('/api/v1/recuperaciones/token-corto').set('Origin', 'https://localhost:8443').set('Idempotency-Key', 'ficticia_1234567890123456').send({ nuevaContrasena: 'clave ficticia de control', confirmacionContrasena: 'clave ficticia de control', version: 1 }).expect(400);
  });
});
