import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Client } from 'pg';
import type request from 'supertest';
import { clienteAlmacenamiento003 } from '../../soporte/solicitudes-cotizaciones/almacenamiento.js';
import { validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { cuerpoDefinitiva, cuerpoEstimada, cuerpoPublicable, imagen, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T091 · Errores, concurrencia e integridad (CA-ERR-01 a 03, FR-346, CA-CON-*). Aplicación completa con PostgreSQL y Garage reales sobre una base descartable.
//  · Bloque 1  CA-ERR-01: cada conflicto esperado de la tabla de errores devuelve su estado y su código, y NO cambia ni una fila ni un objeto.
//  · Bloque 2  Carreras reales entre peticiones simultáneas: el resultado es el permitido y el estado equivale a UNA sola ejecución exitosa.
//  · Bloque 3  CA-ERR-02: un interbloqueo REAL de PostgreSQL (40P01) provocado con dos transacciones y una barrera determinista se reintenta; la espera de bloqueo
//              agotada responde CONFLICTO_CONCURRENTE; un conflicto persistente (códigos 40P01/40001 inyectados con un disparador) se reintenta 2 veces y responde 409.
//  · Bloque 4  CA-ERR-03: un fallo inesperado de infraestructura inyectado DENTRO de la transacción real (disparador de PostgreSQL) revierte todo, responde 503 sin detalles
//              internos y no se reintenta; repetir la misma clave después funciona (no queda estado parcial ni clave envenenada).
// La inyección ocurre en la base descartable de la suite: ninguna otra base, contenedor ni suite se ve afectada.
let e: EntornoUs1;
let tD: string; let tAna: string; let tBeto: string; let tAjeno: string; let tGema: string;
let almacen: Awaited<ReturnType<typeof clienteAlmacenamiento003>>;
const A = () => e.datos.categorias.A;
const registro: { bloque: string; escenario: string; esperado: string; obtenido: string }[] = [];
const anotar = (bloque: string, escenario: string, esperado: string, obtenido: string) => registro.push({ bloque, escenario, esperado, obtenido });

// ─── Instantáneas e invariantes ───────────────────────────────────────────────────────────────────────────────────────
const TABLAS = ['solicitudes', 'solicitudes_versiones', 'solicitudes_bitacora', 'solicitudes_archivos', 'solicitudes_objetos_pendientes', 'cotizaciones', 'cotizaciones_versiones',
  'cotizaciones_aclaraciones', 'avisos_negocio', 'claves_idempotencia'] as const;
type Conteos = Record<(typeof TABLAS)[number], number>;
async function huellaBase(): Promise<string> {
  const partes: string[] = [];
  for (const t of TABLAS) {
    const r = await e.db.query(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, ',' ORDER BY x::text), '')) AS h FROM ${t} x`) as { n: number; h: string }[];
    partes.push(`${t}:${r[0]!.n}:${r[0]!.h}`);
  }
  return partes.join('|');
}
async function conteos(): Promise<Conteos> {
  const salida = {} as Conteos;
  for (const t of TABLAS) salida[t] = ((await e.db.query(`SELECT count(*)::int AS n FROM ${t}`)) as { n: number }[])[0]!.n;
  return salida;
}
const delta = (a: Conteos, b: Conteos): Conteos => Object.fromEntries(TABLAS.map(t => [t, b[t] - a[t]])) as Conteos;
async function claves(): Promise<string> {
  const salida: string[] = []; let token: string | undefined;
  do {
    const p = await almacen.cliente.send(new ListObjectsV2Command({ Bucket: almacen.bucket, Prefix: e.prefijo, ContinuationToken: token }) as never) as
      { Contents?: { Key?: string; Size?: number }[]; IsTruncated?: boolean; NextContinuationToken?: string };
    for (const o of p.Contents ?? []) salida.push(`${o.Key}:${o.Size}`);
    token = p.IsTruncated ? p.NextContinuationToken : undefined;
  } while (token);
  return salida.sort().join('|');
}
const instantanea = async () => `${await huellaBase()}#${await claves()}`;
/** El borrado de un objeto huérfano puede completarse un instante después de la respuesta: se espera, con límite, a que el almacén vuelva a su estado. */
async function instantaneaIgualA(esperada: string, limiteMs = 15000): Promise<string> {
  const fin = Date.now() + limiteMs; let actual = await instantanea();
  while (actual !== esperada && Date.now() < fin) { await new Promise(r => { setTimeout(r, 250); }); actual = await instantanea(); }
  return actual;
}
/** Invariantes de integridad de todo el modelo. Devuelve las violaciones: debe estar vacío siempre. */
async function violaciones(): Promise<string[]> {
  const q = async (nombre: string, sql: string) => ((await e.db.query(sql)) as unknown[]).length ? [nombre] : [];
  return [
    ...await q('versión de trabajo distinta del número de versiones', 'SELECT s.id FROM solicitudes s WHERE s.version_trabajo <> (SELECT count(*) FROM solicitudes_versiones v WHERE v.solicitud_id = s.id)'),
    ...await q('versiones de solicitud no consecutivas', 'SELECT solicitud_id FROM solicitudes_versiones GROUP BY solicitud_id HAVING max(numero) <> count(*) OR min(numero) <> 1'),
    ...await q('versión actual de cotización distinta del número de versiones', 'SELECT c.id FROM cotizaciones c WHERE c.version_actual <> (SELECT count(*) FROM cotizaciones_versiones v WHERE v.cotizacion_id = c.id)'),
    ...await q('versiones de cotización no consecutivas', 'SELECT cotizacion_id FROM cotizaciones_versiones GROUP BY cotizacion_id HAVING max(numero) <> count(*) OR min(numero) <> 1'),
    ...await q('aclaraciones no consecutivas', 'SELECT cotizacion_id FROM cotizaciones_aclaraciones GROUP BY cotizacion_id HAVING max(numero) <> count(*) OR min(numero) <> 1 OR count(*) > 20'),
    ...await q('dos cotizaciones no retiradas del mismo prestador', "SELECT solicitud_id, prestador_id FROM cotizaciones WHERE estado <> 'RETIRADA' GROUP BY 1, 2 HAVING count(*) > 1"),
    ...await q('cotización sobre una solicitud en borrador', "SELECT c.id FROM cotizaciones c JOIN solicitudes s ON s.id = c.solicitud_id WHERE s.estado = 'BORRADOR'"),
    ...await q('cotización sin ninguna versión', 'SELECT c.id FROM cotizaciones c WHERE NOT EXISTS (SELECT 1 FROM cotizaciones_versiones v WHERE v.cotizacion_id = c.id)'),
    ...await q('solicitud publicada sin entrada de publicación en la bitácora', "SELECT s.id FROM solicitudes s WHERE s.publicada_en IS NOT NULL AND NOT EXISTS (SELECT 1 FROM solicitudes_bitacora b WHERE b.solicitud_id = s.id AND b.tipo = 'PUBLICADA')"),
    ...await q('solicitud cerrada sin entrada de cierre exactamente una vez', "SELECT s.id FROM solicitudes s WHERE s.estado = 'CERRADA' AND (SELECT count(*) FROM solicitudes_bitacora b WHERE b.solicitud_id = s.id AND b.tipo = 'CERRADA') <> 1"),
    ...await q('más de una entrada de publicación', "SELECT solicitud_id FROM solicitudes_bitacora WHERE tipo = 'PUBLICADA' GROUP BY solicitud_id HAVING count(*) > 1"),
  ];
}
/** Sin transacciones abiertas ni esperas de bloqueo pendientes en la base de la suite. */
async function sinResiduos(): Promise<void> {
  const fin = Date.now() + 10000; let abiertas: unknown[] = []; let esperas: unknown[] = [];
  do {
    abiertas = await e.db.query("SELECT pid, state FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND state LIKE 'idle in transaction%'");
    esperas = await e.db.query('SELECT l.pid FROM pg_locks l WHERE NOT l.granted');
    if (!abiertas.length && !esperas.length) break;
    await new Promise(r => { setTimeout(r, 200); });
  } while (Date.now() < fin);
  expect([abiertas.length, esperas.length]).toEqual([0, 0]);
}
const PROHIBIDO = ['SELECT ', 'INSERT ', 'UPDATE ', ' at ', 'node_modules', 'stack', 'password', 'Bearer ', 'XX000', '40P01', '40001', '55P03', 'pg_', 'deadlock', 't091', 'fallo inyectado',
  'cotizaciones_versiones', 'solicitudes_bitacora', 'claves_idempotencia', 'constraint', 'relation ', 'ECONN', 'objeto_clave', 'pruebas/'];
const sinDetalles = (cuerpo: unknown) => {
  const texto = JSON.stringify(cuerpo ?? '');
  for (const p of PROHIBIDO) expect([p, texto.includes(p)]).toEqual([p, false]);
};

// ─── Escenarios ───────────────────────────────────────────────────────────────────────────────────────────────────────
interface Pub { solicitudId: string; version: number; versionTrabajo: number }
async function publicada(extra: object = {}): Promise<Pub> {
  const c = (await e.crear(tD, cuerpoPublicable(e, { categoriaId: A(), ...extra })).expect(201)).body;
  return (await e.publicar(tD, c.solicitudId, { version: c.version }).expect(200)).body;
}
async function borrador(): Promise<{ solicitudId: string; version: number }> { return (await e.crear(tD, cuerpoPublicable(e, { categoriaId: A() })).expect(201)).body; }
async function conCotizacion(token = tBeto) {
  const s = await publicada();
  const c = (await e.cotizar(token, s.solicitudId, cuerpoEstimada(s.versionTrabajo)).expect(201)).body as { cotizacionId: string; version: number };
  return { s, c };
}
const cuerpoActualizacion = (s: Pub, c: { version: number }) => ({ ...cuerpoDefinitiva(s.versionTrabajo), versionCotizacion: c.version });

beforeAll(async () => {
  e = await montarUs1();
  almacen = await clienteAlmacenamiento003();
  const t = (c: Parameters<EntornoUs1['token']>[0]) => e.token(c);
  [tD, tAna, tBeto, tAjeno, tGema] = await Promise.all([t(e.datos.clientes.clienteUno), t(e.datos.prestadores.ana), t(e.datos.prestadores.beto), t(e.datos.clientes.clienteDos), t(e.datos.prestadores.gema)]) as string[] as [string, string, string, string, string];
  // Infraestructura de inyección de fallos en la base descartable de la suite: dos secuencias (no transaccionales, sobreviven al rollback) y un disparador genérico.
  await e.db.query('CREATE SEQUENCE t091_disparos');
  await e.db.query('CREATE TABLE t091_control (fallar_hasta integer NOT NULL, sqlstate text NOT NULL)');
  await e.db.query(`CREATE FUNCTION t091_fallar() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE n bigint; c record;
    BEGIN
      SELECT * INTO c FROM t091_control LIMIT 1;
      IF c IS NULL THEN RETURN NEW; END IF;
      n := nextval('t091_disparos');
      IF n <= c.fallar_hasta THEN RAISE EXCEPTION 'fallo inyectado por T091' USING ERRCODE = c.sqlstate; END IF;
      RETURN NEW;
    END $$`);
}, 600000);
afterAll(async () => {
  try { expect(await violaciones()).toEqual([]); } finally {
    almacen?.cliente.destroy();
    await e?.cerrar();
  }
}, 180000);

async function inyectar(tabla: string, sqlstate: string, fallarHasta: number): Promise<void> {
  await e.db.query('DELETE FROM t091_control');
  await e.db.query('INSERT INTO t091_control(fallar_hasta, sqlstate) VALUES ($1, $2)', [fallarHasta, sqlstate]);
  await e.db.query("SELECT setval('t091_disparos', 1, false)");
  await e.db.query(`CREATE TRIGGER t091_falla AFTER INSERT OR UPDATE ON ${tabla} FOR EACH ROW EXECUTE FUNCTION t091_fallar()`);
}
async function retirarInyeccion(tabla: string): Promise<{ disparos: number }> {
  await e.db.query(`DROP TRIGGER IF EXISTS t091_falla ON ${tabla}`);
  await e.db.query('DELETE FROM t091_control');
  const [d] = await e.db.query("SELECT last_value::int AS n, is_called AS llamado FROM t091_disparos") as { n: number; llamado: boolean }[];
  return { disparos: d!.llamado ? d!.n : 0 };
}

// ─── 1 · CA-ERR-01: cada conflicto esperado, con su código y sin cambios ──────────────────────────────────────────────
interface Conflicto { readonly codigo: string; readonly http: number; readonly nombre: string; readonly preparar: () => Promise<() => request.Test> }
const CONFLICTOS: readonly Conflicto[] = [
  { codigo: 'VERSION_DESACTUALIZADA', http: 409, nombre: 'editar con versión vieja', preparar: async () => { const s = await publicada(); await e.editar(tD, s.solicitudId, { version: s.version, medidas: 'primera' }).expect(200); return () => e.editar(tD, s.solicitudId, { version: s.version, medidas: 'segunda' }); } },
  { codigo: 'VERSION_DESACTUALIZADA', http: 409, nombre: 'cerrar con versión vieja', preparar: async () => { const s = await publicada(); await e.editar(tD, s.solicitudId, { version: s.version, medidas: 'primera' }).expect(200); return () => e.cerrarSolicitud(tD, s.solicitudId, { version: s.version }); } },
  { codigo: 'VERSION_DESACTUALIZADA', http: 409, nombre: 'publicar con versión vieja', preparar: async () => { const b = await borrador(); await e.editar(tD, b.solicitudId, { version: b.version, medidas: 'primera' }).expect(200); return () => e.publicar(tD, b.solicitudId, { version: b.version }); } },
  { codigo: 'VERSION_DESACTUALIZADA', http: 409, nombre: 'actualizar cotización con versión vieja', preparar: async () => { const { s, c } = await conCotizacion(); await e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c)).expect(201); return () => e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c)); } },
  { codigo: 'VERSION_DESACTUALIZADA', http: 409, nombre: 'retirar cotización con versión vieja', preparar: async () => { const { s, c } = await conCotizacion(); await e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c)).expect(201); return () => e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }); } },
  { codigo: 'SOLICITUD_MODIFICADA', http: 409, nombre: 'cotizar sobre una versión de trabajo anterior', preparar: async () => { const s = await publicada(); await e.editar(tD, s.solicitudId, { version: s.version, descripcion: 'Descripción cambiada para la prueba.' }).expect(200); return () => e.cotizar(tAna, s.solicitudId, cuerpoEstimada(s.versionTrabajo)); } },
  { codigo: 'SOLICITUD_MODIFICADA', http: 409, nombre: 'actualizar cotización sobre una versión de trabajo anterior', preparar: async () => { const { s, c } = await conCotizacion(); await e.editar(tD, s.solicitudId, { version: s.version, descripcion: 'Descripción cambiada para la prueba.' }).expect(200); return () => e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c)); } },
  { codigo: 'SOLICITUD_NO_ABIERTA', http: 409, nombre: 'cotizar una solicitud cerrada', preparar: async () => { const s = await publicada(); await e.cerrarSolicitud(tD, s.solicitudId, { version: s.version }).expect(200); return () => e.cotizar(tAna, s.solicitudId, cuerpoEstimada(s.versionTrabajo)); } },
  { codigo: 'SOLICITUD_NO_ABIERTA', http: 409, nombre: 'actualizar una cotización de una solicitud cerrada', preparar: async () => { const { s, c } = await conCotizacion(); await e.cerrarSolicitud(tD, s.solicitudId, { version: s.version }).expect(200); return () => e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c)); } },
  { codigo: 'SOLICITUD_NO_ABIERTA', http: 409, nombre: 'retirar una cotización de una solicitud cerrada', preparar: async () => { const { s, c } = await conCotizacion(); await e.cerrarSolicitud(tD, s.solicitudId, { version: s.version }).expect(200); return () => e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }); } },
  { codigo: 'SOLICITUD_NO_ABIERTA', http: 409, nombre: 'aclaración en una solicitud cerrada', preparar: async () => { const { s, c } = await conCotizacion(); await e.cerrarSolicitud(tD, s.solicitudId, { version: s.version }).expect(200); return () => e.aclarar(tD, c.cotizacionId, { texto: 'Pregunta tardía.' }); } },
  { codigo: 'COTIZACION_EXISTENTE', http: 409, nombre: 'segunda cotización no retirada del mismo prestador', preparar: async () => { const { s } = await conCotizacion(); return () => e.cotizar(tBeto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)); } },
  { codigo: 'COTIZACION_RETIRADA', http: 409, nombre: 'actualizar una cotización retirada', preparar: async () => { const { s, c } = await conCotizacion(); await e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }).expect(200); return () => e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c)); } },
  { codigo: 'COTIZACION_RETIRADA', http: 409, nombre: 'retirar una cotización ya retirada', preparar: async () => { const { c } = await conCotizacion(); await e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }).expect(200); return () => e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }); } },
  { codigo: 'COTIZACION_RETIRADA', http: 409, nombre: 'aclaración en una cotización retirada', preparar: async () => { const { c } = await conCotizacion(); await e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }).expect(200); return () => e.aclarar(tD, c.cotizacionId, { texto: 'Pregunta tardía.' }); } },
  { codigo: 'CLAVE_IDEMPOTENCIA_REUTILIZADA', http: 409, nombre: 'misma clave con otros datos al crear una solicitud', preparar: async () => { const clave = randomUUID(); await e.crear(tD, cuerpoPublicable(e, { categoriaId: A() }), clave).expect(201); return () => e.crear(tD, cuerpoPublicable(e, { categoriaId: A(), descripcion: 'Otra descripción distinta.' }), clave); } },
  { codigo: 'CLAVE_IDEMPOTENCIA_REUTILIZADA', http: 409, nombre: 'misma clave con otros datos al cotizar', preparar: async () => { const s = await publicada(); const clave = randomUUID(); await e.cotizar(tBeto, s.solicitudId, cuerpoEstimada(s.versionTrabajo), clave).expect(201); return () => e.cotizar(tBeto, s.solicitudId, cuerpoDefinitiva(s.versionTrabajo), clave); } },
  { codigo: 'COTIZACION_PROPIA', http: 422, nombre: 'cotizar la propia solicitud', preparar: async () => { const c = (await e.crear(tGema, cuerpoPublicable(e, { categoriaId: A() })).expect(201)).body; const p = (await e.publicar(tGema, c.solicitudId, { version: c.version }).expect(200)).body; return () => e.cotizar(tGema, p.solicitudId, cuerpoEstimada(p.versionTrabajo)); } },
  { codigo: 'COTIZACION_INCOMPLETA', http: 422, nombre: 'cotización definitiva sin precio', preparar: async () => { const s = await publicada(); return () => e.cotizar(tAna, s.solicitudId, { ...cuerpoDefinitiva(s.versionTrabajo), precioCentimos: undefined }); } },
  { codigo: 'SOLICITUD_INCOMPLETA', http: 422, nombre: 'publicar un borrador sin campos obligatorios', preparar: async () => { const c = (await e.crear(tD, { tipo: 'PUBLICADA', descripcion: 'Solo la descripción de la solicitud.' }).expect(201)).body; return () => e.publicar(tD, c.solicitudId, { version: c.version }); } },
  { codigo: 'CAMPO_NO_MODIFICABLE', http: 422, nombre: 'cambiar el tipo de una solicitud publicada', preparar: async () => { const s = await publicada(); return () => e.editar(tD, s.solicitudId, { version: s.version, tipo: 'DIRIGIDA' }); } },
  { codigo: 'DATOS_PERSONALES_EN_TEXTO', http: 422, nombre: 'publicar con un teléfono en el texto', preparar: async () => { const c = (await e.crear(tD, cuerpoPublicable(e, { categoriaId: A(), descripcion: 'Escríbame al 987654321 para coordinar el muro.' })).expect(201)).body; return () => e.publicar(tD, c.solicitudId, { version: c.version }); } },
  { codigo: 'LIMITE_ACLARACIONES', http: 422, nombre: 'mensaje 21 de un hilo', preparar: async () => { const { c } = await conCotizacion(); for (let i = 1; i <= 20; i += 1) await e.aclarar(i % 2 ? tD : tBeto, c.cotizacionId, { texto: `Mensaje ${i}` }).expect(201); return () => e.aclarar(tD, c.cotizacionId, { texto: 'Mensaje 21' }); } },
  { codigo: 'LIMITE_COMPARACION', http: 422, nombre: 'comparar 11 cotizaciones', preparar: async () => { const s = await publicada(); return () => e.cotizacionesDe(tD, s.solicitudId, `?ids=${Array.from({ length: 11 }, () => randomUUID()).join(',')}`); } },
  { codigo: 'LIMITE_ARCHIVOS', http: 422, nombre: 'sexta fotografía de una solicitud', preparar: async () => { const b = await borrador(); for (let i = 0; i < 5; i += 1) await e.cargar(tD, b.solicitudId, await imagen(40 + i, 30)).expect(201); const sexta = await imagen(60, 40); return () => e.cargar(tD, b.solicitudId, sexta); } },
  { codigo: 'IMAGEN_FORMATO_NO_ADMITIDO', http: 422, nombre: 'archivo que no es una imagen admitida', preparar: async () => { const b = await borrador(); return () => e.cargar(tD, b.solicitudId, { tipoMime: 'image/jpeg', contenidoBase64: Buffer.from('%PDF-1.4 no es una imagen').toString('base64') }); } },
  { codigo: 'DATOS_INVALIDOS', http: 400, nombre: 'versión de control con formato inválido', preparar: async () => { const s = await publicada(); return () => e.editar(tD, s.solicitudId, { version: 'no-es-un-numero', medidas: 'x' }); } },
  { codigo: 'RECURSO_NO_DISPONIBLE', http: 404, nombre: 'cotización de otro cliente', preparar: async () => { const { c } = await conCotizacion(); return () => e.cotizacion(tAjeno, c.cotizacionId); } },
];
describe('CA-ERR-01 · cada conflicto esperado devuelve su código y no modifica nada', () => {
  test.each(CONFLICTOS.map(c => [`${c.http} ${c.codigo} · ${c.nombre}`, c] as const))('%s', async (_nombre, conflicto) => {
    const llamar = await conflicto.preparar();
    const antes = await instantanea();
    const res = await llamar();
    expect([conflicto.nombre, res.status, res.body.codigo]).toEqual([conflicto.nombre, conflicto.http, conflicto.codigo]);
    await validarRespuesta003(`C003Error${conflicto.http}` as 'C003Error404', res.body);
    sinDetalles(res.body);
    expect(await instantanea()).toBe(antes);                 // ni una fila, ni un objeto, ni una versión, ni un aviso, ni una clave de idempotencia
    expect(await violaciones()).toEqual([]);
    anotar('CA-ERR-01', conflicto.nombre, `${conflicto.http} ${conflicto.codigo}`, `${res.status} ${res.body.codigo}`);
  }, 120000);
  test('el mismo conflicto repetido con la misma clave responde igual (la respuesta es la del primer intento) y no suma efectos', async () => {
    const { s, c } = await conCotizacion();
    await e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c)).expect(201);
    const clave = randomUUID();
    const primero = await e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c), clave);
    const antes = await instantanea();
    const segundo = await e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c), clave);
    expect([primero.status, primero.body.codigo]).toEqual([409, 'VERSION_DESACTUALIZADA']);
    expect({ s: segundo.status, c: segundo.body.codigo }).toEqual({ s: primero.status, c: primero.body.codigo });
    expect(await instantanea()).toBe(antes);
  });
});

