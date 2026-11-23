import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test as base, expect, type APIRequestContext, type TestInfo } from '@playwright/test';
import { entornoSeguro, validarRecursosEfimeros, type Identidad002 } from '../../../scripts/independencia-002.mjs';

/** Datos del dispositivo y del entorno de una ejecución. Solo contiene identidades (nombres y puertos): nunca credenciales. */
export interface RegistroDispositivo {
  readonly proyecto: string; readonly navegador: string; readonly versionNavegador: string; readonly dispositivo: string;
  readonly anchoViewport: number; readonly altoViewport: number; readonly plataformaEjecutor: string; readonly node: string;
  readonly origen: string; readonly ejecucion: string; readonly entorno: Record<string, string | number>;
}

/** Fichero con el resultado de la verificación previa (independencia de recursos y semilla) generado por el ejecutor del anfitrión. */
export interface PreparacionSerie {
  readonly ejecucion: string; readonly fecha: string; readonly independencia: { ok: boolean; identidad002: Identidad002 };
  readonly semilla: { ok: boolean; estricta: boolean; adicionales: number };
  /** Recursos descartables de esta ejecución: base, bucket y espacio Redis propios (nunca los de validación). */
  readonly recursos: { aislamiento: 'efimero'; baseDatos: string; bucket: string; espacioRedis: string };
}

const descriptores = { chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' } as const;

export async function leerPreparacion(ruta = process.env['E2E_PREPARACION_002']): Promise<PreparacionSerie> {
  if (!ruta) throw new Error('Ejecute las pruebas con scripts/ejecutar-e2e-002.mjs: verifica la independencia de la infraestructura 002 antes de ejecutar.');
  const datos = JSON.parse(await readFile(ruta, 'utf8')) as PreparacionSerie;
  if (!datos.independencia?.ok || !datos.semilla?.ok) throw new Error('La preparación 002 no es válida: independencia o semilla sin verificar.');
  if (datos.ejecucion !== process.env['E2E_EJECUCION_002']) throw new Error('La preparación 002 no pertenece a esta ejecución.');
  if (datos.recursos?.aislamiento !== 'efimero' || !validarRecursosEfimeros(datos.recursos).ok || !datos.semilla.estricta) throw new Error('La preparación 002 no usa recursos descartables propios de esta ejecución.');
  return datos;
}

/**
 * `test` de la 002: cada prueba adjunta automáticamente `dispositivo.json` con el navegador, su versión, el ancho y el entorno.
 * Las series T076 a T079 importan este `test` para heredar el registro sin repetirlo.
 */
export const test = base.extend<{ registroDispositivo: RegistroDispositivo }>({
  registroDispositivo: [async ({ browser, browserName }, use, testInfo) => {
    const preparacion = await leerPreparacion();
    const registro: RegistroDispositivo = {
      proyecto: testInfo.project.name, navegador: browserName, versionNavegador: browser.version(),
      dispositivo: descriptores[browserName], anchoViewport: testInfo.project.use.viewport?.width ?? 0, altoViewport: testInfo.project.use.viewport?.height ?? 0,
      plataformaEjecutor: process.platform, node: process.version, origen: String(testInfo.project.use.baseURL ?? ''), ejecucion: preparacion.ejecucion,
      entorno: {
        ...entornoSeguro({ ...preparacion.independencia.identidad002, baseDatos: preparacion.recursos.baseDatos, bucket: preparacion.recursos.bucket, espacioRedis: preparacion.recursos.espacioRedis }),
        aislamiento: preparacion.recursos.aislamiento,
      },
    };
    await use(registro);
    await testInfo.attach('dispositivo.json', { body: JSON.stringify(registro, null, 2), contentType: 'application/json' });
  }, { auto: true }],
});
export { expect };

/** Origen público de la 002: las escrituras HTTP deben enviarlo en `Origin`. */
export const origenWeb = 'https://localhost:8444';

export interface CuentaE2E { readonly correo: string; readonly contrasena: string; readonly token: string; readonly cuentaId: string }

/** Cabeceras de una escritura autenticada o anónima, con clave de idempotencia nueva salvo que se aporte una. */
export const cabecerasEscritura = (token?: string, clave: string = randomUUID()) => ({ origin: origenWeb, 'idempotency-key': clave, ...(token ? { authorization: `Bearer ${token}` } : {}) });

/** Registra por la API real una cuenta ficticia nueva (correo único `e2e-002-<uuid>@example.invalid`) e inicia sesión. */
export async function crearCuenta(request: APIRequestContext, perfil: 'cliente' | 'prestador', nombre = 'Cuenta ficticia E2E'): Promise<CuentaE2E> {
  const correo = `e2e-002-${randomUUID()}@example.invalid`; const contrasena = `${randomUUID()} ficticia`;
  const alta = await request.post('/api/v1/cuentas', { headers: cabecerasEscritura(), data: { nombreMostrar: nombre, correo, contrasena, confirmacionContrasena: contrasena, perfiles: [perfil], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: '001-v1' } });
  expect(alta.status(), 'registro de la cuenta ficticia').toBe(201);
  const cuentaId = ((await alta.json()) as { cuentaId: string }).cuentaId;
  const sesion = await request.post('/api/v1/sesiones', { headers: { origin: origenWeb }, data: { correo, contrasena } });
  expect(sesion.status(), 'inicio de sesión de la cuenta ficticia').toBe(200);
  return { correo, contrasena, cuentaId, token: ((await sesion.json()) as { tokenAcceso: string }).tokenAcceso };
}

/** Vincula la prueba con los criterios de aceptación que demuestra; el reporte 002 los agrega por navegador y resolución. */
export const criterios = (testInfo: TestInfo, ...ids: string[]): void => { for (const id of ids) testInfo.annotations.push({ type: 'criterio', description: id }); };

/** Adjunta un hecho verificable (estados, huellas, identificadores) que el reporte conserva en `hu03/<proyecto>/`. Nunca debe contener credenciales. */
export async function registrarEvidencia(testInfo: TestInfo, nombre: string, datos: object): Promise<void> {
  await testInfo.attach(`evidencia-${nombre}.json`, { body: JSON.stringify(datos, null, 2), contentType: 'application/json' });
}
