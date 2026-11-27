import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { cargarContrato003, validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { crearYPublicar, cuerpoDefinitiva, cuerpoEstimada, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T072 · contrato de las cinco operaciones de HU10: esquemas, errores, seguridad Bearer, `Origin`, `Idempotency-Key` y ejemplos HTTP. Cada respuesta real se valida
// contra el esquema del contrato normativo y su estado debe figurar entre los declarados por la operación.
interface Operacion { operationId: string; parameters?: { $ref?: string }[]; security?: Record<string, unknown>[]; responses: Record<string, { $ref?: string }>; 'x-limite-cuerpo-bytes'?: number }
const operacionesDeLaHistoria = ['enviarCotizacion003', 'listarMisCotizaciones003', 'obtenerCotizacion003', 'actualizarCotizacion003', 'retirarCotizacion003'] as const;
const control = { fallar: false };
const reloj = { desfase: 0 };
let e: EntornoUs1; let cliente: string; let otroCliente: string; let beto: string; let ana: string;
let contrato: { paths: Record<string, Record<string, Operacion>>; components: { responses: Record<string, { content: { 'application/json': { schema: { $ref: string } } } }> } };
let publicada: { solicitudId: string; version: number; versionTrabajo: number };
let cotizacion: { cotizacionId: string; version: number };
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

beforeAll(async () => {
  contrato = await cargarContrato003() as unknown as typeof contrato;
  for (const [ruta, item] of Object.entries(contrato.paths)) for (const [metodo, operacion] of Object.entries(item)) operaciones.set(operacion.operationId, { metodo, ruta, operacion });
  e = await montarUs1({ ahora: () => { if (control.fallar) throw new Error('Fallo simulado de infraestructura'); return new Date(Date.now() + reloj.desfase); } });
  [cliente, otroCliente, beto, ana] = await Promise.all([e.token(e.datos.clientes.clienteUno), e.token(e.datos.clientes.clienteDos), e.token(e.datos.prestadores.beto), e.token(e.datos.prestadores.ana)]) as [string, string, string, string];
  publicada = await crearYPublicar(e, cliente) as typeof publicada;
  cotizacion = (await e.cotizar(beto, publicada.solicitudId, cuerpoEstimada(publicada.versionTrabajo)).expect(201)).body;
}, 300000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('definición de las cinco operaciones', () => {
  test('el contrato fuente las declara y la aplicación las registra con su ruta y método', () => {
    for (const id of operacionesDeLaHistoria) expect(operaciones.has(id)).toBe(true);
    const rutas = ((e.app.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router.stack
      .flatMap(({ route }) => route ? Object.keys(route.methods).map(m => `${m.toUpperCase()} ${route.path.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')}`) : []));
    for (const id of operacionesDeLaHistoria) { const { metodo, ruta } = operaciones.get(id)!; expect(rutas).toContain(`${metodo.toUpperCase()} ${ruta}`); }
    expect(rutas.filter(r => r.includes('/cotizaciones'))).toHaveLength(operacionesDeLaHistoria.length);
  });
  test('todas exigen Bearer; las mutaciones declaran Origin e Idempotency-Key y las lecturas no', () => {
    for (const id of operacionesDeLaHistoria) {
      const { metodo, operacion } = operaciones.get(id)!;
      expect(JSON.stringify(operacion.security)).toContain('bearerAuth');
      const refs = (operacion.parameters ?? []).map(p => p.$ref ?? '');
      const muta = metodo !== 'get';
      expect([id, refs.includes('#/components/parameters/Origin'), refs.includes('#/components/parameters/IdempotencyKey')]).toEqual([id, muta, muta]);
      if (muta) expect(operacion['x-limite-cuerpo-bytes']).toBe(65536);
    }
  });
  test('cada operación declara los errores de su categoría', () => {
    for (const id of operacionesDeLaHistoria) {
      const { metodo, operacion } = operaciones.get(id)!; const declarados = Object.keys(operacion.responses);
      expect(declarados).toEqual(expect.arrayContaining(['400', '401', '503']));
      if (metodo !== 'get') expect(declarados).toEqual(expect.arrayContaining(['403', '404', '409', '413', '422']));
    }
  });
});

describe('respuestas exitosas conforme al contrato (ejemplos HTTP)', () => {
  test('enviar: 201 con la cotización vigente', async () => {
    const s = await crearYPublicar(e, cliente);
    const r = await conforme('enviarCotizacion003', await e.cotizar(beto, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo)), 'C003Cotizacion');
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estado: 'VIGENTE', motivosNoAceptable: [], versionVigente: { tipo: 'DEFINITIVA', precioCentimos: 250000 } });
  });
  test('actualizar: 201 con la nueva versión; retirar: 200 con la cotización retirada', async () => {
    const s = await crearYPublicar(e, cliente);
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const act = await conforme('actualizarCotizacion003', await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoDefinitiva(s.versionTrabajo), versionCotizacion: 1 }), 'C003Cotizacion');
    expect([act.status, (act.body as { version: number }).version]).toEqual([201, 2]);
    const ret = await conforme('retirarCotizacion003', await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 2 }), 'C003Cotizacion');
    expect([ret.status, (ret.body as { estado: string }).estado]).toEqual([200, 'RETIRADA']);
  });
  test('obtener: el detalle con todas las versiones para el autor y para el cliente dueño', async () => {
    for (const tk of [beto, cliente]) {
      const r = await conforme('obtenerCotizacion003', await e.cotizacion(tk, cotizacion.cotizacionId), 'C003CotizacionDetalle');
      expect(r.status).toBe(200);
    }
  });
  test('listar mis cotizaciones: página con su esquema', async () => {
    const r = await conforme('listarMisCotizaciones003', await e.misCotizaciones(beto), 'C003PaginaCotizaciones');
    expect((r.body as { total: number }).total).toBeGreaterThan(0);
  });
});