// ─── 2 · Carreras reales ──────────────────────────────────────────────────────────────────────────────────────────────
/** Efecto neto de una ejecución exitosa, medido en un gemelo secuencial: la carrera debe producir exactamente el mismo cambio de recuentos. */
async function efectoDe(operacion: () => Promise<void>): Promise<Conteos> {
  const a = await conteos(); await operacion(); return delta(a, await conteos());
}
describe('carreras reales: el resultado permitido y el efecto de UNA sola ejecución', () => {
  test('dos ediciones con la misma versión: una gana (200) y la otra recibe 409 VERSION_DESACTUALIZADA; las versiones siguen consecutivas', async () => {
    const gemela = await publicada(); const una = await efectoDe(async () => { await e.editar(tD, gemela.solicitudId, { version: gemela.version, medidas: 'una sola' }).expect(200); });
    const s = await publicada(); const antes = await conteos();
    const [a, b] = await Promise.all([e.editar(tD, s.solicitudId, { version: s.version, medidas: 'carrera A' }), e.editar(tD, s.solicitudId, { version: s.version, medidas: 'carrera B' })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect([a, b].find(r => r.status === 409)!.body.codigo).toBe('VERSION_DESACTUALIZADA');
    expect(delta(antes, await conteos())).toEqual(una);
    expect(((await e.db.query('SELECT version FROM solicitudes WHERE id=$1', [s.solicitudId])) as { version: number }[])[0]!.version).toBe(s.version + 1);
    expect(await violaciones()).toEqual([]);
  });
  test('dos publicaciones simultáneas del mismo borrador: una publica y la otra se rechaza; un solo aviso y una sola entrada de publicación', async () => {
    const g = await borrador(); const una = await efectoDe(async () => { await e.publicar(tD, g.solicitudId, { version: g.version }).expect(200); });
    const b = await borrador(); const antes = await conteos();
    const [x, y] = await Promise.all([e.publicar(tD, b.solicitudId, { version: b.version }), e.publicar(tD, b.solicitudId, { version: b.version })]);
    expect([x.status, y.status].sort()).toEqual([200, 409]);
    expect(['VERSION_DESACTUALIZADA', 'SOLICITUD_NO_ABIERTA']).toContain([x, y].find(r => r.status === 409)!.body.codigo);
    expect(delta(antes, await conteos())).toEqual(una);
    expect(await violaciones()).toEqual([]);
  });
  test('cerrar y editar a la vez con la misma versión: exactamente una prospera; si cierra, la solicitud queda CERRADA con una sola entrada de cierre', async () => {
    const s = await publicada();
    const [cierre, edicion] = await Promise.all([e.cerrarSolicitud(tD, s.solicitudId, { version: s.version }), e.editar(tD, s.solicitudId, { version: s.version, medidas: 'carrera' })]);
    expect([cierre.status, edicion.status].filter(x => x === 200)).toHaveLength(1);
    expect(['VERSION_DESACTUALIZADA', 'SOLICITUD_NO_ABIERTA']).toContain([cierre, edicion].find(r => r.status === 409)!.body.codigo);
    const [fila] = await e.db.query('SELECT estado FROM solicitudes WHERE id=$1', [s.solicitudId]) as { estado: string }[];
    expect(fila!.estado).toBe(cierre.status === 200 ? 'CERRADA' : 'ABIERTA');
    expect(await violaciones()).toEqual([]);
  });
  test('dos actualizaciones de la misma cotización con la misma versión: una crea la versión 2 y la otra recibe 409 VERSION_DESACTUALIZADA', async () => {
    const { s, c } = await conCotizacion();
    const [a, b] = await Promise.all([e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c)), e.actualizarCotizacion(tBeto, c.cotizacionId, { ...cuerpoActualizacion(s, c), alcance: 'Alcance distinto para la segunda.' })]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect([a, b].find(r => r.status === 409)!.body.codigo).toBe('VERSION_DESACTUALIZADA');
    expect(((await e.db.query('SELECT numero FROM cotizaciones_versiones WHERE cotizacion_id=$1 ORDER BY numero', [c.cotizacionId])) as { numero: number }[]).map(x => x.numero)).toEqual([1, 2]);
    expect(await violaciones()).toEqual([]);
  });
  test('dos retiros simultáneos de la misma cotización: uno retira y el otro recibe 409; una sola retirada', async () => {
    const { c } = await conCotizacion();
    const [a, b] = await Promise.all([e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }), e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(['COTIZACION_RETIRADA', 'VERSION_DESACTUALIZADA']).toContain([a, b].find(r => r.status === 409)!.body.codigo);
    expect(((await e.db.query("SELECT estado FROM cotizaciones WHERE id=$1", [c.cotizacionId])) as { estado: string }[])[0]!.estado).toBe('RETIRADA');
    expect(await violaciones()).toEqual([]);
  });
  test('cinco mensajes simultáneos sobre un hilo con 18: se aceptan exactamente 2 (números 19 y 20) y los otros 3 reciben 422 LIMITE_ACLARACIONES', async () => {
    const { c } = await conCotizacion();
    for (let i = 1; i <= 18; i += 1) await e.aclarar(i % 2 ? tD : tBeto, c.cotizacionId, { texto: `Mensaje ${i}` }).expect(201);
    const r = await Promise.all([1, 2, 3, 4, 5].map(i => e.aclarar(i % 2 ? tD : tBeto, c.cotizacionId, { texto: `Carrera ${i}` })));
    expect(r.filter(x => x.status === 201)).toHaveLength(2);
    for (const x of r.filter(y => y.status !== 201)) expect([x.status, x.body.codigo]).toEqual([422, 'LIMITE_ACLARACIONES']);
    expect(((await e.db.query('SELECT numero FROM cotizaciones_aclaraciones WHERE cotizacion_id=$1 ORDER BY numero', [c.cotizacionId])) as { numero: number }[]).map(x => x.numero)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(await violaciones()).toEqual([]);
  });
  test('retiro y aclaración a la vez: o el mensaje entra antes del retiro o se rechaza con 409 COTIZACION_RETIRADA; nunca queda un mensaje posterior al retiro', async () => {
    const { c } = await conCotizacion();
    const [retiro, mensaje] = await Promise.all([e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }), e.aclarar(tD, c.cotizacionId, { texto: 'Pregunta simultánea al retiro.' })]);
    expect(retiro.status).toBe(200);
    expect([201, 409]).toContain(mensaje.status);
    if (mensaje.status === 409) expect(mensaje.body.codigo).toBe('COTIZACION_RETIRADA');
    const mensajes = await e.db.query('SELECT a.id FROM cotizaciones_aclaraciones a JOIN cotizaciones c ON c.id=a.cotizacion_id WHERE a.cotizacion_id=$1 AND a.creada_en > c.retirada_en', [c.cotizacionId]);
    expect(mensajes).toEqual([]);
    expect(await violaciones()).toEqual([]);
  });
  test('cotizaciones simultáneas del mismo prestador sobre la misma solicitud: una prospera y la otra recibe COTIZACION_EXISTENTE; una sola fila y una sola versión', async () => {
    const s = await publicada();
    const r = await Promise.all([e.cotizar(tBeto, s.solicitudId, cuerpoEstimada(s.versionTrabajo)), e.cotizar(tBeto, s.solicitudId, cuerpoEstimada(s.versionTrabajo))]);
    expect(r.map(x => x.status).sort()).toEqual([201, 409]);
    expect(r.find(x => x.status === 409)!.body.codigo).toBe('COTIZACION_EXISTENTE');
    expect(await e.db.query('SELECT count(*)::int AS n FROM cotizaciones c JOIN cotizaciones_versiones v ON v.cotizacion_id=c.id WHERE c.solicitud_id=$1', [s.solicitudId])).toEqual([{ n: 1 }]);
    expect(await violaciones()).toEqual([]);
  });
});

