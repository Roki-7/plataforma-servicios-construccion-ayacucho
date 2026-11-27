import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { dependenciaNoDisponible } from '../../../src/modulos/solicitudes/dominio/errores.js';
import { cargarContrato003, validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { cuerpoPublicable, imagen, jpegDeTamano, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T049 · contrato de las nueve operaciones de HU07: esquemas, errores, seguridad Bearer, `Origin`, `Idempotency-Key` y ejemplos HTTP. Se valida cada respuesta
// real contra el esquema del contrato normativo y se comprueba que su estado figure entre los declarados por la operación.
interface Operacion { operationId: string; parameters?: { $ref?: string }[]; security?: Record<string, unknown>[]; responses: Record<string, { $ref?: string; content?: Record<string, { schema?: { $ref?: string } }> }>; 'x-limite-cuerpo-bytes'?: number }
const operacionesDeLaHistoria = ['crearSolicitud003', 'listarMisSolicitudes003', 'obtenerSolicitud003', 'editarSolicitud003', 'publicarSolicitud003', 'cerrarSolicitud003',
  'consultarHistorialSolicitud003', 'cargarArchivoSolicitud003', 'obtenerArchivoSolicitud003'] as const;
const control = { fallarGuardar: false };
let e: EntornoUs1; let t1: string; let t2: string; let tDario: string; let tAna: string; let contrato: { paths: Record<string, Record<string, Operacion>>; components: { responses: Record<string, { content: { 'application/json': { schema: { $ref: string } } } }> } };
let publicada: { solicitudId: string; version: number };
type Respuesta = { status: number; body: unknown; headers: Record<string, unknown> };
const operaciones = new Map<string, { metodo: string; ruta: string; operacion: Operacion }>();

/** El estado de la respuesta figura entre los declarados por la operación y su cuerpo cumple el esquema declarado. Devuelve la respuesta. */
async function conforme<T extends { status: number; body: unknown; headers: Record<string, unknown> }>(operationId: string, r: T, esquema?: string): Promise<T> {
  const { operacion } = operaciones.get(operationId)!;
  expect([operationId, r.status, Object.keys(operacion.responses).includes(String(r.status))]).toEqual([operationId, r.status, true]);
  const declarada = operacion.responses[String(r.status)]!;
  const nombre = esquema ?? (declarada.$ref ? contrato.components.responses[declarada.$ref.split('/').pop()!]?.content['application/json'].schema.$ref.split('/').pop() : undefined);
  if (nombre && Buffer.isBuffer(r.body) === false) await validarRespuesta003(nombre, r.body);
  expect(r.headers['cache-control']).toBe('no-store');
  expect(r.headers['x-content-type-options']).toBe('nosniff');
  return r;
}

beforeAll(async () => {
  contrato = await cargarContrato003() as unknown as typeof contrato;
  for (const [ruta, item] of Object.entries(contrato.paths)) for (const [metodo, operacion] of Object.entries(item)) operaciones.set(operacion.operationId, { metodo, ruta, operacion });
  e = await montarUs1({ almacen: real => new Proxy(real, { get(objetivo, propiedad) {
    if (propiedad === 'guardar' && control.fallarGuardar) return async () => { throw dependenciaNoDisponible(); };
    const valor = Reflect.get(objetivo, propiedad, objetivo) as unknown; return typeof valor === 'function' ? (valor as (...a: unknown[]) => unknown).bind(objetivo) : valor;
  } }) });
  [t1, t2, tDario, tAna] = await Promise.all([e.token(e.datos.clientes.clienteUno), e.token(e.datos.clientes.clienteDos), e.token(e.datos.prestadores.dario), e.token(e.datos.prestadores.ana)]) as [string, string, string, string];
  const c = (await e.crear(t1, cuerpoPublicable(e)).expect(201)).body; publicada = { solicitudId: c.solicitudId, version: c.version };
  publicada = { solicitudId: c.solicitudId, version: (await e.publicar(t1, c.solicitudId, { version: c.version }).expect(200)).body.version };
}, 300000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('definición de las nueve operaciones', () => {
  test('el contrato fuente las declara y la aplicación las registra sin rutas adicionales', () => {
    for (const id of operacionesDeLaHistoria) expect(operaciones.has(id)).toBe(true);
    const rutas = ((e.app.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router.stack
      .flatMap(({ route }) => route ? Object.keys(route.methods).map(m => `${m.toUpperCase()} ${route.path.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')}`) : []));
    for (const id of operacionesDeLaHistoria) { const { metodo, ruta } = operaciones.get(id)!; expect(rutas).toContain(`${metodo.toUpperCase()} ${ruta}`); }
    expect(rutas.filter(r => r.includes('/solicitudes') && !r.includes('/cotizaciones'))).toHaveLength(operacionesDeLaHistoria.length);
  });
  test('todas exigen Bearer; las mutaciones declaran Origin e Idempotency-Key y las lecturas no', () => {
    for (const id of operacionesDeLaHistoria) {
      const { metodo, operacion } = operaciones.get(id)!;
      expect(JSON.stringify(operacion.security)).toContain('bearerAuth');
      const refs = (operacion.parameters ?? []).map(p => p.$ref ?? '');
      const muta = metodo !== 'get';
      expect([id, refs.includes('#/components/parameters/Origin'), refs.includes('#/components/parameters/IdempotencyKey')]).toEqual([id, muta, muta]);
    }
  });
  test('cada operación declara los errores de su categoría y las que reciben cuerpo, su límite', () => {
    for (const id of operacionesDeLaHistoria) {
      const { metodo, operacion } = operaciones.get(id)!; const declarados = Object.keys(operacion.responses);
      expect(declarados).toEqual(expect.arrayContaining(['401', '503']));
      if (metodo !== 'get') expect(declarados).toEqual(expect.arrayContaining(['400', '403', '404', '409', '413', '422']));
      if (metodo !== 'get') expect(typeof operacion['x-limite-cuerpo-bytes']).toBe('number');
    }
    expect(operaciones.get('cargarArchivoSolicitud003')!.operacion['x-limite-cuerpo-bytes']).toBe(14_000_000);
  });
});

describe('respuestas exitosas conforme al contrato (ejemplos HTTP)', () => {
  test('crear: 201 con la vista privada del borrador', async () => {
    const r = await conforme('crearSolicitud003', await e.crear(t1, { tipo: 'PUBLICADA', descripcion: 'Necesito pintar una fachada', medidas: '30 m2' }), 'C003SolicitudPrivada');
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ estado: 'BORRADOR', version: 1, versionTrabajo: 0, archivos: [], advertencias: [] });
  });
  test('editar, publicar y cerrar: 200 con la vista privada', async () => {
    const c = (await e.crear(t1, cuerpoPublicable(e)).expect(201)).body;
    const ed = await conforme('editarSolicitud003', await e.editar(t1, c.solicitudId, { version: c.version, medidas: '3 x 2 m' }), 'C003SolicitudPrivada');
    const pu = await conforme('publicarSolicitud003', await e.publicar(t1, c.solicitudId, { version: ed.body.version }), 'C003SolicitudPrivada');
    const ce = await conforme('cerrarSolicitud003', await e.cerrarSolicitud(t1, c.solicitudId, { version: pu.body.version }), 'C003SolicitudPrivada');
    expect([ed.status, pu.status, ce.status, ce.body.estado]).toEqual([200, 200, 200, 'CERRADA']);
  });
  test('obtener: la vista privada para el dueño y la visible para un prestador con acceso', async () => {
    await conforme('obtenerSolicitud003', await e.obtener(t1, publicada.solicitudId), 'C003SolicitudPrivada');
    const dirigida = (await e.crear(t1, { tipo: 'DIRIGIDA', prestadorId: e.datos.prestadores.ana.prestadorId, descripcion: 'Dirigida a Ana', categoriaId: e.datos.categorias.A, distrito: 'ayacucho', fechaDesde: '2031-08-01' }).expect(201)).body;
    await e.publicar(t1, dirigida.solicitudId, { version: dirigida.version }).expect(200);
    const visible = await conforme('obtenerSolicitud003', await e.obtener(tAna, dirigida.solicitudId), 'C003SolicitudVisible');
    expect(visible.body).toMatchObject({ titulos: ['DESTINATARIO'] });
  });
  test('listar: página de resúmenes, con el rol de cliente y con el de prestador', async () => {
    await conforme('listarMisSolicitudes003', await e.listar(t1, '?tamano=5'), 'C003PaginaSolicitudes');
    await conforme('listarMisSolicitudes003', await e.listar(tAna, '?rol=prestador'), 'C003PaginaSolicitudes');
    await conforme('listarMisSolicitudes003', await e.listar(t1, '?estado=ABIERTA&pagina=1&tamano=1'), 'C003PaginaSolicitudes');
  });
  test('historial: versiones y bitácora, cada una con su esquema', async () => {
    const v = await conforme('consultarHistorialSolicitud003', await e.historial(t1, publicada.solicitudId, '?tipo=versiones'), 'C003HistorialVersiones');
    const b = await conforme('consultarHistorialSolicitud003', await e.historial(t1, publicada.solicitudId, '?tipo=bitacora'), 'C003HistorialBitacora');
    expect([v.body.tipo, b.body.tipo]).toEqual(['versiones', 'bitacora']);
  });
  test('cargar archivo: 201 y obtenerlo: 200 con image/webp', async () => {
    const a = await conforme('cargarArchivoSolicitud003', await e.cargar(t1, publicada.solicitudId, await imagen(120, 90, 'png')), 'C003Archivo');
    expect([a.status, a.body.estado]).toEqual([201, 'PREPARADO']);
    const d = await e.archivo(t1, publicada.solicitudId, a.body.archivoId);
    expect([d.status, d.headers['content-type'], d.headers['cache-control']]).toEqual([200, 'image/webp', 'no-store']);
    expect(Object.keys(operaciones.get('obtenerArchivoSolicitud003')!.operacion.responses['200']!.content ?? {})).toEqual(['image/webp']);
  });
});

describe('errores 400, 401 y 403: esquema, cabeceras y seguridad', () => {
  test('401 NO_AUTENTICADO sin sesión en cada operación', async () => {
    const id = publicada.solicitudId;
    const respuestas: [string, { status: number; body: unknown; headers: Record<string, unknown> }][] = [['crearSolicitud003', await e.crear(undefined, { tipo: 'PUBLICADA' })], ['listarMisSolicitudes003', await e.listar(undefined)],
      ['obtenerSolicitud003', await e.obtener(undefined, id)], ['editarSolicitud003', await e.editar(undefined, id, { version: 1 })], ['publicarSolicitud003', await e.publicar(undefined, id, { version: 1 })],
      ['cerrarSolicitud003', await e.cerrarSolicitud(undefined, id, { version: 1 })], ['consultarHistorialSolicitud003', await e.historial(undefined, id, '?tipo=versiones')],
      ['cargarArchivoSolicitud003', await e.cargar(undefined, id, await imagen(10, 10))], ['obtenerArchivoSolicitud003', await e.archivo(undefined, id, randomUUID())]];
    for (const [op, r] of respuestas) { const c = await conforme(op, r, 'C003Error401'); expect((c.body as { codigo: string }).codigo).toBe('NO_AUTENTICADO'); }
  });
  test('400 CABECERA_REQUERIDA sin Origin o sin Idempotency-Key, y 403 ORIGEN_NO_ADMITIDO con un origen ajeno, en cada mutación', async () => {
    const cuerpos: [string, string, string, object][] = [['crearSolicitud003', 'post', '/solicitudes', { tipo: 'PUBLICADA' }], ['editarSolicitud003', 'patch', `/solicitudes/${publicada.solicitudId}`, { version: 1 }],
      ['publicarSolicitud003', 'post', `/solicitudes/${publicada.solicitudId}/publicacion`, { version: 1 }], ['cerrarSolicitud003', 'post', `/solicitudes/${publicada.solicitudId}/cierre`, { version: 1 }],
      ['cargarArchivoSolicitud003', 'post', `/solicitudes/${publicada.solicitudId}/archivos`, await imagen(10, 10)]];
    for (const [op, metodo, ruta, cuerpo] of cuerpos) {
      const base = () => (e.http as unknown as Record<string, (r: string) => import('supertest').Test>)[metodo]!(`/api/v1${ruta}`).set('Authorization', `Bearer ${t1}`);
      const sinOrigen = await conforme(op, await base().set('Idempotency-Key', randomUUID()).send(cuerpo), 'C003Error400');
      expect((sinOrigen.body as { codigo: string }).codigo).toBe('CABECERA_REQUERIDA');
      const sinClave = await conforme(op, await base().set('Origin', e.config.origen).send(cuerpo), 'C003Error400');
      expect((sinClave.body as { codigo: string }).codigo).toBe('CABECERA_REQUERIDA');
      const ajeno = await conforme(op, await base().set('Origin', 'https://ajeno.example.invalid').set('Idempotency-Key', randomUUID()).send(cuerpo), 'C003Error403');
      expect((ajeno.body as { codigo: string }).codigo).toBe('ORIGEN_NO_ADMITIDO');
    }
  });
  test('400 DATOS_INVALIDOS ante un cuerpo, un identificador o una consulta inválidos, y PROPIEDAD_NO_ADMITIDA ante campos no declarados', async () => {
    const id = publicada.solicitudId;
    const invalidas: [string, Awaited<ReturnType<typeof e.crear>>][] = [['crearSolicitud003', await e.crear(t1, {})], ['crearSolicitud003', await e.crear(t1, { tipo: 'OTRA' })],
      ['crearSolicitud003', await e.crear(t1, { tipo: 'PUBLICADA', descripcion: 'x'.repeat(2001) })], ['crearSolicitud003', await e.crear(t1, { tipo: 'PUBLICADA', distrito: 'huanta' })],
      ['editarSolicitud003', await e.editar(t1, id, {})], ['editarSolicitud003', await e.editar(t1, 'no-es-uuid', { version: 1 })], ['publicarSolicitud003', await e.publicar(t1, id, { version: 0 })],
      ['obtenerSolicitud003', await e.obtener(t1, 'no-es-uuid')], ['listarMisSolicitudes003', await e.listar(t1, '?pagina=0')], ['listarMisSolicitudes003', await e.listar(t1, '?rol=otro')],
      ['consultarHistorialSolicitud003', await e.historial(t1, id, '')], ['cargarArchivoSolicitud003', await e.cargar(t1, id, { tipoMime: 'image/gif', contenidoBase64: 'AAAA' })]];
    for (const [op, r] of invalidas) { const c = await conforme(op, r, 'C003Error400'); expect([op, (c.body as { codigo: string }).codigo]).toEqual([op, 'DATOS_INVALIDOS']); }
    const extra = await conforme('crearSolicitud003', await e.crear(t1, { tipo: 'PUBLICADA', titulo: 'no existe' }), 'C003Error400');
    expect((extra.body as { codigo: string }).codigo).toBe('PROPIEDAD_NO_ADMITIDA');
  });
  test('403 SIN_PERMISO para un prestador sin perfil de cliente y para un cliente sin perfil de prestador', async () => {
    const a = await conforme('crearSolicitud003', await e.crear(tDario, { tipo: 'PUBLICADA' }), 'C003Error403');
    const b = await conforme('listarMisSolicitudes003', await e.listar(t1, '?rol=prestador'), 'C003Error403');
    const c = await conforme('listarMisSolicitudes003', await e.listar(tDario), 'C003Error403');
    expect([a.body, b.body, c.body].map(x => (x as { codigo: string }).codigo)).toEqual(['SIN_PERMISO', 'SIN_PERMISO', 'SIN_PERMISO']);
  });
  test('un cuerpo que no es JSON válido o con otro tipo de contenido se rechaza con 400', async () => {
    const r = await e.http.post('/api/v1/solicitudes').set('Authorization', `Bearer ${t1}`).set('Origin', e.config.origen).set('Idempotency-Key', randomUUID()).set('Content-Type', 'text/plain').send('{"tipo":"PUBLICADA"}');
    await conforme('crearSolicitud003', r, 'C003Error400');
    const roto = await e.http.post('/api/v1/solicitudes').set('Authorization', `Bearer ${t1}`).set('Origin', e.config.origen).set('Idempotency-Key', randomUUID()).set('Content-Type', 'application/json').send('{"tipo":');
    await conforme('crearSolicitud003', roto, 'C003Error400');
  });
});

describe('errores 404, 409, 413, 422 y 503', () => {
  test('404 RECURSO_NO_DISPONIBLE para un recurso inexistente o ajeno', async () => {
    const f = randomUUID();
    for (const [op, r] of [['obtenerSolicitud003', await e.obtener(t1, f)], ['editarSolicitud003', await e.editar(t1, f, { version: 1 })], ['publicarSolicitud003', await e.publicar(t2, publicada.solicitudId, { version: 1 })],
      ['cerrarSolicitud003', await e.cerrarSolicitud(t1, f, { version: 1 })], ['consultarHistorialSolicitud003', await e.historial(t2, publicada.solicitudId, '?tipo=versiones')],
      ['cargarArchivoSolicitud003', await e.cargar(t2, publicada.solicitudId, await imagen(10, 10))], ['obtenerArchivoSolicitud003', await e.archivo(t1, publicada.solicitudId, f)]] as const) {
      expect(((await conforme(op, r as unknown as Respuesta, 'C003Error404')).body as { codigo: string }).codigo).toBe('RECURSO_NO_DISPONIBLE');
    }
  });
  test('409: VERSION_DESACTUALIZADA, SOLICITUD_NO_ABIERTA y CLAVE_IDEMPOTENCIA_REUTILIZADA', async () => {
    const v = await conforme('editarSolicitud003', await e.editar(t1, publicada.solicitudId, { version: 1, medidas: 'x' }), 'C003Error409');
    const c = (await e.crear(t1, { tipo: 'PUBLICADA' }).expect(201)).body; const cerrada = (await e.cerrarSolicitud(t1, c.solicitudId, { version: c.version }).expect(200)).body;
    const n = await conforme('editarSolicitud003', await e.editar(t1, c.solicitudId, { version: cerrada.version, medidas: 'x' }), 'C003Error409');
    const clave = randomUUID(); await e.crear(t1, { tipo: 'PUBLICADA' }, clave).expect(201);
    const k = await conforme('crearSolicitud003', await e.crear(t1, { tipo: 'DIRIGIDA' }, clave), 'C003Error409');
    expect([v, n, k].map(x => (x.body as { codigo: string }).codigo)).toEqual(['VERSION_DESACTUALIZADA', 'SOLICITUD_NO_ABIERTA', 'CLAVE_IDEMPOTENCIA_REUTILIZADA']);
  });
  test('413: CUERPO_DEMASIADO_GRANDE en un JSON de más de 65 536 bytes y ARCHIVO_DEMASIADO_GRANDE en una imagen de más de 10 MB', async () => {
    const grande = await conforme('crearSolicitud003', await e.crear(t1, { tipo: 'PUBLICADA', descripcion: 'x'.repeat(70_000) }), 'C003Error413');
    expect((grande.body as { codigo: string }).codigo).toBe('CUERPO_DEMASIADO_GRANDE');
    const imagenGrande = await conforme('cargarArchivoSolicitud003', await e.cargar(t1, publicada.solicitudId, await jpegDeTamano(10_000_001)), 'C003Error413');
    expect((imagenGrande.body as { codigo: string }).codigo).toBe('ARCHIVO_DEMASIADO_GRANDE');
  }, 120000);
  test('422 con cada código de la historia que el cliente puede provocar', async () => {
    const d = e.datos; const codigos = new Set<string>();
    const registrar = async (op: string, r: Awaited<ReturnType<typeof e.crear>>) => { const c = await conforme(op, r as unknown as Respuesta, 'C003Error422'); codigos.add((c.body as { codigo: string }).codigo); };
    const borrador = (await e.crear(t1, { tipo: 'PUBLICADA' }).expect(201)).body;
    await registrar('publicarSolicitud003', await e.publicar(t1, borrador.solicitudId, { version: borrador.version }));
    await registrar('crearSolicitud003', await e.crear(t1, { tipo: 'DIRIGIDA', prestadorId: randomUUID() }));
    await registrar('crearSolicitud003', await e.crear(t1, cuerpoPublicable(e, { categoriaId: d.categorias.inactiva })));
    await registrar('crearSolicitud003', await e.crear(t1, cuerpoPublicable(e, { fechaDesde: '2031-05-10', fechaHasta: '2031-05-09' })));
    await registrar('crearSolicitud003', await e.crear(t1, { tipo: 'DIRIGIDA', prestadorId: d.prestadores.beto.prestadorId, servicioId: d.prestadores.ana.servicios[0]!.id }));
    await registrar('crearSolicitud003', await e.crear(t1, { tipo: 'DIRIGIDA', prestadorId: d.prestadores.beto.prestadorId, servicioId: d.prestadores.beto.servicios[0]!.id, categoriaId: d.categorias.B }));
    const tg = await e.token(d.ambosPerfiles); await registrar('crearSolicitud003', await e.crear(tg, { tipo: 'DIRIGIDA', prestadorId: d.ambosPerfiles.prestadorId }));
    const conTelefono = (await e.crear(t1, cuerpoPublicable(e, { descripcion: 'Llámame al 981 234 567' })).expect(201)).body;
    await registrar('publicarSolicitud003', await e.publicar(t1, conTelefono.solicitudId, { version: conTelefono.version }));
    await registrar('editarSolicitud003', await e.editar(t1, publicada.solicitudId, { version: publicada.version, tipo: 'DIRIGIDA' }));
    await registrar('cargarArchivoSolicitud003', await e.cargar(t1, publicada.solicitudId, { tipoMime: 'image/png', contenidoBase64: Buffer.from('no es una imagen').toString('base64') }));
    await registrar('cargarArchivoSolicitud003', await e.cargar(t1, publicada.solicitudId, await imagen(4097, 1, 'png')));
    expect([...codigos].sort()).toEqual(['AUTODIRECCION_NO_PERMITIDA', 'CAMPO_NO_MODIFICABLE', 'CATEGORIA_NO_ACTIVA', 'CATEGORIA_NO_COINCIDE_CON_SERVICIO', 'DATOS_PERSONALES_EN_TEXTO', 'FECHA_NO_VALIDA',
      'IMAGEN_DIMENSIONES_NO_ADMITIDAS', 'IMAGEN_FORMATO_NO_ADMITIDO', 'PRESTADOR_NO_DISPONIBLE', 'SERVICIO_NO_PERTENECE_AL_PRESTADOR', 'SOLICITUD_INCOMPLETA']);
  }, 120000);
  test('503 DEPENDENCIA_NO_DISPONIBLE cuando el almacenamiento falla, sin exponer detalles internos', async () => {
    control.fallarGuardar = true;
    try {
      const r = await conforme('cargarArchivoSolicitud003', await e.cargar(t1, publicada.solicitudId, await imagen(33, 33)), 'C003Error503');
      expect((r.body as { codigo: string }).codigo).toBe('DEPENDENCIA_NO_DISPONIBLE');
      expect(JSON.stringify(r.body)).not.toMatch(/solicitudes\/|bucket|garage|stack|at \w+\.|ECONN/i);
    } finally { control.fallarGuardar = false; }
  });
});

describe('ejemplos HTTP de extremo a extremo', () => {
  test('crear, subir una imagen, publicar con ella, listar, consultar versiones y cerrar: cada respuesta cumple su esquema', async () => {
    const c = await conforme('crearSolicitud003', await e.crear(t1, cuerpoPublicable(e)), 'C003SolicitudPrivada');
    const a = await conforme('cargarArchivoSolicitud003', await e.cargar(t1, c.body.solicitudId, await imagen(200, 150)), 'C003Archivo');
    const p = await conforme('publicarSolicitud003', await e.publicar(t1, c.body.solicitudId, { version: c.body.version, archivosIds: [a.body.archivoId], compartirFotografias: true }), 'C003SolicitudPrivada');
    expect(p.body).toMatchObject({ estado: 'ABIERTA', versionTrabajo: 1, compartirFotografias: true, archivos: [{ estado: 'CONFIRMADO' }] });
    await conforme('listarMisSolicitudes003', await e.listar(t1, '?estado=ABIERTA'), 'C003PaginaSolicitudes');
    const v = await conforme('consultarHistorialSolicitud003', await e.historial(t1, c.body.solicitudId, '?tipo=versiones'), 'C003HistorialVersiones');
    expect(v.body.elementos[0].contenido.archivos).toEqual([expect.objectContaining({ archivoId: a.body.archivoId, retirado: false })]);
    await conforme('cerrarSolicitud003', await e.cerrarSolicitud(t1, c.body.solicitudId, { version: p.body.version }), 'C003SolicitudPrivada');
  });
});
