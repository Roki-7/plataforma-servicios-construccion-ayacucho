import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { persistencia003 } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { aplicarMigraciones003, persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { condicionDe, traducirErrorBd } from '../../../src/compartido/infraestructura/postgres/traduccion-errores.js';
import { traducirCondicionSolicitudes } from '../../../src/modulos/solicitudes/dominio/errores.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';

// Modelo de datos de Solicitudes con PostgreSQL real (T028 / T-mod-sol): restricciones, disparadores e invariantes de data-model.md §2.
// Base descartable `ayacucho_003_test_*`. La aplicación es la primera barrera; esto verifica la segunda.
let base: Awaited<ReturnType<typeof baseAislada003>>;
let db: DataSource; let uow: UnidadDeTrabajoPostgres;

const uuid = () => randomUUID();
const codigoDe = async (promesa: Promise<unknown>) => { try { await promesa; return undefined; } catch (e) { return condicionDe(e)?.sqlstate ?? 'otro'; } };
const restriccionDe = async (promesa: Promise<unknown>) => { try { await promesa; return undefined; } catch (e) { return condicionDe(e)?.restriccion; } };
const valorDe = (v: unknown) => (v instanceof Date ? v.toISOString() : v);

/** Inserta una solicitud. Por omisión, una PUBLICADA ABIERTA completa (versión de trabajo 1). `sobre` sustituye columnas. */
async function solicitud(sobre: Record<string, unknown> = {}): Promise<string> {
  const id = uuid();
  const valores: Record<string, unknown> = {
    id, cliente_cuenta_id: uuid(), tipo: 'PUBLICADA', estado: 'ABIERTA', descripcion: 'Descripción ficticia', categoria_id: uuid(), distrito_codigo: 'ayacucho',
    fecha_desde: '2030-01-10', fecha_hasta: '2030-01-20', version_trabajo: 1, publicada_en: new Date().toISOString(), ...sobre,
  };
  const columnas = Object.keys(valores);
  await db.query(`INSERT INTO solicitudes (${columnas.join(',')}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(',')})`, columnas.map(c => valorDe(valores[c])));
  return id;
}
const borrador = (sobre: Record<string, unknown> = {}) => solicitud({ estado: 'BORRADOR', descripcion: null, categoria_id: null, distrito_codigo: null, fecha_desde: null, fecha_hasta: null, version_trabajo: 0, publicada_en: null, ...sobre });
const dirigida = (sobre: Record<string, unknown> = {}) => solicitud({ tipo: 'DIRIGIDA', prestador_id: uuid(), prestador_cuenta_id: uuid(), ...sobre });
const actualizar = (id: string, columnas: Record<string, unknown>) => {
  const claves = Object.keys(columnas);
  return db.query(`UPDATE solicitudes SET ${claves.map((c, i) => `${c}=$${i + 2}`).join(',')} WHERE id=$1`, [id, ...claves.map(c => valorDe(columnas[c]))]);
};
const fila = async (id: string) => ((await db.query('SELECT * FROM solicitudes WHERE id=$1', [id])) as Record<string, unknown>[])[0]!;

async function archivo(solicitudId: string, sobre: Record<string, unknown> = {}): Promise<string> {
  const id = uuid();
  const valores: Record<string, unknown> = {
    id, solicitud_id: solicitudId, estado: 'PREPARADO', objeto_clave: `solicitudes/${solicitudId}/${id}`, mime: 'image/webp', bytes: 1000, ancho: 800, alto: 600,
    checksum: Buffer.alloc(32, 1), caduca_en: new Date(Date.now() + 86_400_000).toISOString(), ...sobre,
  };
  const columnas = Object.keys(valores);
  await db.query(`INSERT INTO solicitudes_archivos (${columnas.join(',')}) VALUES (${columnas.map((_, i) => `$${i + 1}`).join(',')})`, columnas.map(c => valorDe(valores[c])));
  return id;
}
const contadores = async (id: string) => { const f = await fila(id); return { cantidad: Number(f['archivos_cantidad']), bytes: Number(f['archivos_bytes']) }; };

beforeAll(async () => {
  base = await baseAislada003(); await aplicarMigraciones003(base.url);
  db = persistencia003(base.url, persistenciaOferta002, persistenciaOferta003); await db.initialize();
  uow = new UnidadDeTrabajoPostgres(db);
}, 180000);
afterAll(async () => { if (db?.isInitialized) await db.destroy(); await base?.cerrar(); });

describe('migración 1796000000001', () => {
  test('crea las cinco tablas de Solicitudes y no toca las de otros módulos', async () => {
    const tablas = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'solicitudes%' ORDER BY 1") as { table_name: string }[]).map(t => t.table_name);
    expect(tablas).toEqual(['solicitudes', 'solicitudes_archivos', 'solicitudes_bitacora', 'solicitudes_objetos_pendientes', 'solicitudes_versiones']);
  });
  test('no hay claves foráneas hacia tablas de otros módulos', async () => {
    const fks = await db.query(`SELECT conrelid::regclass::text AS desde, confrelid::regclass::text AS hacia FROM pg_constraint WHERE contype='f' AND conrelid::regclass::text LIKE 'solicitudes%'`) as { desde: string; hacia: string }[];
    for (const f of fks) expect(f.hacia).toMatch(/^solicitudes/);
  });
  test('los tipos y longitudes son los del modelo', async () => {
    const col = async (c: string) => ((await db.query("SELECT data_type, character_maximum_length AS largo FROM information_schema.columns WHERE table_name='solicitudes' AND column_name=$1", [c])) as { data_type: string; largo: number | null }[])[0]!;
    expect(await col('descripcion')).toEqual({ data_type: 'character varying', largo: 2000 });
    expect(await col('medidas')).toEqual({ data_type: 'character varying', largo: 500 });
    expect((await col('archivos_cantidad')).data_type).toBe('smallint');
    expect((await col('archivos_bytes')).data_type).toBe('bigint');
    expect(await codigoDe(solicitud({ descripcion: 'x'.repeat(2001) }))).toBe('22001');
    expect(await codigoDe(solicitud({ medidas: 'x'.repeat(501) }))).toBe('22001');
    expect(await codigoDe(solicitud({ descripcion: 'x'.repeat(2000), medidas: 'y'.repeat(500) }))).toBeUndefined();
  });
});

describe('dominios cerrados y coherencia de la fila', () => {
  test('tipo, estado y distrito solo admiten sus valores canónicos', async () => {
    expect(await codigoDe(solicitud({ tipo: 'OTRA' }))).toBe('23514');
    expect(await codigoDe(solicitud({ estado: 'EN_PROCESO' }))).toBe('23514');
    expect(await codigoDe(solicitud({ distrito_codigo: 'huanta' }))).toBe('23514');
    for (const d of ['ayacucho', 'carmen-alto', 'san-juan-bautista', 'jesus-nazareno', 'andres-avelino-caceres-dorregaray']) expect(await codigoDe(solicitud({ distrito_codigo: d }))).toBeUndefined();
  });
  test('(publicada_en IS NOT NULL) = (version_trabajo >= 1)', async () => {
    expect(await codigoDe(solicitud({ publicada_en: null, version_trabajo: 1 }))).toBe('23514');
    expect(await codigoDe(solicitud({ publicada_en: new Date().toISOString(), version_trabajo: 0 }))).toBe('23514');
    expect(await codigoDe(borrador())).toBeUndefined();
  });
  test('fecha_hasta >= fecha_desde y no puede existir sin fecha_desde', async () => {
    expect(await codigoDe(solicitud({ fecha_desde: '2030-02-10', fecha_hasta: '2030-02-09' }))).toBe('23514');
    expect(await codigoDe(solicitud({ fecha_desde: '2030-02-10', fecha_hasta: '2030-02-10' }))).toBeUndefined();
    expect(await codigoDe(borrador({ fecha_desde: null, fecha_hasta: '2030-02-10' }))).toBe('23514');
  });
  test('una publicada exige descripción, categoría, distrito y fecha_desde; un borrador no', async () => {
    for (const faltante of ['descripcion', 'categoria_id', 'distrito_codigo', 'fecha_desde']) expect(await codigoDe(solicitud({ [faltante]: null, ...(faltante === 'fecha_desde' ? { fecha_hasta: null } : {}) }))).toBe('23514');
    expect(await codigoDe(borrador())).toBeUndefined();
  });
  test('una PUBLICADA no lleva destinatario ni servicio; una DIRIGIDA publicada exige prestador y su cuenta', async () => {
    expect(await codigoDe(solicitud({ prestador_id: uuid() }))).toBe('23514');
    expect(await codigoDe(solicitud({ prestador_cuenta_id: uuid() }))).toBe('23514');
    expect(await codigoDe(solicitud({ tipo: 'DIRIGIDA' }))).toBe('23514');
    expect(await codigoDe(solicitud({ tipo: 'DIRIGIDA', prestador_id: uuid() }))).toBe('23514');
    expect(await codigoDe(dirigida())).toBeUndefined();
    expect(await codigoDe(borrador({ tipo: 'DIRIGIDA' }))).toBeUndefined();
  });
  test('la cuenta del destinatario no puede ser la del cliente', async () => {
    const cuenta = uuid();
    expect(await codigoDe(dirigida({ cliente_cuenta_id: cuenta, prestador_cuenta_id: cuenta }))).toBe('23514');
  });
  test('un servicio exige su copia completa, la categoría del servicio y una DIRIGIDA', async () => {
    const categoria = uuid();
    const conServicio = (extra: Record<string, unknown>) => dirigida({ categoria_id: categoria, servicio_id: uuid(), servicio_titulo: 'Servicio', servicio_categoria_id: categoria, ...extra });
    expect(await codigoDe(conServicio({}))).toBeUndefined();
    expect(await codigoDe(conServicio({ servicio_titulo: null }))).toBe('23514');
    expect(await codigoDe(conServicio({ servicio_categoria_id: uuid() }))).toBe('23514');
    expect(await codigoDe(solicitud({ servicio_id: uuid(), servicio_titulo: 'Servicio', servicio_categoria_id: categoria, categoria_id: categoria }))).toBe('23514');
  });
  test('cerrada_en existe si y solo si la solicitud está CERRADA', async () => {
    expect(await codigoDe(solicitud({ estado: 'CERRADA', cerrada_en: null }))).toBe('23514');
    expect(await codigoDe(solicitud({ estado: 'ABIERTA', cerrada_en: new Date().toISOString() }))).toBe('23514');
    expect(await codigoDe(solicitud({ estado: 'CERRADA', cerrada_en: new Date().toISOString() }))).toBeUndefined();
  });
  test('la versión de control empieza en 1 y la de trabajo no es negativa', async () => {
    expect(await codigoDe(solicitud({ version: 0 }))).toBe('23514');
    expect(await codigoDe(borrador({ version_trabajo: -1 }))).toBe('23514');
  });
});

describe('contadores de archivos', () => {
  test('archivos_cantidad entre 0 y 5 y archivos_bytes entre 0 y 30 000 000, con restricciones con nombre', async () => {
    const id = await solicitud();
    for (const [columna, valor, restriccion] of [['archivos_cantidad', 6, 'solicitudes_archivos_cantidad_rango'], ['archivos_cantidad', -1, 'solicitudes_archivos_cantidad_rango'],
      ['archivos_bytes', 30_000_001, 'solicitudes_archivos_bytes_rango'], ['archivos_bytes', -1, 'solicitudes_archivos_bytes_rango']] as const) {
      const promesa = actualizar(id, { [columna]: valor });
      expect(await restriccionDe(promesa)).toBe(restriccion);
    }
    await actualizar(id, { archivos_cantidad: 5, archivos_bytes: 30_000_000 });
    expect(await contadores(id)).toEqual({ cantidad: 5, bytes: 30_000_000 });
  });
  test('el único disparador suma y resta en cada alta, cambio de estado y baja', async () => {
    const id = await solicitud();
    const a = await archivo(id, { bytes: 1000 }); const b = await archivo(id, { bytes: 2500, estado: 'PREPARANDO' });
    expect(await contadores(id)).toEqual({ cantidad: 2, bytes: 3500 });
    await db.query("UPDATE solicitudes_archivos SET estado='CONFIRMADO', confirmado_en=clock_timestamp(), caduca_en=NULL WHERE id=$1", [a]);
    expect(await contadores(id)).toEqual({ cantidad: 2, bytes: 3500 });
    await db.query("UPDATE solicitudes_archivos SET estado='DESCARTADO', retirado_en=clock_timestamp() WHERE id=$1", [b]);
    expect(await contadores(id)).toEqual({ cantidad: 1, bytes: 1000 });
    await db.query("UPDATE solicitudes_archivos SET estado='ELIMINADO', retirado_en=clock_timestamp() WHERE id=$1", [a]);
    expect(await contadores(id)).toEqual({ cantidad: 0, bytes: 0 });
    await db.query('DELETE FROM solicitudes_archivos WHERE id=$1', [b]);
    expect(await contadores(id)).toEqual({ cantidad: 0, bytes: 0 });
  });
  test('un archivo DESCARTADO o ELIMINADO desde el alta no consume cupo', async () => {
    const id = await solicitud();
    await archivo(id, { estado: 'DESCARTADO', retirado_en: new Date().toISOString(), caduca_en: null });
    expect(await contadores(id)).toEqual({ cantidad: 0, bytes: 0 });
  });
  test('el sexto archivo y el exceso de bytes se rechazan con la restricción del contador y se traducen a LIMITE_ARCHIVOS', async () => {
    const id = await solicitud();
    for (let i = 0; i < 5; i += 1) await archivo(id, { bytes: 1000 });
    const sexto = archivo(id).catch((e: unknown) => { throw e; });
    expect(await restriccionDe(sexto)).toBe('solicitudes_archivos_cantidad_rango');
    const otra = await solicitud();
    await archivo(otra, { bytes: 9_999_999 }); await archivo(otra, { bytes: 9_999_999 }); await archivo(otra, { bytes: 9_999_999 });
    const exceso = archivo(otra, { bytes: 9_999_999 }).catch((e: unknown) => e);
    const error = await exceso;
    expect(condicionDe(error)).toMatchObject({ sqlstate: '23514', restriccion: 'solicitudes_archivos_bytes_rango' });
    expect(traducirErrorBd(error, traducirCondicionSolicitudes)).toMatchObject({ http: 422, codigo: 'LIMITE_ARCHIVOS' });
    expect(await contadores(otra)).toEqual({ cantidad: 3, bytes: 29_999_997 });
  });
  test('cargas simultáneas no superan 5 archivos: exactamente 5 entran y el resto recibe LIMITE_ARCHIVOS', async () => {
    const id = await solicitud();
    const resultados = await Promise.allSettled(Array.from({ length: 9 }, () => archivo(id, { bytes: 1000 })));
    const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(5);
    expect(rechazos).toHaveLength(4);
    for (const r of rechazos) expect(traducirErrorBd(r.reason, traducirCondicionSolicitudes)).toMatchObject({ codigo: 'LIMITE_ARCHIVOS' });
    expect(await contadores(id)).toEqual({ cantidad: 5, bytes: 5000 });
  }, 60000);
  test('cargas simultáneas no superan 30 000 000 bytes', async () => {
    const id = await solicitud();
    const resultados = await Promise.allSettled(Array.from({ length: 5 }, () => archivo(id, { bytes: 9_000_000 })));
    expect(resultados.filter(r => r.status === 'fulfilled')).toHaveLength(3);
    expect((await contadores(id)).bytes).toBe(27_000_000);
  }, 60000);
});

describe('inmutabilidad tras publicar', () => {
  test('rechaza cambiar tipo, destinatario, servicio y sus copias después de publicar', async () => {
    const categoria = uuid();
    const id = await dirigida({ categoria_id: categoria, servicio_id: uuid(), servicio_titulo: 'Servicio', servicio_categoria_id: categoria });
    for (const cambio of [{ tipo: 'PUBLICADA' }, { prestador_id: uuid() }, { prestador_cuenta_id: uuid() }, { servicio_id: uuid() }, { servicio_titulo: 'Otro' }, { cliente_cuenta_id: uuid() }, { publicada_en: new Date(0).toISOString() }]) {
      expect([cambio, await codigoDe(actualizar(id, cambio))]).toEqual([cambio, '23514']);
    }
  });
  test('sí permite cambiar el contenido editable y subir las versiones', async () => {
    const id = await solicitud();
    await actualizar(id, { descripcion: 'Otra descripción', medidas: '10 m2', compartir_fotografias: true, version: 2, version_trabajo: 2, actualizada_en: new Date().toISOString() });
    expect(await fila(id)).toMatchObject({ descripcion: 'Otra descripción', version: 2, version_trabajo: 2 });
  });
  test('las versiones no retroceden', async () => {
    const id = await solicitud({ version: 3, version_trabajo: 2 });
    expect(await codigoDe(actualizar(id, { version: 2 }))).toBe('23514');
    expect(await codigoDe(actualizar(id, { version_trabajo: 1 }))).toBe('23514');
  });
  test('antes de publicar, un borrador sí puede cambiar de tipo, destinatario y servicio', async () => {
    const id = await borrador({ tipo: 'DIRIGIDA' });
    await actualizar(id, { prestador_id: uuid(), prestador_cuenta_id: uuid() });
    await actualizar(id, { tipo: 'PUBLICADA', prestador_id: null, prestador_cuenta_id: null });
    expect((await fila(id))['tipo']).toBe('PUBLICADA');
  });
});

describe('transiciones y terminalidad de CERRADA', () => {
  test('BORRADOR → ABIERTA → CERRADA y BORRADOR → CERRADA (descartar) son válidas; volver atrás no', async () => {
    const b = await borrador();
    await actualizar(b, { estado: 'ABIERTA', descripcion: 'Texto', categoria_id: uuid(), distrito_codigo: 'ayacucho', fecha_desde: '2030-03-01', version_trabajo: 1, publicada_en: new Date().toISOString(), version: 2 });
    expect(await codigoDe(actualizar(b, { estado: 'BORRADOR' }))).toBe('23514');
    await actualizar(b, { estado: 'CERRADA', cerrada_en: new Date().toISOString(), version: 3 });
    const descartada = await borrador();
    await actualizar(descartada, { estado: 'CERRADA', cerrada_en: new Date().toISOString(), version: 2 });
    expect((await fila(descartada))['estado']).toBe('CERRADA');
  });
  test('una solicitud CERRADA rechaza cualquier cambio salvo los contadores de archivos', async () => {
    const id = await solicitud();
    const a = await archivo(id, { bytes: 4000 });
    await actualizar(id, { estado: 'CERRADA', cerrada_en: new Date().toISOString(), version: 2 });
    for (const cambio of [{ descripcion: 'Nueva' }, { estado: 'ABIERTA', cerrada_en: null }, { version: 9 }, { compartir_fotografias: true }, { medidas: '1 m' }]) {
      expect([cambio, await codigoDe(actualizar(id, cambio))]).toEqual([cambio, '23514']);
    }
    // El disparador de archivos sigue pudiendo mantener los contadores de una solicitud cerrada (por ejemplo, al purgar un archivo caducado).
    await db.query("UPDATE solicitudes_archivos SET estado='DESCARTADO', retirado_en=clock_timestamp(), caduca_en=NULL WHERE id=$1", [a]);
    expect(await contadores(id)).toEqual({ cantidad: 0, bytes: 0 });
  });
  test('una solicitud no se puede borrar', async () => {
    const id = await borrador();
    expect(await codigoDe(db.query('DELETE FROM solicitudes WHERE id=$1', [id]))).toBe('23514');
    expect(await fila(id)).toBeDefined();
  });
});

describe('versiones de trabajo', () => {
  const version = (solicitudId: string, numero: number, sobre: Record<string, unknown> = {}) => db.query(
    `INSERT INTO solicitudes_versiones (solicitud_id,numero,descripcion,categoria_id,distrito_codigo,fecha_desde,archivos,creada_por_cuenta_id) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
    [solicitudId, numero, sobre['descripcion'] ?? 'Descripción', uuid(), sobre['distrito'] ?? 'ayacucho', '2030-01-10', JSON.stringify(sobre['archivos'] ?? []), uuid()]);
  test('numeración consecutiva desde 1, sin repetir ni saltar', async () => {
    const id = await solicitud();
    expect(await codigoDe(version(id, 2))).toBe('23514');
    await version(id, 1);
    expect(await codigoDe(version(id, 1))).toBeDefined();
    expect(await codigoDe(version(id, 3))).toBe('23514');
    await version(id, 2, { archivos: [{ archivoId: uuid(), tipoMime: 'image/webp', bytes: 100, ancho: 10, alto: 10, sha256: 'a'.repeat(64) }] });
  });
  test('son inmutables: UPDATE y DELETE se rechazan', async () => {
    const id = await solicitud(); await version(id, 1);
    expect(await codigoDe(db.query("UPDATE solicitudes_versiones SET descripcion='cambio' WHERE solicitud_id=$1", [id]))).toBe('23514');
    expect(await codigoDe(db.query('DELETE FROM solicitudes_versiones WHERE solicitud_id=$1', [id]))).toBe('23514');
    expect(Number(((await db.query('SELECT count(*)::int AS n FROM solicitudes_versiones WHERE solicitud_id=$1', [id])) as { n: number }[])[0]!.n)).toBe(1);
  });
  test('el distrito de una versión también es canónico', async () => {
    const id = await solicitud();
    expect(await codigoDe(version(id, 1, { distrito: 'lima' }))).toBe('23514');
  });
});

describe('bitácora', () => {
  const entrada = (solicitudId: string, tipo: string) => db.query(
    'INSERT INTO solicitudes_bitacora (id,solicitud_id,actor_cuenta_id,tipo,version,version_trabajo,campos_cambiados) VALUES ($1,$2,$3,$4,1,1,$5)', [uuid(), solicitudId, uuid(), tipo, ['descripcion']]);
  test('solo admite los seis tipos y es inmutable', async () => {
    const id = await solicitud();
    for (const tipo of ['CREADA', 'BORRADOR_EDITADO', 'PUBLICADA', 'EDITADA', 'PRIVACIDAD_CAMBIADA', 'CERRADA']) expect(await codigoDe(entrada(id, tipo))).toBeUndefined();
    expect(await codigoDe(entrada(id, 'ACEPTADA'))).toBe('23514');
    expect(await codigoDe(db.query("UPDATE solicitudes_bitacora SET tipo='CERRADA' WHERE solicitud_id=$1", [id]))).toBe('23514');
    expect(await codigoDe(db.query('DELETE FROM solicitudes_bitacora WHERE solicitud_id=$1', [id]))).toBe('23514');
  });
  test('guarda nombres de campo, nunca valores', async () => {
    const tipo = ((await db.query("SELECT data_type FROM information_schema.columns WHERE table_name='solicitudes_bitacora' AND column_name='campos_cambiados'")) as { data_type: string }[])[0]!.data_type;
    expect(tipo).toBe('ARRAY');
  });
});

describe('archivos', () => {
  test('la clave del objeto tiene la forma solicitudes/<solicitud>/<archivo> o su variante de pruebas, y es única', async () => {
    const id = await solicitud();
    expect(await codigoDe(archivo(id, { objeto_clave: 'portafolio/x/y' }))).toBe('23514');
    expect(await codigoDe(archivo(id, { objeto_clave: `solicitudes/${uuid()}/${uuid()}` }))).toBe('23514');
    const a = uuid();
    expect(await codigoDe(archivo(id, { id: a, objeto_clave: `pruebas/${uuid()}/solicitudes/${id}/${a}` }))).toBeUndefined();
    const b = uuid(); const clave = `solicitudes/${id}/${b}`;
    await archivo(id, { id: b, objeto_clave: clave });
    expect(await codigoDe(archivo(id, { objeto_clave: clave }))).toBe('23514');
  });
  test('mime WebP, bytes positivos, lado ≤ 1 600 y checksum SHA-256 de 32 bytes', async () => {
    const id = await solicitud();
    expect(await codigoDe(archivo(id, { mime: 'image/png' }))).toBe('23514');
    expect(await codigoDe(archivo(id, { bytes: 0 }))).toBe('23514');
    expect(await codigoDe(archivo(id, { ancho: 1601 }))).toBe('23514');
    expect(await codigoDe(archivo(id, { alto: 0 }))).toBe('23514');
    expect(await codigoDe(archivo(id, { checksum: Buffer.alloc(31) }))).toBe('23514');
  });
  test('los estados son cinco, los no confirmados caducan y los retirados registran su fecha', async () => {
    const id = await solicitud();
    expect(await codigoDe(archivo(id, { estado: 'BORRADO' }))).toBe('23514');
    expect(await codigoDe(archivo(id, { estado: 'PREPARADO', caduca_en: null }))).toBe('23514');
    expect(await codigoDe(archivo(id, { estado: 'CONFIRMADO', caduca_en: null }))).toBe('23514');
    expect(await codigoDe(archivo(id, { estado: 'ELIMINADO', caduca_en: null }))).toBe('23514');
  });
  test('transiciones: PREPARANDO→PREPARADO→CONFIRMADO→ELIMINADO; DESCARTADO y ELIMINADO son terminales', async () => {
    const id = await solicitud(); const a = await archivo(id, { estado: 'PREPARANDO' });
    expect(await codigoDe(db.query("UPDATE solicitudes_archivos SET estado='CONFIRMADO', confirmado_en=clock_timestamp(), caduca_en=NULL WHERE id=$1", [a]))).toBe('23514');
    await db.query("UPDATE solicitudes_archivos SET estado='PREPARADO' WHERE id=$1", [a]);
    await db.query("UPDATE solicitudes_archivos SET estado='CONFIRMADO', confirmado_en=clock_timestamp(), caduca_en=NULL WHERE id=$1", [a]);
    expect(await codigoDe(db.query("UPDATE solicitudes_archivos SET estado='PREPARADO', caduca_en=clock_timestamp() WHERE id=$1", [a]))).toBe('23514');
    await db.query("UPDATE solicitudes_archivos SET estado='ELIMINADO', retirado_en=clock_timestamp() WHERE id=$1", [a]);
    expect(await codigoDe(db.query("UPDATE solicitudes_archivos SET estado='CONFIRMADO' WHERE id=$1", [a]))).toBe('23514');
  });
  test('la identidad y el contenido de un archivo no cambian', async () => {
    const id = await solicitud(); const a = await archivo(id);
    expect(await codigoDe(db.query('UPDATE solicitudes_archivos SET solicitud_id=$2 WHERE id=$1', [a, await solicitud()]))).toBe('23514');
    expect(await codigoDe(db.query("UPDATE solicitudes_archivos SET objeto_clave='solicitudes/x' WHERE id=$1", [a]))).toBe('23514');
    expect(await codigoDe(db.query("UPDATE solicitudes_archivos SET checksum=$2 WHERE id=$1", [a, Buffer.alloc(32, 9)]))).toBe('23514');
  });
  test('un archivo exige una solicitud existente', async () => {
    expect(await codigoDe(archivo(uuid()))).toBe('23503');
  });
});

describe('objetos pendientes de limpieza', () => {
  const pendiente = (sobre: Record<string, unknown> = {}) => {
    const solicitudId = (sobre['solicitud_id'] as string | undefined) ?? uuid(); const archivoId = uuid();
    const v = { clave: `solicitudes/${solicitudId}/${archivoId}`, tipo: 'PREPARACION', solicitud_id: solicitudId, proxima_ejecucion: new Date().toISOString(), ...sobre };
    return db.query('INSERT INTO solicitudes_objetos_pendientes (clave,tipo,solicitud_id,proxima_ejecucion) VALUES ($1,$2,$3,$4)', [v.clave, v.tipo, v.solicitud_id, v.proxima_ejecucion]);
  };
  test('tipo PREPARACION o PURGA, clave única con la forma del objeto y contadores no negativos', async () => {
    expect(await codigoDe(pendiente())).toBeUndefined();
    expect(await codigoDe(pendiente({ tipo: 'BORRAR' }))).toBe('23514');
    expect(await codigoDe(pendiente({ clave: 'portafolio/x/y' }))).toBe('23514');
    const solicitudId = uuid(); const clave = `solicitudes/${solicitudId}/${uuid()}`;
    await pendiente({ solicitud_id: solicitudId, clave });
    expect(await codigoDe(pendiente({ solicitud_id: solicitudId, clave }))).toBe('23505');
    expect(await codigoDe(db.query("UPDATE solicitudes_objetos_pendientes SET intentos=-1 WHERE clave=$1", [clave]))).toBe('23514');
  });
  test('el último error es un código sanitizado: no admite texto libre', async () => {
    const solicitudId = uuid(); const clave = `solicitudes/${solicitudId}/${uuid()}`;
    await pendiente({ solicitud_id: solicitudId, clave });
    await db.query("UPDATE solicitudes_objetos_pendientes SET ultimo_error='ALMACENAMIENTO_NO_DISPONIBLE' WHERE clave=$1", [clave]);
    expect(await codigoDe(db.query("UPDATE solicitudes_objetos_pendientes SET ultimo_error='fallo en solicitudes/abc: acceso denegado' WHERE clave=$1", [clave]))).toBe('23514');
  });
});

describe('espera de bloqueo traducida con PostgreSQL real', () => {
  test('un bloqueo que excede lock_timeout (55P03) se traduce a CONFLICTO_CONCURRENTE', async () => {
    const id = await solicitud();
    let liberar!: () => void; const espera = new Promise<void>(r => { liberar = r; });
    let bloqueado!: () => void; const listo = new Promise<void>(r => { bloqueado = r; });
    const duenio = uow.ejecutar(async (tx) => { await uow.runner(tx).query('SELECT id FROM solicitudes WHERE id=$1 FOR UPDATE', [id]); bloqueado(); await espera; });
    await listo;
    try {
      const error = await uow.ejecutar(async (tx) => {
        try {
          await uow.runner(tx).query("SET LOCAL lock_timeout = '300ms'");
          await uow.runner(tx).query('SELECT id FROM solicitudes WHERE id=$1 FOR UPDATE', [id]);
        } catch (e) { throw traducirErrorBd(e, traducirCondicionSolicitudes); }
      }).catch((e: unknown) => e);
      expect(error).toMatchObject({ http: 409, codigo: 'CONFLICTO_CONCURRENTE' });
    } finally { liberar(); await duenio; }
  }, 60000);
  test('el contenido de la fila rechazada nunca llega al error traducido', async () => {
    const id = await solicitud();
    for (let i = 0; i < 3; i += 1) await archivo(id, { bytes: 10_000_000 });
    const error = traducirErrorBd(await archivo(id, { bytes: 1234 }).catch((e: unknown) => e), traducirCondicionSolicitudes);
    expect(error).toMatchObject({ codigo: 'LIMITE_ARCHIVOS' });
    expect(JSON.stringify([(error as Error).message, (error as { detalles?: unknown }).detalles])).not.toMatch(/1234|30000000|solicitudes_archivos|constraint|Failing row/i);
  });
});
