import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { ApiCotizacionesVigentes } from '../../../src/modulos/cotizaciones/api-publica.js';
import { RepositorioCotizacionesPostgres } from '../../../src/modulos/cotizaciones/infraestructura/persistencia/cotizaciones.js';
import { ApiSolicitudes } from '../../../src/modulos/solicitudes/aplicacion/api-solicitudes.js';
import { RepositorioSolicitudesPostgres } from '../../../src/modulos/solicitudes/infraestructura/persistencia/solicitudes.js';
import { cargarContrato003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { crearYPublicar, cuerpoEstimada, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T071 · frontera con la 004 (E2). La 003 ofrece SOLO lecturas reales: `obtenerVigente` y `validarClienteYDisponibilidad`. No hay operación, estado ni tabla de selección,
// aceptación o contratación (CA-FRO-01, FR-341). El contrato futuro de la 004 queda escrito como pruebas pendientes, sin simularlo.
const reloj = { desfase: 0 };
const ahora = () => new Date(Date.now() + reloj.desfase);
let e: EntornoUs1; let cliente: string; let beto: string;
let cotizaciones: ApiCotizacionesVigentes; let solicitudes: ApiSolicitudes;
const instantanea = async () => Object.fromEntries(await Promise.all((await e.db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1") as { table_name: string }[])
  .map(async ({ table_name }) => [table_name, Number(((await e.db.query(`SELECT count(*)::int AS n FROM "${table_name}"`)) as { n: number }[])[0]!.n)] as const)));
const sinComentarios = (ruta: string) => readFileSync(resolve(ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
// «motivosNoAceptable» es una lectura permitida: se prohíben las acciones (seleccionar, aceptar, contratar) y sus estados.
const prohibido = /selecci[oó]n|seleccionar|seleccionada|aceptar|aceptaci[oó]n|contrata/i;

beforeAll(async () => {
  e = await montarUs1({ ahora });
  cliente = await e.token(e.datos.clientes.clienteUno); beto = await e.token(e.datos.prestadores.beto);
  const uow = new UnidadDeTrabajoPostgres(e.db);
  solicitudes = new ApiSolicitudes(new RepositorioSolicitudesPostgres(uow));
  cotizaciones = new ApiCotizacionesVigentes(new RepositorioCotizacionesPostgres(uow), solicitudes, ahora);
}, 240000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('CA-FRO-01 · no existe selección, aceptación ni contratación', () => {
  test('ninguna ruta HTTP, operación del contrato ni función pública de la 003 las ofrece', async () => {
    const rutas = ((e.app.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string } }[] } }).router.stack.flatMap(({ route }) => route ? [route.path] : []));
    expect(rutas.filter(r => /solicitudes|cotizaciones/.test(r))).not.toHaveLength(0);
    expect(rutas.filter(r => /solicitudes|cotizaciones/.test(r) && prohibido.test(r))).toEqual([]);
    const contrato = await cargarContrato003() as { paths: Record<string, Record<string, { operationId: string }>> };
    const operaciones = Object.entries(contrato.paths).flatMap(([ruta, metodos]) => Object.values(metodos).map(o => `${ruta} ${o.operationId}`));
    expect(operaciones.filter(o => prohibido.test(o))).toEqual([]);
    for (const api of ['src/modulos/cotizaciones/api-publica.ts', 'src/modulos/solicitudes/api-publica.ts']) expect([api, prohibido.test(sinComentarios(api))]).toEqual([api, false]);
    expect(Object.getOwnPropertyNames(ApiCotizacionesVigentes.prototype).sort()).toEqual(['constructor', 'obtenerVigente']);
    expect(Object.getOwnPropertyNames(ApiSolicitudes.prototype).sort()).toEqual(['bloquearCompartido', 'constructor', 'esClienteDe', 'resumenes', 'validarClienteYDisponibilidad']);
  });
  test('la base de datos solo admite los estados ACTIVA y RETIRADA y no tiene tablas de contratación', async () => {
    const tablas = (await e.db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'") as { table_name: string }[]).map(t => t.table_name);
    expect(tablas.filter(t => prohibido.test(t))).toEqual([]);
    const s = await crearYPublicar(e, cliente);
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
    for (const estado of ['SELECCIONADA', 'NO_SELECCIONADA', 'CONTRATADA', 'COMPLETADA']) {
      await expect(e.db.query('UPDATE cotizaciones SET estado=$2 WHERE id=$1', [c.cotizacionId, estado])).rejects.toThrow();
    }
  });
});

describe('obtenerVigente (solo lectura)', () => {
  test('describe la cotización vigente, la versión esperada y los motivos de no aceptabilidad, y no escribe nada', async () => {
    const s = await crearYPublicar(e, cliente);
    const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo, { vigenteHasta: new Date(Date.now() + 3_600_000).toISOString() })).expect(201)).body;
    const antes = await instantanea();
    expect(await cotizaciones.obtenerVigente(c.cotizacionId, 1)).toEqual({
      cotizacionId: c.cotizacionId, solicitudId: s.solicitudId, prestadorId: e.datos.prestadores.beto.prestadorId, estado: 'ACTIVA', version: 1, versionActual: 1,
      versionTrabajoSolicitud: s.versionTrabajo, tipo: 'ESTIMADA', precioCentimos: null, vigenteHasta: expect.any(String), versionEsperadaCoincide: true, motivosNoAceptable: [],
    });
    expect((await cotizaciones.obtenerVigente(c.cotizacionId, 7))?.versionEsperadaCoincide).toBe(false);
    expect(await cotizaciones.obtenerVigente(randomUUID(), 1)).toBeNull();
    expect(await cotizaciones.obtenerVigente('no-es-uuid', 1)).toBeNull();
    expect(await instantanea()).toEqual(antes);
  });
  test('informa cada motivo: pendiente de revisión, vencida, solicitud cerrada y retirada', async () => {
    const pendiente = await crearYPublicar(e, cliente);
    const cp = (await e.cotizar(beto, pendiente.solicitudId, cuerpoEstimada(pendiente.versionTrabajo)).expect(201)).body;
    await e.editar(cliente, pendiente.solicitudId, { version: pendiente.version, medidas: '5 m de largo' }).expect(200);
    expect((await cotizaciones.obtenerVigente(cp.cotizacionId, 1))?.motivosNoAceptable).toEqual(['PENDIENTE_REVISION']);

    const cerrada = await crearYPublicar(e, cliente);
    const cc = (await e.cotizar(beto, cerrada.solicitudId, cuerpoEstimada(cerrada.versionTrabajo)).expect(201)).body;
    await e.cerrarSolicitud(cliente, cerrada.solicitudId, { version: cerrada.version }).expect(200);
    expect((await cotizaciones.obtenerVigente(cc.cotizacionId, 1))?.motivosNoAceptable).toEqual(['SOLICITUD_CERRADA']);

    const retirada = await crearYPublicar(e, cliente);
    const cr = (await e.cotizar(beto, retirada.solicitudId, cuerpoEstimada(retirada.versionTrabajo)).expect(201)).body;
    await e.retirarCotizacion(beto, cr.cotizacionId, { versionCotizacion: 1 }).expect(200);
    expect(await cotizaciones.obtenerVigente(cr.cotizacionId, 2)).toMatchObject({ estado: 'RETIRADA', version: 2, versionEsperadaCoincide: true, motivosNoAceptable: ['RETIRADA'] });

    const vence = await crearYPublicar(e, cliente);
    const cv = (await e.cotizar(beto, vence.solicitudId, cuerpoEstimada(vence.versionTrabajo, { vigenteHasta: new Date(Date.now() + 3_600_000).toISOString() })).expect(201)).body;
    reloj.desfase = 2 * 3_600_000;
    try { expect((await cotizaciones.obtenerVigente(cv.cotizacionId, 1))?.motivosNoAceptable).toEqual(['VENCIDA']); } finally { reloj.desfase = 0; }
  });
});

