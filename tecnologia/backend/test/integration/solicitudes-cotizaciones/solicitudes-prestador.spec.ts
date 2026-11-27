import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ContadorSentencias, exigirConteoConstante } from '../../soporte/solicitudes-cotizaciones/contador-sentencias.js';
import { cuerpoPublicable, crearYPublicar, imagen, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

let e: EntornoUs1;
let cliente: string;
let elena: string;
let beto: string;

beforeAll(async () => {
  e = await montarUs1();
  cliente = await e.token(e.datos.clientes.clienteUno);
  elena = await e.token(e.datos.prestadores.elena);
  beto = await e.token(e.datos.prestadores.beto);
}, 240000);
afterAll(async () => { await e?.cerrar(); }, 120000);

async function conFoto(extra: object = {}) {
  const creada = (await e.crear(cliente, cuerpoPublicable(e, extra)).expect(201)).body;
  const foto = (await e.cargar(cliente, creada.solicitudId, await imagen()).expect(201)).body;
  const publicada = (await e.publicar(cliente, creada.solicitudId, { version: creada.version, archivosIds: [foto.archivoId] }).expect(200)).body;
  return { solicitudId: publicada.solicitudId as string, version: publicada.version as number, archivoId: foto.archivoId as string };
}

test('CP-301 y CP-302: dirigida cerrada localizable sin cotización y privada frente a cuentas ajenas', async () => {
  const { prestadorId } = e.datos.prestadores.elena;
  const s = await conFoto({ tipo: 'DIRIGIDA', prestadorId });
  await e.crear(cliente, cuerpoPublicable(e, { tipo: 'DIRIGIDA', prestadorId })).expect(201);
  const cerrada = await e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }).expect(200);
  expect(cerrada.body.estado).toBe('CERRADA');
  expect((await e.oportunidades(elena).expect(200)).body.elementos).toEqual([]);
  await e.listar(cliente, '?rol=prestador').expect(403);
  const contador = new ContadorSentencias().instalar(e.db);
  try {
    const conteos = [];
    for (const tamano of [1, 20, 50]) {
      const { resultado, total, sentencias } = await contador.contar(() => e.listar(elena, `?rol=prestador&estado=CERRADA&tamano=${tamano}`).expect(200));
      expect(resultado.body).toMatchObject({ total: 1, elementos: [{ estado: 'CERRADA', solicitudId: s.solicitudId, titulos: ['DESTINATARIO'] }] });
      expect(sentencias.filter(sql => /count\(\*\) OVER/i.test(sql))).toHaveLength(1);
      expect(JSON.stringify(resultado.body)).not.toMatch(/clienteCuentaId|correo|contacto/i);
      conteos.push(total);
    }
    exigirConteoConstante(conteos);
  } finally { contador.liberar(); }
  const detalle = (await e.obtener(elena, s.solicitudId).expect(200)).body;
  expect(detalle).toMatchObject({ estado: 'CERRADA', titulos: ['DESTINATARIO'], fotografias: { hay: true, compartidas: true } });
  expect(JSON.stringify(detalle)).not.toMatch(/clienteCuentaId|correo|contacto|objetoClave|prestadorId/i);
  await e.obtener(beto, s.solicitudId).expect(404);
  await e.archivo(beto, s.solicitudId, s.archivoId).expect(404);
  await e.archivo(elena, s.solicitudId, s.archivoId).expect(200);
  await e.db.query("INSERT INTO cotizaciones (id,solicitud_id,prestador_id,prestador_cuenta_id,estado,retirada_en) VALUES ($1,$2,$3,$4,'RETIRADA',now())",
    [randomUUID(), s.solicitudId, prestadorId, e.datos.prestadores.elena.cuentaId]);
  expect((await e.obtener(elena, s.solicitudId).expect(200)).body.titulos).toEqual(['DESTINATARIO']);
  await e.archivo(elena, s.solicitudId, s.archivoId).expect(200);
});

test('CA-ARC-04 y CA-HIS-01: vigente, fotos privadas y revocación en la siguiente petición', async () => {
  const s = await conFoto();
  expect((await e.oportunidades(beto).expect(200)).body.elementos).toEqual(expect.arrayContaining([
    expect.objectContaining({ solicitudId: s.solicitudId, hayFotografias: true, fotografiasCompartidas: false }),
  ]));
  const detalle = async () => (await e.obtener(beto, s.solicitudId).expect(200)).body;
  expect(await detalle()).toMatchObject({ titulos: ['COMPATIBLE'], versionTrabajo: 1, fotografias: { hay: true, compartidas: false, archivos: [] } });
  await e.archivo(beto, s.solicitudId, s.archivoId).expect(404);
  await e.historial(beto, s.solicitudId, '?tipo=versiones').expect(404);
  await e.historial(beto, s.solicitudId, '?tipo=bitacora').expect(404);
  const compartida = (await e.editar(cliente, s.solicitudId, { version: s.version, compartirFotografias: true }).expect(200)).body;
  expect((await detalle()).fotografias.archivos).toEqual([expect.objectContaining({ archivoId: s.archivoId })]);
  await e.archivo(beto, s.solicitudId, s.archivoId).expect(200);
  await e.editar(cliente, s.solicitudId, { version: compartida.version, compartirFotografias: false }).expect(200);
  expect((await detalle()).fotografias.archivos).toEqual([]);
  await e.archivo(beto, s.solicitudId, s.archivoId).expect(404);
});

