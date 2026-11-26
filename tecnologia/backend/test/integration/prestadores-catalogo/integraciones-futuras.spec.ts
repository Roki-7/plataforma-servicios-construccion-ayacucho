import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { crearAplicacionCompleta002 } from '../../../src/composicion/aplicacion-002.js';
import { aplicarMigraciones002 } from '../../../src/composicion/migraciones-002.js';
import { ELEGIBILIDAD_SERVICIO_002 } from '../../../src/composicion/servicios-002.js';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import type { ElegibilidadServicio } from '../../../src/modulos/catalogo/api-publica.js';
import type { FuentesPublicas } from '../../../src/modulos/prestadores/aplicacion/perfil-publico.js';
import { validarRespuesta002 } from '../../soporte/prestadores-catalogo/contrato-002.js';
import { baseAislada002 } from '../../soporte/prestadores-catalogo/postgres.js';
import { configuracionDePrueba002 } from '../../soporte/prestadores-catalogo/entorno.js';
import { almacenDePrueba002, type CuentaPrueba } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';
import { cat, prest, serv } from '../../soporte/prestadores-catalogo/fixtures-hu05.js';
import { montarHu25, type EntornoHu25 } from '../../soporte/prestadores-catalogo/fixtures-hu25.js';

/**
 * Límites de integración de la 002 con 003, 004, 007, 008, 011 y 012, SIN desplegar ninguna de esas funcionalidades.
 *
 * Alcance y distinción importante: aquí la 002 ensaya su propio contrato de elegibilidad (`ElegibilidadServicio`, el evaluador real, no una copia de su lógica).
 * `guardarSolicitud` es solo un DOBLE de la 003: evalúa con transacción e inserta en una tabla de prueba. Demuestra que Catálogo ofrece lo que la 003 necesita,
 * pero NO sustituye la prueba de integración de la 003, que deberá validar la escritura real de solicitudes cuando exista (spec 002, límites con otras funcionalidades).
 * Se ejecuta sobre bases descartables `ayacucho_002_test_*`.
 */
let fuentes: FuentesPublicas = { calificaciones: false, verificaciones: false };
let e: EntornoHu25; let op: CuentaPrueba; let elegibilidad: ElegibilidadServicio;
const sinFuentes = (): FuentesPublicas => ({ calificaciones: false, verificaciones: false });

beforeAll(async () => {
  e = await montarHu25({ busqueda: { fuentes: () => fuentes } });
  op = await e.cuenta(); await e.habilitar(op);
  elegibilidad = e.app.get<ElegibilidadServicio>(ELEGIBILIDAD_SERVICIO_002);
  // Tablas de prueba que representan lo que otros módulos futuros guardarán. No son parte de la 002: viven solo en esta base descartable.
  await e.db.query(`CREATE TABLE referencias_prueba_002 (id uuid PRIMARY KEY, servicio_id uuid NOT NULL REFERENCES catalogo_servicios(id) ON DELETE RESTRICT,
    tipo text NOT NULL CHECK (tipo IN ('SOLICITUD','COTIZACION','CONTRATACION')))`);
  await e.db.query(`CREATE TABLE solicitudes_prueba_002 (id uuid PRIMARY KEY, servicio_id uuid NOT NULL REFERENCES catalogo_servicios(id) ON DELETE RESTRICT)`);
}, 180000);
afterAll(async () => { await e?.cerrar(); });

