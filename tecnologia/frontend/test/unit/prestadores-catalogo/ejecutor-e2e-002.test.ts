import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  anchos002, clasificarPropietarioBloqueo, conteosDeTablas, diferenciaDeConteos, elementosNuevos, entornoSeguro, filasDeClasificaciones, identidad001Referencia, identidad002Esperada, leerEnv, navegadores002, origen002, recursosEfimeros, semillaClasificaciones, validarIndependencia, validarRecursosEfimeros, validarSemilla,
} from '../../../scripts/independencia-002.mjs';

const env002 = leerEnv([
  "DATABASE_URL='postgresql://usuario:clave-secreta@127.0.0.1:54330/ayacucho_002_validacion'", 'REDIS_URL=redis://127.0.0.1:63800', 'REDIS_NAMESPACE=ayacucho:002:validacion',
  'S3_ENDPOINT=http://127.0.0.1:3910', 'S3_BUCKET=portafolio-002-validacion', 'PORT=3002', 'SMTP_PORT=1026', 'PUBLIC_ORIGIN=https://localhost:8444',
].join('\n'));
const env001 = leerEnv([
  'DATABASE_URL=postgresql://u:p@127.0.0.1:54329/ayacucho_001_validacion', 'S3_ENDPOINT=http://127.0.0.1:3900', 'S3_BUCKET=usuarios-validacion', 'PORT=3000', 'SMTP_PORT=1025', 'PUBLIC_ORIGIN=https://localhost:8443',
].join('\n'));

describe('T075 · independencia de la infraestructura 002', () => {
  test('la configuración dedicada de la 002 es independiente de la 001 y del ensayo de restauración', () => {
    const r = validarIndependencia({ env002, env001 });
    expect(r.problemas).toEqual([]); expect(r.ok).toBe(true);
    expect(r.identidad002).toMatchObject({ baseDatos: 'ayacucho_002_validacion', puertoBaseDatos: 54330, puertoRedis: 63800, bucket: 'portafolio-002-validacion', puertoApi: 3002 });
  });

  test('sin entorno de 001 compara con la referencia fija', () => {
    expect(validarIndependencia({ env002 }).ok).toBe(true);
  });

  test('rechaza cada recurso compartido con la 001: base, Redis, bucket, objetos, API y origen', () => {
    for (const [clave, valor] of [
      ['DATABASE_URL', 'postgresql://u:p@127.0.0.1:54329/ayacucho_001_validacion'], ['REDIS_URL', 'redis://127.0.0.1:63799'], ['S3_BUCKET', 'usuarios-validacion'],
      ['S3_ENDPOINT', 'http://127.0.0.1:3900'], ['PORT', '3000'], ['PUBLIC_ORIGIN', 'https://localhost:8443'],
    ] as const) {
      const r = validarIndependencia({ env002: { ...env002, [clave]: valor }, env001 });
      expect(r.ok, clave).toBe(false);
    }
  });

  test('rechaza puertos del ensayo de restauración y puertos repetidos dentro de la 002', () => {
    expect(validarIndependencia({ env002: { ...env002, REDIS_URL: 'redis://127.0.0.1:63851' }, env001 }).ok).toBe(false);
    expect(validarIndependencia({ env002: { ...env002, SMTP_PORT: '3002' }, env001 }).ok).toBe(false);
  });

  test('la identidad registrada no contiene credenciales ni cadenas de conexión', () => {
    const r = validarIndependencia({ env002, env001 });
    const texto = JSON.stringify({ identidad: entornoSeguro({ ...r.identidad002, proyectoCompose: identidad002Esperada.proyectoCompose }), referencia: r.referencia001 });
    expect(texto).not.toMatch(/clave-secreta|postgres(ql)?:\/\/|"usuario"|usuario:/);
    expect(identidad001Referencia.origen).not.toBe(identidad002Esperada.origen);
  });
});

