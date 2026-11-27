import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { cargarContrato003, validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { crearYPublicar, cuerpoEstimada, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T081 · contrato de las tres operaciones de HU11: esquemas, errores, seguridad Bearer, `Origin`, `Idempotency-Key`, el parámetro `ids` (hasta 10) y ejemplos HTTP.
// Cada respuesta real se valida contra el esquema del contrato normativo y su estado debe figurar entre los declarados por la operación.
interface Operacion { operationId: string; parameters?: { $ref?: string }[]; security?: Record<string, unknown>[]; responses: Record<string, { $ref?: string }>; 'x-limite-cuerpo-bytes'?: number }
const operacionesDeLaHistoria = ['listarCotizacionesDeSolicitud003', 'enviarAclaracion003', 'listarAclaraciones003'] as const;
const control = { fallar: false };
let e: EntornoUs1; let cliente: string; let otroCliente: string; let beto: string; let ana: string; let gema: string;
let contrato: { paths: Record<string, Record<string, Operacion>>; components: { responses: Record<string, { content: { 'application/json': { schema: { $ref: string } } } }> } };
let solicitud: { solicitudId: string; version: number; versionTrabajo: number };
let cotizacion: { cotizacionId: string };
type Respuesta = { status: number; body: unknown; headers: Record<string, unknown> };
const operaciones = new Map<string, { metodo: string; ruta: string; operacion: Operacion }>();

async function conforme<T extends Respuesta>(operationId: string, r: T, esquema?: string): Promise<T> {
  const { operacion } = operaciones.get(operationId)!;
  expect([operationId, r.status, Object.keys(operacion.responses).includes(String(r.status))]).toEqual([operationId, r.status, true]);
  const declarada = operacion.responses[String(r.status)]!;
  const nombre = esquema ?? (declarada.$ref ? contrato.components.responses[declarada.$ref.split('/').pop()!]?.content['application/json'].schema.$ref.split('/').pop() : undefined);
  if (nombre) await validarRespuesta003(nombre, r.body);
  expect(r.headers['cache-control']).toBe('no-store');
  expect(r.headers['x-content-type-options']).toBe('nosniff');
  return r;
}
const codigo = (r: Respuesta) => (r.body as { codigo: string }).codigo;
const catA = () => e.datos.categorias.A;

beforeAll(async () => {
  contrato = await cargarContrato003() as unknown as typeof contrato;
  for (const [ruta, item] of Object.entries(contrato.paths)) for (const [metodo, operacion] of Object.entries(item)) operaciones.set(operacion.operationId, { metodo, ruta, operacion });
  e = await montarUs1({ ahora: () => { if (control.fallar) throw new Error('Fallo simulado de infraestructura'); return new Date(); } });
  [cliente, otroCliente, beto, ana, gema] = await Promise.all([e.token(e.datos.clientes.clienteUno), e.token(e.datos.clientes.clienteDos), e.token(e.datos.prestadores.beto),
    e.token(e.datos.prestadores.ana), e.token(e.datos.prestadores.gema)]) as [string, string, string, string, string];
  solicitud = await crearYPublicar(e, cliente, { categoriaId: catA() }) as typeof solicitud;
  cotizacion = (await e.cotizar(beto, solicitud.solicitudId, cuerpoEstimada(solicitud.versionTrabajo)).expect(201)).body;
}, 300000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('definición de las tres operaciones', () => {
  test('el contrato fuente las declara y la aplicación las registra con su ruta y método', () => {
    for (const id of operacionesDeLaHistoria) expect(operaciones.has(id)).toBe(true);
    const rutas = ((e.app.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router.stack
      .flatMap(({ route }) => route ? Object.keys(route.methods).map(m => `${m.toUpperCase()} ${route.path.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')}`) : []));
    for (const id of operacionesDeLaHistoria) { const { metodo, ruta } = operaciones.get(id)!; expect(rutas).toContain(`${metodo.toUpperCase()} ${ruta}`); }
  });
  test('la aplicación arranca en modo de prueba con las 18 operaciones de HU07, HU08, HU10 y HU11', () => {
    const registradas = ((e.app.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router.stack
      .flatMap(({ route }) => route ? Object.keys(route.methods).map(m => `${m.toUpperCase()} ${route.path.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')}`) : []))
      .filter(r => /\/(solicitudes|cotizaciones)/.test(r));
    const del003 = [...operaciones.values()].filter(o => /003$/.test(o.operacion.operationId) && /^\/(solicitudes|cotizaciones)/.test(o.ruta)).map(o => `${o.metodo.toUpperCase()} ${o.ruta}`);
    const esperadas = del003.filter(r => registradas.includes(r));
    expect(esperadas).toHaveLength(18);
  });
  test('todas exigen Bearer; la escritura declara Origin e Idempotency-Key y las lecturas no; la lista declara ids, pagina y tamano', () => {
    for (const id of operacionesDeLaHistoria) {
      const { metodo, operacion } = operaciones.get(id)!;
      expect(JSON.stringify(operacion.security)).toContain('bearerAuth');
      const refs = (operacion.parameters ?? []).map(p => p.$ref ?? '');
      const muta = metodo !== 'get';
      expect([id, refs.includes('#/components/parameters/Origin'), refs.includes('#/components/parameters/IdempotencyKey')]).toEqual([id, muta, muta]);
      if (muta) expect(operacion['x-limite-cuerpo-bytes']).toBe(65536);
    }
    expect((operaciones.get('listarCotizacionesDeSolicitud003')!.operacion.parameters ?? []).map(p => p.$ref)).toEqual(expect.arrayContaining([
      '#/components/parameters/C003IdsComparacion', '#/components/parameters/C003Pagina', '#/components/parameters/C003Tamano']));
  });
  test('cada operación declara los errores de su categoría', () => {
    for (const id of operacionesDeLaHistoria) {
      const { metodo, operacion } = operaciones.get(id)!; const declarados = Object.keys(operacion.responses);
      expect(declarados).toEqual(expect.arrayContaining(['400', '401', '404', '503']));
      if (metodo !== 'get') expect(declarados).toEqual(expect.arrayContaining(['403', '409', '413', '422']));
    }
    expect(Object.keys(operaciones.get('listarCotizacionesDeSolicitud003')!.operacion.responses)).toContain('422');
  });
});

describe('respuestas exitosas conforme al contrato (ejemplos HTTP)', () => {
  test('enviar una aclaración: 201 con el mensaje; listar el hilo: 200 con su página', async () => {
    const r = await conforme('enviarAclaracion003', await e.aclarar(cliente, cotizacion.cotizacionId, { texto: '¿Cuándo podría empezar?' }), 'C003Aclaracion');
    expect([r.status, r.body]).toEqual([201, expect.objectContaining({ numero: 1, autor: 'CLIENTE', versionCotizacion: 1 })]);
    await conforme('enviarAclaracion003', await e.aclarar(beto, cotizacion.cotizacionId, { texto: 'La semana próxima.' }), 'C003Aclaracion');
    const l = await conforme('listarAclaraciones003', await e.aclaraciones(beto, cotizacion.cotizacionId), 'C003PaginaAclaraciones');
    expect(l.body).toMatchObject({ total: 2, pagina: 1, tamano: 20 });
  });
  test('listar las cotizaciones de mi solicitud: página; con ids, la comparación', async () => {
    const lista = await conforme('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, solicitud.solicitudId), 'C003PaginaCotizaciones');
    expect((lista.body as { total: number }).total).toBe(1);
    const comparacion = await conforme('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, solicitud.solicitudId, `?ids=${cotizacion.cotizacionId}`), 'C003PaginaCotizaciones');
    expect((comparacion.body as { elementos: { cotizacionId: string; prestadorNombrePublico: string }[] }).elementos).toEqual([expect.objectContaining({ cotizacionId: cotizacion.cotizacionId, prestadorNombrePublico: 'Beto Gasfitero' })]);
  });
});

describe('errores 400, 401 y 403', () => {
  test('401 NO_AUTENTICADO sin sesión en cada operación', async () => {
    const id = randomUUID();
    for (const [op, r] of [['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(undefined, solicitud.solicitudId)], ['enviarAclaracion003', await e.aclarar(undefined, id, { texto: 'x' })],
      ['listarAclaraciones003', await e.aclaraciones(undefined, id)]] as const) expect([op, codigo(await conforme(op, r, 'C003Error401'))]).toEqual([op, 'NO_AUTENTICADO']);
  });
  test('400 CABECERA_REQUERIDA sin Origin o sin Idempotency-Key, y 403 ORIGEN_NO_ADMITIDO con un origen ajeno', async () => {
    const url = `/api/v1/cotizaciones/${cotizacion.cotizacionId}/aclaraciones`;
    const base = () => e.http.post(url).set('Authorization', `Bearer ${cliente}`).send({ texto: 'Hola' });
    expect(codigo(await conforme('enviarAclaracion003', await base().set('Idempotency-Key', randomUUID()), 'C003Error400'))).toBe('CABECERA_REQUERIDA');
    expect(codigo(await conforme('enviarAclaracion003', await base().set('Origin', e.config.origen), 'C003Error400'))).toBe('CABECERA_REQUERIDA');
    expect(codigo(await conforme('enviarAclaracion003', await base().set('Origin', 'https://otro.example').set('Idempotency-Key', randomUUID()), 'C003Error403'))).toBe('ORIGEN_NO_ADMITIDO');
  });
  test('400 DATOS_INVALIDOS ante cuerpos, identificadores, ids y consultas inválidos, y PROPIEDAD_NO_ADMITIDA ante campos no declarados', async () => {
    const c = cotizacion.cotizacionId; const s = solicitud.solicitudId;
    const invalidas: [string, Awaited<ReturnType<typeof e.aclarar>>][] = [
      ['enviarAclaracion003', await e.aclarar(cliente, c, {})], ['enviarAclaracion003', await e.aclarar(cliente, c, { texto: '' })], ['enviarAclaracion003', await e.aclarar(cliente, c, { texto: 'x'.repeat(1001) })],
      ['enviarAclaracion003', await e.aclarar(cliente, c, { texto: '   ' })], ['enviarAclaracion003', await e.aclarar(cliente, 'no-es-uuid', { texto: 'x' })],
      ['listarAclaraciones003', await e.aclaraciones(cliente, 'no-es-uuid')], ['listarAclaraciones003', await e.aclaraciones(cliente, c, '?pagina=0')], ['listarAclaraciones003', await e.aclaraciones(cliente, c, '?tamano=51')],
      ['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, 'no-es-uuid')], ['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s, '?ids=no-es-uuid')],
      ['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s, `?ids=${c},`)], ['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s, '?pagina=0')],
      ['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s, '?tamano=51')],
    ];
    for (const [op, r] of invalidas) expect([op, codigo(await conforme(op, r, 'C003Error400'))]).toEqual([op, 'DATOS_INVALIDOS']);
    expect(codigo(await conforme('enviarAclaracion003', await e.aclarar(cliente, c, { texto: 'x', adjunto: 'a.pdf' }), 'C003Error400'))).toBe('PROPIEDAD_NO_ADMITIDA');
  });
  test('403 SIN_PERMISO si el dueño de la solicitud ya no tiene el perfil de cliente', async () => {
    const propia = await crearYPublicar(e, gema, { categoriaId: catA() });
    const c = (await e.cotizar(ana, propia.solicitudId, cuerpoEstimada(propia.versionTrabajo)).expect(201)).body;
    await e.aclarar(gema, c.cotizacionId, { texto: 'Con el perfil de cliente' }).expect(201);
    await e.db.query("DELETE FROM perfiles_habilitados WHERE usuario_id=$1 AND perfil='cliente'", [e.datos.prestadores.gema.cuentaId]);
    expect(codigo(await conforme('enviarAclaracion003', await e.aclarar(gema, c.cotizacionId, { texto: 'Sin el perfil' }), 'C003Error403'))).toBe('SIN_PERMISO');
  });
});

describe('errores 404, 409, 413, 422 y 503', () => {
  test('404 RECURSO_NO_DISPONIBLE para un recurso inexistente, ajeno o sin título, sin distinguirlos', async () => {
    const f = randomUUID(); const c = cotizacion.cotizacionId; const s = solicitud.solicitudId;
    const respuestas: [string, Awaited<ReturnType<typeof e.aclarar>>][] = [
      ['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, f)], ['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(otroCliente, s)], ['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(beto, s)],
      ['listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s, `?ids=${f}`)],
      ['enviarAclaracion003', await e.aclarar(cliente, f, { texto: 'x' })], ['enviarAclaracion003', await e.aclarar(ana, c, { texto: 'x' })], ['enviarAclaracion003', await e.aclarar(otroCliente, c, { texto: 'x' })],
      ['listarAclaraciones003', await e.aclaraciones(cliente, f)], ['listarAclaraciones003', await e.aclaraciones(ana, c)], ['listarAclaraciones003', await e.aclaraciones(otroCliente, c)],
    ];
    const cuerpos = new Set<string>();
    for (const [op, r] of respuestas) { const x = await conforme(op, r as unknown as Respuesta, 'C003Error404'); expect(codigo(x)).toBe('RECURSO_NO_DISPONIBLE'); cuerpos.add(JSON.stringify(x.body)); }
    expect(cuerpos.size).toBe(1);
  });
  test('409: COTIZACION_RETIRADA, SOLICITUD_NO_ABIERTA y CLAVE_IDEMPOTENCIA_REUTILIZADA', async () => {
    const s = await crearYPublicar(e, cliente, { categoriaId: catA() });
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const clave = randomUUID();
    await e.aclarar(cliente, c.cotizacionId, { texto: 'Uno' }, clave).expect(201);
    expect(codigo(await conforme('enviarAclaracion003', await e.aclarar(cliente, c.cotizacionId, { texto: 'Otro' }, clave), 'C003Error409'))).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
    const cerrada = await crearYPublicar(e, cliente, { categoriaId: catA() });
    const cc = (await e.cotizar(beto, cerrada.solicitudId, cuerpoEstimada(cerrada.versionTrabajo)).expect(201)).body;
    await e.cerrarSolicitud(cliente, cerrada.solicitudId, { version: cerrada.version }).expect(200);
    expect(codigo(await conforme('enviarAclaracion003', await e.aclarar(cliente, cc.cotizacionId, { texto: 'Tarde' }), 'C003Error409'))).toBe('SOLICITUD_NO_ABIERTA');
    await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }).expect(200);
    expect(codigo(await conforme('enviarAclaracion003', await e.aclarar(beto, c.cotizacionId, { texto: 'Retirada' }), 'C003Error409'))).toBe('COTIZACION_RETIRADA');
  });
  test('413 CUERPO_DEMASIADO_GRANDE con un JSON de más de 65 536 bytes', async () => {
    const r = await conforme('enviarAclaracion003', await e.aclarar(cliente, cotizacion.cotizacionId, { texto: 'x'.repeat(70_000) }), 'C003Error413');
    expect([r.status, codigo(r)]).toEqual([413, 'CUERPO_DEMASIADO_GRANDE']);
  }, 60000);
  test('422: LIMITE_ACLARACIONES con el mensaje 21 y LIMITE_COMPARACION con 11 identificadores', async () => {
    const s = await crearYPublicar(e, cliente, { categoriaId: catA() });
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    for (let i = 1; i <= 20; i += 1) await e.aclarar(i % 2 ? cliente : beto, c.cotizacionId, { texto: `Mensaje ${i}` }).expect(201);
    expect(codigo(await conforme('enviarAclaracion003', await e.aclarar(cliente, c.cotizacionId, { texto: 'Mensaje 21' }), 'C003Error422'))).toBe('LIMITE_ACLARACIONES');
    const ids = Array.from({ length: 11 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`).join(',');
    expect(codigo(await conforme('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${ids}`), 'C003Error422'))).toBe('LIMITE_COMPARACION');
    const diez = ids.split(',').slice(0, 10).join(',');
    expect((await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${diez}`)).status).toBe(404);
  });
  test('503 DEPENDENCIA_NO_DISPONIBLE ante un fallo de infraestructura, sin detalles internos ni estado parcial', async () => {
    const s = await crearYPublicar(e, cliente, { categoriaId: catA() });
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    control.fallar = true;
    try {
      const r = await conforme('listarCotizacionesDeSolicitud003', await e.cotizacionesDe(cliente, s.solicitudId), 'C003Error503');
      expect([r.status, codigo(r)]).toEqual([503, 'DEPENDENCIA_NO_DISPONIBLE']);
      expect(JSON.stringify(r.body)).not.toMatch(/Fallo simulado|infraestructura|stack|sql/i);
    } finally { control.fallar = false; }
    // Escritura: la tabla del hilo deja de existir un momento (base efímera de esta suite) y la operación falla sin detalles internos ni estado parcial.
    await e.db.query('ALTER TABLE cotizaciones_aclaraciones RENAME TO cotizaciones_aclaraciones_fuera');
    try {
      const w = await conforme('enviarAclaracion003', await e.aclarar(cliente, c.cotizacionId, { texto: 'Con fallo' }), 'C003Error503');
      expect([w.status, codigo(w)]).toEqual([503, 'DEPENDENCIA_NO_DISPONIBLE']);
      expect(JSON.stringify(w.body)).not.toMatch(/cotizaciones_aclaraciones|relation|sql|stack/i);
    } finally { await e.db.query('ALTER TABLE cotizaciones_aclaraciones_fuera RENAME TO cotizaciones_aclaraciones'); }
    expect(Number(((await e.db.query('SELECT count(*) AS n FROM cotizaciones_aclaraciones WHERE cotizacion_id=$1', [c.cotizacionId])) as { n: string }[])[0]!.n)).toBe(0);
    await e.aclarar(cliente, c.cotizacionId, { texto: 'Sin fallo' }).expect(201);
  });
});
