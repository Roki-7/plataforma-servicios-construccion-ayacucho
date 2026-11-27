import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cargarContrato003, validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { crearYPublicar, cuerpoDefinitiva, cuerpoEstimada, cuerpoPublicable, imagen, jpegDeTamano, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

/**
 * T089 · cobertura contractual de las 18 operaciones de la 003 (CP-308, PR04 en su parte contractual). A diferencia de las suites por historia, esta es una MATRIZ construida
 * desde el inventario del contrato aprobado: un registro de cobertura anota cada (operación, estado) observado en una respuesta REAL ya validada contra su esquema, y la
 * última prueba exige que cada código declarado por cada operación se haya observado, salvo una lista explícita y justificada de códigos que ninguna regla produce.
 * Las pruebas de seguridad envían solicitudes bien formadas SIN sesión: distinguen la validación de entrada (400) del acceso efectivo (401) y comprueban que no se
 * modifica ningún dato. La matriz exhaustiva de actores y recursos (PR04) es T090.
 */
interface Operacion { operationId: string; parameters?: { $ref?: string }[]; security?: Record<string, unknown>[]; responses: Record<string, { $ref?: string }>;
  requestBody?: { content: { 'application/json': { schema: { $ref: string } } } }; 'x-limite-cuerpo-bytes'?: number }
type Contrato = { paths: Record<string, Record<string, Operacion>>; components: { responses: Record<string, { content: { 'application/json': { schema: { $ref: string } } } }> } };
type Respuesta = { status: number; body: unknown; headers: Record<string, unknown> };

/** Códigos declarados que NINGUNA regla de la implementación produce: el contrato los declara con la plantilla de las mutaciones. Cada uno se justifica. */
const sinEscenarioAlcanzable: Readonly<Record<string, { codigos: readonly number[]; razon: string }>> = {
  cerrarSolicitud003: { codigos: [422], razon: 'El cierre solo depende de la titularidad, del estado y de la versión (403, 404, 409); ninguna regla de negocio produce un 422.' },
  retirarCotizacion003: { codigos: [422], razon: 'El retiro solo depende de la titularidad, del estado y de la versión (403, 404, 409); ninguna regla de negocio produce un 422.' },
};

const operaciones = new Map<string, { metodo: string; ruta: string; operacion: Operacion }>();
const observados = new Map<string, Set<number>>();
let contrato: Contrato;
let e: EntornoUs1;
let cliente: string; let otroCliente: string; let beto: string; let ana: string; let dario: string; let gema: string;

/** Valida la respuesta real: estado esperado y declarado, cabeceras de seguridad y cuerpo conforme a su esquema. Lo anota en el registro de cobertura. */
async function ver<T extends Respuesta>(operationId: string, r: T, esperado: number, esquema?: string): Promise<T> {
  const { operacion } = operaciones.get(operationId)!;
  expect([operationId, r.status]).toEqual([operationId, esperado]);
  expect([operationId, r.status, Object.keys(operacion.responses).includes(String(r.status))]).toEqual([operationId, r.status, true]);
  const declarada = operacion.responses[String(r.status)]!;
  const nombre = esquema ?? (declarada.$ref ? contrato.components.responses[declarada.$ref.split('/').pop()!]?.content['application/json'].schema.$ref.split('/').pop() : undefined);
  if (nombre && !Buffer.isBuffer(r.body)) await validarRespuesta003(nombre, r.body);
  expect(r.headers['cache-control']).toBe('no-store');
  expect(r.headers['x-content-type-options']).toBe('nosniff');
  if (r.status >= 400) expect(Object.keys((r.body as object) ?? {}).sort()).toEqual(expect.arrayContaining(['codigo', 'mensaje']));
  (observados.get(operationId) ?? observados.set(operationId, new Set()).get(operationId)!).add(r.status);
  return r;
}
const codigo = (r: Respuesta) => (r.body as { codigo: string }).codigo;
const nueva = (extra: object = {}) => crearYPublicar(e, cliente, extra) as Promise<{ solicitudId: string; version: number; versionTrabajo: number }>;
const cotizar = async (s: { solicitudId: string; versionTrabajo: number }, tk = beto) => (await e.cotizar(tk, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body as { cotizacionId: string; version: number };
const contar = async (sql: string) => Number(((await e.db.query(sql)) as { n: string }[])[0]!.n);
const foto = async () => (await imagen(40, 30, 'png')) as { tipoMime: string; contenidoBase64: string };

beforeAll(async () => {
  contrato = await cargarContrato003() as unknown as Contrato;
  for (const [ruta, item] of Object.entries(contrato.paths)) for (const [metodo, operacion] of Object.entries(item)) operaciones.set(operacion.operationId, { metodo, ruta, operacion });
  e = await montarUs1();
  const t = (c: Parameters<EntornoUs1['token']>[0]) => e.token(c);
  [cliente, otroCliente, beto, ana, dario, gema] = await Promise.all([t(e.datos.clientes.clienteUno), t(e.datos.clientes.clienteDos), t(e.datos.prestadores.beto),
    t(e.datos.prestadores.ana), t(e.datos.prestadores.dario), t(e.datos.prestadores.gema)]) as [string, string, string, string, string, string];
}, 300000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('inventario y espejo', () => {
  test('el contrato aprobado declara exactamente 18 operaciones, todas con Bearer, ninguna pública, y la aplicación registra cada una con su método y ruta', () => {
    expect(operaciones.size).toBe(18);
    expect([...operaciones.keys()].every(id => /003$/.test(id))).toBe(true);
    for (const [id, { operacion }] of operaciones) {
      expect([id, JSON.stringify(operacion.security)]).toEqual([id, '[{"bearerAuth":[]}]']);
      expect(operacion.responses).toHaveProperty('401');
      expect(operacion.responses).toHaveProperty('503');
    }
    const registradas = ((e.app.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router.stack
      .flatMap(({ route }) => route ? Object.keys(route.methods).map(m => `${m.toUpperCase()} ${route.path.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')}`) : []));
    for (const [id, { metodo, ruta }] of operaciones) expect([id, registradas.includes(`${metodo.toUpperCase()} ${ruta}`)]).toEqual([id, true]);
    expect(registradas.filter(r => [...operaciones.values()].some(o => `${o.metodo.toUpperCase()} ${o.ruta}` === r))).toHaveLength(18);
  });
  test('el espejo ejecutable es idéntico byte a byte a la fuente aprobada, sin normalizaciones', async () => {
    const fuente = await readFile(resolve('../../specs/003-solicitudes-y-cotizaciones/contracts/openapi.json'));
    const espejo = await readFile(resolve('contracts/solicitudes-cotizaciones.openapi.json'));
    expect(espejo.length).toBe(fuente.length);
    expect(Buffer.compare(espejo, fuente)).toBe(0);
    const diferenteAUnByte = Buffer.from(espejo); diferenteAUnByte[diferenteAUnByte.length - 2] = diferenteAUnByte[diferenteAUnByte.length - 2]! ^ 1;
    expect(Buffer.compare(diferenteAUnByte, fuente)).not.toBe(0); // la comparación detecta una diferencia real de un solo bit
  });
  test('el verificador es sensible: rechaza un estado no declarado, un cuerpo que incumple su esquema, un acceso sin sesión que devolviera 200 y la falta de no-store', async () => {
    const cabeceras = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
    const antes = new Map([...observados].map(([k, v]) => [k, new Set(v)]));
    await expect(ver('obtenerSolicitud003', { status: 418, body: {}, headers: cabeceras }, 418)).rejects.toThrow();
    await expect(ver('obtenerSolicitud003', { status: 200, body: { sin: 'esquema' }, headers: cabeceras }, 200, 'C003SolicitudPrivada')).rejects.toThrow();
    await expect(ver('obtenerSolicitud003', { status: 200, body: {}, headers: cabeceras }, 401, 'C003Error401')).rejects.toThrow();
    await expect(ver('obtenerSolicitud003', { status: 404, body: { codigo: 'RECURSO_NO_DISPONIBLE', mensaje: 'x', detalles: [] }, headers: { 'x-content-type-options': 'nosniff' } }, 404)).rejects.toThrow();
    expect(observados.get('obtenerSolicitud003') ?? new Set()).toEqual(antes.get('obtenerSolicitud003') ?? new Set()); // los intentos fallidos no cuentan como cobertura
  });
  test('las mutaciones declaran Origin, Idempotency-Key y un límite de cuerpo, y las lecturas no declaran cabeceras de escritura', () => {
    for (const [id, { metodo, operacion }] of operaciones) {
      const refs = (operacion.parameters ?? []).map(p => p.$ref ?? '');
      const muta = metodo !== 'get';
      expect([id, refs.includes('#/components/parameters/Origin'), refs.includes('#/components/parameters/IdempotencyKey')]).toEqual([id, muta, muta]);
      expect([id, typeof operacion['x-limite-cuerpo-bytes']]).toEqual([id, muta ? 'number' : 'undefined']);
      expect([id, !!operacion.requestBody]).toEqual([id, muta]);
    }
  });
});

describe('seguridad por operación: ninguna es pública (solicitudes bien formadas SIN sesión)', () => {
  test('cada una de las 18, con cabeceras, identificadores, consulta y cuerpo válidos según su esquema, responde exactamente 401 y no modifica ningún dato', async () => {
    const id = randomUUID();
    const png = (await foto()).contenidoBase64;
    const origen = e.config.origen;
    const escr = (t: ReturnType<typeof e.http.post>, cuerpo: object) => t.set('Origin', origen).set('Idempotency-Key', randomUUID()).send(cuerpo);
    const peticiones: [string, string, () => Promise<Respuesta>][] = [
      ['crearSolicitud003', 'C003SolicitudAlta', () => escr(e.http.post('/api/v1/solicitudes'), { tipo: 'PUBLICADA' })],
      ['listarMisSolicitudes003', '', () => e.http.get('/api/v1/solicitudes?rol=cliente&pagina=1&tamano=20')],
      ['listarOportunidades003', '', () => e.http.get('/api/v1/solicitudes/oportunidades?pagina=1&tamano=20')],
      ['obtenerSolicitud003', '', () => e.http.get(`/api/v1/solicitudes/${id}`)],
      ['editarSolicitud003', 'C003SolicitudEdicion', () => escr(e.http.patch(`/api/v1/solicitudes/${id}`), { version: 1, medidas: '3 m' })],
      ['publicarSolicitud003', 'C003SolicitudPublicacion', () => escr(e.http.post(`/api/v1/solicitudes/${id}/publicacion`), { version: 1 })],
      ['cerrarSolicitud003', 'C003SolicitudCierre', () => escr(e.http.post(`/api/v1/solicitudes/${id}/cierre`), { version: 1 })],
      ['consultarHistorialSolicitud003', '', () => e.http.get(`/api/v1/solicitudes/${id}/historial?tipo=versiones&pagina=1&tamano=20`)],
      ['cargarArchivoSolicitud003', 'C003ArchivoCarga', () => escr(e.http.post(`/api/v1/solicitudes/${id}/archivos`), { tipoMime: 'image/png', contenidoBase64: png })],
      ['obtenerArchivoSolicitud003', '', () => e.http.get(`/api/v1/solicitudes/${id}/archivos/${randomUUID()}`)],
      ['enviarCotizacion003', 'C003CotizacionEnvio', () => escr(e.http.post(`/api/v1/solicitudes/${id}/cotizaciones`), cuerpoEstimada(1))],
      ['listarCotizacionesDeSolicitud003', '', () => e.http.get(`/api/v1/solicitudes/${id}/cotizaciones?ids=${randomUUID()}&pagina=1&tamano=20`)],
      ['listarMisCotizaciones003', '', () => e.http.get('/api/v1/cotizaciones?pagina=1&tamano=20')],
      ['obtenerCotizacion003', '', () => e.http.get(`/api/v1/cotizaciones/${id}`)],
      ['actualizarCotizacion003', 'C003CotizacionActualizacion', () => escr(e.http.post(`/api/v1/cotizaciones/${id}/versiones`), { ...cuerpoEstimada(1), versionCotizacion: 1 })],
      ['retirarCotizacion003', 'C003CotizacionRetiro', () => escr(e.http.post(`/api/v1/cotizaciones/${id}/retiro`), { versionCotizacion: 1 })],
      ['enviarAclaracion003', 'C003AclaracionEscritura', () => escr(e.http.post(`/api/v1/cotizaciones/${id}/aclaraciones`), { texto: 'Hola' })],
      ['listarAclaraciones003', '', () => e.http.get(`/api/v1/cotizaciones/${id}/aclaraciones?pagina=1&tamano=20`)],
    ];
    expect(peticiones.map(([op]) => op).sort()).toEqual([...operaciones.keys()].sort());
    const antes = [await contar('SELECT count(*) AS n FROM solicitudes'), await contar('SELECT count(*) AS n FROM cotizaciones'), await contar('SELECT count(*) AS n FROM cotizaciones_aclaraciones'),
      await contar('SELECT count(*) AS n FROM solicitudes_archivos'), await contar('SELECT count(*) AS n FROM avisos_negocio'), await contar('SELECT count(*) AS n FROM solicitudes_bitacora')];
    for (const [op, , ejecutar] of peticiones) {
      const r = await ejecutar();
      await ver(op, r, 401, 'C003Error401');
      expect([op, codigo(r)]).toEqual([op, 'NO_AUTENTICADO']);
    }
    const despues = [await contar('SELECT count(*) AS n FROM solicitudes'), await contar('SELECT count(*) AS n FROM cotizaciones'), await contar('SELECT count(*) AS n FROM cotizaciones_aclaraciones'),
      await contar('SELECT count(*) AS n FROM solicitudes_archivos'), await contar('SELECT count(*) AS n FROM avisos_negocio'), await contar('SELECT count(*) AS n FROM solicitudes_bitacora')];
    expect(despues).toEqual(antes);
  }, 120000);

  test('los cuerpos usados para esa prueba son válidos según los esquemas del contrato, de modo que el 401 no es un efecto de una entrada mal formada', async () => {
    const png = (await foto()).contenidoBase64;
    const validos: [string, object][] = [['C003SolicitudAlta', { tipo: 'PUBLICADA' }], ['C003SolicitudEdicion', { version: 1, medidas: '3 m' }], ['C003SolicitudPublicacion', { version: 1 }],
      ['C003SolicitudCierre', { version: 1 }], ['C003ArchivoCarga', { tipoMime: 'image/png', contenidoBase64: png }], ['C003CotizacionEnvio', cuerpoEstimada(1)],
      ['C003CotizacionActualizacion', { ...cuerpoEstimada(1), versionCotizacion: 1 }], ['C003CotizacionRetiro', { versionCotizacion: 1 }], ['C003AclaracionEscritura', { texto: 'Hola' }]];
    for (const [esquema, cuerpo] of validos) await validarRespuesta003(esquema, cuerpo);
    await expect(validarRespuesta003('C003CotizacionRetiro', {})).rejects.toThrow(); // y un esquema sí rechaza lo inválido: la comprobación no es vacía
  });

  test('una solicitud mal formada sin sesión puede recibir 400 antes que 401 (validación de entrada), pero nunca un 2xx, 403, 404 ni 5xx: no es acceso público', async () => {
    const mal: [string, () => Promise<Respuesta>][] = [
      ['obtenerSolicitud003', () => e.http.get('/api/v1/solicitudes/no-es-uuid')], ['consultarHistorialSolicitud003', () => e.http.get(`/api/v1/solicitudes/${randomUUID()}/historial`)],
      ['crearSolicitud003', () => e.http.post('/api/v1/solicitudes').send({})], ['listarMisCotizaciones003', () => e.http.get('/api/v1/cotizaciones?pagina=0')],
      ['listarCotizacionesDeSolicitud003', () => e.http.get(`/api/v1/solicitudes/${randomUUID()}/cotizaciones?ids=xyz`)],
    ];
    for (const [op, ejecutar] of mal) { const r = await ejecutar(); expect([op, [400, 401].includes(r.status)]).toEqual([op, true]); }
  });
});

describe('solicitudes (9 operaciones)', () => {
  test('crearSolicitud003: 201 borrador, 400, 403 sin perfil de cliente, 404 con un archivo inexistente, 409 por clave reutilizada, 413 y 422', async () => {
    const r = await ver('crearSolicitud003', await e.crear(cliente, cuerpoPublicable(e)), 201, 'C003SolicitudPrivada');
    expect(r.body).toMatchObject({ estado: 'BORRADOR', tipo: 'PUBLICADA', version: 1, versionTrabajo: 0, archivos: [] });
    expect(codigo(await ver('crearSolicitud003', await e.crear(cliente, { tipo: 'OTRA' }), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('crearSolicitud003', await e.crear(cliente, { tipo: 'PUBLICADA', titulo: 'no declarado' }), 400))).toBe('PROPIEDAD_NO_ADMITIDA');
    expect(codigo(await ver('crearSolicitud003', await e.crear(dario, { tipo: 'PUBLICADA' }), 403))).toBe('SIN_PERMISO');
    expect(codigo(await ver('crearSolicitud003', await e.crear(cliente, { tipo: 'PUBLICADA', archivosIds: [randomUUID()] }), 404))).toBe('RECURSO_NO_DISPONIBLE');
    const clave = randomUUID();
    await e.crear(cliente, { tipo: 'PUBLICADA' }, clave).expect(201);
    expect(codigo(await ver('crearSolicitud003', await e.crear(cliente, { tipo: 'DIRIGIDA' }, clave), 409))).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
    expect(codigo(await ver('crearSolicitud003', await e.crear(cliente, { tipo: 'PUBLICADA', descripcion: 'x'.repeat(70_000) }), 413))).toBe('CUERPO_DEMASIADO_GRANDE');
    expect(codigo(await ver('crearSolicitud003', await e.crear(cliente, { tipo: 'DIRIGIDA', prestadorId: randomUUID() }), 422))).toBe('PRESTADOR_NO_DISPONIBLE');
  });

  test('listarMisSolicitudes003 y listarOportunidades003: 200 con su página, 400, 403 por perfil', async () => {
    const mis = await ver('listarMisSolicitudes003', await e.listar(cliente, '?pagina=1&tamano=2'), 200, 'C003PaginaSolicitudes');
    expect(mis.body).toMatchObject({ pagina: 1, tamano: 2 });
    await ver('listarMisSolicitudes003', await e.listar(beto, '?rol=prestador'), 200, 'C003PaginaSolicitudes');
    expect(codigo(await ver('listarMisSolicitudes003', await e.listar(cliente, '?pagina=0'), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('listarMisSolicitudes003', await e.listar(cliente, '?rol=externo'), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('listarMisSolicitudes003', await e.listar(dario, ''), 403))).toBe('SIN_PERMISO');
    expect(codigo(await ver('listarMisSolicitudes003', await e.listar(cliente, '?rol=prestador'), 403))).toBe('SIN_PERMISO');
    await ver('listarOportunidades003', await e.oportunidades(beto, '?pagina=1&tamano=5'), 200, 'C003PaginaOportunidades');
    expect(codigo(await ver('listarOportunidades003', await e.oportunidades(beto, '?tamano=51'), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('listarOportunidades003', await e.oportunidades(otroCliente), 403))).toBe('SIN_PERMISO');
  });

  test('obtenerSolicitud003: 200 con la vista privada del dueño y la visible de un prestador con título, 400 y 404 idéntico para ajeno e inexistente', async () => {
    const s = await nueva();
    await ver('obtenerSolicitud003', await e.obtener(cliente, s.solicitudId), 200, 'C003SolicitudPrivada');
    const visible = await ver('obtenerSolicitud003', await e.obtener(beto, s.solicitudId), 200, 'C003SolicitudVisible');
    expect(visible.body).toMatchObject({ titulos: ['COMPATIBLE'] });
    expect(JSON.stringify(visible.body)).not.toMatch(/clienteCuentaId|correo|telefono/i);
    expect(codigo(await ver('obtenerSolicitud003', await e.obtener(cliente, 'no-es-uuid'), 400))).toBe('DATOS_INVALIDOS');
    const inexistente = (await ver('obtenerSolicitud003', await e.obtener(cliente, randomUUID()), 404)).body;
    expect((await ver('obtenerSolicitud003', await e.obtener(ana, s.solicitudId), 404)).body).toEqual(inexistente);
    expect((await ver('obtenerSolicitud003', await e.obtener(otroCliente, s.solicitudId), 404)).body).toEqual(inexistente);
  });

  test('editarSolicitud003: 200, 400, 403, 404, 409 por versión, 413 y 422 por una fecha anterior a hoy', async () => {
    const s = await nueva();
    const ok = await ver('editarSolicitud003', await e.editar(cliente, s.solicitudId, { version: s.version, medidas: '4 m de largo' }), 200, 'C003SolicitudPrivada');
    expect(ok.body).toMatchObject({ medidas: '4 m de largo', versionTrabajo: 2 });
    expect(codigo(await ver('editarSolicitud003', await e.editar(cliente, s.solicitudId, {}), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('editarSolicitud003', await e.editar(dario, s.solicitudId, { version: 1, medidas: 'x' }), 403))).toBe('SIN_PERMISO');
    expect(codigo(await ver('editarSolicitud003', await e.editar(otroCliente, s.solicitudId, { version: 1, medidas: 'x' }), 404))).toBe('RECURSO_NO_DISPONIBLE');
    expect(codigo(await ver('editarSolicitud003', await e.editar(cliente, s.solicitudId, { version: 1, medidas: 'otra' }), 409))).toBe('VERSION_DESACTUALIZADA');
    expect(codigo(await ver('editarSolicitud003', await e.editar(cliente, s.solicitudId, { version: 99, medidas: 'x'.repeat(70_000) }), 413))).toBe('CUERPO_DEMASIADO_GRANDE');
    expect(codigo(await ver('editarSolicitud003', await e.editar(cliente, s.solicitudId, { version: (ok.body as { version: number }).version, fechaDesde: '2020-01-01' }), 422))).toBe('FECHA_NO_VALIDA');
  });

  test('publicarSolicitud003: 200 ABIERTA, 400, 403, 404, 409 al repetirla con la versión previa, 413 y 422 por un borrador incompleto', async () => {
    const borrador = (await e.crear(cliente, cuerpoPublicable(e)).expect(201)).body;
    const ok = await ver('publicarSolicitud003', await e.publicar(cliente, borrador.solicitudId, { version: borrador.version }), 200, 'C003SolicitudPrivada');
    expect(ok.body).toMatchObject({ estado: 'ABIERTA', versionTrabajo: 1 });
    expect(codigo(await ver('publicarSolicitud003', await e.publicar(cliente, borrador.solicitudId, { version: 0 }), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('publicarSolicitud003', await e.publicar(dario, borrador.solicitudId, { version: 1 }), 403))).toBe('SIN_PERMISO');
    expect(codigo(await ver('publicarSolicitud003', await e.publicar(otroCliente, borrador.solicitudId, { version: 1 }), 404))).toBe('RECURSO_NO_DISPONIBLE');
    expect(codigo(await ver('publicarSolicitud003', await e.publicar(cliente, borrador.solicitudId, { version: borrador.version }), 409))).toBe('VERSION_DESACTUALIZADA');
    expect(codigo(await ver('publicarSolicitud003', await e.publicar(cliente, borrador.solicitudId, { version: 1, archivosIds: Array(20_000).fill(randomUUID()) }), 413))).toBe('CUERPO_DEMASIADO_GRANDE');
    const vacio = (await e.crear(cliente, { tipo: 'PUBLICADA' }).expect(201)).body;
    const incompleta = await ver('publicarSolicitud003', await e.publicar(cliente, vacio.solicitudId, { version: vacio.version }), 422);
    expect(codigo(incompleta)).toBe('SOLICITUD_INCOMPLETA');
    expect((incompleta.body as { detalles: { campo: string }[] }).detalles.map(d => d.campo)).toEqual(expect.arrayContaining(['descripcion', 'categoriaId']));
  });

  test('cerrarSolicitud003: 200 CERRADA, 400, 403, 404, 409 al cerrar una cerrada y 413 (el 422 declarado no tiene regla que lo produzca)', async () => {
    const s = await nueva();
    const ok = await ver('cerrarSolicitud003', await e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }), 200, 'C003SolicitudPrivada');
    expect(ok.body).toMatchObject({ estado: 'CERRADA' });
    expect(codigo(await ver('cerrarSolicitud003', await e.cerrarSolicitud(cliente, s.solicitudId, {}), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('cerrarSolicitud003', await e.cerrarSolicitud(dario, s.solicitudId, { version: 1 }), 403))).toBe('SIN_PERMISO');
    expect(codigo(await ver('cerrarSolicitud003', await e.cerrarSolicitud(otroCliente, s.solicitudId, { version: 1 }), 404))).toBe('RECURSO_NO_DISPONIBLE');
    expect(codigo(await ver('cerrarSolicitud003', await e.cerrarSolicitud(cliente, s.solicitudId, { version: (ok.body as { version: number }).version }), 409))).toBe('SOLICITUD_NO_ABIERTA');
    expect(codigo(await ver('cerrarSolicitud003', await e.cerrarSolicitud(cliente, s.solicitudId, { version: 1, relleno: 'x'.repeat(70_000) }), 413))).toBe('CUERPO_DEMASIADO_GRANDE');
  });

  test('consultarHistorialSolicitud003: versiones y bitácora conforme a su esquema, 400 sin tipo y 404 para quien no es dueño ni tiene el título', async () => {
    const s = await nueva();
    const v = await ver('consultarHistorialSolicitud003', await e.historial(cliente, s.solicitudId, '?tipo=versiones'), 200, 'C003Historial');
    expect(v.body).toMatchObject({ pagina: 1, total: 1 });
    await ver('consultarHistorialSolicitud003', await e.historial(cliente, s.solicitudId, '?tipo=bitacora&tamano=1'), 200, 'C003Historial');
    expect(codigo(await ver('consultarHistorialSolicitud003', await e.historial(cliente, s.solicitudId, ''), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('consultarHistorialSolicitud003', await e.historial(cliente, s.solicitudId, '?tipo=otro'), 400))).toBe('DATOS_INVALIDOS');
    const inexistente = (await ver('consultarHistorialSolicitud003', await e.historial(cliente, randomUUID(), '?tipo=versiones'), 404)).body;
    expect((await ver('consultarHistorialSolicitud003', await e.historial(ana, s.solicitudId, '?tipo=versiones'), 404)).body).toEqual(inexistente);
    expect((await ver('consultarHistorialSolicitud003', await e.historial(beto, s.solicitudId, '?tipo=bitacora'), 404)).body).toEqual(inexistente);
  });

  test('cargarArchivoSolicitud003 y obtenerArchivoSolicitud003: 201 PREPARADO y 200 image/webp saneada, y todos sus errores declarados', async () => {
    const creada = (await e.crear(cliente, cuerpoPublicable(e)).expect(201)).body;
    const subida = await ver('cargarArchivoSolicitud003', await e.cargar(cliente, creada.solicitudId, await foto()), 201, 'C003Archivo');
    expect(subida.body).toMatchObject({ estado: 'PREPARADO', tipoMime: 'image/webp' });
    expect(JSON.stringify(subida.body)).not.toMatch(/objetoClave|prefijo|solicitudes\//);
    expect(codigo(await ver('cargarArchivoSolicitud003', await e.cargar(cliente, creada.solicitudId, { tipoMime: 'image/gif', contenidoBase64: 'AAAA' }), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('cargarArchivoSolicitud003', await e.cargar(dario, creada.solicitudId, await foto()), 403))).toBe('SIN_PERMISO');
    expect(codigo(await ver('cargarArchivoSolicitud003', await e.cargar(otroCliente, creada.solicitudId, await foto()), 404))).toBe('RECURSO_NO_DISPONIBLE');
    expect(codigo(await ver('cargarArchivoSolicitud003', await e.cargar(cliente, creada.solicitudId, await jpegDeTamano(10_000_001)), 413))).toBe('ARCHIVO_DEMASIADO_GRANDE');
    expect(codigo(await ver('cargarArchivoSolicitud003', await e.cargar(cliente, creada.solicitudId, { tipoMime: 'image/png', contenidoBase64: Buffer.from('esto no es una imagen').toString('base64') }), 422))).toBe('IMAGEN_FORMATO_NO_ADMITIDO');
    const publicada = (await e.publicar(cliente, creada.solicitudId, { version: creada.version, archivosIds: [(subida.body as { archivoId: string }).archivoId] }).expect(200)).body;
    const imagenLeida = await ver('obtenerArchivoSolicitud003', await e.archivo(cliente, creada.solicitudId, (subida.body as { archivoId: string }).archivoId), 200, '');
    expect(imagenLeida.headers['content-type']).toBe('image/webp');
    const bytes = imagenLeida.body as Buffer;
    expect([bytes.subarray(0, 4).toString('latin1'), bytes.subarray(8, 12).toString('latin1')]).toEqual(['RIFF', 'WEBP']);
    expect(codigo(await ver('obtenerArchivoSolicitud003', await e.archivo(cliente, creada.solicitudId, 'no-es-uuid'), 400))).toBe('DATOS_INVALIDOS');
    const inexistente = (await ver('obtenerArchivoSolicitud003', await e.archivo(cliente, creada.solicitudId, randomUUID()), 404)).body;
    expect((await ver('obtenerArchivoSolicitud003', await e.archivo(ana, creada.solicitudId, (subida.body as { archivoId: string }).archivoId), 404)).body).toEqual(inexistente);
    await e.cerrarSolicitud(cliente, creada.solicitudId, { version: (publicada as { version: number }).version }).expect(200);
    expect(codigo(await ver('cargarArchivoSolicitud003', await e.cargar(cliente, creada.solicitudId, await foto()), 409))).toBe('SOLICITUD_NO_ABIERTA');
  });
});

describe('cotizaciones y aclaraciones (9 operaciones)', () => {
  test('enviarCotizacion003 y obtenerCotizacion003: 201 y 200 conforme al esquema; 400, 403, 404, 409, 413 y 422', async () => {
    const s = await nueva();
    const c = await ver('enviarCotizacion003', await e.cotizar(beto, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo)), 201, 'C003Cotizacion');
    expect(c.body).toMatchObject({ estado: 'VIGENTE', version: 1, motivosNoAceptable: [], versionVigente: { numero: 1, tipo: 'DEFINITIVA', precioCentimos: 250000 } });
    expect(JSON.stringify(c.body)).not.toMatch(/cuenta|correo|telefono/i);
    expect(codigo(await ver('enviarCotizacion003', await e.cotizar(beto, s.solicitudId, {}), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('enviarCotizacion003', await e.cotizar(otroCliente, s.solicitudId, cuerpoEstimada(1)), 403))).toBe('SIN_PERMISO');
    const inexistente = (await ver('enviarCotizacion003', await e.cotizar(beto, randomUUID(), cuerpoEstimada(1)), 404)).body;
    expect((await ver('enviarCotizacion003', await e.cotizar(ana, s.solicitudId, cuerpoEstimada(s.versionTrabajo)), 404)).body).toEqual(inexistente);
    expect(codigo(await ver('enviarCotizacion003', await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)), 409))).toBe('COTIZACION_EXISTENTE');
    expect(codigo(await ver('enviarCotizacion003', await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { exclusiones: 'x'.repeat(70_000) })), 413))).toBe('CUERPO_DEMASIADO_GRANDE');
    const propia = await crearYPublicar(e, gema, { categoriaId: e.datos.categorias.A }) as { solicitudId: string; versionTrabajo: number };
    expect(codigo(await ver('enviarCotizacion003', await e.cotizar(gema, propia.solicitudId, cuerpoEstimada(propia.versionTrabajo)), 422))).toBe('COTIZACION_PROPIA');
    const detalleAutor = await ver('obtenerCotizacion003', await e.cotizacion(beto, (c.body as { cotizacionId: string }).cotizacionId), 200, 'C003CotizacionDetalle');
    expect(detalleAutor.body).toMatchObject({ versiones: [expect.objectContaining({ numero: 1, reemplazada: false })] });
    await ver('obtenerCotizacion003', await e.cotizacion(cliente, (c.body as { cotizacionId: string }).cotizacionId), 200, 'C003CotizacionDetalle');
    expect(codigo(await ver('obtenerCotizacion003', await e.cotizacion(beto, 'no-es-uuid'), 400))).toBe('DATOS_INVALIDOS');
    const sinTitulo = (await ver('obtenerCotizacion003', await e.cotizacion(ana, (c.body as { cotizacionId: string }).cotizacionId), 404)).body;
    expect(sinTitulo).toEqual((await ver('obtenerCotizacion003', await e.cotizacion(beto, randomUUID()), 404)).body);
  });

  test('actualizarCotizacion003: 201 versión nueva, 400, 403, 404, 409 por versión, 413 y 422', async () => {
    const s = await nueva(); const c = await cotizar(s);
    const ok = await ver('actualizarCotizacion003', await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoDefinitiva(s.versionTrabajo), versionCotizacion: 1 }), 201, 'C003Cotizacion');
    expect(ok.body).toMatchObject({ version: 2, versionVigente: { numero: 2, tipo: 'DEFINITIVA' } });
    expect(codigo(await ver('actualizarCotizacion003', await e.actualizarCotizacion(beto, c.cotizacionId, cuerpoEstimada(s.versionTrabajo)), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('actualizarCotizacion003', await e.actualizarCotizacion(otroCliente, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: 2 }), 403))).toBe('SIN_PERMISO');
    expect(codigo(await ver('actualizarCotizacion003', await e.actualizarCotizacion(ana, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: 2 }), 404))).toBe('RECURSO_NO_DISPONIBLE');
    expect(codigo(await ver('actualizarCotizacion003', await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: 1 }), 409))).toBe('VERSION_DESACTUALIZADA');
    expect(codigo(await ver('actualizarCotizacion003', await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo, { exclusiones: 'x'.repeat(70_000) }), versionCotizacion: 2 }), 413))).toBe('CUERPO_DEMASIADO_GRANDE');
    expect(codigo(await ver('actualizarCotizacion003', await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoDefinitiva(s.versionTrabajo, { plazoDias: undefined }), versionCotizacion: 2 }), 422))).toBe('COTIZACION_INCOMPLETA');
  });

  test('retirarCotizacion003: 200 RETIRADA, 400, 403, 404, 409 al repetirlo y 413 (el 422 declarado no tiene regla que lo produzca)', async () => {
    const s = await nueva(); const c = await cotizar(s);
    const ok = await ver('retirarCotizacion003', await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }), 200, 'C003Cotizacion');
    expect(ok.body).toMatchObject({ estado: 'RETIRADA', motivosNoAceptable: ['RETIRADA'] });
    expect(codigo(await ver('retirarCotizacion003', await e.retirarCotizacion(beto, c.cotizacionId, {}), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('retirarCotizacion003', await e.retirarCotizacion(otroCliente, c.cotizacionId, { versionCotizacion: 2 }), 403))).toBe('SIN_PERMISO');
    expect(codigo(await ver('retirarCotizacion003', await e.retirarCotizacion(ana, c.cotizacionId, { versionCotizacion: 2 }), 404))).toBe('RECURSO_NO_DISPONIBLE');
    expect(codigo(await ver('retirarCotizacion003', await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 2 }), 409))).toBe('COTIZACION_RETIRADA');
    expect(codigo(await ver('retirarCotizacion003', await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 2, relleno: 'x'.repeat(70_000) }), 413))).toBe('CUERPO_DEMASIADO_GRANDE');
  });

  test('listarMisCotizaciones003: 200 con la página de las propias, 400 y 403 sin perfil de prestador', async () => {
    const s = await nueva(); await cotizar(s);
    const r = await ver('listarMisCotizaciones003', await e.misCotizaciones(beto, '?pagina=1&tamano=1'), 200, 'C003PaginaCotizaciones');
    expect(r.body).toMatchObject({ pagina: 1, tamano: 1 });
    expect(codigo(await ver('listarMisCotizaciones003', await e.misCotizaciones(beto, '?pagina=0'), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('listarMisCotizaciones003', await e.misCotizaciones(otroCliente), 403))).toBe('SIN_PERMISO');
  });

  test('listarCotizacionesDeSolicitud003: 200 lista y comparación con ids, 400, 404 para quien no es dueño y 422 LIMITE_COMPARACION', async () => {
    const s = await nueva(); const c = await cotizar(s);
    await ver('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s.solicitudId), 200, 'C003PaginaCotizaciones');
    const comparacion = await ver('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${c.cotizacionId}`), 200, 'C003PaginaCotizaciones');
    expect(comparacion.body).toMatchObject({ total: 1, elementos: [expect.objectContaining({ cotizacionId: c.cotizacionId, prestadorNombrePublico: 'Beto Gasfitero' })] });
    expect(codigo(await ver('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s.solicitudId, '?ids=no-es-uuid'), 400))).toBe('DATOS_INVALIDOS');
    const inexistente = (await ver('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, randomUUID()), 404)).body;
    for (const tk of [otroCliente, beto, ana]) expect((await ver('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(tk, s.solicitudId), 404)).body).toEqual(inexistente);
    const once = Array.from({ length: 11 }, () => randomUUID()).join(',');
    expect(codigo(await ver('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${once}`), 422))).toBe('LIMITE_COMPARACION');
  });

  test('enviarAclaracion003 y listarAclaraciones003: 201 y 200 conforme al esquema; 400, 404, 409 con la cotización retirada, 413 y 422 con el mensaje 21', async () => {
    const s = await nueva(); const c = await cotizar(s);
    const m = await ver('enviarAclaracion003', await e.aclarar(cliente, c.cotizacionId, { texto: '¿Incluye materiales?' }), 201, 'C003Aclaracion');
    expect(m.body).toMatchObject({ numero: 1, autor: 'CLIENTE', versionCotizacion: 1 });
    await e.aclarar(beto, c.cotizacionId, { texto: 'Sí, incluye materiales.' }).expect(201);
    const hilo = await ver('listarAclaraciones003', await e.aclaraciones(cliente, c.cotizacionId), 200, 'C003PaginaAclaraciones');
    expect(hilo.body).toMatchObject({ total: 2 });
    await ver('listarAclaraciones003', await e.aclaraciones(beto, c.cotizacionId, '?pagina=1&tamano=1'), 200, 'C003PaginaAclaraciones');
    expect(codigo(await ver('enviarAclaracion003', await e.aclarar(cliente, c.cotizacionId, { texto: '' }), 400))).toBe('DATOS_INVALIDOS');
    expect(codigo(await ver('listarAclaraciones003', await e.aclaraciones(cliente, 'no-es-uuid'), 400))).toBe('DATOS_INVALIDOS');
    const inexistente = (await ver('enviarAclaracion003', await e.aclarar(cliente, randomUUID(), { texto: 'x' }), 404)).body;
    expect((await ver('enviarAclaracion003', await e.aclarar(ana, c.cotizacionId, { texto: 'x' }), 404)).body).toEqual(inexistente);
    expect((await ver('listarAclaraciones003', await e.aclaraciones(otroCliente, c.cotizacionId), 404)).body).toEqual((await ver('listarAclaraciones003', await e.aclaraciones(cliente, randomUUID()), 404)).body);
    expect(codigo(await ver('enviarAclaracion003', await e.aclarar(cliente, c.cotizacionId, { texto: 'x'.repeat(70_000) }), 413))).toBe('CUERPO_DEMASIADO_GRANDE');
    for (let i = 3; i <= 20; i += 1) await e.aclarar(i % 2 ? cliente : beto, c.cotizacionId, { texto: `Mensaje ${i}` }).expect(201);
    expect(codigo(await ver('enviarAclaracion003', await e.aclarar(cliente, c.cotizacionId, { texto: 'Mensaje 21' }), 422))).toBe('LIMITE_ACLARACIONES');
    const otra = await nueva(); const co = await cotizar(otra);
    await e.retirarCotizacion(beto, co.cotizacionId, { versionCotizacion: 1 }).expect(200);
    expect(codigo(await ver('enviarAclaracion003', await e.aclarar(cliente, co.cotizacionId, { texto: 'Tarde' }), 409))).toBe('COTIZACION_RETIRADA');
  });

  test('enviarAclaracion003: 403 SIN_PERMISO si el dueño de la solicitud ya no tiene el perfil de cliente', async () => {
    const propia = await crearYPublicar(e, gema, { categoriaId: e.datos.categorias.A }) as { solicitudId: string; versionTrabajo: number };
    const c = (await e.cotizar(ana, propia.solicitudId, cuerpoEstimada(propia.versionTrabajo)).expect(201)).body;
    await e.aclarar(gema, c.cotizacionId, { texto: 'Con el perfil de cliente' }).expect(201);
    await e.db.query("DELETE FROM perfiles_habilitados WHERE usuario_id=$1 AND perfil='cliente'", [e.datos.prestadores.gema.cuentaId]);
    expect(codigo(await ver('enviarAclaracion003', await e.aclarar(gema, c.cotizacionId, { texto: 'Sin el perfil' }), 403))).toBe('SIN_PERMISO');
  });
});

describe('503 en las 18 operaciones y cobertura final', () => {
  test('con la base de datos no disponible (tablas de la 003 ausentes un instante en la base efímera) las 18 devuelven 503 DEPENDENCIA_NO_DISPONIBLE conforme a su esquema, sin detalles internos', async () => {
    const s = await nueva(); const c = await cotizar(s);
    const foto1 = await foto();
    const archivoId = (await e.cargar(cliente, (await e.crear(cliente, cuerpoPublicable(e)).expect(201)).body.solicitudId, foto1).expect(201)).body.archivoId as string;
    const borrador = (await e.crear(cliente, cuerpoPublicable(e)).expect(201)).body;
    const casos: Record<string, () => Promise<Respuesta>> = {
      crearSolicitud003: () => e.crear(cliente, { tipo: 'PUBLICADA' }), listarMisSolicitudes003: () => e.listar(cliente), listarOportunidades003: () => e.oportunidades(beto),
      obtenerSolicitud003: () => e.obtener(cliente, s.solicitudId), editarSolicitud003: () => e.editar(cliente, s.solicitudId, { version: s.version, medidas: 'x' }),
      publicarSolicitud003: () => e.publicar(cliente, borrador.solicitudId, { version: borrador.version }), cerrarSolicitud003: () => e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }),
      consultarHistorialSolicitud003: () => e.historial(cliente, s.solicitudId, '?tipo=versiones'), cargarArchivoSolicitud003: () => e.cargar(cliente, s.solicitudId, foto1),
      obtenerArchivoSolicitud003: () => e.archivo(cliente, s.solicitudId, archivoId), enviarCotizacion003: () => e.cotizar(ana, s.solicitudId, cuerpoEstimada(s.versionTrabajo)),
      listarCotizacionesDeSolicitud003: () => e.cotizacionesDe(cliente, s.solicitudId), listarMisCotizaciones003: () => e.misCotizaciones(beto), obtenerCotizacion003: () => e.cotizacion(beto, c.cotizacionId),
      actualizarCotizacion003: () => e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: c.version }),
      retirarCotizacion003: () => e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: c.version }), enviarAclaracion003: () => e.aclarar(cliente, c.cotizacionId, { texto: 'Hola' }),
      listarAclaraciones003: () => e.aclaraciones(cliente, c.cotizacionId),
    };
    expect(Object.keys(casos).sort()).toEqual([...operaciones.keys()].sort());
    await e.db.query('ALTER TABLE solicitudes RENAME TO solicitudes_fuera');
    await e.db.query('ALTER TABLE cotizaciones RENAME TO cotizaciones_fuera');
    try {
      for (const [op, ejecutar] of Object.entries(casos)) {
        const r = await ver(op, await ejecutar(), 503);
        expect([op, codigo(r)]).toEqual([op, 'DEPENDENCIA_NO_DISPONIBLE']);
        expect(JSON.stringify(r.body)).not.toMatch(/relation|solicitudes|cotizaciones|sql|stack|42P01/i);
      }
    } finally {
      await e.db.query('ALTER TABLE cotizaciones_fuera RENAME TO cotizaciones');
      await e.db.query('ALTER TABLE solicitudes_fuera RENAME TO solicitudes');
    }
    await e.obtener(cliente, s.solicitudId).expect(200); // restablecida: sin estado parcial
  }, 180000);

  test('COBERTURA: cada código HTTP declarado por cada una de las 18 operaciones se observó en una respuesta real validada, salvo los códigos justificados sin escenario', () => {
    const faltantes: string[] = []; const resumen: string[] = [];
    for (const [id, { operacion }] of operaciones) {
      const declarados = Object.keys(operacion.responses).map(Number).sort();
      const vistos = observados.get(id) ?? new Set<number>();
      const exentos = sinEscenarioAlcanzable[id]?.codigos ?? [];
      const faltan = declarados.filter(c => !vistos.has(c) && !exentos.includes(c));
      if (faltan.length) faltantes.push(`${id}: ${faltan.join(',')}`);
      resumen.push(`${id}: ${declarados.map(c => vistos.has(c) ? String(c) : `(${c})`).join(' ')}`);
    }
    expect(faltantes).toEqual([]);
    // Las exenciones son solo las justificadas y realmente no se observaron (si se observaran, la lista sobraría).
    expect(Object.keys(sinEscenarioAlcanzable).sort()).toEqual(['cerrarSolicitud003', 'retirarCotizacion003']);
    for (const [id, { codigos }] of Object.entries(sinEscenarioAlcanzable)) for (const c of codigos) expect([id, c, observados.get(id)?.has(c)]).toEqual([id, c, false]);
    expect([...observados.keys()].sort()).toEqual([...operaciones.keys()].sort());
    process.stdout.write(`\nCobertura contractual T089 (entre paréntesis, declarados sin escenario):\n${resumen.join('\n')}\n`);
  });
});