describe('T075 · verificación de la semilla', () => {
  const salida = semillaClasificaciones.map((s) => [s.id, s.nombre, s.nivel, s.padre, s.activa ? 't' : 'f'].join('|')).join('\n');
  test('la semilla completa es válida, también en modo exacto', () => {
    const filas = filasDeClasificaciones(salida);
    expect(validarSemilla(filas, { estricta: true })).toMatchObject({ ok: true, adicionales: 0 });
  });
  test('filas adicionales son válidas en entorno compartido y se rechazan en modo exacto', () => {
    const filas = filasDeClasificaciones(`${salida}\nfe05bcd1-c08e-4643-8047-aa7090213bf3|Prueba HTTPS 05b907ca|1||f`);
    expect(validarSemilla(filas)).toMatchObject({ ok: true, adicionales: 1 });
    expect(validarSemilla(filas, { estricta: true }).ok).toBe(false);
  });
  test('una fila ausente o alterada invalida la semilla', () => {
    const filas = filasDeClasificaciones(salida);
    expect(validarSemilla(filas.slice(1))).toMatchObject({ ok: false, faltantes: [semillaClasificaciones[0]!.id] });
    expect(validarSemilla(filas.map((f) => f.nombre === 'Pintura' ? { ...f, activa: false } : f))).toMatchObject({ ok: false, alteradas: [semillaClasificaciones[4]!.id] });
  });
});

describe('T075 · recursos descartables por corrida', () => {
  const id = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  test('derivan la base, el bucket y el espacio Redis propios de un identificador de 32 hexadecimales', () => {
    expect(recursosEfimeros(id)).toEqual({ id, baseDatos: `ayacucho_002_test_${id}`, bucket: `e2e-${id}`, espacioRedis: `ayacucho:002:e2e-${id}` });
    expect(validarRecursosEfimeros(recursosEfimeros(id))).toEqual({ ok: true, problemas: [] });
    for (const malo of ['', 'abc', 'A1B2C3D4E5F60718293A4B5C6D7E8F90', `${id}0`, '../etc', `${id.slice(0, 31)}g`]) expect(() => recursosEfimeros(malo)).toThrow();
  });
  test('rechaza cualquier recurso que sea o pueda confundirse con uno de validación, de la 001 o del ensayo', () => {
    const buenos = recursosEfimeros(id);
    for (const sustituto of [
      { baseDatos: identidad002Esperada.baseDatos }, { baseDatos: identidad001Referencia.baseDatos }, { baseDatos: 'ayacucho_002_restauracion_x' }, { baseDatos: `ayacucho_002_test_${id};DROP` },
      { bucket: identidad002Esperada.bucket }, { bucket: identidad001Referencia.bucket }, { bucket: 'portafolio-002-validacion-2' },
      { espacioRedis: identidad002Esperada.espacioRedis }, { espacioRedis: `${identidad002Esperada.espacioRedis}:e2e` }, { espacioRedis: identidad001Referencia.espacioRedis },
    ]) expect(validarRecursosEfimeros({ ...buenos, ...sustituto }).ok, JSON.stringify(sustituto)).toBe(false);
  });
  test('comparan los conteos por tabla y detectan solo lo añadido', () => {
    const inicial = conteosDeTablas(['usuarios|1', 'catalogo_clasificaciones|6', 'administracion_auditoria|1', ''].join('\n'));
    expect(inicial).toEqual({ usuarios: 1, catalogo_clasificaciones: 6, administracion_auditoria: 1 });
    expect(diferenciaDeConteos(inicial, { ...inicial })).toEqual({});
    expect(diferenciaDeConteos(inicial, { ...inicial, usuarios: 2, catalogo_clasificaciones: 7, nueva: 1 })).toEqual({ usuarios: { antes: 1, despues: 2 }, catalogo_clasificaciones: { antes: 6, despues: 7 }, nueva: { antes: 0, despues: 1 } });
    expect(elementosNuevos(['a', 'b'], ['b', 'c'])).toEqual(['c']);
    expect(elementosNuevos(['a', 'b'], ['a'])).toEqual([]);
  });
});

