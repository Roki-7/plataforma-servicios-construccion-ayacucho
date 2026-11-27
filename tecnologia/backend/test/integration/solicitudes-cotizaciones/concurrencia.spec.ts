import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { crearYPublicar, cuerpoEstimada, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T070 · CA-CON-01 a 06 sobre PostgreSQL real. Cada escenario se repite varias rondas con solicitudes distintas porque el orden de llegada varía: lo que se afirma es
// el INVARIANTE de cada pareja (resultados permitidos y estado final coherente), no un orden concreto. Orden de bloqueos: solicitud (FOR SHARE) y luego cotización.
const RONDAS = 4;
let e: EntornoUs1;
let cliente: string; let beto: string; let gema: string;
const contar = async (sql: string, parametros: unknown[]) => Number(((await e.db.query(sql, parametros)) as { n: string }[])[0]!.n);
const publicada = () => crearYPublicar(e, cliente);
const codigo = (r: { body: { codigo?: string } }) => r.body.codigo;
const exito = (estado: number) => estado >= 200 && estado < 300;

beforeAll(async () => {
  e = await montarUs1();
  cliente = await e.token(e.datos.clientes.clienteUno);
  beto = await e.token(e.datos.prestadores.beto);
  gema = await e.token(e.datos.prestadores.gema);
}, 240000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('CA-COT-01 y CA-CON-01 a 05', () => {
  test('dos envíos simultáneos del mismo prestador: uno gana y el otro recibe 409 COTIZACION_EXISTENTE (CA-COT-01)', async () => {
    for (let i = 0; i < RONDAS; i += 1) {
      const s = await publicada();
      const [a, b] = await Promise.all([e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)), e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo))]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(codigo([a, b].find(r => r.status === 409)!)).toBe('COTIZACION_EXISTENTE');
      expect(await contar("SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id=$1 AND estado <> 'RETIRADA'", [s.solicitudId])).toBe(1);
    }
  });

  test('cierre y envío simultáneos se serializan: si gana el cierre, el envío recibe 409 SOLICITUD_NO_ABIERTA (CA-CON-01)', async () => {
    for (let i = 0; i < RONDAS; i += 1) {
      const s = await publicada();
      const [cierre, envio] = await Promise.all([e.cerrarSolicitud(cliente, s.solicitudId, { version: s.version }), e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo))]);
      expect(cierre.status).toBe(200);
      const hay = await contar('SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id=$1', [s.solicitudId]);
      if (envio.status === 201) {
        // El envío entró antes del cierre: la cotización existe y el cierre avisó a su autor.
        expect(hay).toBe(1);
        expect(await contar("SELECT count(*) AS n FROM avisos_negocio WHERE solicitud_id=$1 AND tipo='SOLICITUD_CERRADA'", [s.solicitudId])).toBe(1);
      } else {
        expect([envio.status, codigo(envio)]).toEqual([409, 'SOLICITUD_NO_ABIERTA']);
        expect(hay).toBe(0);
      }
    }
  });

  test('edición y envío simultáneos: un envío con versión vieja recibe 409 y, si entró antes, queda pendiente de revisión (CA-CON-02)', async () => {
    for (let i = 0; i < RONDAS; i += 1) {
      const s = await publicada();
      const [edicion, envio] = await Promise.all([
        e.editar(cliente, s.solicitudId, { version: s.version, medidas: `Muro de ${i + 3} m de largo` }), e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo))]);
      expect(edicion.status).toBe(200);
      if (envio.status === 201) {
        expect((await e.cotizacion(beto, envio.body.cotizacionId).expect(200)).body).toMatchObject({ estado: 'PENDIENTE_REVISION', requiereRevision: true });
      } else {
        expect([envio.status, codigo(envio)]).toEqual([409, 'SOLICITUD_MODIFICADA']);
        expect(await contar('SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id=$1', [s.solicitudId])).toBe(0);
      }
    }
  });

  test('retiro y actualización simultáneos: exactamente uno prospera y el segundo recibe 409 (CA-CON-03)', async () => {
    for (let i = 0; i < RONDAS; i += 1) {
      const s = await publicada();
      const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
      const [retiro, actualizacion] = await Promise.all([
        e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }), e.actualizarCotizacion(beto, c.cotizacionId, { ...cuerpoEstimada(s.versionTrabajo), versionCotizacion: 1 })]);
      expect([retiro, actualizacion].filter(r => exito(r.status))).toHaveLength(1);
      const perdedor = exito(retiro.status) ? actualizacion : retiro;
      expect([perdedor.status, perdedor.body]).toEqual([409, expect.anything()]);
      expect(['COTIZACION_RETIRADA', 'VERSION_DESACTUALIZADA']).toContain(codigo(perdedor));
      const versiones = await contar('SELECT count(*) AS n FROM cotizaciones_versiones WHERE cotizacion_id=$1', [c.cotizacionId]);
      expect(versiones).toBe(exito(actualizacion.status) ? 2 : 1);
    }
  });

  test('retiro y reenvío simultáneos nunca dejan dos posiciones no retiradas (CA-CON-04)', async () => {
    for (let i = 0; i < RONDAS; i += 1) {
      const s = await publicada();
      const c = (await e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body;
      const [retiro, reenvio] = await Promise.all([e.retirarCotizacion(beto, c.cotizacionId, { versionCotizacion: 1 }), e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo))]);
      expect(retiro.status).toBe(200);
      expect([201, 409]).toContain(reenvio.status);
      if (reenvio.status === 409) expect(codigo(reenvio)).toBe('COTIZACION_EXISTENTE');
      expect(await contar("SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id=$1 AND estado <> 'RETIRADA'", [s.solicitudId])).toBe(reenvio.status === 201 ? 1 : 0);
    }
  });

  test('una petición idempotente repetida a la vez ejecuta el trabajo una sola vez (CA-CON-05)', async () => {
    for (let i = 0; i < RONDAS; i += 1) {
      const s = await publicada();
      const clave = randomUUID();
      const respuestas = await Promise.all(Array.from({ length: 5 }, () => e.cotizar(beto, s.solicitudId, cuerpoEstimada(s.versionTrabajo), clave)));
      expect(respuestas.map(r => r.status)).toEqual([201, 201, 201, 201, 201]);
      expect(new Set(respuestas.map(r => r.body.cotizacionId)).size).toBe(1);
      expect(await contar('SELECT count(*) AS n FROM cotizaciones WHERE solicitud_id=$1', [s.solicitudId])).toBe(1);
    }
  });
});