describe('errores 400, 401 y 403', () => {
  test('401 NO_AUTENTICADO sin sesión en cada operación', async () => {
    const id = randomUUID();
    for (const [op, r] of [['enviarCotizacion003', await e.cotizar(undefined, publicada.solicitudId, cuerpoEstimada(1))], ['listarMisCotizaciones003', await e.misCotizaciones(undefined)],
      ['obtenerCotizacion003', await e.cotizacion(undefined, id)], ['actualizarCotizacion003', await e.actualizarCotizacion(undefined, id, { ...cuerpoEstimada(1), versionCotizacion: 1 })],
      ['retirarCotizacion003', await e.retirarCotizacion(undefined, id, { versionCotizacion: 1 })]] as const) {
      expect([op, codigo(await conforme(op, r, 'C003Error401'))]).toEqual([op, 'NO_AUTENTICADO']);
    }
  });
  test('400 CABECERA_REQUERIDA sin Origin o sin Idempotency-Key, y 403 ORIGEN_NO_ADMITIDO con un origen ajeno', async () => {
    const url = `/api/v1/solicitudes/${publicada.solicitudId}/cotizaciones`;
    const base = () => e.http.post(url).set('Authorization', `Bearer ${beto}`).send(cuerpoEstimada(publicada.versionTrabajo));
    expect(codigo(await conforme('enviarCotizacion003', await base().set('Idempotency-Key', randomUUID()), 'C003Error400'))).toBe('CABECERA_REQUERIDA');
    expect(codigo(await conforme('enviarCotizacion003', await base().set('Origin', e.config.origen), 'C003Error400'))).toBe('CABECERA_REQUERIDA');
    expect(codigo(await conforme('enviarCotizacion003', await base().set('Origin', 'https://otro.example').set('Idempotency-Key', randomUUID()), 'C003Error403'))).toBe('ORIGEN_NO_ADMITIDO');
  });
  test('400 DATOS_INVALIDOS ante cuerpos, identificadores y consultas inválidos, y PROPIEDAD_NO_ADMITIDA ante campos no declarados', async () => {
    const s = publicada.solicitudId; const c = cotizacion.cotizacionId; const v = publicada.versionTrabajo;
    const invalidas: [string, Awaited<ReturnType<typeof e.cotizar>>][] = [
      ['enviarCotizacion003', await e.cotizar(beto, s, {})], ['enviarCotizacion003', await e.cotizar(beto, s, cuerpoEstimada(v, { tipo: 'OTRA' }))],
      ['enviarCotizacion003', await e.cotizar(beto, s, cuerpoEstimada(v, { precioCentimos: 0 }))], ['enviarCotizacion003', await e.cotizar(beto, s, cuerpoEstimada(v, { precioCentimos: 1.5 }))],
      ['enviarCotizacion003', await e.cotizar(beto, s, cuerpoEstimada(v, { alcance: '' }))], ['enviarCotizacion003', await e.cotizar(beto, s, cuerpoEstimada(v, { versionTrabajoSolicitud: 0 }))],
      ['enviarCotizacion003', await e.cotizar(beto, 'no-es-uuid', cuerpoEstimada(v))],
      ['actualizarCotizacion003', await e.actualizarCotizacion(beto, c, cuerpoEstimada(v))], ['actualizarCotizacion003', await e.actualizarCotizacion(beto, 'no-es-uuid', { ...cuerpoEstimada(v), versionCotizacion: 1 })],
      ['retirarCotizacion003', await e.retirarCotizacion(beto, c, {})], ['retirarCotizacion003', await e.retirarCotizacion(beto, c, { versionCotizacion: 0 })],
      ['obtenerCotizacion003', await e.cotizacion(beto, 'no-es-uuid')], ['listarMisCotizaciones003', await e.misCotizaciones(beto, '?pagina=0')], ['listarMisCotizaciones003', await e.misCotizaciones(beto, '?tamano=51')],
    ];
    for (const [op, r] of invalidas) expect([op, codigo(await conforme(op, r, 'C003Error400'))]).toEqual([op, 'DATOS_INVALIDOS']);
    expect(codigo(await conforme('enviarCotizacion003', await e.cotizar(beto, s, cuerpoEstimada(v, { precioFinal: 1 })), 'C003Error400'))).toBe('PROPIEDAD_NO_ADMITIDA');
  });
  test('403 SIN_PERMISO para quien no tiene perfil de prestador al enviar, actualizar, retirar y listar', async () => {
    const id = randomUUID();
    for (const [op, r] of [['enviarCotizacion003', await e.cotizar(otroCliente, publicada.solicitudId, cuerpoEstimada(1))], ['listarMisCotizaciones003', await e.misCotizaciones(otroCliente)],
      ['actualizarCotizacion003', await e.actualizarCotizacion(otroCliente, id, { ...cuerpoEstimada(1), versionCotizacion: 1 })], ['retirarCotizacion003', await e.retirarCotizacion(otroCliente, id, { versionCotizacion: 1 })]] as const) {
      expect([op, codigo(await conforme(op, r, 'C003Error403'))]).toEqual([op, 'SIN_PERMISO']);
    }
  });
});

