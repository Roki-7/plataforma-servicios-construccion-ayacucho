import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { cat } from '../../soporte/prestadores-catalogo/fixtures-hu05.js';
import { ejecutorPrueba, montarHu25, type EntornoHu25 } from '../../soporte/prestadores-catalogo/fixtures-hu25.js';
import type { CuentaPrueba } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

const fallo = { auditoria: false };
let e: EntornoHu25;
beforeAll(async () => {
  e = await montarHu25({ categorias: { auditoria: base => ({ registrar: (tx, r) => fallo.auditoria ? Promise.reject(new Error('fallo de auditoría simulado')) : base.registrar(tx, r) }) } });
}, 180000);
afterAll(async () => { await e?.cerrar(); });

const n = async (sql: string, p: unknown[] = []) => Number(((await e.db.query(sql, p)) as { n: number }[])[0]!.n);
const operador = async (): Promise<CuentaPrueba> => { const c = await e.cuenta(); await e.habilitar(c); return c; };
const nueva = async (c: CuentaPrueba, nombre = `Categoría ${randomUUID().slice(0, 8)}`, extra: object = {}) =>
  (await e.crear(c.token, { nombre, motivo: 'Alta de prueba', ...extra }).expect(201)).body as { categoriaId: string; version: number };
const permiso = async (cuentaId: string) => ((await e.db.query('SELECT estado,version FROM administracion_permisos WHERE cuenta_id=$1', [cuentaId])) as { estado: string; version: number }[])[0];

describe('permiso persistente RF39', () => {
  test('sin permiso se rechaza toda lectura y escritura, aunque haya perfil de prestador (403)', async () => {
    const sinPermiso = await e.cuenta();
    expect((await e.listar(sinPermiso.token).expect(403)).body.codigo).toBe('SIN_PERMISO');
    await e.crear(sinPermiso.token, { nombre: 'X', motivo: 'M' }).expect(403);
    await e.crear(e.datos.titular.token, { nombre: 'X', motivo: 'M' }).expect(403);
    await e.listar(undefined).expect(401);
    expect(await n("SELECT count(*)::int AS n FROM catalogo_clasificaciones WHERE nombre='X'")).toBe(0);
  });

  test('tras la concesión operativa se puede gestionar y cada cambio queda auditado con el responsable autenticado y el motivo', async () => {
    const c = await operador();
    const antes = (await e.auditoria()).length;
    const r = await nueva(c, 'Carpintería', { motivo: 'Nueva categoría solicitada' });
    expect((await e.listar(c.token).expect(200)).body.categorias.some((x: { categoriaId: string }) => x.categoriaId === r.categoriaId)).toBe(true);
    const fila = (await e.auditoria()).slice(antes).find(a => a['recurso_id'] === r.categoriaId)!;
    expect(fila).toMatchObject({ responsable: c.cuentaId, accion: 'CATEGORIA_CREADA', recurso_tipo: 'CLASIFICACION', motivo: 'Nueva categoría solicitada' });
    // El permiso se concedió por el flujo operativo y quedó auditado con la aprobación y el ejecutor.
    const concesion = (await e.auditoria()).find(a => a['recurso_id'] === c.cuentaId)!;
    expect(concesion).toMatchObject({ accion: 'PERMISO_RF39_CONCEDIDO', responsable: `operativo:${ejecutorPrueba}`, recurso_tipo: 'PERMISO_RF39' });
    expect(concesion['aprobacion_id']).toBeTruthy();
  });

  test('revocar con la sesión aún abierta bloquea la operación siguiente y conserva la fila del permiso', async () => {
    const c = await operador();
    await e.listar(c.token).expect(200);
    await e.revocar(c);
    await e.listar(c.token).expect(403);
    await e.crear(c.token, { nombre: 'Tras revocar', motivo: 'M' }).expect(403);
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'REVOCADO' });
    expect(await n("SELECT count(*)::int AS n FROM catalogo_clasificaciones WHERE nombre='Tras revocar'")).toBe(0);
    // Reconceder restituye la misma fila con versión mayor.
    await e.habilitar(c);
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'VIGENTE', version: 3 });
  });

  test('el replay de una clave ya confirmada se rechaza si el permiso fue revocado', async () => {
    const c = await operador();
    const clave = randomUUID();
    await e.crear(c.token, { nombre: 'Replay', motivo: 'M' }, clave).expect(201);
    await e.revocar(c);
    expect((await e.crear(c.token, { nombre: 'Replay', motivo: 'M' }, clave).expect(403)).body.codigo).toBe('SIN_PERMISO');
  });

  test('el replay con permiso vigente devuelve el mismo resultado sin duplicar el cambio ni la auditoría', async () => {
    const c = await operador();
    const clave = randomUUID();
    const a = await e.crear(c.token, { nombre: 'Idempotente', motivo: 'M' }, clave).expect(201);
    const b = await e.crear(c.token, { nombre: 'Idempotente', motivo: 'M' }, clave).expect(201);
    expect(b.body).toEqual(a.body);
    expect(await n("SELECT count(*)::int AS n FROM catalogo_clasificaciones WHERE nombre='Idempotente'")).toBe(1);
    expect(await n('SELECT count(*)::int AS n FROM administracion_auditoria WHERE recurso_id=$1', [a.body.categoriaId])).toBe(1);
    // La misma clave con otro cuerpo es un conflicto.
    await e.crear(c.token, { nombre: 'Otro nombre', motivo: 'M' }, clave).expect(409);
  });

  test('la auditoría es de solo adición', async () => {
    await operador();
    await expect(e.db.query("UPDATE administracion_auditoria SET motivo='x'")).rejects.toThrow();
    await expect(e.db.query('DELETE FROM administracion_auditoria')).rejects.toThrow();
    await expect(e.db.query('TRUNCATE administracion_auditoria')).rejects.toThrow();
  });
});