// ─── 3 · CA-ERR-02: interbloqueo real, espera agotada y conflicto persistente ─────────────────────────────────────────
async function cliente(): Promise<Client> { const c = new Client({ connectionString: e.base.url }); await c.connect(); return c; }
async function hasta<T>(condicion: () => Promise<T | undefined | false>, limiteMs = 15000, mensaje = 'condición'): Promise<T> {
  const fin = Date.now() + limiteMs;
  for (;;) { const v = await condicion(); if (v) return v; if (Date.now() > fin) throw new Error(`Tiempo agotado esperando: ${mensaje}`); await new Promise(r => { setTimeout(r, 25); }); }
}
const interbloqueosAcumulados = async () => Number(((await e.db.query("SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()")) as { deadlocks: string }[])[0]!.deadlocks);

describe('CA-ERR-02 · interbloqueo real de PostgreSQL', () => {
  test('un interbloqueo real (transacción externa vs retiro de cotización) se detecta, la transacción de la aplicación se revierte, se reintenta y termina bien', async () => {
    const { c } = await conCotizacion();
    const [{ solicitud_id: solicitudId }] = await e.db.query('SELECT solicitud_id FROM cotizaciones WHERE id=$1', [c.cotizacionId]) as { solicitud_id: string }[] as [{ solicitud_id: string }];
    const antesInterbloqueos = await interbloqueosAcumulados();
    const antes = await conteos();
    const t1 = await cliente(); const pidT1 = ((await t1.query('SELECT pg_backend_pid() AS pid')).rows[0] as { pid: number }).pid;
    let respuesta: Promise<request.Response> | undefined; let bloqueoT1: Promise<unknown> | undefined;
    try {
      // 1 · T1 toma la cotización FOR UPDATE.
      await t1.query('BEGIN'); await t1.query('SELECT id FROM cotizaciones WHERE id=$1 FOR UPDATE', [c.cotizacionId]);
      // 2 · La aplicación retira: toma la solicitud FOR SHARE y se queda esperando la cotización.
      respuesta = Promise.resolve(e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }));
      await hasta(async () => { const r = await e.db.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND pid <> $1 AND wait_event_type = 'Lock' AND query ILIKE '%cotizaciones%'", [pidT1]); return r.length > 0; }, 15000, 'la aplicación debe quedar esperando el bloqueo de T1');
      // 3 · Sólo entonces T1 pide la solicitud FOR UPDATE, que choca con el FOR SHARE de la aplicación: ciclo cerrado. La aplicación esperó primero y es la víctima.
      bloqueoT1 = t1.query('SELECT id FROM solicitudes WHERE id=$1 FOR UPDATE', [solicitudId]);
      const resultadoT1 = await Promise.allSettled([bloqueoT1]);
      expect(resultadoT1[0]!.status).toBe('fulfilled');           // T1 NO fue la víctima: PostgreSQL abortó la transacción de la aplicación
      await t1.query('ROLLBACK');                                  // T1 suelta: el reintento de la aplicación puede continuar
      const res = await respuesta;
      expect(res.status).toBe(200);
      expect(res.body.estado).toBe('RETIRADA');
    } finally { await t1.query('ROLLBACK').catch(() => undefined); await t1.end(); if (respuesta) await respuesta.catch(() => undefined); }
    await hasta(async () => (await interbloqueosAcumulados()) > antesInterbloqueos, 15000, 'el contador de interbloqueos de PostgreSQL debe aumentar');
    // Efectos: una sola retirada, sin duplicados; la clave de idempotencia quedó una vez.
    expect(delta(antes, await conteos())).toEqual({ ...Object.fromEntries(TABLAS.map(t => [t, 0])), claves_idempotencia: 1 });
    expect(((await e.db.query('SELECT estado FROM cotizaciones WHERE id=$1', [c.cotizacionId])) as { estado: string }[])[0]!.estado).toBe('RETIRADA');
    await sinResiduos();
    expect(await violaciones()).toEqual([]);
    anotar('CA-ERR-02', 'interbloqueo real retirar-vs-transacción externa', '200 tras 1 reintento', '200, T1 no fue víctima, deadlocks+1');
  }, 120000);

  test('la espera de bloqueo agotada (lock_timeout de 5 s) responde 409 CONFLICTO_CONCURRENTE sin reintentar, sin cambios y sin dejar esperas', async () => {
    const s = await publicada();
    const antes = await instantanea();
    const t1 = await cliente();
    try {
      await t1.query('BEGIN'); await t1.query('SELECT id FROM solicitudes WHERE id=$1 FOR UPDATE', [s.solicitudId]);
      const inicio = Date.now();
      const res = await e.editar(tD, s.solicitudId, { version: s.version, medidas: 'bloqueada por T1' });
      const espera = Date.now() - inicio;
      expect([res.status, res.body.codigo]).toEqual([409, 'CONFLICTO_CONCURRENTE']);
      expect(espera).toBeGreaterThanOrEqual(4500);                  // esperó el lock_timeout real; no se rindió antes
      expect(espera).toBeLessThan(9000);                            // una sola espera: no se reintentó (un reintento sumaría otros 5 s)
      await validarRespuesta003('C003Error409', res.body);
      sinDetalles(res.body);
    } finally { await t1.query('ROLLBACK'); await t1.end(); }
    expect(await instantanea()).toBe(antes);
    await sinResiduos();
    // Con el bloqueo liberado, la misma operación prospera: nada quedó bloqueado ni a medias.
    await e.editar(tD, s.solicitudId, { version: s.version, medidas: 'ya libre' }).expect(200);
    anotar('CA-ERR-02', 'lock_timeout real (5 s)', '409 CONFLICTO_CONCURRENTE', '409 CONFLICTO_CONCURRENTE');
  }, 120000);
});