const titular = () => e.datos.titular.token;
const publicar = async (titulo: string, categoriaId: string = cat.H1a) => (await e.publicar(titular(), { titulo, descripcion: 'Descripción ficticia', categoriaId }).expect(201)).body as { servicioId: string; version: number };
const estadoServicio = async (id: string) => ((await e.db.query('SELECT estado,version FROM catalogo_servicios WHERE id=$1', [id])) as { estado: string; version: number }[])[0]!;
const referenciasDe = async (id: string) => ((await e.db.query('SELECT tipo FROM referencias_prueba_002 WHERE servicio_id=$1 ORDER BY tipo', [id])) as { tipo: string }[]).map(r => r.tipo);
const solicitudesDe = async (id: string) => Number(((await e.db.query('SELECT count(*)::int AS n FROM solicitudes_prueba_002 WHERE servicio_id=$1', [id])) as { n: number }[])[0]!.n);
const sembrarReferencias = async (id: string) => { for (const tipo of ['SOLICITUD', 'COTIZACION', 'CONTRATACION']) await e.db.query('INSERT INTO referencias_prueba_002(id,servicio_id,tipo) VALUES($1,$2,$3)', [randomUUID(), id, tipo]); };
const TRES = ['CONTRATACION', 'COTIZACION', 'SOLICITUD'];

/** Doble de la 003: evalúa con transacción (bloqueo compartido de la revisión) y guarda en la misma unidad de trabajo solo si el servicio es elegible. */
const guardarSolicitud = (servicioId: string) => e.uow.ejecutar(async (tx) => {
  const evaluacion = await elegibilidad.evaluar(servicioId, tx);
  if (!evaluacion.elegible) throw new ErrorAplicacion(409, 'SERVICIO_NO_ELEGIBLE', `Servicio no elegible: ${evaluacion.motivo}.`, []);
  await e.uow.runner(tx).query('INSERT INTO solicitudes_prueba_002(id,servicio_id) VALUES($1,$2)', [randomUUID(), servicioId]);
  return evaluacion;
});

/** Mantiene abierta una transacción que ya evaluó el servicio (bloqueo compartido de la revisión) hasta `liberar()`. */
async function retenerEvaluacion(servicioId: string) {
  let liberar!: () => void; const espera = new Promise<void>(r => { liberar = r; });
  let lista!: () => void; const evaluada = new Promise<void>(r => { lista = r; });
  let pid = 0;
  const resultado = e.uow.ejecutar(async (tx) => {
    const r = await elegibilidad.evaluar(servicioId, tx);
    pid = Number(((await e.uow.runner(tx).query('SELECT pg_backend_pid() AS pid')) as { pid: number }[])[0]!.pid);
    lista(); await espera; return r;
  });
  await evaluada;
  /** Idempotente: libera la transacción retenida y espera a que se cierre (commit y conexión devuelta al pool), aunque haya fallado. */
  const cerrar = async () => { liberar(); await asentar(resultado); };
  return { pid, resultado, liberar, cerrar };
}

/** Espera a que una promesa (o petición de supertest) termine, con éxito o con error, sin relanzar el error. */
async function asentar(p: PromiseLike<unknown> | undefined): Promise<void> { if (p) await Promise.resolve(p).then(() => undefined, () => undefined); }

/**
 * Ejecuta `trabajo` y después `limpieza`, de modo que la limpieza corra SIEMPRE. Si el trabajo falla, se relanza ese error ORIGINAL: un fallo de la limpieza
 * solo se informa por stderr y no lo oculta. Si el trabajo termina bien, un fallo de la limpieza sí hace fallar la prueba.
 */
async function conLimpieza(trabajo: () => Promise<void>, limpieza: () => Promise<void>): Promise<void> {
  try { await trabajo(); }
  catch (error) {
    try { await limpieza(); } catch (fallo) { process.stderr.write(`La limpieza de la prueba también falló: ${fallo instanceof Error ? fallo.message : String(fallo)}\n`); }
    throw error;
  }
  await limpieza();
}

