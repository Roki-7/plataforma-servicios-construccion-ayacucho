import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { cuerpoPublicable, imagen, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T050 · matriz PR04 de solicitudes y archivos: sin sesión, cuenta ajena, perfil incorrecto, dueño y destinatario sobre cada operación de la historia, incluida la
// bitácora y los archivos. CA-SEG-01, CA-PRI-01 a 04 y CA-HIS-01 a 03. Todo intento no autorizado se rechaza sin modificar datos ni revelar existencia.
let e: EntornoUs1; let tDueno: string; let tAjeno: string; let tAna: string; let tBeto: string; let tDario: string;
interface Contexto { solicitudId: string; version: number; archivoId: string }
let dirigida: Contexto; let publicada: Contexto;
const cotizar = (solicitudId: string, p: { prestadorId: string; cuentaId: string }, estado: 'ACTIVA' | 'RETIRADA' = 'ACTIVA') =>
  e.db.query('INSERT INTO cotizaciones (id,solicitud_id,prestador_id,prestador_cuenta_id,estado,retirada_en) VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(), solicitudId, p.prestadorId, p.cuentaId, estado, estado === 'RETIRADA' ? new Date().toISOString() : null]);
/** Instantánea de todo lo que una operación podría modificar. */
async function huella() {
  const q = async (sql: string) => JSON.stringify(await e.db.query(sql));
  return [await q("SELECT md5(string_agg(id::text || version::text || version_trabajo::text || estado || archivos_cantidad::text || compartir_fotografias::text, ',' ORDER BY id)) AS h FROM solicitudes"),
    await q('SELECT count(*)::int AS n FROM solicitudes_versiones'), await q('SELECT count(*)::int AS n FROM solicitudes_bitacora'), await q('SELECT count(*)::int AS n FROM avisos_negocio'),
    await q("SELECT md5(string_agg(id::text || estado, ',' ORDER BY id)) AS h FROM solicitudes_archivos"), await q('SELECT count(*)::int AS n FROM solicitudes_objetos_pendientes'),
    await q('SELECT count(*)::int AS n FROM claves_idempotencia')].join('|');
}
const normal = (r: { status: number; body: unknown }) => ({ status: r.status, body: r.body });

beforeAll(async () => {
  e = await montarUs1();
  const d = e.datos;
  [tDueno, tAjeno, tAna, tBeto, tDario] = await Promise.all([e.token(d.clientes.clienteUno), e.token(d.clientes.clienteDos), e.token(d.prestadores.ana), e.token(d.prestadores.beto), e.token(d.prestadores.dario)]) as [string, string, string, string, string];
  // Dirigida a Ana, con una fotografía confirmada.
  const c1 = (await e.crear(tDueno, { tipo: 'DIRIGIDA', prestadorId: d.prestadores.ana.prestadorId, descripcion: 'Muro de contención en el huerto.', categoriaId: d.categorias.A, distrito: 'ayacucho', fechaDesde: '2031-06-01' }).expect(201)).body;
  const a1 = (await e.cargar(tDueno, c1.solicitudId, await imagen(80, 60)).expect(201)).body.archivoId as string;
  const p1 = (await e.publicar(tDueno, c1.solicitudId, { version: c1.version, archivosIds: [a1] }).expect(200)).body;
  dirigida = { solicitudId: p1.solicitudId, version: p1.version, archivoId: a1 };
  // Publicada con una fotografía confirmada, sin permiso de compartir; Beto es autor de una cotización.
  const c2 = (await e.crear(tDueno, cuerpoPublicable(e)).expect(201)).body;
  const a2 = (await e.cargar(tDueno, c2.solicitudId, await imagen(90, 70, 'png')).expect(201)).body.archivoId as string;
  const p2 = (await e.publicar(tDueno, c2.solicitudId, { version: c2.version, archivosIds: [a2] }).expect(200)).body;
  publicada = { solicitudId: p2.solicitudId, version: p2.version, archivoId: a2 };
  await cotizar(publicada.solicitudId, d.prestadores.beto);
}, 300000);
afterAll(async () => { await e?.cerrar(); }, 120000);

const ops = (c: Contexto) => ({
  editar: (t?: string) => e.editar(t, c.solicitudId, { version: c.version, medidas: 'intento' }),
  publicar: (t?: string) => e.publicar(t, c.solicitudId, { version: c.version }),
  cerrar: (t?: string) => e.cerrarSolicitud(t, c.solicitudId, { version: c.version }),
  cargar: async (t?: string) => e.cargar(t, c.solicitudId, await imagen(20, 20)),
  obtener: (t?: string) => e.obtener(t, c.solicitudId),
  versiones: (t?: string) => e.historial(t, c.solicitudId, '?tipo=versiones'),
  bitacora: (t?: string) => e.historial(t, c.solicitudId, '?tipo=bitacora'),
  archivo: (t?: string) => e.archivo(t, c.solicitudId, c.archivoId),
});
const escrituras = ['editar', 'publicar', 'cerrar', 'cargar'] as const;
const lecturas = ['obtener', 'versiones', 'bitacora', 'archivo'] as const;

describe('sin sesión (CA-SEG-01)', () => {
  test('las nueve operaciones responden 401 NO_AUTENTICADO sin modificar nada', async () => {
    const antes = await huella(); const o = ops(dirigida);
    for (const nombre of [...escrituras, ...lecturas] as const) { const r = await o[nombre](undefined); expect([nombre, r.status]).toEqual([nombre, 401]); }
    expect((await e.crear(undefined, { tipo: 'PUBLICADA' })).status).toBe(401);
    expect((await e.listar(undefined)).status).toBe(401);
    expect((await e.listar('token-inventado')).status).toBe(401);
    expect(await huella()).toBe(antes);
  });
  test('un token inválido o con formato incorrecto también se rechaza', async () => {
    for (const t of ['x', 'a'.repeat(43), 'Bearer']) expect((await ops(dirigida).obtener(t)).status).toBe(401);
  });
});

describe('perfil incorrecto', () => {
  test('un prestador sin perfil de cliente no puede crear, editar, publicar, cerrar ni cargar: 403 SIN_PERMISO y nada cambia', async () => {
    const antes = await huella(); const o = ops(dirigida);
    for (const nombre of escrituras) { const r = await o[nombre](tDario); expect([nombre, r.status, r.body.codigo]).toEqual([nombre, 403, 'SIN_PERMISO']); await validarRespuesta003('C003Error403', r.body); }
    expect((await e.crear(tDario, { tipo: 'PUBLICADA' })).status).toBe(403);
    expect((await e.listar(tDario)).status).toBe(403);
    expect(await huella()).toBe(antes);
  });
  test('un cliente sin perfil de prestador no puede listar con rol=prestador (403)', async () => {
    expect((await e.listar(tDueno, '?rol=prestador')).status).toBe(403);
    expect((await e.listar(tAjeno, '?rol=prestador')).status).toBe(403);
  });
  test('un prestador sin relación con la solicitud solo recibe 404 en las lecturas', async () => {
    for (const nombre of lecturas) expect([nombre, (await ops(dirigida)[nombre](tDario)).status]).toEqual([nombre, 404]);
  });
});

describe('cuenta ajena: no se revela la existencia ni se modifica nada', () => {
  test('otro cliente recibe 404 RECURSO_NO_DISPONIBLE en las nueve operaciones, idéntico al de un identificador inexistente', async () => {
    const antes = await huella(); const real = ops(dirigida); const inexistente = ops({ solicitudId: randomUUID(), version: 1, archivoId: randomUUID() });
    for (const nombre of [...escrituras, ...lecturas] as const) {
      const ajeno = await real[nombre](tAjeno); const falso = await inexistente[nombre](tAjeno);
      expect([nombre, ajeno.status, ajeno.body.codigo]).toEqual([nombre, 404, 'RECURSO_NO_DISPONIBLE']);
      expect(normal(ajeno)).toEqual(normal(falso));
      await validarRespuesta003('C003Error404', ajeno.body);
    }
    expect(await huella()).toBe(antes);
  });
  test('un archivo existente de otra solicitud o inexistente responde igual', async () => {
    const mezclado = await e.archivo(tDueno, publicada.solicitudId, dirigida.archivoId); const falso = await e.archivo(tDueno, publicada.solicitudId, randomUUID());
    expect(normal(mezclado)).toEqual(normal(falso));
    expect(mezclado.status).toBe(404);
  });
  test('el listado de otro cliente no contiene solicitudes ajenas', async () => {
    const r = await e.listar(tAjeno).expect(200);
    expect(JSON.stringify(r.body)).not.toContain(dirigida.solicitudId);
    expect(JSON.stringify(r.body)).not.toContain(publicada.solicitudId);
  });
  test('un identificador mal formado responde 400 DATOS_INVALIDOS sin tocar la base de datos', async () => {
    const antes = await huella();
    expect((await e.obtener(tDueno, 'no-es-uuid')).status).toBe(400);
    expect((await e.editar(tDueno, 'no-es-uuid', { version: 1 })).status).toBe(400);
    expect(await huella()).toBe(antes);
  });
});

describe('dueño', () => {
  test('lee todo: detalle, versiones, bitácora y archivo; y las respuestas cumplen el contrato', async () => {
    const o = ops(dirigida);
    const detalle = await o.obtener(tDueno).expect(200); await validarRespuesta003('C003SolicitudPrivada', detalle.body);
    expect(detalle.body.archivos).toHaveLength(1);
    const v = await o.versiones(tDueno).expect(200); await validarRespuesta003('C003HistorialVersiones', v.body);
    const b = await o.bitacora(tDueno).expect(200); await validarRespuesta003('C003HistorialBitacora', b.body);
    expect(b.body.elementos.map((x: { tipo: string }) => x.tipo).sort()).toEqual(['CREADA', 'PUBLICADA']);
    expect((await o.archivo(tDueno)).status).toBe(200);
  });
});

describe('destinatario de una dirigida (título a)', () => {
  test('lee la solicitud con la vista visible, sin datos del cliente, y con sus fotografías', async () => {
    const r = await ops(dirigida).obtener(tAna).expect(200);
    await validarRespuesta003('C003SolicitudVisible', r.body);
    expect(r.body).toMatchObject({ solicitudId: dirigida.solicitudId, titulos: ['DESTINATARIO'], fotografias: { hay: true, compartidas: true } });
    expect(r.body.fotografias.archivos).toHaveLength(1);
    expect(JSON.stringify(r.body)).not.toMatch(/clienteCuentaId|cuentaId|correo|telefono|prestadorId|advertencias|"version"|compartirFotografias|archivosIds/);
  });
  test('ve las versiones de trabajo y descarga las fotografías de una dirigida aunque el permiso de compartir esté apagado', async () => {
    const v = await ops(dirigida).versiones(tAna).expect(200);
    await validarRespuesta003('C003HistorialVersiones', v.body);
    expect(v.body.elementos).toHaveLength(1);
    expect((await ops(dirigida).archivo(tAna)).status).toBe(200);
  });
  test('la bitácora solo la ve el cliente dueño: el destinatario recibe 404 (CA-HIS-03)', async () => {
    const r = await ops(dirigida).bitacora(tAna);
    expect([r.status, r.body.codigo]).toEqual([404, 'RECURSO_NO_DISPONIBLE']);
  });
  test('no puede editar, publicar, cerrar ni cargar archivos: no es cliente', async () => {
    const antes = await huella();
    for (const nombre of escrituras) expect([nombre, (await ops(dirigida)[nombre](tAna)).status]).toEqual([nombre, 403]);
    expect(await huella()).toBe(antes);
  });
  test('otro prestador no destinatario recibe 404 en el detalle, las versiones y el archivo', async () => {
    for (const nombre of ['obtener', 'versiones', 'archivo'] as const) expect((await ops(dirigida)[nombre](tBeto)).status).toBe(404);
  });
  test('la solicitud aparece en su listado con rol=prestador, con el título DESTINATARIO, y no en el de otros', async () => {
    const r = await e.listar(tAna, '?rol=prestador&tamano=50').expect(200);
    expect((r.body.elementos as { solicitudId: string; titulos: string[] }[]).find(x => x.solicitudId === dirigida.solicitudId)?.titulos).toEqual(['DESTINATARIO']);
    expect(JSON.stringify((await e.listar(tDario, '?rol=prestador&tamano=50').expect(200)).body)).not.toContain(dirigida.solicitudId);
  });
});

describe('autor de una cotización no retirada (título c), historial y fotografías (CA-HIS-01 a 03, CA-PRI-02 a 04, CA-ARC-04)', () => {
  test('el autor lee una publicada y sus versiones, pero no la bitácora (CA-HIS-01 y CA-HIS-03)', async () => {
    const o = ops(publicada);
    const d = await o.obtener(tBeto).expect(200); expect(d.body.titulos).toEqual(['AUTOR_DE_COTIZACION']);
    const v = await o.versiones(tBeto).expect(200);
    expect(JSON.stringify(v.body)).not.toMatch(/actor|privacidad|compartir|transicion|bitacora|CERRADA|PUBLICADA/i);
    expect((await o.bitacora(tBeto)).status).toBe(404);
  });
  test('sin permiso de compartir, el autor solo sabe que existen fotografías no compartidas y recibe 404 al pedirlas (CA-ARC-04)', async () => {
    const d = await ops(publicada).obtener(tBeto).expect(200);
    expect(d.body.fotografias).toEqual({ hay: true, compartidas: false, archivos: [] });
    expect((await ops(publicada).archivo(tBeto)).status).toBe(404);
    const v = await ops(publicada).versiones(tBeto).expect(200);
    expect(v.body.elementos.every((x: { contenido: { archivos: unknown[] } }) => x.contenido.archivos.length === 0)).toBe(true);
  });
  test('con permiso vigente el autor ve y descarga las fotografías; al revocar, la siguiente petición ya no las ve, y conserva el historial (CA-PRI-02 a 04)', async () => {
    const antes = (await e.obtener(tDueno, publicada.solicitudId).expect(200)).body as { version: number };
    const on = (await e.editar(tDueno, publicada.solicitudId, { version: antes.version, compartirFotografias: true }).expect(200)).body;
    const o = ops({ ...publicada, version: on.version });
    const visto = (await o.obtener(tBeto).expect(200)).body;
    expect(visto.fotografias).toMatchObject({ hay: true, compartidas: true }); expect(visto.fotografias.archivos).toHaveLength(1);
    expect((await o.archivo(tBeto)).status).toBe(200);
    expect((await o.versiones(tBeto).expect(200)).body.elementos[0].contenido.archivos).toHaveLength(1);
    const off = (await e.editar(tDueno, publicada.solicitudId, { version: on.version, compartirFotografias: false }).expect(200)).body;
    expect((await ops(publicada).archivo(tBeto)).status).toBe(404);
    expect((await ops(publicada).obtener(tBeto).expect(200)).body.fotografias).toEqual({ hay: true, compartidas: false, archivos: [] });
    expect((await ops(publicada).versiones(tBeto)).status).toBe(200);
    expect(await e.db.query("SELECT count(*)::int AS n FROM cotizaciones WHERE solicitud_id=$1 AND estado='ACTIVA'", [publicada.solicitudId])).toEqual([{ n: 1 }]);
    const on2 = (await e.editar(tDueno, publicada.solicitudId, { version: off.version, compartirFotografias: true }).expect(200)).body;
    expect((await ops(publicada).archivo(tBeto)).status).toBe(200);
    expect((await e.historial(tDueno, publicada.solicitudId, '?tipo=bitacora').expect(200)).body.elementos.map((x: { tipo: string }) => x.tipo).filter((t: string) => t === 'PRIVACIDAD_CAMBIADA')).toHaveLength(3);
    publicada = { ...publicada, version: on2.version };
  });
  test('un prestador sin cotización sobre la publicada recibe 404 en todo, también en el archivo', async () => {
    for (const nombre of lecturas) expect([nombre, (await ops(publicada)[nombre](tDario)).status]).toEqual([nombre, 404]);
  });
  test('quien retiró su cotización y no tiene otro título pierde el acceso: 404 (CA-PRI-06)', async () => {
    const carla = e.datos.prestadores.carla; const tCarla = await e.token(carla);
    await cotizar(publicada.solicitudId, carla);
    expect((await ops(publicada).obtener(tCarla)).status).toBe(200);
    await e.db.query("UPDATE cotizaciones SET estado='RETIRADA', retirada_en=now() WHERE solicitud_id=$1 AND prestador_cuenta_id=$2", [publicada.solicitudId, carla.cuentaId]);
    for (const nombre of lecturas) expect([nombre, (await ops(publicada)[nombre](tCarla)).status]).toEqual([nombre, 404]);
  });
});

describe('solicitud cerrada (CA-CIE-03 y CA-CIE-04)', () => {
  test('el destinatario y el autor leen la cerrada y sus versiones; un prestador sin título recibe 404', async () => {
    const d = e.datos;
    const c = (await e.crear(tDueno, { tipo: 'DIRIGIDA', prestadorId: d.prestadores.ana.prestadorId, descripcion: 'Dirigida que se cerrará.', categoriaId: d.categorias.A, distrito: 'ayacucho', fechaDesde: '2031-07-01' }).expect(201)).body;
    const p = (await e.publicar(tDueno, c.solicitudId, { version: c.version }).expect(200)).body;
    const pub = (await e.crear(tDueno, cuerpoPublicable(e)).expect(201)).body; const pp = (await e.publicar(tDueno, pub.solicitudId, { version: pub.version }).expect(200)).body;
    await cotizar(pp.solicitudId, d.prestadores.beto);
    await e.cerrarSolicitud(tDueno, p.solicitudId, { version: p.version }).expect(200); await e.cerrarSolicitud(tDueno, pp.solicitudId, { version: pp.version }).expect(200);
    expect((await e.obtener(tAna, p.solicitudId).expect(200)).body.estado).toBe('CERRADA');
    expect((await e.historial(tAna, p.solicitudId, '?tipo=versiones')).status).toBe(200);
    expect((await e.obtener(tBeto, pp.solicitudId).expect(200)).body.estado).toBe('CERRADA');
    expect((await e.historial(tBeto, pp.solicitudId, '?tipo=versiones')).status).toBe(200);
    expect((await e.obtener(tDario, p.solicitudId)).status).toBe(404);
    expect((await e.obtener(tDario, pp.solicitudId)).status).toBe(404);
    expect((await e.historial(tDueno, p.solicitudId, '?tipo=bitacora').expect(200)).body.elementos[0].tipo).toBe('CERRADA');
  });
});

describe('historial paginado (CA-HIS-02)', () => {
  test('versiones y bitácora están paginadas con total, orden determinista y límite de 50', async () => {
    const c = (await e.crear(tDueno, cuerpoPublicable(e)).expect(201)).body; let version = (await e.publicar(tDueno, c.solicitudId, { version: c.version }).expect(200)).body.version as number;
    for (let i = 0; i < 4; i += 1) version = (await e.editar(tDueno, c.solicitudId, { version, descripcion: `Edición ${i}` }).expect(200)).body.version;
    const p1 = (await e.historial(tDueno, c.solicitudId, '?tipo=versiones&tamano=2&pagina=1').expect(200)).body; const p2 = (await e.historial(tDueno, c.solicitudId, '?tipo=versiones&tamano=2&pagina=2').expect(200)).body;
    expect([p1.total, p1.elementos.length, p2.elementos.length]).toEqual([5, 2, 2]);
    expect([...p1.elementos, ...p2.elementos].map((x: { numero: number }) => x.numero)).toEqual([5, 4, 3, 2]);
    const bit = (await e.historial(tDueno, c.solicitudId, '?tipo=bitacora&tamano=50').expect(200)).body; expect(bit.total).toBe(6);
    expect((await e.historial(tDueno, c.solicitudId, '?tipo=bitacora&tamano=51')).status).toBe(400);
    expect((await e.historial(tDueno, c.solicitudId, '?tipo=otra')).status).toBe(400);
    expect((await e.historial(tDueno, c.solicitudId, '')).status).toBe(400);
  });
});

describe('ninguna respuesta incluye datos de contacto (CA-PRI-01)', () => {
  test('el detalle del destinatario, el del autor y el listado de prestador no contienen correo, teléfono ni identificadores de cuenta del cliente', async () => {
    const cliente = e.datos.clientes.clienteUno;
    const respuestas = [(await ops(dirigida).obtener(tAna).expect(200)).body, (await ops(publicada).obtener(tBeto).expect(200)).body, (await e.listar(tAna, '?rol=prestador').expect(200)).body, (await ops(dirigida).versiones(tAna).expect(200)).body];
    for (const cuerpo of respuestas) { const t = JSON.stringify(cuerpo); expect(t).not.toContain(cliente.correo); expect(t).not.toContain(cliente.cuentaId); expect(t).not.toMatch(/"(telefono|correo|nombreMostrar|clienteCuentaId)"/); }
  });
});