interface OpInyectable {
  readonly nombre: string; readonly tabla: string; readonly exito: number; readonly unaTransaccion: boolean;
  readonly preparar: () => Promise<(clave: string) => request.Test>;
}
const OPERACIONES: readonly OpInyectable[] = [
  { nombre: 'crearSolicitud003', tabla: 'solicitudes_bitacora', exito: 201, unaTransaccion: true, preparar: async () => (clave) => e.crear(tD, cuerpoPublicable(e, { categoriaId: A() }), clave) },
  { nombre: 'editarSolicitud003', tabla: 'solicitudes_versiones', exito: 200, unaTransaccion: true, preparar: async () => { const s = await publicada(); return (clave) => e.editar(tD, s.solicitudId, { version: s.version, medidas: 'edición inyectada' }, clave); } },
  { nombre: 'publicarSolicitud003', tabla: 'solicitudes_bitacora', exito: 200, unaTransaccion: true, preparar: async () => { const b = await borrador(); return (clave) => e.publicar(tD, b.solicitudId, { version: b.version }, clave); } },
  { nombre: 'cerrarSolicitud003', tabla: 'solicitudes_bitacora', exito: 200, unaTransaccion: true, preparar: async () => { const s = await publicada(); return (clave) => e.cerrarSolicitud(tD, s.solicitudId, { version: s.version }, clave); } },
  { nombre: 'cargarArchivoSolicitud003', tabla: 'solicitudes_archivos', exito: 201, unaTransaccion: false, preparar: async () => { const b = await borrador(); const img = await imagen(50, 40); return (clave) => e.cargar(tD, b.solicitudId, img, clave); } },
  { nombre: 'enviarCotizacion003', tabla: 'cotizaciones_versiones', exito: 201, unaTransaccion: true, preparar: async () => { const s = await publicada(); return (clave) => e.cotizar(tAna, s.solicitudId, cuerpoEstimada(s.versionTrabajo), clave); } },
  { nombre: 'actualizarCotizacion003', tabla: 'cotizaciones_versiones', exito: 201, unaTransaccion: true, preparar: async () => { const { s, c } = await conCotizacion(); return (clave) => e.actualizarCotizacion(tBeto, c.cotizacionId, cuerpoActualizacion(s, c), clave); } },
  { nombre: 'retirarCotizacion003', tabla: 'cotizaciones', exito: 200, unaTransaccion: true, preparar: async () => { const { c } = await conCotizacion(); return (clave) => e.retirarCotizacion(tBeto, c.cotizacionId, { versionCotizacion: c.version }, clave); } },
  { nombre: 'enviarAclaracion003', tabla: 'cotizaciones_aclaraciones', exito: 201, unaTransaccion: true, preparar: async () => { const { c } = await conCotizacion(); return (clave) => e.aclarar(tD, c.cotizacionId, { texto: 'Aclaración inyectada.' }, clave); } },
];
const OPS = OPERACIONES.map(o => [o.nombre, o] as const);

