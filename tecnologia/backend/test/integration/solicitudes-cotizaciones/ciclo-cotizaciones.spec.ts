import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ContadorSentencias, exigirConteoConstante } from '../../soporte/solicitudes-cotizaciones/contador-sentencias.js';
import { validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { crearYPublicar, cuerpoDefinitiva, cuerpoEstimada, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T069 · ciclo de cotizaciones de HU10 con PostgreSQL real: envío, actualización, revisión, vencimiento, retiro y reenvío, títulos de acceso y avisos.
// Beto es el único compatible con una publicada de la subcategoría A1; Ana, Carla y Dario no lo son. Elena tiene un servicio en pausa.
const reloj = { desfase: 0 };
let e: EntornoUs1;
let cliente: string; let beto: string; let ana: string; let carla: string; let elena: string; let gema: string; let otroCliente: string;
const ahora = () => new Date(Date.now() + reloj.desfase);
const nuevaPublicada = (extra: object = {}) => crearYPublicar(e, cliente, extra);
const ids = (r: { body: { elementos: { cotizacionId: string }[] } }) => r.body.elementos.map(x => x.cotizacionId);
const contar = async (sql: string, parametros: unknown[]) => Number(((await e.db.query(sql, parametros)) as { n: string }[])[0]!.n);
const avisos = (solicitudId: string, cuentaId: string, tipo: string) => contar('SELECT count(*) AS n FROM avisos_negocio WHERE solicitud_id=$1 AND cuenta_destinatario_id=$2 AND tipo=$3', [solicitudId, cuentaId, tipo]);

beforeAll(async () => {
  e = await montarUs1({ ahora });
  const t = (c: Parameters<EntornoUs1['token']>[0]) => e.token(c);
  cliente = await t(e.datos.clientes.clienteUno); otroCliente = await t(e.datos.clientes.clienteDos);
  beto = await t(e.datos.prestadores.beto); ana = await t(e.datos.prestadores.ana); carla = await t(e.datos.prestadores.carla);
  elena = await t(e.datos.prestadores.elena); gema = await t(e.datos.prestadores.gema);
}, 240000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('envío y datos obligatorios (CA-RF17-01 a 03, CA-COT-09)', () => {
  test('los datos incompletos devuelven 422 COTIZACION_INCOMPLETA y no crean nada; las válidas, 201 conforme al contrato', async () => {
    const s = await nuevaPublicada();
    const sinPlazo = await e.cotizar(beto, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo, { plazoDias: undefined })).expect(422);
    expect(sinPlazo.body).toMatchObject({ codigo: 'COTIZACION_INCOMPLETA', detalles: [{ campo: 'plazoDias' }] });
    const sinPago = await e.cotizar(beto, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo, { condicionesPago: undefined })).expect(422);
    expect(sinPago.body.detalles).toEqual([expect.objectContaining({ campo: 'condicionesPago' })]);
    const sinPrecio = await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { formaCalculo: undefined })).expect(422);
    expect(sinPrecio.body).toMatchObject({ codigo: 'COTIZACION_INCOMPLETA' });
    expect(await contar('SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id=$1', [s.solicitudId])).toBe(0);
    const r = await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201);
    await validarRespuesta003('C003Cotizacion', r.body);
    expect(r.body).toMatchObject({ estado: 'VIGENTE', vencida: false, requiereRevision: false, solicitudCerrada: false, motivosNoAceptable: [], version: 1,
      versionVigente: { numero: 1, tipo: 'ESTIMADA', versionTrabajoSolicitud: s.versionTrabajo, reemplazada: false } });
    expect(r.body.versionVigente).not.toHaveProperty('precioCentimos');
    expect(r.body.versionVigente).not.toHaveProperty('plazoDias');
    expect(JSON.stringify(r.body)).not.toMatch(/cuenta|correo|contacto|telefono/i);
  });
  test('una definitiva completa se acepta con el precio en céntimos', async () => {
    const s = await nuevaPublicada();
    const r = await e.cotizar(beto, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo)).expect(201);
    expect(r.body.versionVigente).toMatchObject({ tipo: 'DEFINITIVA', precioCentimos: 250000, plazoDias: 6, condicionesPago: '50 % al iniciar y 50 % al entregar.' });
  });
  test('una vigencia pasada se rechaza con FECHA_NO_VALIDA y un precio no positivo, con 400 del contrato', async () => {
    const s = await nuevaPublicada();
    expect((await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { vigenteHasta: '2020-01-01T00:00:00.000Z' })).expect(422)).body.codigo).toBe('FECHA_NO_VALIDA');
    await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { precioCentimos: 0 })).expect(400);
    await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { campoAjeno: 1 })).expect(400);
  });
});