describe('vista previa, confirmación y servicios históricos', () => {
  test('revocar entre la vista previa y la confirmación impide desactivar', async () => {
    const c = await operador();
    const p = (await e.previsualizar(c.token, cat.H1a, { version: 1 }).expect(201)).body as { confirmacionId: string };
    await e.revocar(c);
    await e.desactivar(c.token, cat.H1a, { confirmacionId: p.confirmacionId, version: 1, motivo: 'M' }).expect(403);
    expect(await e.filaCategoria(cat.H1a)).toMatchObject({ activa: true, version: 1 });
  });

  test('una confirmación de otro actor, de otra clasificación o inexistente no sirve', async () => {
    const a = await operador(); const b = await operador();
    const p = (await e.previsualizar(a.token, cat.H1a, { version: 1 }).expect(201)).body as { confirmacionId: string };
    expect((await e.desactivar(b.token, cat.H1a, { confirmacionId: p.confirmacionId, version: 1, motivo: 'M' }).expect(409)).body.codigo).toBe('CONFIRMACION_NO_VALIDA');
    expect((await e.desactivar(a.token, cat.H1b, { confirmacionId: p.confirmacionId, version: 1, motivo: 'M' }).expect(409)).body.codigo).toBe('CONFIRMACION_NO_VALIDA');
    expect((await e.desactivar(a.token, cat.H1a, { confirmacionId: randomUUID(), version: 1, motivo: 'M' }).expect(409)).body.codigo).toBe('CONFIRMACION_NO_VALIDA');
    expect(await e.filaCategoria(cat.H1a)).toMatchObject({ activa: true });
  });

  test('una confirmación vencida se rechaza y exige otra vista previa', async () => {
    const c = await operador();
    const p = (await e.previsualizar(c.token, cat.H1a, { version: 1 }).expect(201)).body as { confirmacionId: string; venceEn: string };
    expect(p.venceEn).toMatch(/Z$/);
    const minutos = (Date.parse(p.venceEn) - Date.now()) / 60000;
    expect(minutos).toBeGreaterThan(4); expect(minutos).toBeLessThanOrEqual(5.1);
    await e.db.query("UPDATE catalogo_confirmaciones_desactivacion SET creada_en = CURRENT_TIMESTAMP - interval '10 minutes', vence_en = CURRENT_TIMESTAMP - interval '5 minutes' WHERE id=$1", [p.confirmacionId]);
    expect((await e.desactivar(c.token, cat.H1a, { confirmacionId: p.confirmacionId, version: 1, motivo: 'M' }).expect(409)).body.codigo).toBe('CONFIRMACION_NO_VALIDA');
  });

  test('si cambia el impacto o la revisión tras la vista previa, la confirmación devuelve 409 y conserva todo', async () => {
    const c = await operador();
    const p = (await e.previsualizar(c.token, cat.H1a, { version: 1 }).expect(201)).body as { confirmacionId: string; afectados: number };
    expect(p.afectados).toBe(2);
    await e.publicar(e.datos.titular.token, { titulo: 'Nuevo tras la vista previa', descripcion: 'D', categoriaId: cat.H1a }).expect(201);
    const r = await e.desactivar(c.token, cat.H1a, { confirmacionId: p.confirmacionId, version: 1, motivo: 'M' }).expect(409);
    expect(r.body.codigo).toBe('IMPACTO_DESACTUALIZADO');
    expect(await e.filaCategoria(cat.H1a)).toMatchObject({ activa: true, version: 1 });
    // Una vista previa nueva cuenta el servicio adicional y permite confirmar.
    const q = (await e.previsualizar(c.token, cat.H1a, { version: 1 }).expect(201)).body as { confirmacionId: string; afectados: number };
    expect(q.afectados).toBe(3);
    await e.activar(c.token, cat.H1a, { version: 1, motivo: 'M' }).expect(422);
  });

  test('desactivar conserva el estado propio de los servicios y activar los restituye según su estado', async () => {
    const c = await operador();
    const antes = (await e.db.query('SELECT id,estado,version FROM catalogo_servicios ORDER BY id')) as { id: string; estado: string; version: number }[];
    const p = (await e.previsualizar(c.token, cat.R2, { version: 1 }).expect(201)).body as { confirmacionId: string; afectados: number };
    expect(p.afectados).toBe(1);
    const d = await e.desactivar(c.token, cat.R2, { confirmacionId: p.confirmacionId, version: 1, motivo: 'Categoría obsoleta' }).expect(200);
    expect(d.body).toMatchObject({ categoriaId: cat.R2, activaPropia: false, activaEfectiva: false, version: 2 });
    // La hija conserva su estado propio, pero deja de ser efectiva.
    const lista = (await e.listar(c.token).expect(200)).body.categorias as { categoriaId: string; activaPropia: boolean; activaEfectiva: boolean }[];
    expect(lista.find(x => x.categoriaId === cat.H2a)).toMatchObject({ activaPropia: true, activaEfectiva: false });
    expect((await e.publicas().expect(200)).body.categorias.map((x: { categoriaId: string }) => x.categoriaId)).not.toContain(cat.H2a);
    expect((await e.servicios(`?categoria=${cat.R2}`).expect(200)).body.total).toBe(0);
    expect(await e.db.query('SELECT id,estado,version FROM catalogo_servicios ORDER BY id')).toEqual(antes);
    const a = await e.activar(c.token, cat.R2, { version: 2, motivo: 'Se reactiva' }).expect(200);
    expect(a.body).toMatchObject({ activaPropia: true, activaEfectiva: true, version: 3 });
    expect((await e.servicios(`?categoria=${cat.R2}`).expect(200)).body.total).toBe(1);
    expect((await e.auditoria()).filter(x => x['recurso_id'] === cat.R2).map(x => x['accion'])).toEqual(['CATEGORIA_DESACTIVADA', 'CATEGORIA_ACTIVADA']);
  });

  test('una confirmación se usa una sola vez', async () => {
    const c = await operador();
    const p = (await e.previsualizar(c.token, cat.H1b, { version: 1 }).expect(201)).body as { confirmacionId: string };
    await e.desactivar(c.token, cat.H1b, { confirmacionId: p.confirmacionId, version: 1, motivo: 'M' }).expect(200);
    await e.activar(c.token, cat.H1b, { version: 2, motivo: 'M' }).expect(200);
    expect((await e.desactivar(c.token, cat.H1b, { confirmacionId: p.confirmacionId, version: 3, motivo: 'M' }).expect(409)).body.codigo).toBe('CONFIRMACION_NO_VALIDA');
  });
});