/** Deja la categoría activa sea cual sea el estado en que la dejó la prueba. Idempotente: si ya está activa no hace nada. */
const restaurarCategoria = async (id: string): Promise<void> => {
  const fila = await e.filaCategoria(id);
  if (fila['activa'] === true) return;
  await e.activar(op.token, id, { version: fila['version'] as number, motivo: 'Restituir tras la prueba' }).expect(200);
};
/** Previsualiza y confirma la desactivación de una categoría con su versión vigente. */
const desactivarCategoria = async (id: string, motivo: string): Promise<void> => {
  const version = (await e.filaCategoria(id))['version'] as number;
  const previa = (await e.previsualizar(op.token, id, { version }).expect(201)).body as { confirmacionId: string };
  await e.desactivar(op.token, id, { confirmacionId: previa.confirmacionId, version, motivo }).expect(200);
};

interface Espera { readonly pid: number; readonly bloqueantes: number[]; readonly tipo: string; readonly consulta: string }
/** Backends de ESTA base que esperan un bloqueo, con quién los bloquea (`pg_stat_activity` y `pg_blocking_pids`). */
const esperas = async (): Promise<Espera[]> => ((await e.db.query(`SELECT a.pid, a.wait_event_type AS tipo, pg_blocking_pids(a.pid) AS bloqueantes, a.query AS consulta
  FROM pg_stat_activity a WHERE a.datname = current_database() AND a.pid <> pg_backend_pid() AND a.wait_event_type = 'Lock'`)) as { pid: number; tipo: string; bloqueantes: number[]; consulta: string }[])
  .map(f => ({ pid: Number(f.pid), tipo: f.tipo, bloqueantes: (f.bloqueantes ?? []).map(Number), consulta: f.consulta }));
/** Espera (hasta 4 s, menos que el `lock_timeout` de 5 s de la unidad de trabajo) a que un backend esté bloqueado por `pid`. */
async function esperaBloqueadaPor(pid: number): Promise<Espera | undefined> {
  const limite = Date.now() + 4000;
  while (Date.now() < limite) { const f = (await esperas()).find(x => x.bloqueantes.includes(pid)); if (f) return f; await new Promise(r => setTimeout(r, 40)); }
  return undefined;
}