describe('quién puede cotizar (FR-324, FR-335, CA-COT-02 y 09)', () => {
  test('un prestador no compatible, uno sin servicio publicado y uno que no es el destinatario reciben 404 y no se crea nada', async () => {
    const s = await nuevaPublicada();
    const inexistente = (await e.cotizar(beto, randomUUID(), cuerpoEstimada(1)).expect(404)).body;
    for (const tk of [ana, carla, elena]) expect((await e.cotizar(tk, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(404)).body).toEqual(inexistente);
    const dirigida = await nuevaPublicada({ tipo: 'DIRIGIDA', prestadorId: e.datos.prestadores.elena.prestadorId });
    expect((await e.cotizar(beto, dirigida.solicitudId, cuerpoEstimada(dirigida.versionTrabajo)).expect(404)).body).toEqual(inexistente);
    expect(await contar('SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id = ANY($1::uuid[])', [[s.solicitudId, dirigida.solicitudId]])).toBe(0);
  });
  test('el destinatario de una dirigida cotiza sin necesidad de compatibilidad ni de servicio elegible', async () => {
    const d = await nuevaPublicada({ tipo: 'DIRIGIDA', prestadorId: e.datos.prestadores.elena.prestadorId });
    const r = await e.cotizar(elena, d.solicitudId, cuerpoEstimada(d.versionTrabajo)).expect(201);
    expect(r.body.prestadorId).toBe(e.datos.prestadores.elena.prestadorId);
  });
  test('cotizar la propia solicitud devuelve 422 COTIZACION_PROPIA (CA-COT-02)', async () => {
    const propia = await crearYPublicar(e, gema, { categoriaId: e.datos.categorias.A });
    expect((await e.cotizar(gema, propia.solicitudId, cuerpoEstimada(propia.versionTrabajo)).expect(422)).body.codigo).toBe('COTIZACION_PROPIA');
  });
  test('sin sesión, 401; con perfil de cliente únicamente, 403; un borrador ajeno no se puede cotizar', async () => {
    const s = await nuevaPublicada();
    await e.cotizar(undefined, s.solicitudId, cuerpoEstimada(1)).expect(401);
    expect((await e.cotizar(otroCliente, s.solicitudId, cuerpoEstimada(1)).expect(403)).body.codigo).toBe('SIN_PERMISO');
    const borrador = (await e.crear(cliente, { tipo: 'PUBLICADA', descripcion: 'Borrador', categoriaId: e.datos.categorias.A1, distrito: 'ayacucho' }).expect(201)).body.solicitudId as string;
    await e.cotizar(beto, borrador, cuerpoEstimada(1)).expect(404);
  });
  test('CA-SOL-08: un servicio retirado tras publicar una dirigida deja la solicitud abierta y se puede cotizar', async () => {
    // Un servicio retirado es de solo lectura (no se puede revertir): se usa a Darío, que no interviene en los demás casos.
    const p = e.datos.prestadores.dario;
    const d = await nuevaPublicada({ tipo: 'DIRIGIDA', prestadorId: p.prestadorId, servicioId: p.servicios[0]!.id, categoriaId: undefined, distrito: 'jesus-nazareno' });
    await e.db.query("UPDATE catalogo_servicios SET estado='RETIRADO' WHERE id=$1", [p.servicios[0]!.id]);
    expect((await e.obtener(cliente, d.solicitudId).expect(200)).body.estado).toBe('ABIERTA');
    await e.cotizar(await e.token(p), d.solicitudId, cuerpoEstimada(d.versionTrabajo)).expect(201);
  });
});

describe('versión de trabajo y revisión (CA-COT-03 y 04, CA-AVI-04)', () => {
  test('cotizar sobre una versión de trabajo anterior devuelve 409 SOLICITUD_MODIFICADA; sobre la vigente, 201', async () => {
    const s = await nuevaPublicada();
    await e.editar(cliente, s.solicitudId, { version: s.version, descripcion: 'Necesito levantar un muro de ladrillo de 4 x 2 m en el patio.' }).expect(200);
    expect((await e.cotizar(beto, s.solicitudId, cuerpoEstimada(1)).expect(409)).body.codigo).toBe('SOLICITUD_MODIFICADA');
    await e.cotizar(beto, s.solicitudId, cuerpoEstimada(2)).expect(201);
  });
  test('un cambio relevante deja la cotización pendiente de revisión y no aceptable, y se resuelve actualizando', async () => {
    const s = await nuevaPublicada();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const editada = (await e.editar(cliente, s.solicitudId, { version: s.version, medidas: '4 m de largo por 2 m de alto' }).expect(200)).body;
    const pendiente = (await e.cotizacion(beto, c.cotizacionId).expect(200)).body;
    await validarRespuesta003('C003CotizacionDetalle', pendiente);
    expect(pendiente).toMatchObject({ estado: 'PENDIENTE_REVISION', requiereRevision: true, vencida: false, motivosNoAceptable: ['PENDIENTE_REVISION'] });
    expect(await avisos(s.solicitudId, e.datos.prestadores.beto.cuentaId, 'SOLICITUD_CAMBIADA')).toBe(1);
    expect(await avisos(s.solicitudId, e.datos.prestadores.ana.cuentaId, 'SOLICITUD_CAMBIADA')).toBe(0);
    // Un cambio de privacidad no crea versión de trabajo ni deja nada pendiente (FR-309).
    await e.editar(cliente, s.solicitudId, { version: editada.version, compartirFotografias: true }).expect(200);
    expect((await e.cotizacion(beto, c.cotizacionId).expect(200)).body.estado).toBe('PENDIENTE_REVISION');
    const actualizada = await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(editada.versionTrabajo), versionCotizacion: pendiente.version }).expect(201);
    expect(actualizada.body).toMatchObject({ estado: 'VIGENTE', requiereRevision: false, motivosNoAceptable: [], versionVigente: { numero: 2, versionTrabajoSolicitud: editada.versionTrabajo } });
  });
  test('publicar una publicada y cerrar sin interesados no registran avisos; el cierre avisa a cada autor sin duplicados', async () => {
    const s = await nuevaPublicada();
    expect(await contar('SELECT count(*) AS n FROM avisos_negocio WHERE solicitud_id=$1', [s.solicitudId])).toBe(0);
    await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201);
    await e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }).expect(200);
    expect(await avisos(s.solicitudId, e.datos.prestadores.beto.cuentaId, 'SOLICITUD_CERRADA')).toBe(1);
    expect(await contar('SELECT count(*) AS n FROM avisos_negocio WHERE solicitud_id=$1', [s.solicitudId])).toBe(1);
  });
});

