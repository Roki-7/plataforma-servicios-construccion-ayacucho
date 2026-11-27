import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { cargarContrato003, validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { crearYPublicar, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

let e: EntornoUs1;
let cliente: string;
let prestador: string;
let directa: string;
let publicada: string;

beforeAll(async () => {
  e = await montarUs1();
  const beto = e.datos.prestadores.beto;
  cliente = await e.token(e.datos.clientes.clienteUno);
  prestador = await e.token(beto);
  directa = (await crearYPublicar(e, cliente, { tipo: 'DIRIGIDA', prestadorId: beto.prestadorId })).solicitudId;
  publicada = (await crearYPublicar(e, cliente)).solicitudId;
}, 240000);
afterAll(async () => { await e?.cerrar(); }, 120000);

test('la ruta literal exige Bearer, declara paginación y se alcanza antes del detalle paramétrico', async () => {
  const contrato = await cargarContrato003();
  const op = contrato.paths['/solicitudes/oportunidades']!.get!;
  expect(op).toMatchObject({ operationId: 'listarOportunidades003', security: [{ bearerAuth: [] }], parameters: [
    { $ref: '#/components/parameters/C003Pagina' }, { $ref: '#/components/parameters/C003Tamano' },
  ] });
  const r = await e.oportunidades(prestador).expect(200).expect('Cache-Control', 'no-store');
  await validarRespuesta003('C003PaginaOportunidades', r.body);
  expect(r.body.total).toBe(2);
  for (const [peticion, estado] of [[e.oportunidades(undefined), 401], [e.oportunidades(cliente), 403], [e.oportunidades(prestador, '?pagina=0'), 400]] as const) {
    expect(op.responses).toHaveProperty(String(estado));
    const error = await peticion.expect(estado).expect('Cache-Control', 'no-store');
    await validarRespuesta003(`C003Error${estado}`, error.body);
  }
});

test('la perspectiva prestador y la vista visible respetan sus esquemas y el 404 opaco', async () => {
  const contrato = await cargarContrato003();
  expect(contrato.paths['/solicitudes']!.get!.parameters).toContainEqual({ $ref: '#/components/parameters/C003RolListado' });
  const lista = await e.listar(prestador, '?rol=prestador').expect(200).expect('Cache-Control', 'no-store');
  await validarRespuesta003('C003PaginaSolicitudes', lista.body);
  expect(lista.body.elementos).toEqual([expect.objectContaining({ solicitudId: directa, titulos: ['DESTINATARIO'] })]);
  await e.listar(prestador, '?rol=externo').expect(400);
  for (const [id, titulo] of [[directa, 'DESTINATARIO'], [publicada, 'COMPATIBLE']]) {
    const r = await e.obtener(prestador, id!).expect(200).expect('Cache-Control', 'no-store');
    await validarRespuesta003('C003SolicitudVisible', r.body);
    expect(r.body.titulos).toEqual([titulo]);
  }
  const ajeno = await e.token(e.datos.clientes.clienteDos);
  const e404 = await e.obtener(ajeno, publicada).expect(404);
  await validarRespuesta003('C003Error404', e404.body);
});