describe('003: elegibilidad bajo bloqueo (ensayo de la 002 con un doble de solicitudes)', () => {
  test('las evaluaciones transaccionales comparten el bloqueo: dos a la vez no se esperan entre sí', async () => {
    const s = await publicar('Elegibilidad compartida');
    let a: Awaited<ReturnType<typeof retenerEvaluacion>> | undefined;
    await conLimpieza(async () => {
      a = await retenerEvaluacion(s.servicioId);
      // Con A abierta (bloqueo compartido), B evalúa y termina sin esperar: no hay ningún backend bloqueado.
      const b = await e.uow.ejecutar(async (tx) => elegibilidad.evaluar(s.servicioId, tx));
      expect(b).toEqual({ servicioId: s.servicioId, elegible: true });
      expect(await esperas()).toEqual([]);
      a.liberar();
      expect(await a.resultado).toEqual({ servicioId: s.servicioId, elegible: true });
    }, async () => { await a?.cerrar(); });
  }, 60000);

  test('un cambio de elegibilidad por pausa espera al commit de la evaluación y lo demuestra pg_blocking_pids', async () => {
    const s = await publicar('Pausa tras evaluación');
    let a: Awaited<ReturnType<typeof retenerEvaluacion>> | undefined; let pausa: ReturnType<typeof e.transicionar> | undefined; let terminada = false;
    await conLimpieza(async () => {
      a = await retenerEvaluacion(s.servicioId);
      pausa = e.transicionar(titular(), s.servicioId, { version: s.version, destino: 'PAUSADO' });
      void Promise.resolve(pausa).then(() => { terminada = true; }, () => { terminada = true; });
      const espera = await esperaBloqueadaPor(a.pid);
      expect(espera).toBeDefined();
      expect(espera!.tipo).toBe('Lock');
      expect(espera!.consulta).toMatch(/catalogo_revision_oferta[\s\S]*FOR UPDATE/);
      expect(terminada).toBe(false);
      a.liberar();
      expect((await a.resultado).elegible).toBe(true);
      expect((await pausa).status).toBe(200);
      expect(await esperas()).toEqual([]);
      expect(await elegibilidad.evaluar(s.servicioId)).toMatchObject({ elegible: false, motivo: 'ESTADO_NO_PUBLICADO' });
    }, async () => { await a?.cerrar(); await asentar(pausa); });
  }, 60000);

  test('desactivar una categoría (RF39) espera al commit de la evaluación y el servicio queda inelegible por su clasificación', async () => {
    expect(await elegibilidad.evaluar(serv.s6)).toEqual({ servicioId: serv.s6, elegible: true });
    const version = (await e.filaCategoria(cat.H2a))['version'] as number;
    const previa = (await e.previsualizar(op.token, cat.H2a, { version }).expect(201)).body as { confirmacionId: string };
    let a: Awaited<ReturnType<typeof retenerEvaluacion>> | undefined; let desactivacion: ReturnType<typeof e.desactivar> | undefined; let terminada = false;
    // La limpieza corre siempre: cierra la transacción retenida, deja que la desactivación en vuelo termine y reactiva la categoría, sin ocultar el error original.
    await conLimpieza(async () => {
      a = await retenerEvaluacion(serv.s6);
      desactivacion = e.desactivar(op.token, cat.H2a, { confirmacionId: previa.confirmacionId, version, motivo: 'Prueba de límite con la 003' });
      void Promise.resolve(desactivacion).then(() => { terminada = true; }, () => { terminada = true; });
      const espera = await esperaBloqueadaPor(a.pid);
      expect(espera).toBeDefined();
      expect(espera!.consulta).toMatch(/catalogo_revision_oferta[\s\S]*FOR UPDATE/);
      expect(terminada).toBe(false);
      expect(await e.filaCategoria(cat.H2a)).toMatchObject({ activa: true, version });
      a.liberar();
      expect((await a.resultado).elegible).toBe(true);
      expect((await desactivacion).status).toBe(200);
      expect(await elegibilidad.evaluar(serv.s6)).toMatchObject({ elegible: false, motivo: 'CLASIFICACION_INACTIVA' });
      expect(await estadoServicio(serv.s6)).toEqual({ estado: 'PUBLICADO', version: 1 });
    }, async () => { await a?.cerrar(); await asentar(desactivacion); await restaurarCategoria(cat.H2a); });
    expect(await e.filaCategoria(cat.H2a)).toMatchObject({ activa: true });
    expect(await esperas()).toEqual([]);
    expect(await elegibilidad.evaluar(serv.s6)).toEqual({ servicioId: serv.s6, elegible: true });
  }, 60000);

  const inelegibles: [string, (id: string, version: number) => Promise<void>, string][] = [
    ['se pausa', async (id, version) => { await e.transicionar(titular(), id, { version, destino: 'PAUSADO' }).expect(200); }, 'ESTADO_NO_PUBLICADO'],
    ['se retira', async (id, version) => { await e.transicionar(titular(), id, { version, destino: 'RETIRADO' }).expect(200); }, 'ESTADO_NO_PUBLICADO'],
  ];
  test.each(inelegibles)('un servicio consultado como elegible que luego %s: la solicitud se rechaza sin guardar nada', async (_cambio, cambiar, motivo) => {
    const s = await publicar(`Elegible y luego inelegible ${motivo}`);
    expect(await elegibilidad.evaluar(s.servicioId)).toEqual({ servicioId: s.servicioId, elegible: true }); // consulta previa, sin transacción
    await cambiar(s.servicioId, s.version);
    await expect(guardarSolicitud(s.servicioId)).rejects.toMatchObject({ http: 409, codigo: 'SERVICIO_NO_ELEGIBLE' });
    expect(await solicitudesDe(s.servicioId)).toBe(0);
  }, 60000);

  test('la clasificación desactivada tras una consulta previa también rechaza la solicitud sin guardarla, y reactivarla la admite', async () => {
    expect(await elegibilidad.evaluar(serv.s6)).toEqual({ servicioId: serv.s6, elegible: true });
    const antes = await solicitudesDe(serv.s6);
    await conLimpieza(async () => {
      await desactivarCategoria(cat.H2a, 'Prueba de límite con la 003');
      await expect(guardarSolicitud(serv.s6)).rejects.toMatchObject({ http: 409, codigo: 'SERVICIO_NO_ELEGIBLE' });
      expect(await solicitudesDe(serv.s6)).toBe(antes);
      await restaurarCategoria(cat.H2a);
      await expect(guardarSolicitud(serv.s6)).resolves.toEqual({ servicioId: serv.s6, elegible: true });
      expect(await solicitudesDe(serv.s6)).toBe(antes + 1);
    }, () => restaurarCategoria(cat.H2a));
    expect(await e.filaCategoria(cat.H2a)).toMatchObject({ activa: true });
  }, 60000);
});