describe('T075 · bloqueo exclusivo del ejecutor', () => {
  const bloqueo = { pid: 4242, token: 'a1', anfitrion: 'equipo', inicio: '2026-11-23T10:00:00.000Z' };
  const comando = 'node C:/repo/tecnologia/frontend/scripts/ejecutar-e2e-002.mjs --especificaciones=aislamiento.spec.ts';
  test('solo un propietario comprobadamente inexistente autoriza la recuperación', () => {
    expect(clasificarPropietarioBloqueo(bloqueo, { anfitrion: 'equipo', pid: 'no-existe' })).toBe('muerto');
    // El PID existe pero ahora es otro programa: ya no es el propietario.
    expect(clasificarPropietarioBloqueo(bloqueo, { anfitrion: 'equipo', pid: 'existe', comando: 'C:/Program Files/Adobe/node.exe main.js' })).toBe('muerto');
  });
  test('una ejecución del propio ejecutor con ese PID está viva y se respeta', () => {
    expect(clasificarPropietarioBloqueo(bloqueo, { anfitrion: 'equipo', pid: 'existe', comando })).toBe('vivo');
  });
  test('ante cualquier incertidumbre no se recupera: proceso no comprobable, sin comando, otro anfitrión o archivo ilegible', () => {
    expect(clasificarPropietarioBloqueo(bloqueo, { anfitrion: 'equipo', pid: 'desconocido' })).toBe('incierto');
    expect(clasificarPropietarioBloqueo(bloqueo, { anfitrion: 'equipo', pid: 'existe' })).toBe('incierto');
    expect(clasificarPropietarioBloqueo(bloqueo, { anfitrion: 'equipo', pid: 'existe', comando: '   ' })).toBe('incierto');
    expect(clasificarPropietarioBloqueo(bloqueo, { anfitrion: 'otro-equipo', pid: 'no-existe' })).toBe('incierto');
    for (const malo of [undefined, null, 'texto', {}, { ...bloqueo, pid: 0 }, { ...bloqueo, pid: 1.5 }, { ...bloqueo, pid: '4242' }, { ...bloqueo, token: undefined }, { ...bloqueo, anfitrion: undefined }]) {
      expect(clasificarPropietarioBloqueo(malo, { anfitrion: 'equipo', pid: 'no-existe' }), JSON.stringify(malo)).toBe('incierto');
    }
  });
});

describe('T075 · configuración del ejecutor de navegador 002', () => {
  // La configuración de Playwright no puede importarse dentro de Vitest; su matriz real se comprueba con `playwright test --list`.
  const fuente = readFileSync(resolve(import.meta.dirname, '../../../playwright.002.config.ts'), 'utf8');
  test('define Chromium, Firefox y WebKit en 360, 768 y 1366 px sobre el origen HTTPS 8444', () => {
    expect(navegadores002).toEqual(['chromium', 'firefox', 'webkit']); expect(anchos002).toEqual([360, 768, 1366]); expect(origen002).toBe('https://localhost:8444');
    expect(fuente).toContain('navegadores002.flatMap((navegador) => anchos002.map((ancho)');
    expect(fuente).toContain("name: `${navegador}-${ancho}`");
  });
  test('usa TLS real (sin ignorar errores), conserva traza al fallar y escribe solo en la evidencia 002', () => {
    expect(fuente).toMatch(/baseURL: origen002, ignoreHTTPSErrors: false, trace: 'retain-on-failure'/);
    expect(fuente).not.toMatch(/ignoreHTTPSErrors: true/);
    expect(fuente).toContain("resolve(local, 'evidencia/002')");
    expect(fuente).not.toContain('evidencia/001');
  });
  test('es serial, genera reportes JUnit, JSON y 002 y exige la preparación previa', () => {
    expect(fuente).toMatch(/fullyParallel: false, workers: 1, retries: 0/);
    expect(fuente).toContain("'playwright-junit.xml'"); expect(fuente).toContain("'playwright.json'"); expect(fuente).toContain('./test/soporte/reporte-002.ts');
    expect(fuente).toContain("globalSetup: './test/e2e/prestadores-catalogo/global-setup.ts'");
  });
});