describe('vigencia, actualización y retiro (CA-COT-05, 06 y 10, CA-PRI-05, 06 y 08)', () => {
  test('una cotización vencida sigue ocupando la posición y se actualiza en vez de reenviarla (CA-COT-05)', async () => {
    const s = await nuevaPublicada();
    const vence = new Date(Date.now() + 3_600_000).toISOString();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { vigenteHasta: vence })).expect(201)).body;
    reloj.desfase = 2 * 3_600_000;
    try {
      const vencida = (await e.cotizacion(beto, c.cotizacionId).expect(200)).body;
      expect(vencida).toMatchObject({ estado: 'VENCIDA', vencida: true, motivosNoAceptable: ['VENCIDA'] });
      expect((await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { vigenteHasta: new Date(ahora().getTime() + 3_600_000).toISOString() })).expect(409)).body.codigo).toBe('COTIZACION_EXISTENTE');
      const renovada = await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: vencida.version }).expect(201);
      expect(renovada.body).toMatchObject({ estado: 'VIGENTE', vencida: false });
    } finally { reloj.desfase = 0; }
  });
  test('cada actualización conserva las versiones anteriores como reemplazadas y exige la versión esperada (CA-COT-10)', async () => {
    const s = await nuevaPublicada();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const v2 = (await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoDefinitiva(s.versionTrabajo), versionCotizacion: 1 }).expect(201)).body;
    expect(v2).toMatchObject({ version: 2, versionVigente: { numero: 2, tipo: 'DEFINITIVA' } });
    expect((await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoDefinitiva(s.versionTrabajo), versionCotizacion: 1 }).expect(409)).body.codigo).toBe('VERSION_DESACTUALIZADA');
    for (const tk of [beto, cliente]) {
      const d = (await e.cotizacion(tk, c.cotizacionId).expect(200)).body;
      expect(d.versiones.map((v: { numero: number; reemplazada: boolean }) => [v.numero, v.reemplazada])).toEqual([[2, false], [1, true]]);
    }
    for (const tk of [ana, otroCliente]) await e.cotizacion(tk, c.cotizacionId).expect(404);
    await e.cotizacion(undefined, c.cotizacionId).expect(401);
  });
  test('retirar es terminal, libera la posición y reenviar crea otra identidad; la anterior conserva su historial (CA-COT-06)', async () => {
    const s = await nuevaPublicada();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const retirada = (await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }).expect(200)).body;
    expect(retirada).toMatchObject({ estado: 'RETIRADA', motivosNoAceptable: ['RETIRADA'], version: 2 });
    expect(retirada.retiradaEn).toEqual(expect.any(String));
    expect((await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 2 }).expect(409)).body.codigo).toBe('COTIZACION_RETIRADA');
    expect((await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: 2 }).expect(409)).body.codigo).toBe('COTIZACION_RETIRADA');
    const nueva = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    expect(nueva.cotizacionId).not.toBe(c.cotizacionId);
    expect(nueva).toMatchObject({ estado: 'VIGENTE', version: 1 });
    expect((await e.cotizacion(beto, c.cotizacionId).expect(200)).body).toMatchObject({ estado: 'RETIRADA', versiones: [expect.objectContaining({ numero: 1 })] });
    expect(await contar("SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id=$1 AND estado <> 'RETIRADA'", [s.solicitudId])).toBe(1);
  });
  test('CA-PRI-08: un compatible que retira sigue viendo la publicada abierta y puede enviar otra cotización', async () => {
    const s = await nuevaPublicada();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }).expect(200);
    expect((await e.obtener(beto, s.solicitudId).expect(200)).body.titulos).toEqual(['COMPATIBLE']);
    await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201);
  });
  test('CA-PRI-06: sin los títulos de destinatario ni de compatibilidad, retirar quita el acceso a la solicitud y conserva la lectura de la cotización', async () => {
    const s = await nuevaPublicada();
    const p = e.datos.prestadores.beto;
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    await e.db.query("UPDATE catalogo_servicios SET estado='PAUSADO' WHERE id=$1", [p.servicios[0]!.id]);
    try {
      // Perder la compatibilidad no impide leer, actualizar ni retirar (FR-326), pero sí enviar una nueva.
      expect((await e.obtener(beto, s.solicitudId).expect(200)).body.titulos).toEqual(['AUTOR_DE_COTIZACION']);
      await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: 1 }).expect(201);
      await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 2 }).expect(200);
      await e.obtener(beto, s.solicitudId).expect(404);
      await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(404);
      expect((await e.cotizacion(beto, c.cotizacionId).expect(200)).body.estado).toBe('RETIRADA');
    } finally { await e.db.query("UPDATE catalogo_servicios SET estado='PUBLICADO' WHERE id=$1", [p.servicios[0]!.id]); }
  });
});

