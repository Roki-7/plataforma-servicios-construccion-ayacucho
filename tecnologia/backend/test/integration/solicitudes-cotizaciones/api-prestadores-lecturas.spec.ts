import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { persistencia003 } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { aplicarMigraciones003 } from '../../../src/composicion/migraciones-003.js';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { ApiPrestadores } from '../../../src/modulos/prestadores/api-publica.js';
import { RepositorioPrestadoresPostgres } from '../../../src/modulos/prestadores/infraestructura/persistencia/perfiles-y-portafolio.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';
import { ContadorSentencias } from '../../soporte/solicitudes-cotizaciones/contador-sentencias.js';

// Lecturas aditivas de Prestadores para la 003 (T016): FR-302, FR-305, FR-333 y FR-343. Base descartable `ayacucho_003_test_*`.
let base: Awaited<ReturnType<typeof baseAislada003>>;
let db: DataSource; let uow: UnidadDeTrabajoPostgres; let api: ApiPrestadores; let contador: ContadorSentencias;
const distritos = ['ayacucho', 'carmen-alto', 'san-juan-bautista', 'jesus-nazareno', 'andres-avelino-caceres-dorregaray'] as const;

async function crearPerfil(opciones: { nombre?: string; publicable?: boolean; zonas?: readonly string[]; especialidades?: readonly string[] } = {}) {
  const id = randomUUID(); const cuentaId = randomUUID();
  await db.query(`INSERT INTO prestadores_perfiles (id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada,publicable)
    VALUES ($1,$2,$3,'TECNICO','Experiencia ficticia',true,$4)`, [id, cuentaId, opciones.nombre ?? `Prestador ${id.slice(0, 8)}`, opciones.publicable ?? true]);
  for (const zona of opciones.zonas ?? []) await db.query('INSERT INTO prestadores_zonas (prestador_id,distrito_codigo) VALUES ($1,$2)', [id, zona]);
  for (const categoria of opciones.especialidades ?? []) await db.query('INSERT INTO prestadores_especialidades (prestador_id,categoria_id) VALUES ($1,$2)', [id, categoria]);
  return { id, cuentaId };
}
const conteos = async () => Object.fromEntries(await Promise.all((await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1") as { table_name: string }[])
  .map(async ({ table_name }) => [table_name, Number(((await db.query(`SELECT count(*)::int AS n FROM "${table_name}"`)) as { n: number }[])[0]!.n)] as const)));

beforeAll(async () => {
  base = await baseAislada003(); await aplicarMigraciones003(base.url);
  db = persistencia003(base.url, persistenciaOferta002, persistenciaOferta003); await db.initialize();
  uow = new UnidadDeTrabajoPostgres(db);
  api = new ApiPrestadores(new RepositorioPrestadoresPostgres(uow));
  contador = new ContadorSentencias().instalar(db);
}, 180000);
afterAll(async () => { contador?.liberar(); if (db?.isInitialized) await db.destroy(); await base?.cerrar(); });

describe('perfilPorId', () => {
  test('devuelve identificador, cuenta y si es publicable, y nada más', async () => {
    const p = await crearPerfil({ publicable: true }); const oculto = await crearPerfil({ publicable: false });
    expect(await api.perfilPorId(p.id)).toEqual({ prestadorId: p.id, cuentaId: p.cuentaId, publicable: true });
    expect(await api.perfilPorId(oculto.id)).toEqual({ prestadorId: oculto.id, cuentaId: oculto.cuentaId, publicable: false });
  });
  test('un perfil inexistente o un identificador mal formado devuelven null sin error de base de datos', async () => {
    expect(await api.perfilPorId(randomUUID())).toBeNull();
    for (const malo of ['', 'no-es-uuid', "'; DROP TABLE prestadores_perfiles; --", '123e4567-e89b-42d3-a456-42661417400']) expect(await api.perfilPorId(malo)).toBeNull();
    expect(Number(((await db.query('SELECT count(*)::int AS n FROM prestadores_perfiles')) as { n: number }[])[0]!.n)).toBeGreaterThan(0);
  });
  test('con la transacción del llamador ve sus propios cambios sin confirmar y sin ella no los ve', async () => {
    const id = randomUUID(); const cuentaId = randomUUID(); let fuera: unknown; let dentro: unknown;
    await uow.ejecutar(async (tx) => {
      await uow.runner(tx).query(`INSERT INTO prestadores_perfiles (id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada) VALUES ($1,$2,'Pendiente','TECNICO','x',true)`, [id, cuentaId]);
      dentro = await api.perfilPorId(id, tx); fuera = await api.perfilPorId(id);
    });
    expect(dentro).toEqual({ prestadorId: id, cuentaId, publicable: true });
    expect(fuera).toBeNull();
    expect(await api.perfilPorId(id)).toMatchObject({ prestadorId: id });
  });
});

describe('distritosDe y especialidadesDe', () => {
  test('devuelven los distritos y las categorías del prestador, ordenados y sin repeticiones', async () => {
    const [a, b] = [randomUUID(), randomUUID()];
    const p = await crearPerfil({ zonas: ['san-juan-bautista', 'ayacucho', 'jesus-nazareno'], especialidades: [b, a] });
    expect(await api.distritosDe(p.id)).toEqual(['ayacucho', 'jesus-nazareno', 'san-juan-bautista']);
    expect(await api.especialidadesDe(p.id)).toEqual([a, b].sort());
  });
  test('un prestador sin zonas ni especialidades, o inexistente, devuelve una lista vacía', async () => {
    const p = await crearPerfil();
    expect(await api.distritosDe(p.id)).toEqual([]);
    expect(await api.especialidadesDe(p.id)).toEqual([]);
    expect(await api.distritosDe(randomUUID())).toEqual([]);
    expect(await api.especialidadesDe('no-es-uuid')).toEqual([]);
  });
  test('no mezclan los datos de otro prestador', async () => {
    const x = await crearPerfil({ zonas: ['ayacucho'] }); const y = await crearPerfil({ zonas: ['carmen-alto', 'jesus-nazareno'] });
    expect(await api.distritosDe(x.id)).toEqual(['ayacucho']);
    expect(await api.distritosDe(y.id)).toEqual(['carmen-alto', 'jesus-nazareno']);
  });
  test('participan en la transacción del llamador', async () => {
    const p = await crearPerfil(); const nueva = randomUUID();
    await uow.ejecutar(async (tx) => {
      await uow.runner(tx).query('INSERT INTO prestadores_zonas (prestador_id,distrito_codigo) VALUES ($1,$2)', [p.id, distritos[1]]);
      await uow.runner(tx).query('INSERT INTO prestadores_especialidades (prestador_id,categoria_id) VALUES ($1,$2)', [p.id, nueva]);
      expect(await api.distritosDe(p.id, tx)).toEqual([distritos[1]]);
      expect(await api.especialidadesDe(p.id, tx)).toEqual([nueva]);
      expect(await api.distritosDe(p.id)).toEqual([]);
    });
  });
});

describe('nombresPublicos', () => {
  test('devuelve el nombre público de cada prestador existente y omite los inexistentes', async () => {
    const a = await crearPerfil({ nombre: 'Ana Obras' }); const b = await crearPerfil({ nombre: 'Construcciones Quinua', publicable: false });
    const inexistente = randomUUID();
    const nombres = await api.nombresPublicos([a.id, b.id, inexistente, a.id]);
    expect(Object.fromEntries(nombres)).toEqual({ [a.id]: 'Ana Obras', [b.id]: 'Construcciones Quinua' });
    expect(nombres.has(inexistente)).toBe(false);
  });
  test('una lista vacía no consulta la base de datos', async () => {
    const r = await contador.contar(() => api.nombresPublicos([]));
    expect(r.resultado.size).toBe(0);
    expect(r.total).toBe(0);
  });
  test('usa una sola consulta por página, sea cual sea su tamaño (FR-343)', async () => {
    // La preparación usa una conexión y queda fuera de la medición de las lecturas.
    const perfiles = await db.query(`
      INSERT INTO prestadores_perfiles (id, cuenta_id, nombre_publico, tipo, experiencia, disponibilidad_declarada, publicable)
      SELECT gen_random_uuid(), gen_random_uuid(), 'Prestador ' || n, 'TECNICO', 'Experiencia ficticia', true, true
      FROM generate_series(1, 50) AS serie(n)
      RETURNING id, nombre_publico
    `) as { id: string; nombre_publico: string }[];
    expect(perfiles).toHaveLength(50);
    for (const tamano of [1, 10, 50]) {
      const pagina = perfiles.slice(0, tamano);
      const { resultado, total } = await contador.contar(() => api.nombresPublicos(pagina.map(p => p.id)));
      expect(total).toBe(1);
      expect(resultado).toEqual(new Map(pagina.map(p => [p.id, p.nombre_publico])));
    }
  });
  test('rechaza más de 50 identificadores y los que no son UUID, sin consultar', async () => {
    const r = await contador.contar(async () => {
      await expect(api.nombresPublicos(Array.from({ length: 51 }, () => randomUUID()))).rejects.toThrow('50');
      await expect(api.nombresPublicos(['no-es-uuid'])).rejects.toThrow('identificador');
    });
    expect(r.total).toBe(0);
  });
});

describe('solo lectura y sin tocar tablas ajenas', () => {
  test('las cuatro lecturas y perfilPorId solo ejecutan SELECT sobre tablas de Prestadores y no cambian ninguna fila', async () => {
    const p = await crearPerfil({ zonas: ['ayacucho'], especialidades: [randomUUID()] });
    const antes = await conteos();
    const r = await contador.contar(async () => {
      await api.perfilPorId(p.id); await api.distritosDe(p.id); await api.especialidadesDe(p.id); await api.nombresPublicos([p.id]);
    });
    expect(r.total).toBe(4);
    for (const sentencia of r.sentencias) {
      expect(sentencia).toMatch(/^SELECT /i);
      expect(sentencia).not.toMatch(/\b(INSERT|UPDATE|DELETE|LOCK|FOR UPDATE)\b/i);
      const tablas = [...sentencia.matchAll(/\b(?:FROM|JOIN)\s+(\w+)/gi)].map(m => m[1]);
      for (const tabla of tablas) expect(tabla).toMatch(/^prestadores_(perfiles|zonas|especialidades)$/);
    }
    expect(await conteos()).toEqual(antes);
  });
  test('la lectura existente de 002 no cambia', async () => {
    const p = await crearPerfil();
    expect(await api.perfilDeCuenta(p.cuentaId)).toEqual({ prestadorId: p.id, version: 1 });
    expect(await api.perfilDeCuenta(randomUUID())).toBeNull();
  });
});
