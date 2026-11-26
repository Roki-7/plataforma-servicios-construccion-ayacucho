import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { validarRespuesta002 } from '../../soporte/prestadores-catalogo/contrato-002.js';
import { clasificaciones04 as c, montarHu04, servicioValido, type EntornoHu04 } from '../../soporte/prestadores-catalogo/fixtures-hu04.js';

let e: EntornoHu04;
beforeAll(async () => { e = await montarHu04(); });
afterAll(async () => { await e?.cerrar(); });

const desactivar = async (id: string) => { await e.db.query('UPDATE catalogo_clasificaciones SET activa=false WHERE id=$1', [id]); };
const activar = async (id: string) => { await e.db.query('UPDATE catalogo_clasificaciones SET activa=true WHERE id=$1', [id]); };
const publicado = async (token = e.datos.prestador.token, extra: object = {}) => (await e.publicar(token, servicioValido(c, extra)).expect(201)).body as { servicioId: string; prestadorId: string; version: number; estado: string };
const error = async (r: Promise<{ status: number; body: { codigo: string } }>, http: number, codigo: string, esquema: string) => {
  const res = await r; expect([res.status, res.body.codigo]).toEqual([http, codigo]); await validarRespuesta002(esquema, res.body);
};

describe('autenticación, perfil de prestador, Origin e idempotencia en las cuatro operaciones', () => {
  test('un visitante recibe 401 y una cuenta solo cliente 403 (CA-SER-03)', async () => {
    const s = await publicado();
    const operaciones = (token?: string) => [e.publicar(token, servicioValido(c)), e.editar(token, s.servicioId, { version: 1, titulo: 'x' }),
      e.transicionar(token, s.servicioId, { version: 1, destino: 'PAUSADO' }), e.mios(token)];
    for (const p of operaciones()) { const r = await p.expect(401); await validarRespuesta002('C002Error401', r.body); }
    for (const p of operaciones(e.datos.cliente.token)) { const r = await p.expect(403); await validarRespuesta002('C002Error403', r.body); expect(r.body.codigo).toBe('SIN_PERMISO'); }
  });

  test('exige Origin e Idempotency-Key y rechaza identidad, estado o versión enviados donde no corresponden', async () => {
    const t = e.datos.prestador.token;
    await e.http.post('/api/v1/servicios').set('Authorization', `Bearer ${t}`).set('Idempotency-Key', randomUUID()).send(servicioValido(c)).expect(400);
    await e.http.post('/api/v1/servicios').set('Authorization', `Bearer ${t}`).set('Origin', 'https://ajeno.example.invalid').set('Idempotency-Key', randomUUID()).send(servicioValido(c)).expect(403);
    await e.http.post('/api/v1/servicios').set('Authorization', `Bearer ${t}`).set('Origin', 'https://localhost:8444').send(servicioValido(c)).expect(400);
    for (const extra of [{ prestadorId: randomUUID() }, { cuentaId: randomUUID() }, { estado: 'PAUSADO' }, { version: 1 }]) {
      const r = await e.publicar(t, servicioValido(c, extra)).expect(400);
      expect(r.body.codigo).toBe('PROPIEDAD_NO_ADMITIDA');
    }
  });
});