describe('solicitud cerrada (FR-311, CA-HIS-01 con autores)', () => {
  test('cierra el envío, la actualización y el retiro con 409 SOLICITUD_NO_ABIERTA, y la lectura informa el cierre', async () => {
    const s = await nuevaPublicada();
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    const otra = await nuevaPublicada();
    await e.cerrarSolicitud(cliente, otra.solicitudId, { version: otra.version }).expect(200);
    expect((await e.cotizar(beto, otra.solicitudId, cuerpoEstimada(otra.versionTrabajo)).expect(409)).body.codigo).toBe('SOLICITUD_NO_ABIERTA');
    await e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }).expect(200);
    expect((await e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: 1 }).expect(409)).body.codigo).toBe('SOLICITUD_NO_ABIERTA');
    expect((await e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }).expect(409)).body.codigo).toBe('SOLICITUD_NO_ABIERTA');
    expect((await e.cotizacion(beto, c.cotizacionId).expect(200)).body).toMatchObject({ estado: 'VIGENTE', solicitudCerrada: true, motivosNoAceptable: ['SOLICITUD_CERRADA'] });
    await e.historial(beto, s.solicitudId, '?tipo=versiones').expect(200);
    expect((await e.obtener(beto, s.solicitudId).expect(200)).body).toMatchObject({ estado: 'CERRADA', titulos: ['AUTOR_DE_COTIZACION'] });
  });
});