test('CA-PRI-05: la autoría vigente conserva la lectura al perder compatibilidad y al cerrar', async () => {
  const s = await crearYPublicar(e, cliente);
  const p = e.datos.prestadores.beto;
  await e.db.query("INSERT INTO cotizaciones (id,solicitud_id,prestador_id,prestador_cuenta_id,estado) VALUES ($1,$2,$3,$4,'ACTIVA')",
    [randomUUID(), s.solicitudId, p.prestadorId, p.cuentaId]);
  await e.db.query("UPDATE catalogo_servicios SET estado='PAUSADO' WHERE id=$1", [p.servicios[0]!.id]);
  try {
    expect((await e.oportunidades(beto).expect(200)).body.elementos).toEqual([]);
    expect((await e.obtener(beto, s.solicitudId).expect(200)).body.titulos).toEqual(['AUTOR_DE_COTIZACION']);
    await e.historial(beto, s.solicitudId, '?tipo=versiones').expect(200);
    await e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }).expect(200);
    expect((await e.listar(beto, '?rol=prestador&estado=CERRADA').expect(200)).body.elementos).toEqual([
      expect.objectContaining({ solicitudId: s.solicitudId, titulos: ['AUTOR_DE_COTIZACION'] }),
    ]);
    expect((await e.obtener(beto, s.solicitudId).expect(200)).body.estado).toBe('CERRADA');
    const decision = (await e.obtener(await e.token(e.datos.prestadores.ana), s.solicitudId).expect(404)).body;
    expect(decision).toEqual((await e.obtener(beto, randomUUID()).expect(404)).body);
  } finally { await e.db.query("UPDATE catalogo_servicios SET estado='PUBLICADO' WHERE id=$1", [p.servicios[0]!.id]); }
});

test('FR-324 a FR-328: sin sesión, no compatibles, ajenos y borradores reciben la misma respuesta opaca que un identificador inexistente', async () => {
  const s = await conFoto();
  await e.crear(cliente, cuerpoPublicable(e)).expect(201);
  const borrador = (await e.crear(cliente, cuerpoPublicable(e)).expect(201)).body.solicitudId as string;
  const carla = await e.token(e.datos.prestadores.carla);
  const ajeno = await e.token(e.datos.clientes.clienteDos);
  const inexistente = (await e.obtener(beto, randomUUID()).expect(404)).body;
  await e.obtener(undefined, s.solicitudId).expect(401);
  await e.archivo(undefined, s.solicitudId, s.archivoId).expect(401);
  for (const tk of [carla, ajeno]) {
    expect((await e.obtener(tk, s.solicitudId).expect(404)).body).toEqual(inexistente);
    expect((await e.archivo(tk, s.solicitudId, s.archivoId).expect(404)).body).toEqual(inexistente);
    await e.historial(tk, s.solicitudId, '?tipo=versiones').expect(404);
  }
  expect((await e.obtener(beto, borrador).expect(404)).body).toEqual(inexistente);
  await e.obtener(cliente, borrador).expect(200);
  expect((await e.oportunidades(carla).expect(200)).body.elementos.map((x: { solicitudId: string }) => x.solicitudId)).not.toContain(s.solicitudId);
});

test('revocación: cerrar la solicitud o perder la compatibilidad retira el acceso al detalle y a la fotografía compartida', async () => {
  const s = await conFoto({ compartirFotografias: true });
  const p = e.datos.prestadores.beto;
  await e.obtener(beto, s.solicitudId).expect(200);
  await e.archivo(beto, s.solicitudId, s.archivoId).expect(200);
  await e.db.query("UPDATE catalogo_servicios SET estado='PAUSADO' WHERE id=$1", [p.servicios[0]!.id]);
  try {
    await e.obtener(beto, s.solicitudId).expect(404);
    await e.archivo(beto, s.solicitudId, s.archivoId).expect(404);
  } finally { await e.db.query("UPDATE catalogo_servicios SET estado='PUBLICADO' WHERE id=$1", [p.servicios[0]!.id]); }
  await e.archivo(beto, s.solicitudId, s.archivoId).expect(200);
  await e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }).expect(200);
  await e.obtener(beto, s.solicitudId).expect(404);
  await e.archivo(beto, s.solicitudId, s.archivoId).expect(404);
  expect((await e.oportunidades(beto).expect(200)).body.elementos.map((x: { solicitudId: string }) => x.solicitudId)).not.toContain(s.solicitudId);
  await e.archivo(cliente, s.solicitudId, s.archivoId).expect(200);
});