describe('carreras', () => {
  test('dos confirmaciones simultáneas de la misma vista previa producen un único cambio', async () => {
    const c = await operador();
    const id = (await nueva(c)).categoriaId;
    await e.activar(c.token, id, { version: 1, motivo: 'M' }).expect(200);
    const p = (await e.previsualizar(c.token, id, { version: 2 }).expect(201)).body as { confirmacionId: string };
    const cuerpo = { confirmacionId: p.confirmacionId, version: 2, motivo: 'M' };
    const r = await Promise.all([e.desactivar(c.token, id, cuerpo), e.desactivar(c.token, id, cuerpo)]);
    expect(r.map(x => x.status).sort()).toEqual([200, 409]);
    expect(await e.filaCategoria(id)).toMatchObject({ activa: false, version: 3 });
    expect(await n("SELECT count(*)::int AS n FROM administracion_auditoria WHERE recurso_id=$1 AND accion='CATEGORIA_DESACTIVADA'", [id])).toBe(1);
  });

  test('una revocación simultánea con escrituras deja cada resultado coherente y bloquea las siguientes', async () => {
    const c = await operador();
    const tareas = Array.from({ length: 8 }, (_, i) => e.crear(c.token, { nombre: `Carrera ${i} ${randomUUID().slice(0, 6)}`, motivo: 'M' }));
    const revocacion = e.revocar(c);
    const respuestas = await Promise.all(tareas); await revocacion;
    for (const r of respuestas) expect([201, 403]).toContain(r.status);
    const creadas = respuestas.filter(r => r.status === 201).length;
    expect(await n("SELECT count(*)::int AS n FROM administracion_auditoria WHERE responsable=$1 AND accion='CATEGORIA_CREADA'", [c.cuentaId])).toBe(creadas);
    await e.crear(c.token, { nombre: 'Posterior', motivo: 'M' }).expect(403);
  }, 60000);

  test('ocho escrituras simultáneas no agotan el pool de conexiones', async () => {
    const c = await operador();
    const r = await Promise.all(Array.from({ length: 10 }, (_, i) => e.crear(c.token, { nombre: `Pool ${i} ${randomUUID().slice(0, 6)}`, motivo: 'M' })));
    expect(r.every(x => x.status === 201)).toBe(true);
  }, 60000);
});