describe('mis cotizaciones (CA-COT-11, CP-304 y CP-306)', () => {
  test('el prestador lista solo las suyas, paginadas con total coherente y un presupuesto de sentencias constante', async () => {
    const mias: string[] = [];
    for (let i = 0; i < 3; i += 1) { const s = await nuevaPublicada({ categoriaId: e.datos.categorias.A }); mias.push((await e.cotizar(gema, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body.cotizacionId); }
    const contador = new ContadorSentencias().instalar(e.db);
    try {
      const mediciones = [];
      for (const tamano of [1, 2, 50]) {
        const m = await contador.contar(async () => (await e.misCotizaciones(gema, `?pagina=1&tamano=${tamano}`).expect(200)).body);
        mediciones.push(m.total);
        expect(m.sentencias.filter(sql => /count\(\*\) OVER/i.test(sql))).toHaveLength(1);
        expect(m.resultado).toMatchObject({ pagina: 1, tamano, total: 3 });
        expect(ids({ body: m.resultado })).toEqual([...mias].reverse().slice(0, tamano));
      }
      exigirConteoConstante(mediciones);
    } finally { contador.liberar(); }
    const pagina = (await e.misCotizaciones(gema, '?pagina=9&tamano=2').expect(200)).body;
    expect(pagina).toEqual({ elementos: [], total: 3, pagina: 9, tamano: 2 });
    await validarRespuesta003('C003PaginaCotizaciones', (await e.misCotizaciones(gema).expect(200)).body);
    expect((await e.misCotizaciones(beto).expect(200)).body.elementos.map((x: { cotizacionId: string }) => x.cotizacionId)).not.toEqual(expect.arrayContaining(mias));
    await e.misCotizaciones(cliente).expect(403);
    await e.misCotizaciones(undefined).expect(401);
    await e.misCotizaciones(gema, '?tamano=51').expect(400);
  });
});

describe('idempotencia', () => {
  test('repetir el envío con la misma clave devuelve el mismo resultado sin duplicar; con otros datos, 409', async () => {
    const s = await nuevaPublicada();
    const clave = randomUUID();
    const primera = await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo), clave).expect(201);
    const repetida = await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo), clave).expect(201);
    expect(repetida.body).toEqual(primera.body);
    expect(await contar('SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id=$1', [s.solicitudId])).toBe(1);
    expect((await e.cotizar(beto, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo), clave).expect(409)).body.codigo).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
  });
});