describe('CA-ERR-02 · conflicto de concurrencia (40P01 y 40001) inyectado dentro de la transacción real', () => {
  test.each(OPS)('%s · un interbloqueo transitorio se reintenta y el efecto ocurre una sola vez', async (_n, op) => {
    const llamar = await op.preparar();
    const clave = randomUUID(); const antes = await conteos();
    await inyectar(op.tabla, '40P01', 1);
    let res: request.Response; let conteo: { disparos: number };
    try { res = await llamar(clave); } finally { conteo = await retirarInyeccion(op.tabla); }
    expect([op.nombre, res.status]).toEqual([op.nombre, op.exito]);
    expect(conteo.disparos).toBeGreaterThanOrEqual(2);                     // la inyección alcanzó el punto previsto, falló la primera vez y la segunda pasó
    const d = delta(antes, await conteos());
    const [fila] = await e.db.query("SELECT count(*)::int AS n FROM claves_idempotencia WHERE clave = $1", [clave]) as { n: number }[];
    expect(fila!.n).toBe(1);                                              // una sola clave de idempotencia, sin duplicados
    if (op.nombre === 'enviarCotizacion003' || op.nombre === 'actualizarCotizacion003') expect(d.cotizaciones_versiones).toBe(1);
    if (op.nombre === 'enviarAclaracion003') expect(d.cotizaciones_aclaraciones).toBe(1);
    if (op.nombre === 'enviarCotizacion003') expect(d.cotizaciones).toBe(1);
    expect(await violaciones()).toEqual([]);
    await sinResiduos();
    anotar('CA-ERR-02', `${op.nombre}: 40P01 transitorio`, `${op.exito} con reintento`, `${res.status}`);
  }, 120000);

  test.each(OPS.filter(([, o]) => o.unaTransaccion).flatMap(([n, o]) => [['40P01', n, o], ['40001', n, o]] as const))(
    'conflicto persistente %s en %s: 2 reintentos y 409 CONFLICTO_CONCURRENTE, sin cambios; luego la misma clave funciona', async (sqlstate, _n, op) => {
      const llamar = await op.preparar();
      const clave = randomUUID(); const antes = await instantanea();
      await inyectar(op.tabla, sqlstate, 1000);
      let res: request.Response; let conteo: { disparos: number };
      try { res = await llamar(clave); } finally { conteo = await retirarInyeccion(op.tabla); }
      expect([op.nombre, res.status, res.body.codigo]).toEqual([op.nombre, 409, 'CONFLICTO_CONCURRENTE']);
      expect(conteo.disparos).toBe(3);                                       // 1 intento + 2 reintentos (política aprobada), ni más ni menos: cada intento falla en su primera escritura
      await validarRespuesta003('C003Error409', res.body);
      sinDetalles(res.body);
      expect(await instantanea()).toBe(antes);                              // todo revertido: filas, versiones, avisos, bitácora, claves y objetos
      await sinResiduos();
      // No quedó la clave envenenada ni estado a medias: con la misma clave, ahora sí.
      const ok = await llamar(clave);
      expect([op.nombre, ok.status]).toEqual([op.nombre, op.exito]);
      expect(await violaciones()).toEqual([]);
      anotar('CA-ERR-02', `${op.nombre}: ${sqlstate} persistente`, '409 CONFLICTO_CONCURRENTE tras 3 intentos', `${res.status} ${res.body.codigo} tras ${conteo.disparos}`);
    }, 120000);

  test('la espera de bloqueo (55P03) se traduce a CONFLICTO_CONCURRENTE sin reintentar (no es un interbloqueo) y revierte todo', async () => {
    const { c } = await conCotizacion(); const clave = randomUUID(); const antes = await instantanea();
    await inyectar('cotizaciones_versiones', '55P03', 1000);
    let res: request.Response; let conteo: { disparos: number };
    try { res = await e.actualizarCotizacion(tBeto, c.cotizacionId, { ...cuerpoDefinitiva(1), versionCotizacion: c.version }, clave); } finally { conteo = await retirarInyeccion('cotizaciones_versiones'); }
    expect([res.status, res.body.codigo]).toEqual([409, 'CONFLICTO_CONCURRENTE']);
    expect(conteo.disparos).toBe(1);
    expect(await instantanea()).toBe(antes);
  });
});

