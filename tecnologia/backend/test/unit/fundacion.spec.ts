import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import sharp from 'sharp';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GuardSesion, SesionRequerida } from '../../src/modulos/usuarios-acceso/presentacion/guard-sesion.js';
import type { IdentidadAutenticada } from '../../src/modulos/usuarios-acceso/aplicacion/puertos/puertos.js';
import { dependenciaNoDisponible } from '../../src/compartido/dominio/errores.js';
import { HashArgon2id } from '../../src/modulos/usuarios-acceso/infraestructura/seguridad/argon2id.js';
import { CatalogoLocal } from '../../src/modulos/usuarios-acceso/infraestructura/seguridad/catalogo-contrasenas.js';
import { SecretosCrypto } from '../../src/modulos/usuarios-acceso/infraestructura/seguridad/crypto.js';
import { exigirTitularidad } from '../../src/modulos/usuarios-acceso/dominio/politica-acceso.js';
import { idCuenta } from '../../src/modulos/usuarios-acceso/dominio/identificadores.js';
import { jsonCanonico } from '../../src/compartido/infraestructura/idempotencia.js';
import { CifradoOutbox } from '../../src/modulos/notificaciones/infraestructura/outbox.js';
import { validarImagen } from '../../src/modulos/usuarios-acceso/infraestructura/almacenamiento/fotografias-s3.js';
import { eventoPeticion } from '../../src/compartido/infraestructura/http/logs-seguros.js';
import { cargarConfiguracion } from '../../src/composicion/configuracion.js';
import { cargarLocal, local } from '../../scripts/entorno.js';