describe('errores 404, 409, 413, 422 y 503', () => {
  test('404 RECURSO_NO_DISPONIBLE para un recurso inexistente, ajeno o sin título, sin distinguirlos', async () => {
    const f = randomUUID();
    const respuestas: [string, Awaited<ReturnType<typeof e.cotizar>>][] = [
      ['enviarCotizacion003', await e.cotizar(beto, f, cuerpoEstimada(1))], ['enviarCotizacion003', await e.cotizar(ana, publicada.solicitudId, cuerpoEstimada(publicada.versionTrabajo))],
      ['obtenerCotizacion003', await e.cotizacion(beto, f)], ['obtenerCotizacion003', await e.cotizacion(ana, cotizacion.cotizacionId)], ['obtenerCotizacion003', await e.cotizacion(otroCliente, cotizacion.cotizacionId)],
      ['actualizarCotizacion003', await e.actualizarCotizacion(beto, f, { ...cuerpoEstimada(1), versionCotizacion: 1 })], ['actualizarCotizacion003', await e.actualizarCotizacion(ana, cotizacion.cotizacionId, { ...cuerpoEstimada(1), versionCotizacion: 1 })],
      ['retirarCotizacion003', await e.retirarCotizacion(beto, f, { versionCotizacion: 1 })], ['retirarCotizacion003', await e.retirarCotizacion(ana, cotizacion.cotizacionId, { versionCotizacion: 1 })],
    ];
    const cuerpos = [];
    for (const [op, r] of respuestas) { const c = await conforme(op, r as unknown as Respuesta, 'C003Error404'); expect(codigo(c)).toBe('RECURSO_NO_DISPONIBLE'); cuerpos.push(JSON.stringify(c.body)); }
    expect(new Set(cuerpos).size).toBe(1);
  });
  test('409: VERSION_DESACTUALIZADA, SOLICITUD_MODIFICADA, SOLICITUD_NO_ABIERTA, COTIZACION_EXISTENTE, COTIZACION_RETIRADA y CLAVE_IDEMPOTENCIA_REUTILIZADA', async () => {
    const s = await crearYPublicar(e, cliente);
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const clave = randomUUID();
    const obtenidos = [
      ['actualizarCotizacion003', await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: 9 })],
      ['actualizarCotizacion003', await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo + 5), versionCotizacion: 1 })],
      ['enviarCotizacion003', await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo))],
      ['enviarCotizacion003', await e.cotizar(beto, (await crearYPublicar(e, cliente)).solicitudId, cuerpoEstimada(99))],
    ] as const;
    expect(await Promise.all(obtenidos.map(async ([op, r]) => codigo(await conforme(op, r, 'C003Error409'))))).toEqual(['VERSION_DESACTUALIZADA', 'SOLICITUD_MODIFICADA', 'COTIZACION_EXISTENTE', 'SOLICITUD_MODIFICADA']);
    await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }).expect(200);
    expect(codigo(await conforme('retirarCotizacion003', await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 2 }), 'C003Error409'))).toBe('COTIZACION_RETIRADA');
    const abierta = await crearYPublicar(e, cliente);
    await e.cerrarSolicitud(cliente, abierta.solicitudId, { version: abierta.version }).expect(200);
    expect(codigo(await conforme('enviarCotizacion003', await e.cotizar(beto, abierta.solicitudId, cuerpoEstimada(abierta.versionTrabajo)), 'C003Error409'))).toBe('SOLICITUD_NO_ABIERTA');
    const d = await crearYPublicar(e, cliente);
    await e.cotizar(beto, d.solicitudId, cuerpoEstimada(d.versionTrabajo), clave).expect(201);
    expect(codigo(await conforme('enviarCotizacion003', await e.cotizar(beto, d.solicitudId, cuerpoDefinitiva(d.versionTrabajo), clave), 'C003Error409'))).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
  });
  test('413 CUERPO_DEMASIADO_GRANDE con un JSON de más de 65 536 bytes', async () => {
    const r = await conforme('enviarCotizacion003', await e.cotizar(beto, publicada.solicitudId, cuerpoEstimada(publicada.versionTrabajo, { exclusiones: 'x'.repeat(70_000) })), 'C003Error413');
    expect([r.status, codigo(r)]).toEqual([413, 'CUERPO_DEMASIADO_GRANDE']);
  }, 60000);
  test('422: COTIZACION_INCOMPLETA, COTIZACION_PROPIA y FECHA_NO_VALIDA', async () => {
    const s = await crearYPublicar(e, cliente);
    const gema = await e.token(e.datos.prestadores.gema);
    const propia = await crearYPublicar(e, gema, { categoriaId: e.datos.categorias.A });
    const resultados = [
      ['enviarCotizacion003', await e.cotizar(beto, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo, { condicionesPago: undefined }))],
      ['enviarCotizacion003', await e.cotizar(gema, propia.solicitudId, cuerpoEstimada(propia.versionTrabajo))],
      ['enviarCotizacion003', await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { vigenteHasta: '2020-01-01T00:00:00.000Z' }))],
      ['actualizarCotizacion003', await e.actualizarCotizacion(beto, cotizacion.cotizacionId, { ...cuerpoDefinitiva(publicada.versionTrabajo, { plazoDias: undefined }), versionCotizacion: cotizacion.version })],
    ] as const;
    expect(await Promise.all(resultados.map(async ([op, r]) => codigo(await conforme(op, r, 'C003Error422'))))).toEqual(['COTIZACION_INCOMPLETA', 'COTIZACION_PROPIA', 'FECHA_NO_VALIDA', 'COTIZACION_INCOMPLETA']);
  });
  test('503 DEPENDENCIA_NO_DISPONIBLE ante un fallo de infraestructura, sin exponer detalles internos ni dejar estado parcial', async () => {
    const s = await crearYPublicar(e, cliente);
    control.fallar = true;
    try {
      const r = await conforme('enviarCotizacion003', await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)), 'C003Error503');
      expect([r.status, codigo(r)]).toEqual([503, 'DEPENDENCIA_NO_DISPONIBLE']);
      expect(JSON.stringify(r.body)).not.toMatch(/Fallo simulado|infraestructura|stack|sql/i);
    } finally { control.fallar = false; }
    expect(Number(((await e.db.query('SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id=$1', [s.solicitudId])) as { n: string }[])[0]!.n)).toBe(0);
    await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201);
  });
});
