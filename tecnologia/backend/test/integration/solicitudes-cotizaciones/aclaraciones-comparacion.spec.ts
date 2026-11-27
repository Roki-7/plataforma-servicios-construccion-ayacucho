import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ContadorSentencias, exigirConteoConstante } from '../../soporte/solicitudes-cotizaciones/contador-sentencias.js';
import { validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { crearYPublicar, cuerpoDefinitiva, cuerpoEstimada, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T080 · HU11 con PostgreSQL real: aclaraciones (CA-ACL-01 a 04), lista y comparación del cliente (CA-COT-08, CA-COT-11, CA-COT-12, CA-RF17-04), nombres públicos limitados a
// quien tiene título (cliente dueño), paginación determinista y presupuesto constante de sentencias (CP-304 y CP-306).
// Para una solicitud de la categoría A en Ayacucho cotizan Ana, Beto y Gema; de la subcategoría A1, solo Beto.
let e: EntornoUs1;
let cliente: string; let otroCliente: string; let ana: string; let beto: string; let gema: string; let carla: string;
const categoriaA = () => e.datos.categorias.A;
const solicitudA = (extra: object = {}) => crearYPublicar(e, cliente, { categoriaId: categoriaA(), ...extra });
const contar = async (sql: string, parametros: unknown[]) => Number(((await e.db.query(sql, parametros)) as { n: string }[])[0]!.n);
const idsDe = (r: { body: { elementos: { cotizacionId: string }[] } }) => r.body.elementos.map(x => x.cotizacionId);
// Nombres públicos de la semilla ficticia (`catalogo_proyeccion_prestadores.nombre_publico`).
const nombre = (clave: 'ana' | 'beto' | 'gema') => ({ ana: 'Ana Albañil', beto: 'Beto Gasfitero', gema: 'Gema Constructora' })[clave];

beforeAll(async () => {
  e = await montarUs1();
  const t = (c: Parameters<EntornoUs1['token']>[0]) => e.token(c);
  cliente = await t(e.datos.clientes.clienteUno); otroCliente = await t(e.datos.clientes.clienteDos);
  [ana, beto, gema, carla] = await Promise.all([t(e.datos.prestadores.ana), t(e.datos.prestadores.beto), t(e.datos.prestadores.gema), t(e.datos.prestadores.carla)]) as [string, string, string, string];
}, 240000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('aclaraciones (CA-ACL-01 a 04)', () => {
  test('el cliente y el autor intercambian mensajes y el hilo sobrevive a las actualizaciones (CA-ACL-01)', async () => {
    const s = await solicitudA();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const m1 = (await e.aclarar(cliente, c.cotizacionId, { texto: '  ¿Incluye el retiro del desmonte?  ' }).expect(201)).body;
    await validarRespuesta003('C003Aclaracion', m1);
    expect(m1).toMatchObject({ numero: 1, autor: 'CLIENTE', texto: '¿Incluye el retiro del desmonte?', versionCotizacion: 1 });
    expect(JSON.stringify(m1)).not.toMatch(/cuenta|correo|telefono/i);
    const m2 = (await e.aclarar(beto, c.cotizacionId, { texto: 'No, el desmonte se cotiza aparte.' }).expect(201)).body;
    expect(m2).toMatchObject({ numero: 2, autor: 'PRESTADOR', versionCotizacion: 1 });
    await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoDefinitiva(s.versionTrabajo), versionCotizacion: 1 }).expect(201);
    const m3 = (await e.aclarar(cliente, c.cotizacionId, { texto: 'Entonces cotícelo con el desmonte.' }).expect(201)).body;
    expect(m3).toMatchObject({ numero: 3, versionCotizacion: 2 });
    for (const tk of [cliente, beto]) {
      const r = await e.aclaraciones(tk, c.cotizacionId).expect(200);
      await validarRespuesta003('C003PaginaAclaraciones', r.body);
      expect(r.body.elementos.map((m: { numero: number; autor: string; versionCotizacion: number }) => [m.numero, m.autor, m.versionCotizacion])).toEqual([[1, 'CLIENTE', 1], [2, 'PRESTADOR', 1], [3, 'CLIENTE', 2]]);
      expect(r.body).toMatchObject({ total: 3, pagina: 1, tamano: 20 });
    }
  });

  test('un mensaje de más de 1 000 caracteres es 400 y el 21.º de un hilo es 422 LIMITE_ACLARACIONES (CA-ACL-02)', async () => {
    const s = await solicitudA();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    expect((await e.aclarar(cliente, c.cotizacionId, { texto: 'x'.repeat(1001) }).expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
    expect((await e.aclarar(cliente, c.cotizacionId, { texto: '   ' }).expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
    await e.aclarar(cliente, c.cotizacionId, { texto: 'x'.repeat(1000) }).expect(201);
    for (let i = 2; i <= 20; i += 1) await e.aclarar(i % 2 ? cliente : beto, c.cotizacionId, { texto: `Mensaje ${i}` }).expect(201);
    const veintiuno = await e.aclarar(cliente, c.cotizacionId, { texto: 'Mensaje 21' }).expect(422);
    expect(veintiuno.body.codigo).toBe('LIMITE_ACLARACIONES');
    expect(await contar('SELECT count(*) AS n FROM cotizaciones_aclaraciones WHERE cotizacion_id=$1', [c.cotizacionId])).toBe(20);
    expect((await e.aclaraciones(cliente, c.cotizacionId, '?tamano=50').expect(200)).body.total).toBe(20);
  });

  test('dos mensajes simultáneos con 19 en el hilo: uno gana, el otro recibe 422 y la numeración no se repite', async () => {
    const s = await solicitudA();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    for (let i = 1; i <= 19; i += 1) await e.aclarar(cliente, c.cotizacionId, { texto: `Mensaje ${i}` }).expect(201);
    const [a, b] = await Promise.all([e.aclarar(cliente, c.cotizacionId, { texto: 'Simultáneo A' }), e.aclarar(beto, c.cotizacionId, { texto: 'Simultáneo B' })]);
    expect([a.status, b.status].sort()).toEqual([201, 422]);
    expect(await contar('SELECT count(DISTINCT numero) AS n FROM cotizaciones_aclaraciones WHERE cotizacion_id=$1', [c.cotizacionId])).toBe(20);
  });

  test('con la cotización retirada o la solicitud cerrada el hilo queda en lectura (CA-ACL-03), y un reenvío empieza con un hilo vacío (CA-COT-06)', async () => {
    const s = await solicitudA();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    await e.aclarar(cliente, c.cotizacionId, { texto: 'Antes del retiro' }).expect(201);
    await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }).expect(200);
    for (const tk of [cliente, beto]) expect((await e.aclarar(tk, c.cotizacionId, { texto: 'Después' }).expect(409)).body.codigo).toBe('COTIZACION_RETIRADA');
    expect((await e.aclaraciones(cliente, c.cotizacionId).expect(200)).body.total).toBe(1);
    const nueva = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    expect((await e.aclaraciones(cliente, nueva.cotizacionId).expect(200)).body).toMatchObject({ total: 0, elementos: [] });
    await e.aclarar(beto, nueva.cotizacionId, { texto: 'Hilo nuevo' }).expect(201);
    await e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }).expect(200);
    for (const tk of [cliente, beto]) expect((await e.aclarar(tk, nueva.cotizacionId, { texto: 'Con la solicitud cerrada' }).expect(409)).body.codigo).toBe('SOLICITUD_NO_ABIERTA');
    for (const [tk, id, total] of [[cliente, nueva.cotizacionId, 1], [beto, nueva.cotizacionId, 1], [cliente, c.cotizacionId, 1]] as const) expect((await e.aclaraciones(tk, id).expect(200)).body.total).toBe(total);
  });

  test('cualquier otra cuenta no puede leer ni escribir el hilo y recibe el mismo 404 que ante un identificador inexistente (CA-ACL-04)', async () => {
    const s = await solicitudA();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    await e.aclarar(cliente, c.cotizacionId, { texto: 'Mensaje privado' }).expect(201);
    const inexistente = (await e.aclaraciones(beto, randomUUID()).expect(404)).body;
    for (const tk of [ana, gema, carla, otroCliente]) {
      expect((await e.aclaraciones(tk, c.cotizacionId).expect(404)).body).toEqual(inexistente);
      expect((await e.aclarar(tk, c.cotizacionId, { texto: 'Intruso' }).expect(404)).body).toEqual(inexistente);
    }
    await e.aclaraciones(undefined, c.cotizacionId).expect(401);
    await e.aclarar(undefined, c.cotizacionId, { texto: 'Anónimo' }).expect(401);
    expect(await contar('SELECT count(*) AS n FROM cotizaciones_aclaraciones WHERE cotizacion_id=$1', [c.cotizacionId])).toBe(1);
    expect((await e.aclarar(beto, randomUUID(), { texto: 'x' }).expect(404)).body).toEqual(inexistente);
  });

  test('repetir un mensaje con la misma clave no lo duplica y con otro texto devuelve 409', async () => {
    const s = await solicitudA();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const clave = randomUUID();
    const primero = await e.aclarar(cliente, c.cotizacionId, { texto: 'Una sola vez' }, clave).expect(201);
    expect((await e.aclarar(cliente, c.cotizacionId, { texto: 'Una sola vez' }, clave).expect(201)).body).toEqual(primero.body);
    expect((await e.aclarar(cliente, c.cotizacionId, { texto: 'Otro texto' }, clave).expect(409)).body.codigo).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
    expect(await contar('SELECT count(*) AS n FROM cotizaciones_aclaraciones WHERE cotizacion_id=$1', [c.cotizacionId])).toBe(1);
  });
});

describe('cotizaciones de mi solicitud (CA-COT-11 en su parte de cliente, CP-304)', () => {
  test('el cliente lista las cotizaciones de su solicitud en orden de llegada, sin clasificación, con total coherente y nombres de sus autores', async () => {
    const s = await solicitudA();
    // Precios decrecientes: si hubiera una clasificación por precio, el orden cambiaría.
    const c1 = (await e.cotizar(ana, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo, { precioCentimos: 900000 })).expect(201)).body;
    const c2 = (await e.cotizar(beto, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo, { precioCentimos: 500000 })).expect(201)).body;
    const c3 = (await e.cotizar(gema, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const r = await e.cotizacionesDe(cliente, s.solicitudId).expect(200);
    await validarRespuesta003('C003PaginaCotizaciones', r.body);
    expect(idsDe(r)).toEqual([c1.cotizacionId, c2.cotizacionId, c3.cotizacionId]);
    expect(r.body).toMatchObject({ total: 3, pagina: 1, tamano: 20 });
    expect(r.body.elementos.map((x: { prestadorNombrePublico: string }) => x.prestadorNombrePublico)).toEqual([nombre('ana'), nombre('beto'), nombre('gema')]);
    expect(JSON.stringify(r.body)).not.toMatch(/total(Final|General)|mejor|ranking|puntaje|recomend|cuenta|correo|telefono/i);
    expect((await e.cotizacionesDe(cliente, s.solicitudId, '?pagina=2&tamano=2').expect(200)).body).toMatchObject({ total: 3, pagina: 2, tamano: 2, elementos: [expect.objectContaining({ cotizacionId: c3.cotizacionId })] });
    expect((await e.cotizacionesDe(cliente, s.solicitudId, '?pagina=9&tamano=2').expect(200)).body).toEqual({ elementos: [], total: 3, pagina: 9, tamano: 2 });
    expect(idsDe(await e.cotizacionesDe(cliente, s.solicitudId, '?pagina=1&tamano=2').expect(200))).toEqual([c1.cotizacionId, c2.cotizacionId]);
  });

  test('una solicitud sin cotizaciones devuelve una página vacía, y el detalle de una cotización muestra el nombre solo al cliente dueño', async () => {
    const vacia = await solicitudA();
    expect((await e.cotizacionesDe(cliente, vacia.solicitudId).expect(200)).body).toEqual({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    const c = (await e.cotizar(beto, vacia.solicitudId, cuerpoEstimada(vacia.versionTrabajo)).expect(201)).body;
    expect((await e.cotizacion(cliente, c.cotizacionId).expect(200)).body.prestadorNombrePublico).toBe(nombre('beto'));
    expect((await e.cotizacion(beto, c.cotizacionId).expect(200)).body).not.toHaveProperty('prestadorNombrePublico');
  });

  test('un tercero recibe 404 y no obtiene nombres, y un prestador no ve los de otros autores', async () => {
    const s = await solicitudA();
    const cb = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    await e.cotizar(ana, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201);
    const inexistente = (await e.cotizacionesDe(cliente, randomUUID()).expect(404)).body;
    for (const tk of [otroCliente, ana, beto, gema, carla]) {
      const r = await e.cotizacionesDe(tk, s.solicitudId).expect(404);
      expect(r.body).toEqual(inexistente);
      expect(JSON.stringify(r.body)).not.toContain(nombre('beto'));
      expect((await e.cotizacionesDe(tk, s.solicitudId, `?ids=${cb.cotizacionId}`).expect(404)).body).toEqual(inexistente);
    }
    await e.cotizacionesDe(undefined, s.solicitudId).expect(401);
    // Ana, autora de otra cotización, no obtiene el detalle ni el nombre de la de Beto; sus propias cotizaciones no incluyen nombres.
    expect((await e.cotizacion(ana, cb.cotizacionId).expect(404)).body).toEqual(inexistente);
    expect(JSON.stringify((await e.misCotizaciones(ana).expect(200)).body)).not.toContain(nombre('beto'));
    expect(JSON.stringify((await e.misCotizaciones(ana).expect(200)).body)).not.toMatch(/prestadorNombrePublico/);
  });

  test('presupuesto constante: la lista cuesta las mismas sentencias con 1, 2 o 50 por página y con 2 o 5 ids, con un solo total y una sola lectura de nombres', async () => {
    const s = await solicitudA();
    const hechas: string[] = [];
    for (let i = 0; i < 2; i += 1) { const x = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body.cotizacionId; hechas.push(x); await e.retirarCotizacion(beto, x, { versionCotizacion: 1 }).expect(200); }
    for (const tk of [ana, beto, gema]) hechas.push((await e.cotizar(tk, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body.cotizacionId);
    const contador = new ContadorSentencias().instalar(e.db);
    try {
      const mediciones = [];
      for (const tamano of [1, 2, 50]) {
        const m = await contador.contar(async () => (await e.cotizacionesDe(cliente, s.solicitudId, `?pagina=1&tamano=${tamano}`).expect(200)).body);
        mediciones.push(m.total);
        expect(m.sentencias.filter(sql => /count\(\*\) OVER/i.test(sql))).toHaveLength(1);
        expect(m.sentencias.filter(sql => /nombre_publico/i.test(sql))).toHaveLength(1);
        expect(m.resultado).toMatchObject({ total: 5, tamano });
      }
      exigirConteoConstante(mediciones);
      const comparaciones = [];
      for (const cuantos of [2, 5]) {
        const m = await contador.contar(async () => (await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${hechas.slice(0, cuantos).join(',')}`).expect(200)).body);
        comparaciones.push(m.total);
        expect(m.sentencias.filter(sql => /nombre_publico/i.test(sql))).toHaveLength(1);
        expect(m.resultado.elementos).toHaveLength(cuantos);
      }
      exigirConteoConstante(comparaciones);
    } finally { contador.liberar(); }
  });
});

describe('comparación (CA-COT-08, CA-COT-12, CA-RF17-04)', () => {
  test('las cotizaciones indicadas se devuelven en el orden pedido, con estimadas e incompletas identificables y sin sumas', async () => {
    const s = await solicitudA();
    const definitiva = (await e.cotizar(ana, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo)).expect(201)).body;
    const estimada = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const r = await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${estimada.cotizacionId},${definitiva.cotizacionId}`).expect(200);
    await validarRespuesta003('C003PaginaCotizaciones', r.body);
    expect(idsDe(r)).toEqual([estimada.cotizacionId, definitiva.cotizacionId]);
    expect(r.body.total).toBe(2);
    const [est, def] = r.body.elementos;
    expect(est.versionVigente).toMatchObject({ tipo: 'ESTIMADA', formaCalculo: 'S/ 85 por metro cuadrado' });
    for (const campo of ['precioCentimos', 'plazoDias', 'condicionesPago']) expect(est.versionVigente).not.toHaveProperty(campo);
    expect(def.versionVigente).toMatchObject({ tipo: 'DEFINITIVA', precioCentimos: 250000, plazoDias: 6 });
    expect(Object.keys(r.body).sort()).toEqual(['elementos', 'pagina', 'tamano', 'total']);
  });

  test('señala las vencidas, las pendientes de revisión y las de solicitud cerrada en la misma comparación', async () => {
    const s = await solicitudA();
    const vence = (await e.cotizar(ana, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { vigenteHasta: new Date(Date.now() + 1500).toISOString() })).expect(201)).body;
    const viva = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    await e.editar(cliente, s.solicitudId, { version: s.version, medidas: '6 m de largo' }).expect(200);
    await new Promise(r => setTimeout(r, 1800));
    let r = await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${vence.cotizacionId},${viva.cotizacionId}`).expect(200);
    expect(r.body.elementos.map((x: { estado: string; motivosNoAceptable: string[] }) => [x.estado, x.motivosNoAceptable])).toEqual([['VENCIDA', ['VENCIDA', 'PENDIENTE_REVISION']], ['PENDIENTE_REVISION', ['PENDIENTE_REVISION']]]);
    const { version } = (await e.obtener(cliente, s.solicitudId).expect(200)).body;
    await e.cerrarSolicitud(cliente, s.solicitudId, { version }).expect(200);
    r = await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${viva.cotizacionId}`).expect(200);
    expect(r.body.elementos[0]).toMatchObject({ solicitudCerrada: true, motivosNoAceptable: ['PENDIENTE_REVISION', 'SOLICITUD_CERRADA'] });
  });

  test('se aceptan 10 cotizaciones, 11 devuelven 422 LIMITE_COMPARACION y los identificadores repetidos cuentan una vez (CA-COT-12)', async () => {
    const s = await solicitudA();
    const ids: string[] = [];
    for (let i = 0; i < 11; i += 1) { const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body; ids.push(c.cotizacionId); if (i < 10) await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }).expect(200); }
    const diez = await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${ids.slice(0, 10).join(',')}`).expect(200);
    expect(diez.body).toMatchObject({ total: 10 });
    expect(idsDe(diez)).toEqual(ids.slice(0, 10));
    const once = await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${ids.join(',')}`).expect(422);
    expect(once.body.codigo).toBe('LIMITE_COMPARACION');
    expect((await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${ids[0]},${ids[0]},${ids[1]}`).expect(200)).body.total).toBe(2);
    expect((await e.cotizacionesDe(cliente, s.solicitudId, '?pagina=1&tamano=50').expect(200)).body.total).toBe(11);
  }, 120000);

  test('un identificador ajeno a la solicitud o inexistente responde 404 sin revelar de quién es, y uno mal formado, 400', async () => {
    const s = await solicitudA(); const otra = await solicitudA();
    const mia = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const deOtra = (await e.cotizar(beto, otra.solicitudId, cuerpoEstimada(otra.versionTrabajo)).expect(201)).body;
    const inexistente = (await e.cotizacionesDe(cliente, randomUUID()).expect(404)).body;
    expect((await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${mia.cotizacionId},${deOtra.cotizacionId}`).expect(404)).body).toEqual(inexistente);
    expect((await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${randomUUID()}`).expect(404)).body).toEqual(inexistente);
    await e.cotizacionesDe(cliente, s.solicitudId, '?ids=no-es-uuid').expect(400);
    await e.cotizacionesDe(cliente, s.solicitudId, `?ids=${mia.cotizacionId},`).expect(400);
  });
});