describe('reversión conjunta ante fallo de auditoría', () => {
  test('si falla la auditoría de un cambio, no se confirma ni la mutación ni el resultado idempotente y el reintento funciona', async () => {
    const c = await operador();
    const clave = randomUUID();
    const revision = await e.revision();
    fallo.auditoria = true;
    try { await e.crear(c.token, { nombre: 'Falla auditoría', motivo: 'M' }, clave).expect(503); } finally { fallo.auditoria = false; }
    expect(await n("SELECT count(*)::int AS n FROM catalogo_clasificaciones WHERE nombre='Falla auditoría'")).toBe(0);
    expect(await e.revision()).toBe(revision);
    const ok = await e.crear(c.token, { nombre: 'Falla auditoría', motivo: 'M' }, clave).expect(201);
    expect(await e.filaCategoria(ok.body.categoriaId)).toMatchObject({ nombre: 'Falla auditoría' });
  });

  test('si falla la auditoría de un permiso, se revierten permiso, aprobación y constancia, y se puede reintentar', async () => {
    const c = await e.cuenta();
    const { constanciaId } = await e.gestor.emitirConstancia(ejecutorPrueba, c.token);
    const firmada = e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId }));
    fallo.auditoria = true;
    try { await expect(e.gestor.conceder(ejecutorPrueba, firmada)).rejects.toMatchObject({ http: 503 }); } finally { fallo.auditoria = false; }
    expect(await permiso(c.cuentaId)).toBeUndefined();
    expect(await n('SELECT count(*)::int AS n FROM administracion_aprobaciones WHERE id=$1', [firmada.aprobacion.aprobacionId])).toBe(0);
    expect(await n('SELECT count(*)::int AS n FROM administracion_constancias WHERE id=$1 AND consumida_en IS NOT NULL', [constanciaId])).toBe(0);
    await e.gestor.conceder(ejecutorPrueba, firmada);
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'VIGENTE' });
  });
});