describe('004: las referencias históricas sobreviven a pausar, retirar y desactivar la categoría', () => {
  test('pausar, reactivar y retirar conservan el registro y las tres referencias; un disparador de PostgreSQL impide borrar el servicio', async () => {
    const s = await publicar('Referencias con ciclo de vida');
    await guardarSolicitud(s.servicioId); await sembrarReferencias(s.servicioId);
    expect(await referenciasDe(s.servicioId)).toEqual(TRES);
    await e.transicionar(titular(), s.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    expect(await referenciasDe(s.servicioId)).toEqual(TRES); expect(await solicitudesDe(s.servicioId)).toBe(1);
    await e.transicionar(titular(), s.servicioId, { version: 2, destino: 'PUBLICADO' }).expect(200);
    await e.transicionar(titular(), s.servicioId, { version: 3, destino: 'RETIRADO' }).expect(200);
    expect(await referenciasDe(s.servicioId)).toEqual(TRES); expect(await solicitudesDe(s.servicioId)).toBe(1);
    expect(await elegibilidad.registro(s.servicioId)).toMatchObject({ servicioId: s.servicioId, estado: 'RETIRADO', version: 4 });
    expect(await elegibilidad.evaluar(s.servicioId)).toMatchObject({ elegible: false, motivo: 'ESTADO_NO_PUBLICADO' });
    await e.servicio(s.servicioId).expect(404); // fuera de la oferta pública, pero con su registro y sus referencias
    // Mecanismo comprobado: un disparador BEFORE DELETE de PostgreSQL (migración de servicios de Catálogo), incondicional y con el código 23514. No es una regla de dominio
    // ni una clave foránea: actúa antes que cualquier restricción de referencias, por lo que la clave foránea de los dobles de prueba no llega a ejercerse aquí.
    const disparadores = (await e.db.query(`SELECT pg_get_triggerdef(oid) AS definicion FROM pg_trigger WHERE tgrelid='catalogo_servicios'::regclass AND tgname='catalogo_servicio_conservado' AND tgenabled='O'`)) as { definicion: string }[];
    expect(disparadores).toHaveLength(1);
    expect(disparadores[0]!.definicion).toMatch(/BEFORE DELETE ON public\.catalogo_servicios FOR EACH ROW/);
    await expect(e.db.query('DELETE FROM catalogo_servicios WHERE id=$1', [s.servicioId])).rejects.toMatchObject({ message: 'Los servicios no se eliminan: se conservan sus referencias históricas', code: '23514' });
    expect(await estadoServicio(s.servicioId)).toEqual({ estado: 'RETIRADO', version: 4 });
  }, 60000);

  test('desactivar y reactivar la categoría conserva estado, versión, registro y referencias del servicio PUBLICADO', async () => {
    await sembrarReferencias(serv.s6);
    const solicitudes = await solicitudesDe(serv.s6);
    const antes = await estadoServicio(serv.s6);
    const version = (await e.filaCategoria(cat.H2a))['version'] as number;
    const previa = (await e.previsualizar(op.token, cat.H2a, { version }).expect(201)).body as { confirmacionId: string; afectados: number };
    expect(previa.afectados).toBe(1);
    await conLimpieza(async () => {
      await e.desactivar(op.token, cat.H2a, { confirmacionId: previa.confirmacionId, version, motivo: 'Conservación de referencias' }).expect(200);
      expect(await estadoServicio(serv.s6)).toEqual(antes); expect(antes.estado).toBe('PUBLICADO');
      expect(await referenciasDe(serv.s6)).toEqual(TRES); expect(await solicitudesDe(serv.s6)).toBe(solicitudes);
      expect(await elegibilidad.registro(serv.s6)).toMatchObject({ servicioId: serv.s6, estado: 'PUBLICADO', categoriaId: cat.H2a });
      await e.servicio(serv.s6).expect(404);
      expect((await e.perfilPublico(prest.C).expect(200)).body.servicios.elementos).toHaveLength(0);
    }, () => restaurarCategoria(cat.H2a));
    expect(await e.filaCategoria(cat.H2a)).toMatchObject({ activa: true });
    expect(await referenciasDe(serv.s6)).toEqual(TRES);
    await e.servicio(serv.s6).expect(200);
  }, 60000);
});

/** Claves de un objeto JSON, en cualquier profundidad. */
const claves = (v: unknown): string[] => Array.isArray(v) ? v.flatMap(claves) : v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => [k, ...claves(x)]) : [];
const sinAvisos = (cuerpo: Record<string, unknown>) => Object.fromEntries(Object.entries(cuerpo).filter(([k]) => k !== 'avisos'));