describe('CA-CON-06 · ninguna combinación queda bloqueada', () => {
  test('operaciones mezcladas de cliente y prestadores sobre las mismas solicitudes terminan todas con una respuesta controlada', async () => {
    const permitidos = new Set([200, 201, 404, 409, 422]);
    for (let ronda = 0; ronda < RONDAS; ronda += 1) {
      const a = await crearYPublicar(e, cliente, { categoriaId: e.datos.categorias.A });
      const b = await crearYPublicar(e, cliente, { categoriaId: e.datos.categorias.A });
      const cb = (await e.cotizar(beto, a.solicitudId, cuerpoEstimada(a.versionTrabajo)).expect(201)).body;
      const cg = (await e.cotizar(gema, b.solicitudId, cuerpoEstimada(b.versionTrabajo)).expect(201)).body;
      const inicio = Date.now();
      const resultados = await Promise.all([
        e.editar(cliente, a.solicitudId, { version: a.version, medidas: `Ronda ${ronda}` }),
        e.cerrarSolicitud(cliente, b.solicitudId, { version: b.version }),
        e.actualizarCotizacion(beto, cb.cotizacionId, { ...cuerpoEstimada(a.versionTrabajo), versionCotizacion: 1 }),
        e.retirarCotizacion(gema, cg.cotizacionId, { versionCotizacion: 1 }),
        e.cotizar(gema, a.solicitudId, cuerpoEstimada(a.versionTrabajo)),
        e.cotizar(beto, b.solicitudId, cuerpoEstimada(b.versionTrabajo)),
        e.retirarCotizacion(beto, cb.cotizacionId, { versionCotizacion: 1 }),
        e.cotizacion(beto, cb.cotizacionId), e.misCotizaciones(gema),
      ]);
      expect(Date.now() - inicio).toBeLessThan(30_000);
      expect(resultados.map(r => r.status).filter(s => !permitidos.has(s))).toEqual([]);
      for (const s of [a, b]) expect(await contar("SELECT count(*) AS n FROM (SELECT prestador_id FROM cotizaciones WHERE solicitud_id=$1 AND estado <> 'RETIRADA' GROUP BY prestador_id HAVING count(*) > 1) d", [s.solicitudId])).toBe(0);
    }
  }, 180000);
});