// ─── 4 · CA-ERR-03: fallo inesperado de infraestructura ───────────────────────────────────────────────────────────────
describe('CA-ERR-03 · un fallo inesperado de infraestructura no deja estado parcial ni expone detalles', () => {
  const INESPERADOS = ['XX000', '58030', '53300', '57014', 'P0001'] as const;
  test.each(OPS.flatMap(([n, o]) => INESPERADOS.map(code => [code, n, o] as const)))('SQLSTATE %s en %s: 503 DEPENDENCIA_NO_DISPONIBLE, sin reintento, sin cambios y sin detalles; la misma clave funciona después', async (sqlstate, _n, op) => {
    const llamar = await op.preparar();
    const clave = randomUUID(); const antes = await instantanea();
    await inyectar(op.tabla, sqlstate, 1000);
    let res: request.Response; let conteo: { disparos: number };
    try { res = await llamar(clave); } finally { conteo = await retirarInyeccion(op.tabla); }
    expect(conteo.disparos).toBeGreaterThanOrEqual(1);                      // el fallo se produjo dentro de la operación real, después de otras escrituras
    expect([op.nombre, sqlstate, res.status, res.body.codigo]).toEqual([op.nombre, sqlstate, 503, 'DEPENDENCIA_NO_DISPONIBLE']);   // no se convierte en conflicto de negocio
    if (op.unaTransaccion) expect(conteo.disparos).toBe(1);                 // los errores inesperados no se reintentan: un solo intento
    await validarRespuesta003('C003Error503', res.body);
    sinDetalles(res.body);
    sinDetalles(res.headers);
    const despues = await instantaneaIgualA(antes);
    expect(despues).toBe(antes);                                            // atomicidad: ni filas, ni versiones, ni avisos, ni bitácora, ni claves, ni objetos huérfanos
    await sinResiduos();
    const ok = await llamar(clave);                                         // la clave no quedó asociada a un resultado parcial
    expect([op.nombre, ok.status]).toEqual([op.nombre, op.exito]);
    expect(await violaciones()).toEqual([]);
    anotar('CA-ERR-03', `${op.nombre}: ${sqlstate}`, '503 DEPENDENCIA_NO_DISPONIBLE y sin cambios', `${res.status} ${res.body.codigo}`);
  }, 120000);

  test('un fallo de lectura inesperado también responde 503 genérico, sin detalles y sin modificar datos', async () => {
    const { c } = await conCotizacion(); const antes = await instantanea();
    await e.db.query('ALTER TABLE cotizaciones_versiones RENAME TO t091_oculta');
    let res: request.Response;
    try { res = await e.cotizacion(tD, c.cotizacionId); } finally { await e.db.query('ALTER TABLE t091_oculta RENAME TO cotizaciones_versiones'); }
    expect([res.status, res.body.codigo]).toEqual([503, 'DEPENDENCIA_NO_DISPONIBLE']);
    sinDetalles(res.body);
    expect(await instantanea()).toBe(antes);
    expect((await e.cotizacion(tD, c.cotizacionId)).status).toBe(200);
  });
});