describe('Fundación: seguridad y adaptadores puros, sin escenarios de historias', () => {
  test('Argon2id procesa 128 puntos de código y distingue el sufijo posterior al byte 72', async () => {
    const hash = new HashArgon2id(); const clave = '🔐'.repeat(127) + 'a'; const otra = '🔐'.repeat(127) + 'b';
    const phc = await hash.crear(clave); const segundo = await hash.crear(clave);
    expect(phc.startsWith('$argon2id$v=19$m=65536,t=3,p=4$')).toBe(true);
    expect(phc === segundo).toBe(false);
    expect(await hash.verificar(clave, phc)).toBe(true); expect(await hash.verificar(otra, phc)).toBe(false);
    await expect(hash.crear('a'.repeat(14))).rejects.toMatchObject({ codigo: 'CONTRASENA_NO_ADMITIDA' });
    await expect(hash.crear('a'.repeat(129))).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(hash.verificar('\ud800', phc)).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    const espacios = '  frase ficticia con espacios  '; const phcEspacios = await hash.crear(espacios);
    expect(await hash.verificar(espacios, phcEspacios)).toBe(true); expect(await hash.verificar(espacios.trim(), phcEspacios)).toBe(false);
  });
  test('Identidad, perfil y titularidad deben concurrir; ambos perfiles no permiten acceso ajeno', () => {
    const a = idCuenta(randomUUID()); const b = idCuenta(randomUUID());
    expect(() => exigirTitularidad(a, a, ['cliente'])).not.toThrow();
    expect(() => exigirTitularidad(a, b, ['cliente', 'prestador'])).toThrow();
    expect(() => exigirTitularidad(a, a, ['cliente'], 'prestador')).toThrow();
    expect(() => idCuenta('no-es-uuid')).toThrow();
  });
  test('Secretos opacos tienen 32 bytes y se verifican con digest sin conservar el secreto', () => {
    const crypto = new SecretosCrypto(); const uno = crypto.secreto(); const dos = crypto.secreto();
    expect(uno.length).toBe(43); expect(Buffer.from(uno, 'base64url').length).toBe(32);
    expect(uno === dos).toBe(false); expect(crypto.digest(uno).length).toBe(32);
  });
  test('Guard exige Bearer y lectura vigente; una falla de DB no concede acceso', async () => {
    class Protegida { @SesionRequerida() entrada() {} }
    const identidad: IdentidadAutenticada = { cuentaId: idCuenta(randomUUID()), sesionId: randomUUID(), perfiles: ['cliente'], autenticadaConContrasenaEn: null, versionSesion: 1n };
    const req: { headers: { authorization?: string }; identidad?: IdentidadAutenticada } = { headers: {} };
    const contexto = { getHandler: () => Protegida.prototype.entrada, getClass: () => Protegida, switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    const guard = new GuardSesion({ leer: async () => identidad }, new Reflector());
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({ http: 401, codigo: 'NO_AUTENTICADO' });
    req.headers.authorization = `Bearer ${randomBytes(32).toString('base64url')}`;
    expect(await guard.canActivate(contexto)).toBe(true); expect(req.identidad).toBe(identidad);
    await expect(new GuardSesion({ leer: async () => null }, new Reflector()).canActivate(contexto)).rejects.toMatchObject({ http: 401, codigo: 'SESION_NO_VALIDA' });
    await expect(new GuardSesion({ leer: async () => { throw dependenciaNoDisponible(); } }, new Reflector()).canActivate(contexto)).rejects.toMatchObject({ http: 503 });
  });
  test('Canonización conserva diferencias del cuerpo completo y rechaza valores no JSON', () => {
    expect(jsonCanonico({ b: 2, a: ' a ' })).toBe(jsonCanonico({ a: ' a ', b: 2 }));
    expect(jsonCanonico({ a: ' a ' }) === jsonCanonico({ a: 'a' })).toBe(false);
    expect(() => jsonCanonico(Number.NaN)).toThrow();
  });
  test('AEAD vincula el payload con id y destinatario; un cambio se rechaza', () => {
    const cifrado = new CifradoOutbox(new Map([['v1', randomBytes(32)]]), 'v1'); const id = randomUUID();
    const bytes = cifrado.cifrar(id, 'titular@example.invalid', { asunto: 'Aviso ficticio', texto: 'Enlace ficticio exclusivo de validación.' });
    expect(bytes.includes(Buffer.from('Enlace ficticio'))).toBe(false);
    expect(cifrado.descifrar(id, 'titular@example.invalid', 'v1', bytes).asunto).toBe('Aviso ficticio');
    expect(() => cifrado.descifrar(id, 'otra@example.invalid', 'v1', bytes)).toThrow();
    const alterado = Buffer.from(bytes); alterado[28] = (alterado[28] ?? 0) ^ 1;
    expect(() => cifrado.descifrar(id, 'titular@example.invalid', 'v1', alterado)).toThrow();
  });
  test('Fotos: decoder real, contenido disfrazado, base64 y límite de bytes', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#123456' } }).png().toBuffer();
    expect((await validarImagen(png.toString('base64'), 'image/png')).equals(png)).toBe(true);
    await expect(validarImagen(png.toString('base64'), 'image/jpeg')).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(validarImagen(Buffer.from('%PDF-1.7').toString('base64'), 'image/png')).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(validarImagen('!?', 'image/png')).rejects.toMatchObject({ codigo: 'DATOS_INVALIDOS' });
    await expect(validarImagen(Buffer.alloc(10000001).toString('base64'), 'image/png')).rejects.toMatchObject({ codigo: 'ARCHIVO_DEMASIADO_GRANDE' });
  });
  test('Logs conservan únicamente el patrón, sin secretos ni URL desconocida', () => {
    const evento = eventoPeticion('POST', '/recuperaciones/{token}', 422);
    expect(JSON.parse(evento)).toEqual({ metodo: 'POST', ruta: '/recuperaciones/:redactado', http: 422 });
    expect(JSON.parse(eventoPeticion('GET', undefined, 404)).ruta).toBe('ruta_no_catalogada');
  });
  test('Catálogo verifica integridad, consulta completa y rechaza fixture en producción', async () => {
    cargarLocal(); const config = cargarConfiguracion(); const c = new CatalogoLocal(config.catalogo, true); await c.inicializar();
    expect(await c.rechazada('passwordpassword')).toBe(true); expect(await c.rechazada('comprometida ficticia 001')).toBe(true);
    expect(await c.rechazada('control permitido ficticio 001')).toBe(false);
    await expect(new CatalogoLocal(config.catalogo, false).inicializar()).rejects.toMatchObject({ codigo: 'DEPENDENCIA_NO_DISPONIBLE' });
    await expect(new CatalogoLocal(resolve(local, 'ausente.json'), true).inicializar()).rejects.toMatchObject({ codigo: 'DEPENDENCIA_NO_DISPONIBLE' });
    const carpetaBase = resolve(local, 'pruebas'); await mkdir(carpetaBase, { recursive: true }); const carpeta = await mkdtemp(resolve(carpetaBase, 'catalogo-'));
    const m = JSON.parse(await readFile(config.catalogo, 'utf8')) as { comunes: { archivo: string }; comprometidas: { archivo: string } };
    for (const f of [m.comunes.archivo, m.comprometidas.archivo]) await writeFile(resolve(carpeta, f), await readFile(resolve(config.catalogo, '..', f)));
    await writeFile(resolve(carpeta, 'manifest.json'), JSON.stringify(m));
    const copia = new CatalogoLocal(resolve(carpeta, 'manifest.json'), true); await copia.inicializar();
    await writeFile(resolve(carpeta, 'manifest.json'), '{}'); expect(await copia.preparada()).toBe(false);
    await writeFile(resolve(carpeta, 'manifest.json'), JSON.stringify(m));
    await writeFile(resolve(carpeta, m.comprometidas.archivo), 'CORRUPTO\n');
    await expect(new CatalogoLocal(resolve(carpeta, 'manifest.json'), true).inicializar()).rejects.toMatchObject({ codigo: 'DEPENDENCIA_NO_DISPONIBLE' });
  });
  test('Configuración impide fixture productivo y claves AEAD/HMAC compartidas', () => {
    cargarLocal(); const config = cargarConfiguracion(); expect(config.validacion).toBe(true);
    expect(() => cargarConfiguracion({ ...process.env, NODE_ENV: 'production', VALIDATION_MODE: 'true' })).toThrow();
    expect(() => cargarConfiguracion({ ...process.env, AEAD_KEYS_JSON: process.env['HMAC_KEYS_JSON'] })).toThrow();
  });
});