describe('alta operativa del permiso', () => {
  const rechazada = async (p: Promise<unknown>, codigo?: string) => { await expect(p).rejects.toMatchObject(codigo ? { codigo } : { http: expect.any(Number) as unknown as number }); };
  const sinFilas = async (cuentaId: string) => { expect(await permiso(cuentaId)).toBeUndefined(); };

  test('un principal del host no habilitado, el firmante o un ejecutor sin permiso operativo no pueden conceder', async () => {
    const c = await e.cuenta();
    const { constanciaId } = await e.gestor.emitirConstancia(ejecutorPrueba, c.token);
    const f = e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId }));
    await rechazada(e.gestor.conceder('intruso', f), 'SIN_PERMISO');
    await rechazada(e.gestor.conceder('po-prueba', f), 'SIN_PERMISO');
    await sinFilas(c.cuentaId);
  });

  test('el ejecutor no puede concederse el permiso a sí mismo', async () => {
    const c = await e.cuenta();
    const { constanciaId } = await e.gestor.emitirConstancia(ejecutorPrueba, c.token);
    // El segundo ejecutor está asociado en la configuración protegida a la cuenta objetivo.
    const dueno = e.gestor as unknown as { d: { configuracion: { identidades: { principal: string; cuentaId?: string }[] } } };
    const propio = dueno.d.configuracion.identidades.find(i => i.principal === 'otro-operador')!;
    const original = propio.cuentaId;
    (propio as { cuentaId?: string }).cuentaId = c.cuentaId;
    try { await rechazada(e.gestor.conceder('otro-operador', e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId }))), 'SIN_PERMISO'); }
    finally { (propio as { cuentaId?: string }).cuentaId = original as string; }
    await sinFilas(c.cuentaId);
  });

  test('la sustitución de cuenta, una firma ajena o alterada y un entorno distinto se rechazan', async () => {
    const a = await e.cuenta(); const b = await e.cuenta();
    const { constanciaId } = await e.gestor.emitirConstancia(ejecutorPrueba, a.token);
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', b.cuentaId, { constanciaId }))), 'APROBACION_NO_VALIDA');
    const ajena = generateKeyPairSync('ed25519').privateKey;
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', a.cuentaId, { constanciaId }), ajena)), 'APROBACION_NO_VALIDA');
    const buena = e.firmar(e.carga('CONCEDER', a.cuentaId, { constanciaId }));
    await rechazada(e.gestor.conceder(ejecutorPrueba, { aprobacion: { ...buena.aprobacion, motivo: 'Motivo alterado' }, firma: buena.firma }), 'APROBACION_NO_VALIDA');
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', a.cuentaId, { constanciaId, entorno: 'produccion' }))), 'APROBACION_NO_VALIDA');
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', a.cuentaId, { constanciaId, firmante: 'otro-firmante' }))), 'APROBACION_NO_VALIDA');
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('REVOCAR', a.cuentaId))), 'APROBACION_NO_VALIDA');
    await sinFilas(a.cuentaId); await sinFilas(b.cuentaId);
  });

  test('una aprobación vencida o aún no vigente se rechaza', async () => {
    const c = await e.cuenta();
    const { constanciaId } = await e.gestor.emitirConstancia(ejecutorPrueba, c.token);
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId, emitidaEn: new Date(Date.now() - 7200_000).toISOString(), venceEn: new Date(Date.now() - 3600_000).toISOString() }))), 'APROBACION_NO_VALIDA');
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId, emitidaEn: new Date(Date.now() + 3600_000).toISOString(), venceEn: new Date(Date.now() + 7200_000).toISOString() }))), 'APROBACION_NO_VALIDA');
    await sinFilas(c.cuentaId);
  });

  test('una aprobación o una constancia ya usadas no sirven de nuevo', async () => {
    const c = await e.cuenta();
    const { constanciaId } = await e.gestor.emitirConstancia(ejecutorPrueba, c.token);
    const f = e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId }));
    await e.gestor.conceder(ejecutorPrueba, f);
    await e.revocar(c);
    await rechazada(e.gestor.conceder(ejecutorPrueba, f), 'APROBACION_NO_VALIDA');
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId }))), 'APROBACION_NO_VALIDA');
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'REVOCADO' });
  });

  test('una constancia vencida o de otra cuenta no sirve, y revocar no exige sesión del afectado', async () => {
    const c = await e.cuenta(); const otra = await e.cuenta();
    const vencida = await e.gestor.emitirConstancia(ejecutorPrueba, c.token);
    await e.db.query("UPDATE administracion_constancias SET creada_en=CURRENT_TIMESTAMP - interval '2 hours', vence_en=CURRENT_TIMESTAMP - interval '1 hour' WHERE id=$1", [vencida.constanciaId]);
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId: vencida.constanciaId }))), 'APROBACION_NO_VALIDA');
    const deOtra = await e.gestor.emitirConstancia(ejecutorPrueba, otra.token);
    await rechazada(e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId: deOtra.constanciaId }))), 'APROBACION_NO_VALIDA');
    await e.habilitar(c);
    // El afectado no necesita sesión: se revoca a partir de la cuenta del permiso existente.
    await e.revocar(c);
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'REVOCADO' });
    await expect(e.revocar(c)).rejects.toMatchObject({ codigo: 'PERMISO_NO_VIGENTE' });
  });

  test('conceder dos veces o revocar sin permiso se rechaza sin consumir la aprobación', async () => {
    const c = await operador();
    const { constanciaId } = await e.gestor.emitirConstancia(ejecutorPrueba, c.token);
    const f = e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId }));
    await expect(e.gestor.conceder(ejecutorPrueba, f)).rejects.toMatchObject({ codigo: 'PERMISO_YA_VIGENTE' });
    expect(await n('SELECT count(*)::int AS n FROM administracion_aprobaciones WHERE id=$1', [f.aprobacion.aprobacionId])).toBe(0);
    const sin = await e.cuenta();
    await expect(e.gestor.revocar(ejecutorPrueba, e.firmar(e.carga('REVOCAR', sin.cuentaId)))).rejects.toMatchObject({ codigo: 'PERMISO_NO_VIGENTE' });
  });
});