describe('publicar (CA-SER-01, CA-SER-04)', () => {
  test('crea el servicio PUBLICADO asociado al titular, con su versión, y es idempotente', async () => {
    const clave = randomUUID();
    const r = await e.publicar(e.datos.prestador.token, servicioValido(c), clave).expect(201);
    await validarRespuesta002('C002ServicioPrivado', r.body);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({ estado: 'PUBLICADO', version: 1, prestadorId: e.datos.perfiles.prestador, categoriaId: c.hija });
    expect(JSON.stringify(r.body)).not.toContain(e.datos.prestador.cuentaId);
    const replay = await e.publicar(e.datos.prestador.token, servicioValido(c), clave).expect(201);
    expect(replay.body).toEqual(r.body);
    await error(e.publicar(e.datos.prestador.token, servicioValido(c, { titulo: 'Otro título' }), clave), 409, 'CLAVE_IDEMPOTENCIA_REUTILIZADA', 'C002Error409');
    const unico = await e.db.query('SELECT count(*)::int AS n FROM catalogo_servicios WHERE id=$1', [r.body.servicioId]) as { n: number }[];
    expect(unico[0]!.n).toBe(1);
  });

  test('una clasificación que no admite publicaciones se rechaza y no crea el servicio (CA-SER-04)', async () => {
    const antes = Number(((await e.db.query('SELECT count(*)::int AS n FROM catalogo_servicios')) as { n: number }[])[0]!.n);
    for (const id of [c.inactiva, c.hijaDeInactiva, c.hijaInactiva, randomUUID()]) {
      const r = await e.publicar(e.datos.prestador.token, servicioValido(c, { categoriaId: id })).expect(422);
      expect(r.body.codigo).toBe('CATEGORIA_NO_ACTIVA');
      expect(r.body.detalles[0].campo).toBe('categoriaId');
      await validarRespuesta002('C002Error422', r.body);
    }
    expect(Number(((await e.db.query('SELECT count(*)::int AS n FROM catalogo_servicios')) as { n: number }[])[0]!.n)).toBe(antes);
    await e.publicar(e.datos.prestador.token, servicioValido(c, { categoriaId: c.raiz })).expect(201);
  });

  test('valida longitudes y texto plano, y exige un perfil profesional existente', async () => {
    const t = e.datos.prestador.token;
    for (const extra of [{ titulo: ' ' }, { titulo: 't'.repeat(121) }, { descripcion: 'd'.repeat(2001) }, { descripcion: '' }, { categoriaId: 'no-uuid' }, { titulo: '<img src=x onerror=1>' }]) {
      const r = await e.publicar(t, servicioValido(c, extra)).expect(400);
      await validarRespuesta002('C002Error400', r.body);
    }
    await e.publicar(t, servicioValido(c, { titulo: 't'.repeat(120), descripcion: 'd'.repeat(2000) })).expect(201);
    const sinPerfil = await e.nuevaCuenta('prestador');
    await error(e.publicar(sinPerfil.token, servicioValido(c)), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
  });
});

describe('editar y cambiar de estado (CA-SER-01, CA-SER-02, CA-SER-03, CA-SER-05, CA-SER-06, CA-SER-07)', () => {
  test('edita con la versión vigente, avanza la versión y conserva el estado', async () => {
    const s = await publicado();
    const r = await e.editar(e.datos.prestador.token, s.servicioId, { version: 1, titulo: 'Título nuevo', descripcion: 'Descripción nueva' }).expect(200);
    await validarRespuesta002('C002ServicioPrivado', r.body);
    expect(r.body).toMatchObject({ titulo: 'Título nuevo', descripcion: 'Descripción nueva', estado: 'PUBLICADO', version: 2, servicioId: s.servicioId });
    await error(e.editar(e.datos.prestador.token, s.servicioId, { version: 1, titulo: 'Obsoleto' }), 409, 'VERSION_DESACTUALIZADA', 'C002Error409');
    for (const cuerpo of [{ version: 2 }, { version: 2, titulo: ' ' }, { version: 0, titulo: 'x' }, { version: 2, estado: 'RETIRADO' }, { version: 2, prestadorId: randomUUID() }]) await e.editar(e.datos.prestador.token, s.servicioId, cuerpo).expect(400);
    const cambio = await e.editar(e.datos.prestador.token, s.servicioId, { version: 2, categoriaId: c.raiz }).expect(200);
    expect(cambio.body).toMatchObject({ categoriaId: c.raiz, version: 3 });
    await error(e.editar(e.datos.prestador.token, s.servicioId, { version: 3, categoriaId: c.hijaDeInactiva }), 422, 'CATEGORIA_NO_ACTIVA', 'C002Error422');
    expect((await e.mios(e.datos.prestador.token, '?tamano=50').expect(200)).body.elementos.find((x: { servicioId: string }) => x.servicioId === s.servicioId)).toMatchObject({ categoriaId: c.raiz, version: 3 });
  });

  test('las cuatro transiciones permitidas conservan las referencias previas (CA-SER-02)', async () => {
    const t = e.datos.prestador.token;
    const a = await publicado(); const b = await publicado();
    await e.sembrarReferencias(a.servicioId); await e.sembrarReferencias(b.servicioId);
    const pausa = await e.transicionar(t, a.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    await validarRespuesta002('C002ServicioPrivado', pausa.body);
    expect(pausa.body).toMatchObject({ estado: 'PAUSADO', version: 2 });
    expect((await e.elegibilidad.evaluar(a.servicioId)).elegible).toBe(false);
    expect((await e.transicionar(t, a.servicioId, { version: 2, destino: 'PUBLICADO' }).expect(200)).body).toMatchObject({ estado: 'PUBLICADO', version: 3 });
    expect((await e.transicionar(t, a.servicioId, { version: 3, destino: 'PAUSADO' }).expect(200)).body.estado).toBe('PAUSADO');
    expect((await e.transicionar(t, a.servicioId, { version: 4, destino: 'RETIRADO' }).expect(200)).body).toMatchObject({ estado: 'RETIRADO', version: 5 });
    expect((await e.transicionar(t, b.servicioId, { version: 1, destino: 'RETIRADO' }).expect(200)).body.estado).toBe('RETIRADO');
    for (const id of [a.servicioId, b.servicioId]) expect(await e.referencias(id)).toEqual(['CONTRATACION', 'COTIZACION', 'SOLICITUD']);
  });

  test('transiciones inválidas, versiones obsoletas, destinos desconocidos y actores ajenos se rechazan (CA-SER-03)', async () => {
    const t = e.datos.prestador.token;
    const s = await publicado();
    await error(e.transicionar(t, s.servicioId, { version: 1, destino: 'PUBLICADO' }), 422, 'TRANSICION_NO_ADMITIDA', 'C002Error422');
    await error(e.transicionar(t, s.servicioId, { version: 7, destino: 'PAUSADO' }), 409, 'VERSION_DESACTUALIZADA', 'C002Error409');
    for (const cuerpo of [{ version: 1, destino: 'BORRADO' }, { version: 1 }, { destino: 'PAUSADO' }, { version: 1, destino: 'PAUSADO', extra: true }]) await e.transicionar(t, s.servicioId, cuerpo).expect(400);
    const ajeno = e.datos.ajeno.token;
    await error(e.editar(ajeno, s.servicioId, { version: 1, titulo: 'Intrusión' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    await error(e.transicionar(ajeno, s.servicioId, { version: 1, destino: 'RETIRADO' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    await error(e.transicionar(t, randomUUID(), { version: 1, destino: 'PAUSADO' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    await e.editar(t, 'no-es-uuid', { version: 1, titulo: 'x' }).expect(400);
    const sinPerfil = await e.nuevaCuenta('prestador');
    await error(e.editar(sinPerfil.token, s.servicioId, { version: 1, titulo: 'x' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    expect((await e.mios(t, '?tamano=50').expect(200)).body.elementos.find((x: { servicioId: string }) => x.servicioId === s.servicioId)).toMatchObject({ estado: 'PUBLICADO', version: 1, titulo: servicioValido(c).titulo });
  });

  test('un servicio RETIRADO no admite ediciones ni cambios, también del titular (CA-SER-07)', async () => {
    const t = e.datos.prestador.token;
    const s = await publicado();
    await e.transicionar(t, s.servicioId, { version: 1, destino: 'RETIRADO' }).expect(200);
    await error(e.editar(t, s.servicioId, { version: 2, titulo: 'Reabierto' }), 422, 'SERVICIO_RETIRADO', 'C002Error422');
    for (const destino of ['PUBLICADO', 'PAUSADO', 'RETIRADO']) await error(e.transicionar(t, s.servicioId, { version: 2, destino }), 422, 'SERVICIO_RETIRADO', 'C002Error422');
    await error(e.editar(e.datos.ajeno.token, s.servicioId, { version: 2, titulo: 'Ajeno' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    const historico = (await e.mios(t, '?tamano=50').expect(200)).body.elementos.find((x: { servicioId: string }) => x.servicioId === s.servicioId);
    expect(historico).toMatchObject({ estado: 'RETIRADO', version: 2, titulo: servicioValido(c).titulo });
    expect(await e.elegibilidad.registro(s.servicioId)).toMatchObject({ estado: 'RETIRADO', servicioId: s.servicioId });
  });

  test('editar un servicio pausado lo conserva pausado y reactivar comprueba la clasificación vigente (CA-SER-05, CA-SER-06)', async () => {
    const t = e.datos.prestador.token;
    const s = await publicado(t, { categoriaId: c.raizActiva2 });
    await e.transicionar(t, s.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    const editado = await e.editar(t, s.servicioId, { version: 2, titulo: 'Editado en pausa' }).expect(200);
    expect(editado.body).toMatchObject({ estado: 'PAUSADO', titulo: 'Editado en pausa', version: 3 });
    await desactivar(c.raizActiva2);
    try {
      const r = await e.transicionar(t, s.servicioId, { version: 3, destino: 'PUBLICADO' }).expect(422);
      expect(r.body.codigo).toBe('CATEGORIA_NO_ACTIVA');
      await validarRespuesta002('C002Error422', r.body);
      expect((await e.mios(t, '?tamano=50').expect(200)).body.elementos.find((x: { servicioId: string }) => x.servicioId === s.servicioId)).toMatchObject({ estado: 'PAUSADO', version: 3 });
      await e.transicionar(t, s.servicioId, { version: 3, destino: 'RETIRADO' }).expect(200).then(() => undefined);
    } finally { await activar(c.raizActiva2); }
    const otro = await publicado(t, { categoriaId: c.raizActiva2 });
    await e.transicionar(t, otro.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    expect((await e.transicionar(t, otro.servicioId, { version: 2, destino: 'PUBLICADO' }).expect(200)).body).toMatchObject({ estado: 'PUBLICADO', version: 3 });
  });
});

describe('inventario propio', () => {
  test('lista los tres estados del titular con paginación estable y sin servicios ajenos', async () => {
    const cuenta = await e.nuevaCuenta('prestador');
    await e.crearPerfil(cuenta);
    const vacio = await e.mios(cuenta.token).expect(200);
    await validarRespuesta002('C002PaginaServiciosPropios', vacio.body);
    expect(vacio.body).toEqual({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push((await publicado(cuenta.token, { titulo: `Servicio ${i}` })).servicioId);
    await e.transicionar(cuenta.token, ids[1]!, { version: 1, destino: 'PAUSADO' }).expect(200);
    await e.transicionar(cuenta.token, ids[2]!, { version: 1, destino: 'RETIRADO' }).expect(200);
    await publicado(e.datos.ajeno.token, { titulo: 'De otro titular' });
    const todo = await e.mios(cuenta.token).expect(200);
    await validarRespuesta002('C002PaginaServiciosPropios', todo.body);
    expect(todo.body).toMatchObject({ total: 5, pagina: 1, tamano: 20 });
    expect(todo.body.elementos.map((x: { servicioId: string }) => x.servicioId)).toEqual(ids);
    expect(todo.body.elementos.map((x: { estado: string }) => x.estado)).toEqual(['PUBLICADO', 'PAUSADO', 'RETIRADO', 'PUBLICADO', 'PUBLICADO']);
    expect(todo.headers['cache-control']).toBe('no-store');
    const p1 = await e.mios(cuenta.token, '?pagina=1&tamano=2').expect(200);
    const p3 = await e.mios(cuenta.token, '?pagina=3&tamano=2').expect(200);
    expect(p1.body).toMatchObject({ total: 5, pagina: 1, tamano: 2 });
    expect(p1.body.elementos.map((x: { servicioId: string }) => x.servicioId)).toEqual(ids.slice(0, 2));
    expect(p3.body.elementos.map((x: { servicioId: string }) => x.servicioId)).toEqual(ids.slice(4));
    expect((await e.mios(cuenta.token, '?pagina=9').expect(200)).body.elementos).toEqual([]);
  });

  test('rechaza consultas desconocidas, duplicadas o fuera de rango y no lista a otro titular', async () => {
    for (const q of ['?pagina=0', '?tamano=51', '?pagina=x', '?otra=1', '?pagina=1&pagina=2', '?tamano=01']) await e.mios(e.datos.prestador.token, q).expect(400);
    const ajeno = (await e.mios(e.datos.ajeno.token, '?tamano=50').expect(200)).body;
    expect(ajeno.elementos.every((x: { prestadorId: string }) => x.prestadorId === e.datos.perfiles.ajeno)).toBe(true);
  });
});

describe('identificadores UUID en mayúsculas y minúsculas', () => {
  const MAYUS = c.conLetras.toUpperCase();
  const mixto = c.conLetras.slice(0, 18).toUpperCase() + c.conLetras.slice(18);
  test('publicar acepta un UUID válido de categoría en cualquier capitalización y lo guarda en minúsculas', async () => {
    expect(MAYUS).not.toBe(c.conLetras);
    for (const id of [c.conLetras, MAYUS, mixto]) {
      const r = await e.publicar(e.datos.prestador.token, servicioValido(c, { categoriaId: id })).expect(201);
      await validarRespuesta002('C002ServicioPrivado', r.body);
      expect(r.body.categoriaId).toBe(c.conLetras);
    }
    // La misma solicitud con otra capitalización es el mismo intento idempotente.
    const clave = randomUUID();
    const a = await e.publicar(e.datos.prestador.token, servicioValido(c, { categoriaId: MAYUS }), clave).expect(201);
    const b = await e.publicar(e.datos.prestador.token, servicioValido(c, { categoriaId: c.conLetras }), clave).expect(201);
    expect(b.body).toEqual(a.body);
  });

  test('editar y cambiar de estado aceptan el servicioId y la categoría en mayúsculas sin cambiar la titularidad', async () => {
    const s = await publicado();
    const t = e.datos.prestador.token;
    const editado = await e.editar(t, s.servicioId.toUpperCase(), { version: 1, categoriaId: MAYUS }).expect(200);
    expect(editado.body).toMatchObject({ categoriaId: c.conLetras, servicioId: s.servicioId, version: 2 });
    const pausa = await e.transicionar(t, s.servicioId.toUpperCase(), { version: 2, destino: 'PAUSADO' }).expect(200);
    expect(pausa.body).toMatchObject({ estado: 'PAUSADO', servicioId: s.servicioId });
    // El actor ajeno sigue recibiendo 404 con cualquier capitalización.
    await error(e.editar(e.datos.ajeno.token, s.servicioId.toUpperCase(), { version: 3, titulo: 'Intrusión' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
    await error(e.transicionar(e.datos.ajeno.token, s.servicioId.toUpperCase(), { version: 3, destino: 'RETIRADO' }), 404, 'RECURSO_NO_DISPONIBLE', 'C002Error404');
  });

  test('un identificador inválido se sigue rechazando y una categoría inactiva o inexistente en mayúsculas no se admite', async () => {
    const t = e.datos.prestador.token;
    for (const id of [MAYUS.slice(0, -1), MAYUS.replace(/^./, 'G'), `{${MAYUS}}`, MAYUS.replaceAll('-', ''), ` ${MAYUS}`]) {
      const r = await e.publicar(t, servicioValido(c, { categoriaId: id })).expect(400);
      await validarRespuesta002('C002Error400', r.body);
    }
    for (const id of [c.inactiva, c.hijaDeInactiva, c.hijaInactiva, randomUUID()]) {
      await error(e.publicar(t, servicioValido(c, { categoriaId: id.toUpperCase() })), 422, 'CATEGORIA_NO_ACTIVA', 'C002Error422');
    }
    await e.db.query('UPDATE catalogo_clasificaciones SET activa=false WHERE id=$1', [c.conLetras]);
    try { await error(e.publicar(t, servicioValido(c, { categoriaId: MAYUS })), 422, 'CATEGORIA_NO_ACTIVA', 'C002Error422'); }
    finally { await e.db.query('UPDATE catalogo_clasificaciones SET activa=true WHERE id=$1', [c.conLetras]); }
  });
});