describe('011 y 012: avisos independientes sin fuentes desplegadas', () => {
  const casos: [string, FuentesPublicas, string | null, string | null][] = [
    ['ninguna fuente', { calificaciones: false, verificaciones: false }, 'Calificaciones aún no disponibles', 'Verificaciones aún no disponibles'],
    ['solo calificaciones (011)', { calificaciones: true, verificaciones: false }, null, 'Verificaciones aún no disponibles'],
    ['solo verificaciones (012)', { calificaciones: false, verificaciones: true }, 'Calificaciones aún no disponibles', null],
    ['ambas fuentes', { calificaciones: true, verificaciones: true }, null, null],
  ];
  test.each(casos)('%s: cada aviso depende solo de su fuente y no se inventan calificaciones, estrellas ni insignias', async (_n, disponibles, calificaciones, verificaciones) => {
    fuentes = disponibles;
    try {
      const perfil = (await e.perfilPublico(prest.A).expect(200)).body as Record<string, unknown>;
      expect(perfil['avisos']).toEqual({ calificaciones, verificaciones });
      const lecturas = [sinAvisos(perfil), (await e.prestadores('?tamano=50').expect(200)).body, (await e.servicios('?tamano=50').expect(200)).body, (await e.servicio(serv.s1).expect(200)).body];
      for (const lectura of lecturas) expect(claves(lectura).filter(k => /calific|punt|estrella|valorac|verificad|insignia|rating|score/i.test(k))).toEqual([]);
      expect(JSON.stringify(perfil)).not.toMatch(/Sin valoraciones/);
    } finally { fuentes = sinFuentes(); }
  }, 60000);

  test('cambiar la disponibilidad de una fuente solo altera su aviso: el resto de las respuestas públicas es idéntico', async () => {
    const leer = async (disponibles: FuentesPublicas) => {
      fuentes = disponibles;
      try { return { perfil: sinAvisos((await e.perfilPublico(prest.A).expect(200)).body), prestadores: (await e.prestadores('?tamano=50').expect(200)).body, servicios: (await e.servicios('?tamano=50').expect(200)).body }; }
      finally { fuentes = sinFuentes(); }
    };
    const base = await leer({ calificaciones: false, verificaciones: false });
    for (const [, disponibles] of casos.slice(1)) expect(await leer(disponibles)).toEqual(base);
  }, 60000);

  test('la 002 no ofrece filtro por calificación aunque la fuente de la 011 esté disponible', async () => {
    fuentes = { calificaciones: true, verificaciones: true };
    try { for (const q of ['calificacion=5', 'calificacionMinima=4', 'verificado=true']) await e.servicios(`?${q}`).expect(400); }
    finally { fuentes = sinFuentes(); }
  }, 60000);
});

