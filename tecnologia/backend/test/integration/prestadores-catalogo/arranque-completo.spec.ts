import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { crearAplicacion } from '../../../src/composicion/app.module.js';
import { iniciar } from '../../../src/composicion/main.js';
import { leerConfiguracion002 } from '../../../scripts/entorno-002.js';
import { crearAplicacionCompleta002 } from '../../../src/composicion/aplicacion-002.js';
import { cargarConfiguracion002 } from '../../../src/composicion/configuracion-002.js';
import { aplicarMigraciones002 } from '../../../src/composicion/migraciones-002.js';
import { persistenciaFundacional } from '../../../src/composicion/persistencia.js';
import { operadorSemilla002, sembrar002 } from '../../../src/composicion/semilla-002.js';
import { validarRespuesta } from '../../soporte/contrato.js';
import { validarRespuesta002 } from '../../soporte/prestadores-catalogo/contrato-002.js';
import { baseAislada002 } from '../../soporte/prestadores-catalogo/postgres.js';
import { configuracionDePrueba002 } from '../../soporte/prestadores-catalogo/entorno.js';
import { almacenDePrueba002, registrarCuenta, origenWeb002 } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

/** Aplicación compuesta sobre bases descartables. No toca la base de validación 002 ni ninguna de 001. */
type Aplicacion = Awaited<ReturnType<typeof crearAplicacion>>;
const tablas001 = ['usuarios', 'perfiles_habilitados', 'sesiones', 'claves_idempotencia', 'avisos_pendientes', 'fotografias_perfil', 'recuperaciones_acceso', 'consentimientos_telefono', 'cambios_correo'];
const rutas = (app: Aplicacion) => ((app.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router.stack
  .flatMap(({ route }) => route ? Object.keys(route.methods).map(m => `${m.toUpperCase()} ${route.path.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')}`) : [])).sort();
const operaciones = async (archivo: string) => { const o = JSON.parse(await readFile(resolve('contracts', archivo), 'utf8')) as { paths: Record<string, Record<string, { operationId?: string }>> };
  return Object.entries(o.paths).flatMap(([p, ms]) => Object.keys(ms).filter(m => ['get', 'post', 'put', 'patch', 'delete'].includes(m)).map(m => `${m.toUpperCase()} ${p}`)).sort(); };

let almacen: Awaited<ReturnType<typeof almacenDePrueba002>>;
beforeAll(async () => { almacen = await almacenDePrueba002(); }, 60000);
afterAll(async () => { await almacen?.limpiar(); });

describe('migraciones de la 002', () => {
  test('sobre una base vacía se aplican todas, son idempotentes y crean el esquema de Prestadores, Catálogo y Administración', async () => {
    const base = await baseAislada002();
    try {
      expect(await aplicarMigraciones002(base.url)).toBeGreaterThan(8);
      expect(await aplicarMigraciones002(base.url)).toBe(0);
      const app = await crearAplicacionCompleta002(await configuracionDePrueba002(base.url), { prestadores: { almacen: almacen.almacen }, worker: false });
      try {
        const existentes = (await app.db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'") as { table_name: string }[]).map(t => t.table_name);
        for (const t of [...tablas001, 'catalogo_clasificaciones', 'catalogo_revision_oferta', 'catalogo_proyeccion_prestadores', 'catalogo_servicios', 'catalogo_confirmaciones_desactivacion',
          'prestadores_perfiles', 'prestadores_trabajos', 'prestadores_fotografias', 'administracion_permisos', 'administracion_auditoria', 'administracion_aprobaciones', 'administracion_constancias']) expect(existentes).toContain(t);
        expect(((await app.db.query('SELECT count(*)::int AS n FROM catalogo_distritos')) as { n: number }[])[0]!.n).toBe(5);
      } finally { await app.app.close(); }
    } finally { await base.cerrar(); }
  }, 180000);

  test('sobre una copia de prueba de la 001 conserva su esquema y solo añade tablas propias de la 002', async () => {
    const base = await baseAislada002();
    try {
      const fundacional = persistenciaFundacional(base.url); await fundacional.initialize();
      const instantanea = async () => (await fundacional.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name = ANY($1) ORDER BY 1, ordinal_position`, [tablas001])) as unknown[];
      const indices = async () => (await fundacional.query('SELECT indexname, indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename = ANY($2) ORDER BY 1', ['public', tablas001])) as unknown[];
      let antes: unknown[]; let indicesAntes: unknown[]; let migracionesAntes: number;
      try {
        await fundacional.runMigrations({ transaction: 'each' });
        antes = await instantanea(); indicesAntes = await indices();
        migracionesAntes = Number(((await fundacional.query('SELECT count(*)::int AS n FROM migrations')) as { n: number }[])[0]!.n);
        expect(antes.length).toBeGreaterThan(40);
      } finally { await fundacional.destroy(); }
      await aplicarMigraciones002(base.url);
      const verificar = persistenciaFundacional(base.url); await verificar.initialize();
      try {
        const columnas = (await verificar.query(`SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
          WHERE table_schema='public' AND table_name = ANY($1) ORDER BY 1, ordinal_position`, [tablas001])) as unknown[];
        const idx = (await verificar.query('SELECT indexname, indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename = ANY($2) ORDER BY 1', ['public', tablas001])) as unknown[];
        expect(columnas).toEqual(antes);
        expect(idx).toEqual(indicesAntes);
        const nuevas = (await verificar.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name <> ALL($1) AND table_name NOT IN ('migrations','typeorm_metadata')", [tablas001])) as { table_name: string }[];
        expect(nuevas.length).toBeGreaterThan(8);
        for (const t of nuevas) expect(t.table_name).toMatch(/^(catalogo|prestadores|administracion)_/);
        expect(Number(((await verificar.query('SELECT count(*)::int AS n FROM migrations')) as { n: number }[])[0]!.n)).toBeGreaterThan(migracionesAntes);
      } finally { await verificar.destroy(); }
    } finally { await base.cerrar(); }
  }, 180000);
});

describe('aplicación compuesta', () => {
  let base: Awaited<ReturnType<typeof baseAislada002>>; let e: Aplicacion; let http: ReturnType<typeof request>;
  beforeAll(async () => {
    base = await baseAislada002(); await aplicarMigraciones002(base.url);
    e = await crearAplicacionCompleta002(await configuracionDePrueba002(base.url), { prestadores: { almacen: almacen.almacen }, worker: false });
    http = request(e.app.getHttpServer());
  }, 180000);
  afterAll(async () => { try { await e?.app.close(); } finally { await base?.cerrar(); } });

  test('registra exactamente las 40 operaciones: las 17 de la 001 y las 23 de la 002, sin rutas adicionales', async () => {
    const base001 = await operaciones('openapi.json'); const oferta = await operaciones('prestadores-catalogo.openapi.json');
    expect(base001).toHaveLength(17); expect(oferta).toHaveLength(23);
    expect(rutas(e)).toEqual([...base001, ...oferta].sort());
  });

  test('la composición base, sin la 002, conserva sus 17 operaciones', async () => {
    const aislada = await baseAislada002();
    try {
      await aplicarMigraciones002(aislada.url);
      const solo = await crearAplicacion(await configuracionDePrueba002(aislada.url), { worker: false });
      try { expect(rutas(solo)).toEqual(await operaciones('openapi.json')); } finally { await solo.app.close(); }
    } finally { await aislada.cerrar(); }
  }, 180000);

  test('las consultas públicas y de salud responden sin sesión, y las rutas internas exigen identidad', async () => {
    await validarRespuesta('Salud', (await http.get('/api/v1/salud').expect(200)).body);
    expect((await http.get('/api/v1/categorias').expect(200)).body).toEqual({ categorias: [] });
    expect((await http.get('/api/v1/servicios').expect(200)).body).toMatchObject({ elementos: [], total: 0 });
    expect((await http.get('/api/v1/prestadores').expect(200)).body).toMatchObject({ elementos: [], total: 0 });
    for (const ruta of ['/admin/categorias', '/servicios/mios', '/prestadores/perfil']) await http.get(`/api/v1${ruta}`).expect(401);
  });

  test('las rutas de la 001 siguen funcionando con la aplicación compuesta y una cuenta sin permiso RF39 no accede a categorías', async () => {
    const c = await registrarCuenta(e, http, 'prestador');
    expect(c.token).toHaveLength(43);
    await http.get('/api/v1/admin/categorias').set('Authorization', `Bearer ${c.token}`).expect(403);
    await http.post('/api/v1/admin/categorias').set('Authorization', `Bearer ${c.token}`).set('Origin', origenWeb002).set('Idempotency-Key', crypto.randomUUID()).send({ nombre: 'X', motivo: 'M' }).expect(403);
  });
});

describe('configuración de la composición', () => {
  const env = { NODE_ENV: 'test', PUBLIC_ORIGIN: 'https://localhost:8444', PUBLIC_URL: 'https://localhost:8444', HMAC_KEY_ID: 'a', AEAD_KEY_ID: 'b',
    HMAC_KEYS_JSON: JSON.stringify({ a: Buffer.alloc(32, 1).toString('base64') }), AEAD_KEYS_JSON: JSON.stringify({ b: Buffer.alloc(32, 2).toString('base64') }),
    S3_ENDPOINT: 'http://127.0.0.1:3910', S3_REGION: 'garage', S3_BUCKET: 'x', S3_ACCESS_KEY_ID: 'k', S3_SECRET_ACCESS_KEY: 's', SMTP_HOST: '127.0.0.1', SMTP_FROM: 'a@example.invalid',
    CATALOGO_MANIFIESTO: 'x', VALIDATION_MODE: 'true' };
  test('en validación solo admite la base local dedicada de la 002', () => {
    expect(cargarConfiguracion002({ ...env, DATABASE_URL: 'postgresql://u:p@127.0.0.1:54330/ayacucho_002_validacion' }).databaseUrl).toContain('ayacucho_002_validacion');
    expect(cargarConfiguracion002({ ...env, DATABASE_URL: 'postgresql://u:p@127.0.0.1:54330/ayacucho_002_test_abc123' }).databaseUrl).toContain('ayacucho_002_test_abc123');
    expect(cargarConfiguracion002({ ...env, DATABASE_URL: 'postgresql://u:p@127.0.0.1:54341/ayacucho_002_restauracion_abc123' }).databaseUrl).toContain('ayacucho_002_restauracion_abc123');
    for (const url of ['postgresql://u:p@127.0.0.1:54330/ayacucho_001_validacion', 'postgresql://u:p@127.0.0.1:54330/ayacucho_002_restauracion_', 'postgresql://u:p@127.0.0.1:54330/ayacucho_002_restauracion_ABC', 'postgresql://u:p@db.example.com:5432/ayacucho_002_validacion', 'postgresql://u:p@127.0.0.1:54330/produccion', 'no es una url']) {
      expect(() => cargarConfiguracion002({ ...env, DATABASE_URL: url })).toThrow();
    }
  });
});

describe('semilla determinista y operador ficticio', () => {
  test('siembra clasificaciones, concede el permiso por el flujo operativo, es idempotente y las consultas cumplen el contrato', async () => {
    const aislada = await baseAislada002(); await aplicarMigraciones002(aislada.url);
    const app = await crearAplicacionCompleta002(await configuracionDePrueba002(aislada.url), { prestadores: { almacen: almacen.almacen }, worker: false });
    try {
      const primera = await sembrar002(app, 'operador-semilla', origenWeb002);
      expect(primera).toMatchObject({ clasificaciones: 6, permisoConcedido: true });
      expect(primera.credencialNueva?.correo).toBe(operadorSemilla002.correo);
      const otra = await sembrar002(app, 'operador-semilla', origenWeb002);
      expect(otra).toMatchObject({ clasificaciones: 6, permisoConcedido: false, operadorCuentaId: primera.operadorCuentaId });
      expect(otra.credencialNueva).toBeUndefined();
      const consulta = async (sql: string) => Number(((await app.db.query(sql)) as { n: number }[])[0]!.n);
      expect(await consulta('SELECT count(*)::int AS n FROM catalogo_clasificaciones')).toBe(6);
      expect(await consulta("SELECT count(*)::int AS n FROM administracion_permisos WHERE estado='VIGENTE'")).toBe(1);
      const auditoria = (await app.db.query('SELECT responsable,accion FROM administracion_auditoria')) as { responsable: string; accion: string }[];
      expect(auditoria).toEqual([{ responsable: 'operativo:operador-semilla', accion: 'PERMISO_RF39_CONCEDIDO' }]);
      // La semilla no conserva claves: el firmante efímero solo existió en memoria y la aprobación quedó consumida.
      expect(await consulta('SELECT count(*)::int AS n FROM administracion_aprobaciones')).toBe(1);

      const http = request(app.app.getHttpServer());
      const sesion = await http.post('/api/v1/sesiones').set('Origin', origenWeb002).send({ correo: primera.credencialNueva!.correo, contrasena: primera.credencialNueva!.contrasena }).expect(200);
      const token = String(sesion.body.tokenAcceso);
      const admin = await http.get('/api/v1/admin/categorias').set('Authorization', `Bearer ${token}`).expect(200);
      await validarRespuesta002('C002CategoriasAdmin', admin.body);
      expect(admin.body.categorias).toHaveLength(6);
      const publicas = await http.get('/api/v1/categorias').expect(200);
      await validarRespuesta002('C002CategoriasPublicas', publicas.body);
      expect(publicas.body.categorias.map((c: { nombre: string }) => c.nombre).sort()).toEqual(['Acabados', 'Albañilería', 'Construcción', 'Pintura']);
      await validarRespuesta002('C002PaginaServicios', (await http.get('/api/v1/servicios').expect(200)).body);
      await validarRespuesta002('C002PaginaPrestadores', (await http.get('/api/v1/prestadores').expect(200)).body);
      await validarRespuesta('Salud', (await http.get('/api/v1/salud').expect(200)).body);
    } finally { await app.app.close(); await aislada.cerrar(); }
  }, 240000);
});

describe('pasos de preparación separados', () => {
  const texto = (ruta: string) => readFile(resolve(ruta), 'utf8');
  test('dev:prepare:002 solo prepara configuración; migración, almacenamiento y semilla son comandos separados que exigen Compose', async () => {
    const preparar = await texto('scripts/preparar-validacion-002.ts');
    for (const prohibido of ['docker compose', 'runMigrations', 'aplicarMigraciones002', 'sembrar002', 'inicializar-storage']) expect(preparar).not.toContain(prohibido);
    const paquete = JSON.parse(await texto('package.json')) as { scripts: Record<string, string> };
    expect(paquete.scripts['dev:prepare:002']).toContain('preparar-validacion-002');
    expect(paquete.scripts['db:migrate:002']).toContain('migrar');
    expect(paquete.scripts['storage:init:002']).toContain('storage');
    expect(paquete.scripts['test:seed:002']).toContain('seed');
    const lanzador = await texto('scripts/iniciar-validacion-002.ts');
    for (const archivo of ['scripts/migrar-002.ts', 'scripts/inicializar-storage-002.ts', 'scripts/seed-prestadores-catalogo.ts']) expect(lanzador).toContain(archivo);
    expect(await texto('scripts/seed-prestadores-catalogo.ts')).toContain('exigirBase002');
    expect(await texto('scripts/migrar-002.ts')).toContain('exigirBase002');
  });
});

describe('punto de entrada: composición solicitada', () => {
  const claveHmac = Buffer.alloc(32, 3).toString('base64'); const claveAead = Buffer.alloc(32, 4).toString('base64');
  /** Ejecuta `trabajo` con variables de entorno del proceso y las restaura después. */
  async function conEntorno<T>(variables: Record<string, string | undefined>, trabajo: () => Promise<T>): Promise<T> {
    const anteriores = Object.fromEntries(Object.keys(variables).map(k => [k, process.env[k]]));
    for (const [k, v] of Object.entries(variables)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    try { return await trabajo(); } finally { for (const [k, v] of Object.entries(anteriores)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
  }

  test('COMPOSICION=oferta-002 arranca las 40 operaciones por iniciar(), con el mismo origen y controles, y un valor desconocido se rechaza', async () => {
    const real = await leerConfiguracion002(); const aislada = await baseAislada002(); await aplicarMigraciones002(aislada.url);
    const variables = { NODE_ENV: 'test', VALIDATION_MODE: 'true', COMPOSICION: 'oferta-002', PORT: '3981', DATABASE_URL: aislada.url, PUBLIC_ORIGIN: origenWeb002, PUBLIC_URL: origenWeb002,
      HMAC_KEY_ID: 'e', HMAC_KEYS_JSON: JSON.stringify({ e: claveHmac }), AEAD_KEY_ID: 'f', AEAD_KEYS_JSON: JSON.stringify({ f: claveAead }),
      S3_ENDPOINT: real['S3_ENDPOINT'], S3_REGION: real['S3_REGION'], S3_BUCKET: real['S3_BUCKET'], S3_ACCESS_KEY_ID: real['S3_ACCESS_KEY_ID'], S3_SECRET_ACCESS_KEY: real['S3_SECRET_ACCESS_KEY'],
      SMTP_HOST: '127.0.0.1', SMTP_PORT: '9', SMTP_FROM: 'entrada@example.invalid', CATALOGO_MANIFIESTO: real['CATALOGO_MANIFIESTO'],
      REDIS_URL: real['REDIS_URL'], REDIS_NAMESPACE: `ayacucho:002:entrada-${randomUUID().slice(0, 8)}`, REDIS_TIMEOUT_MS: '300' };
    try {
      await conEntorno({ ...variables, COMPOSICION: 'completa' }, async () => { await expect(iniciar()).rejects.toThrow('COMPOSICION no es válida'); });
      await conEntorno(variables, async () => {
        const servicio = await iniciar();
        try {
          const llamar = (ruta: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:3981/api/v1${ruta}`, init);
          expect((await llamar('/salud')).status).toBe(200);
          expect((await llamar('/categorias')).status).toBe(200);
          for (const ruta of ['/admin/categorias', '/servicios/mios', '/prestadores/perfil']) expect((await llamar(ruta)).status).toBe(401);
          // Origen y controles de la base: Origin ausente o ajeno y cuerpo grande.
          const cuerpo = JSON.stringify({ nombreMostrar: 'x' });
          expect((await llamar('/cuentas', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: cuerpo })).status).toBe(400);
          expect((await llamar('/cuentas', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': randomUUID(), origin: 'https://ajeno.example.invalid' }, body: cuerpo })).status).toBe(403);
          expect((await llamar('/cuentas', { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': randomUUID(), origin: origenWeb002 }, body: JSON.stringify({ nombreMostrar: 'x'.repeat(400_000) }) })).status).toBe(413);
        } finally { await servicio.cerrar(); }
      });
    } finally { await aislada.cerrar(); }
  }, 240000);
});