describe('validarClienteYDisponibilidad (solo lectura)', () => {
  test('confirma al cliente dueño y la disponibilidad, y para un tercero no revela nada más que «no es el cliente»', async () => {
    const s = await crearYPublicar(e, cliente);
    const dueno = e.datos.clientes.clienteUno.cuentaId;
    const antes = await instantanea();
    expect(await solicitudes.validarClienteYDisponibilidad(s.solicitudId, dueno)).toEqual({ esCliente: true, disponible: true, versionTrabajo: s.versionTrabajo, motivos: [] });
    expect(await solicitudes.validarClienteYDisponibilidad(s.solicitudId, e.datos.clientes.clienteDos.cuentaId)).toEqual({ esCliente: false, disponible: false, versionTrabajo: null, motivos: ['NO_ES_EL_CLIENTE'] });
    expect(await solicitudes.validarClienteYDisponibilidad('00000000-0000-4000-8000-0000000000ff', dueno)).toEqual({ esCliente: false, disponible: false, versionTrabajo: null, motivos: ['SOLICITUD_INEXISTENTE'] });
    await e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }).expect(200);
    const despuesDeCerrar = await instantanea();
    expect(await solicitudes.validarClienteYDisponibilidad(s.solicitudId, dueno)).toMatchObject({ esCliente: true, disponible: false, motivos: ['SOLICITUD_NO_ABIERTA'] });
    expect(await instantanea()).toEqual(despuesDeCerrar);
    expect(despuesDeCerrar).not.toEqual(antes);
  });
});

describe('contrato futuro de la 004 (E2): escrito, no simulado', () => {
  test.todo('la 004 añadirá a solicitudes/api-publica `registrarContratacion` y el retiro de la selección pendiente al editar, con sus migraciones');
  test.todo('la 004 añadirá a cotizaciones/api-publica `marcarSeleccionada`, `marcarNoSeleccionadas` y la guarda de retiro de una seleccionada, con sus migraciones');
  test.todo('la 004 producirá los estados SELECCIONADA, NO_SELECCIONADA, CONTRATADA y COMPLETADA; hasta entonces la 003 no los produce ni los simula');
});