describe('007 y 008: solo búsqueda por filtros y consulta de la oferta; sin contacto ni interpretación asistida', () => {
  test('los parámetros de interpretación asistida, contacto o visitas se rechazan y no cambian los resultados', async () => {
    const base = (await e.servicios('?tamano=50').expect(200)).body;
    for (const q of ['consulta=albañil+barato', 'lenguajeNatural=necesito+un+electricista', 'ia=true', 'contacto=true', 'visita=true']) {
      expect((await e.servicios(`?${q}`)).status).toBe(400);
      expect((await e.prestadores(`?${q}`)).status).toBe(400);
    }
    expect((await e.servicios('?tamano=50').expect(200)).body).toEqual(base);
  }, 60000);

  test('las proyecciones públicas cumplen el contrato cerrado de la 002 (sin campos adicionales) y no traen contacto ni medios para agendar visitas', async () => {
    const lecturas: [string, unknown][] = [['C002PaginaServicios', (await e.servicios('?tamano=50').expect(200)).body], ['C002PaginaPrestadores', (await e.prestadores('?tamano=50').expect(200)).body],
      ['C002ServicioPublico', (await e.servicio(serv.s1).expect(200)).body], ['C002PrestadorPublico', (await e.perfilPublico(prest.A).expect(200)).body]];
    for (const [esquema, lectura] of lecturas) {
      await validarRespuesta002(esquema, lectura); // los esquemas usan additionalProperties: false
      expect(claves(lectura).filter(k => /contact|telefon|whatsapp|correo|email|visita|agenda|reserva|cita|mensaje|chat|cotiz|solicitud|contrat|pago/i.test(k))).toEqual([]);
    }
  }, 60000);
});

