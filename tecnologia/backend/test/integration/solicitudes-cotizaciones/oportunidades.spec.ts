import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ContadorSentencias, exigirConteoConstante } from '../../soporte/solicitudes-cotizaciones/contador-sentencias.js';
import { cuerpoPublicable, crearYPublicar, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

let e: EntornoUs1;
let cliente: string;
let ids: Record<string, string>;
const listado = (body: { elementos: { solicitudId: string }[] }) => body.elementos.map(x => x.solicitudId);
const token = (clave: keyof EntornoUs1['datos']['prestadores']) => e.token(e.datos.prestadores[clave]);

beforeAll(async () => {
  e = await montarUs1();
  cliente = await e.token(e.datos.clientes.clienteUno);
  const { A, A1, A2, B } = e.datos.categorias;
  const { elena, carla, gema } = e.datos.prestadores;
  const crear = async (extra: object, tk = cliente) => (await crearYPublicar(e, tk, extra)).solicitudId;
  ids = {
    A: await crear({ categoriaId: A }), A1: await crear({ categoriaId: A1 }), A1segunda: await crear({ categoriaId: A1 }),
    A2: await crear({ categoriaId: A2, distrito: 'san-juan-bautista' }), B: await crear({ categoriaId: B, distrito: 'jesus-nazareno' }),
    fuera: await crear({ categoriaId: A1, distrito: 'san-juan-bautista' }),
    directa: await crear({ tipo: 'DIRIGIDA', prestadorId: elena.prestadorId, categoriaId: B, distrito: 'san-juan-bautista' }),
    ajena: await crear({ tipo: 'DIRIGIDA', prestadorId: carla.prestadorId }),
    propia: await crear({ categoriaId: A }, await e.token(gema)),
  };
  await e.crear(cliente, cuerpoPublicable(e)).expect(201);
}, 240000);
afterAll(async () => { await e?.cerrar(); }, 120000);

test('CA-OPO-01 a 03 y CA-CMP-01 a 05, 07 y 08: categoría, distrito, destinatario y propias', async () => {
  const ver = async (p: Parameters<typeof token>[0]) => listado((await e.oportunidades(await token(p)).expect(200)).body);
  expect(await ver('ana')).toEqual(expect.arrayContaining([ids.A, ids.propia]));
  expect(await ver('ana')).toHaveLength(2);
  expect(await ver('beto')).toEqual([ids.propia, ids.A1segunda, ids.A1, ids.A]);
  expect(await ver('carla')).toEqual([ids.ajena, ids.A2]);
  expect(await ver('dario')).toEqual([ids.B]);
  expect(await ver('elena')).toEqual([ids.directa]);
  expect(await ver('gema')).toEqual([ids.A]);
});

test('CA-CMP-06: clasificación propia o padre inactivo, servicio pausado y retirado excluyen publicadas', async () => {
  const tk = await token('beto');
  const { A, A1 } = e.datos.categorias;
  const servicio = e.datos.prestadores.beto.servicios[0]!.id;
  for (const id of [A1, A]) {
    await e.db.query('UPDATE catalogo_clasificaciones SET activa=false WHERE id=$1', [id]);
    try { expect((await e.oportunidades(tk).expect(200)).body.total).toBe(0); }
    finally { await e.db.query('UPDATE catalogo_clasificaciones SET activa=true WHERE id=$1', [id]); }
  }
  await e.db.query("UPDATE catalogo_servicios SET estado='PAUSADO' WHERE id=$1", [servicio]);
  try { expect((await e.oportunidades(tk).expect(200)).body.total).toBe(0); }
  finally { await e.db.query("UPDATE catalogo_servicios SET estado='PUBLICADO' WHERE id=$1", [servicio]); }
  const dario = await token('dario');
  await e.db.query("UPDATE catalogo_servicios SET estado='RETIRADO' WHERE id=$1", [e.datos.prestadores.dario.servicios[0]!.id]);
  expect((await e.oportunidades(dario).expect(200)).body.total).toBe(0);
});

test('CP-303: permisos para cuenta anónima, cliente, prestador y cuenta dual', async () => {
  await e.oportunidades(undefined).expect(401);
  await e.oportunidades(cliente).expect(403);
  await e.listar(cliente, '?rol=prestador').expect(403);
  const prestador = await token('ana');
  await e.oportunidades(prestador).expect(200);
  await e.listar(prestador, '?rol=prestador').expect(200);
  await e.listar(prestador, '?rol=cliente').expect(403);
  const dual = await token('gema');
  await e.oportunidades(dual).expect(200);
  await e.listar(dual, '?rol=prestador').expect(200);
  await e.listar(dual, '?rol=cliente').expect(200);
});

test('CP-304 y CP-306: desempate estable, total en página vacía y una sola consulta de página', async () => {
  const tk = await token('beto');
  const iguales = [randomUUID(), randomUUID()].sort();
  await e.db.query(`INSERT INTO solicitudes (id, cliente_cuenta_id, tipo, estado, descripcion, categoria_id, distrito_codigo, fecha_desde, version_trabajo, publicada_en)
    SELECT id, $2, 'PUBLICADA', 'ABIERTA', 'Ampliación de patio', $3, 'ayacucho', '2031-04-01', 1, now() FROM unnest($1::uuid[]) AS id`,
  [iguales, e.datos.clientes.clienteUno.cuentaId, e.datos.categorias.A1]);
  const orden = [...iguales, ids.propia, ids.A1segunda, ids.A1, ids.A];
  const contador = new ContadorSentencias().instalar(e.db);
  try {
    const mediciones = [];
    for (const tamano of [1, 2, 50]) {
      const medida = await contador.contar(async () => (await e.oportunidades(tk, `?pagina=1&tamano=${tamano}`).expect(200)).body);
      mediciones.push(medida.total);
      expect(medida.sentencias.filter(sql => /count\(\*\) OVER/i.test(sql))).toHaveLength(1);
      expect(medida.resultado).toMatchObject({ pagina: 1, tamano, total: 6 });
      expect(listado(medida.resultado)).toEqual(orden.slice(0, tamano));
    }
    exigirConteoConstante(mediciones);
    expect(listado((await e.oportunidades(tk, '?pagina=2&tamano=2').expect(200)).body)).toEqual(orden.slice(2, 4));
    expect((await e.oportunidades(tk, '?pagina=9&tamano=2').expect(200)).body).toEqual({ pagina: 9, tamano: 2, total: 6, elementos: [] });
    await e.oportunidades(tk, '?tamano=51').expect(400);
  } finally { contador.liberar(); }
});