describe('identificadores en mayúsculas y autoprotección del ejecutor', () => {
  const mixto = (id: string) => [...id].map((c, i) => (i % 2 ? c.toUpperCase() : c)).join('');
  /** Asocia en la configuración protegida (solo en memoria) un ejecutor a una cuenta, como cuando una persona opera su propia cuenta. */
  const asociar = (principal: string, cuentaId: string | undefined) => {
    const dueno = e.gestor as unknown as { d: { configuracion: { identidades: { principal: string; cuentaId?: string }[] } } };
    const i = dueno.d.configuracion.identidades.find(x => x.principal === principal)! as { cuentaId?: string };
    const anterior = i.cuentaId; i.cuentaId = cuentaId as string; return () => { i.cuentaId = anterior as string; };
  };
  const aprobaciones = () => n('SELECT count(*)::int AS n FROM administracion_aprobaciones');

  test('el ejecutor no puede revocar su propio permiso con el UUID en minúsculas, mayúsculas o capitalización mixta', async () => {
    const c = await operador();
    const restaurar = asociar('otro-operador', c.cuentaId);
    try {
      const antes = await aprobaciones();
      for (const id of [c.cuentaId, c.cuentaId.toUpperCase(), mixto(c.cuentaId)]) {
        await expect(e.gestor.revocar('otro-operador', e.firmar(e.carga('REVOCAR', id)))).rejects.toMatchObject({ codigo: 'SIN_PERMISO' });
      }
      expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'VIGENTE' });
      expect(await aprobaciones()).toBe(antes);
    } finally { restaurar(); }
  });

  test('la configuración con la cuenta asociada en mayúsculas también protege al ejecutor', async () => {
    const c = await operador();
    const restaurar = asociar('otro-operador', c.cuentaId.toUpperCase());
    try { await expect(e.gestor.revocar('otro-operador', e.firmar(e.carga('REVOCAR', c.cuentaId)))).rejects.toMatchObject({ codigo: 'SIN_PERMISO' }); }
    finally { restaurar(); }
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'VIGENTE' });
  });

  test('un ejecutor distinto sí puede operar con UUID en mayúsculas: la firma cubre el original y se persiste en minúsculas', async () => {
    const c = await operador();
    const f = e.firmar(e.carga('REVOCAR', mixto(c.cuentaId), { aprobacionId: randomUUID().toUpperCase() }));
    await e.gestor.revocar(ejecutorPrueba, f);
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'REVOCADO' });
    const fila = ((await e.db.query('SELECT cuenta_id::text AS c, id::text AS i FROM administracion_aprobaciones WHERE id=$1', [f.aprobacion.aprobacionId.toLowerCase()])) as { c: string; i: string }[])[0]!;
    expect(fila).toEqual({ c: c.cuentaId, i: f.aprobacion.aprobacionId.toLowerCase() });
    const aud = ((await e.db.query("SELECT recurso_id FROM administracion_auditoria WHERE accion='PERMISO_RF39_REVOCADO' AND recurso_id=$1", [c.cuentaId])) as { recurso_id: string }[]);
    expect(aud).toHaveLength(1);
  });

  test('la firma se verifica sobre el contenido original: cambiar solo la capitalización después de firmar invalida la aprobación', async () => {
    const c = await operador();
    const f = e.firmar(e.carga('REVOCAR', c.cuentaId));
    await expect(e.gestor.revocar(ejecutorPrueba, { aprobacion: { ...f.aprobacion, cuentaId: c.cuentaId.toUpperCase() }, firma: f.firma })).rejects.toMatchObject({ codigo: 'APROBACION_NO_VALIDA' });
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'VIGENTE' });
  });

  test('una constancia y una cuenta en mayúsculas se tratan igual que en minúsculas al conceder', async () => {
    const c = await e.cuenta();
    const { constanciaId } = await e.gestor.emitirConstancia(ejecutorPrueba, c.token);
    await e.gestor.conceder(ejecutorPrueba, e.firmar(e.carga('CONCEDER', c.cuentaId.toUpperCase(), { constanciaId: constanciaId.toUpperCase() })));
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'VIGENTE' });
    expect(await n('SELECT count(*)::int AS n FROM administracion_constancias WHERE id=$1 AND consumida_en IS NOT NULL', [constanciaId])).toBe(1);
  });
});