describe('ausencia de funcionalidades futuras en la composición completa de 40 operaciones', () => {
  type Aplicacion = Awaited<ReturnType<typeof crearAplicacionCompleta002>>;
  const futuras = /solicitud|cotizaci|contrataci|contrato|calificaci|valoraci|resena|verificaci|insignia|visita|contacto|asistid|interpret|conversaci|mensaje|pago|disputa|cancelaci/i;
  const tablas001 = ['usuarios', 'perfiles_habilitados', 'sesiones', 'claves_idempotencia', 'avisos_pendientes', 'fotografias_perfil', 'recuperaciones_acceso', 'consentimientos_telefono', 'cambios_correo'];
  const rutas = (app: Aplicacion) => ((app.app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } }).router.stack
    .flatMap(({ route }) => route ? Object.keys(route.methods).map(m => `${m.toUpperCase()} ${route.path.replace(/^\/api\/v1/, '').replace(/:(\w+)/g, '{$1}')}`) : [])).sort();
  const operaciones = async (archivo: string) => { const o = JSON.parse(await readFile(resolve('contracts', archivo), 'utf8')) as { paths: Record<string, Record<string, unknown>> };
    return Object.entries(o.paths).flatMap(([p, ms]) => Object.keys(ms).filter(m => ['get', 'post', 'put', 'patch', 'delete'].includes(m)).map(m => `${m.toUpperCase()} ${p}`)).sort(); };

  let base: Awaited<ReturnType<typeof baseAislada002>>; let almacen: Awaited<ReturnType<typeof almacenDePrueba002>>; let app: Aplicacion;
  beforeAll(async () => {
    almacen = await almacenDePrueba002(); base = await baseAislada002();
    await aplicarMigraciones002(base.url);
    app = await crearAplicacionCompleta002(await configuracionDePrueba002(base.url), { prestadores: { almacen: almacen.almacen }, worker: false });
  }, 180000);
  afterAll(async () => { try { await app?.app.close(); } finally { try { await base?.cerrar(); } finally { await almacen?.limpiar(); } } });

  test('el inventario real de rutas es exactamente la unión de los dos contratos y no contiene rutas de funcionalidades futuras', async () => {
    const esperadas = [...await operaciones('openapi.json'), ...await operaciones('prestadores-catalogo.openapi.json')].sort();
    expect(esperadas).toHaveLength(40);
    const reales = rutas(app);
    expect(reales).toEqual(esperadas);
    expect(reales.filter(r => futuras.test(r))).toEqual([]);
  }, 60000);

  test('el esquema solo contiene tablas de la 001 y de Prestadores, Catálogo y Administración, sin tablas ni migraciones de funcionalidades futuras', async () => {
    const tablas = ((await app.db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")) as { table_name: string }[]).map(t => t.table_name);
    expect(tablas.length).toBeGreaterThan(20);
    const ajenas = tablas.filter(t => !tablas001.includes(t) && !/^(catalogo|prestadores|administracion)_/.test(t) && !['migrations', 'typeorm_metadata'].includes(t));
    expect(ajenas).toEqual([]);
    expect(tablas.filter(t => futuras.test(t))).toEqual([]);
    const columnasFuturas = ((await app.db.query(`SELECT table_name||'.'||column_name AS c FROM information_schema.columns WHERE table_schema='public' AND table_name LIKE ANY(ARRAY['catalogo\\_%','prestadores\\_%','administracion\\_%'])`)) as { c: string }[]).map(r => r.c);
    expect(columnasFuturas.filter(c => /solicitud|cotizaci|contrataci|calificaci|valoraci|verificaci/i.test(c))).toEqual([]);
    const esquemas = ((await app.db.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('public','information_schema') AND schema_name NOT LIKE 'pg\\_%'")) as { schema_name: string }[]);
    expect(esquemas).toEqual([]);
    const migraciones = ((await app.db.query('SELECT name FROM migrations')) as { name: string }[]).map(m => m.name);
    expect(migraciones.length).toBeGreaterThan(8);
    expect(migraciones.filter(m => futuras.test(m))).toEqual([]);
  }, 60000);

  test('no hay datos de funcionalidades futuras: la base recién migrada solo trae los distritos y la revisión de Catálogo, sin servicios, solicitudes ni referencias', async () => {
    const cuenta = async (tabla: string) => Number(((await app.db.query(`SELECT count(*)::int AS n FROM ${tabla}`)) as { n: number }[])[0]!.n);
    expect(await cuenta('catalogo_distritos')).toBe(5);
    expect(await cuenta('catalogo_revision_oferta')).toBe(1);
    for (const t of ['catalogo_servicios', 'catalogo_clasificaciones', 'catalogo_proyeccion_prestadores', 'prestadores_perfiles', 'prestadores_trabajos', 'prestadores_fotografias', 'administracion_permisos']) expect(await cuenta(t)).toBe(0);
  }, 60000);

  test('las únicas tablas de solicitudes y referencias del arnés de pruebas son los dobles de prueba, ausentes de la composición completa', async () => {
    const delArnes = ((await e.db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ~* 'solicitud|cotizaci|contrataci|referencias'")) as { table_name: string }[]).map(t => t.table_name).sort();
    expect(delArnes).toEqual(['referencias_prueba_002', 'solicitudes_prueba_002']);
    const delProducto = ((await app.db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ~* 'solicitud|cotizaci|contrataci|referencias'")) as { table_name: string }[]);
    expect(delProducto).toEqual([]);
  }, 60000);
});