// ─── 5 · Resumen verificable ──────────────────────────────────────────────────────────────────────────────────────────
describe('cobertura de CA-ERR-01 a CA-ERR-03', () => {
  test('cada código de conflicto de la tabla de errores aprobada tiene al menos un escenario ejecutado en esta suite o una referencia explícita', () => {
    const ejecutados = new Set(registro.filter(r => r.bloque === 'CA-ERR-01').map(r => r.esperado.split(' ')[1]));
    // Los dos códigos de almacenamiento que exigen manipular el reloj o el objeto se verifican, con integridad, en `archivos-solicitud.spec.ts` (CA-ARC-12);
    // el límite de tamaño (413) en la misma suite (CA-ARC-03). Aquí se listan para que ninguno quede sin dueño.
    const delegados = new Set(['ARCHIVO_NO_LISTO', 'ARCHIVO_EXPIRADO', 'ARCHIVO_DEMASIADO_GRANDE']);
    const tabla = ['DATOS_INVALIDOS', 'SOLICITUD_INCOMPLETA', 'COTIZACION_INCOMPLETA', 'CAMPO_NO_MODIFICABLE', 'VERSION_DESACTUALIZADA', 'SOLICITUD_MODIFICADA', 'SOLICITUD_NO_ABIERTA',
      'COTIZACION_EXISTENTE', 'COTIZACION_RETIRADA', 'CLAVE_IDEMPOTENCIA_REUTILIZADA', 'CONFLICTO_CONCURRENTE', 'COTIZACION_PROPIA', 'LIMITE_ARCHIVOS', 'ARCHIVO_NO_LISTO', 'ARCHIVO_EXPIRADO',
      'DATOS_PERSONALES_EN_TEXTO', 'LIMITE_ACLARACIONES', 'LIMITE_COMPARACION', 'IMAGEN_FORMATO_NO_ADMITIDO', 'ARCHIVO_DEMASIADO_GRANDE', 'RECURSO_NO_DISPONIBLE', 'DEPENDENCIA_NO_DISPONIBLE'];
    const concurrente = registro.some(r => r.bloque === 'CA-ERR-02' && r.obtenido.includes('CONFLICTO_CONCURRENTE'));
    const infra = registro.some(r => r.bloque === 'CA-ERR-03');
    const sinCubrir = tabla.filter(c => !ejecutados.has(c) && !delegados.has(c) && !(c === 'CONFLICTO_CONCURRENTE' && concurrente) && !(c === 'DEPENDENCIA_NO_DISPONIBLE' && infra));
    expect(sinCubrir).toEqual([]);
  });
});