describe('emisión de constancias solo por un ejecutor habilitado', () => {
  const constancias = () => n('SELECT count(*)::int AS n FROM administracion_constancias');

  test('un ejecutor habilitado emite la constancia; una identidad no habilitada o el firmante no crean registros', async () => {
    const c = await e.cuenta();
    const antes = await constancias();
    const ok = await e.gestor.emitirConstancia(ejecutorPrueba, c.token);
    expect(ok.cuentaId).toBe(c.cuentaId);
    expect(await constancias()).toBe(antes + 1);
    for (const principal of ['intruso', 'po-prueba', '', ejecutorPrueba.toUpperCase()]) {
      await expect(e.gestor.emitirConstancia(principal, c.token)).rejects.toMatchObject({ http: 403, codigo: 'SIN_PERMISO' });
    }
    expect(await constancias()).toBe(antes + 1);
  });

  test('la identidad se comprueba antes de la sesión, y una sesión inválida tampoco crea registros', async () => {
    const antes = await constancias();
    await expect(e.gestor.emitirConstancia('intruso', 'a'.repeat(43))).rejects.toMatchObject({ codigo: 'SIN_PERMISO' });
    await expect(e.gestor.emitirConstancia(ejecutorPrueba, 'a'.repeat(43))).rejects.toBeDefined();
    expect(await constancias()).toBe(antes);
  });
});

describe('concesiones iniciales simultáneas sobre una cuenta sin permiso previo', () => {
  test('el resultado es un único permiso vigente y cada aprobación consumida deja su auditoría, versión y consumo coherentes', async () => {
    const c = await e.cuenta();
    const ids = await Promise.all([e.gestor.emitirConstancia(ejecutorPrueba, c.token), e.gestor.emitirConstancia(ejecutorPrueba, c.token)]);
    const firmadas = ids.map(({ constanciaId }) => e.firmar(e.carga('CONCEDER', c.cuentaId, { constanciaId })));
    const r = await Promise.allSettled(firmadas.map(f => e.gestor.conceder(ejecutorPrueba, f)));
    const aceptadas = r.filter(x => x.status === 'fulfilled').length;
    expect(aceptadas).toBeGreaterThanOrEqual(1);
    expect(await n('SELECT count(*)::int AS n FROM administracion_permisos WHERE cuenta_id=$1', [c.cuentaId])).toBe(1);
    expect(await permiso(c.cuentaId)).toMatchObject({ estado: 'VIGENTE', version: aceptadas });
    expect(await n("SELECT count(*)::int AS n FROM administracion_auditoria WHERE recurso_id=$1 AND accion='PERMISO_RF39_CONCEDIDO'", [c.cuentaId])).toBe(aceptadas);
    expect(await n('SELECT count(*)::int AS n FROM administracion_aprobaciones WHERE cuenta_id=$1', [c.cuentaId])).toBe(aceptadas);
    expect(await n('SELECT count(*)::int AS n FROM administracion_constancias WHERE cuenta_id=$1 AND consumida_en IS NOT NULL', [c.cuentaId])).toBe(aceptadas);
    for (const x of r.filter(y => y.status === 'rejected')) expect((x as PromiseRejectedResult).reason).toMatchObject({ http: expect.any(Number) as unknown as number });
  });
});
