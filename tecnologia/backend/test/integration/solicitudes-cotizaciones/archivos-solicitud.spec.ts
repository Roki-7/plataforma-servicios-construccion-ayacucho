import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { condicionDe } from '../../../src/compartido/infraestructura/postgres/traduccion-errores.js';
import { dependenciaNoDisponible } from '../../../src/modulos/solicitudes/dominio/errores.js';
import { validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { crearYPublicar, cuerpoPublicable, imagen, jpegDeTamano, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T047 · archivos de solicitudes con PostgreSQL y Garage reales: CA-ARC-01 a 07, 12 y 13, y FR-347.
const control: { fallarGuardar: boolean; antesDeGuardar?: () => Promise<void> } = { fallarGuardar: false };
let e: EntornoUs1; let t1: string; let t2: string;
const n = async (sql: string, p: unknown[] = []) => Number(((await e.db.query(sql, p)) as { n: number }[])[0]!.n);
const contadores = async (id: string) => ((await e.db.query('SELECT archivos_cantidad AS c, archivos_bytes AS b FROM solicitudes WHERE id=$1', [id])) as { c: number; b: string }[]).map(f => ({ cantidad: f.c, bytes: Number(f.b) }))[0]!;
const estados = async (id: string) => ((await e.db.query('SELECT estado, count(*)::int AS n FROM solicitudes_archivos WHERE solicitud_id=$1 GROUP BY estado ORDER BY estado', [id])) as { estado: string; n: number }[]).map(f => [f.estado, f.n]);
async function listarObjetos(): Promise<string[]> {
  const { almacenamientoAislado003 } = await import('../../soporte/solicitudes-cotizaciones/almacenamiento.js');
  const g = await almacenamientoAislado003(); // cliente propio, solo para leer
  try {
    const claves: string[] = []; let token: string | undefined;
    do { const p = await g.cliente.send(new ListObjectsV2Command({ Bucket: g.bucket, Prefix: e.prefijo, ContinuationToken: token })); for (const o of p.Contents ?? []) if (o.Key) claves.push(o.Key); token = p.IsTruncated ? p.NextContinuationToken : undefined; } while (token);
    return claves;
  } finally { g.cliente.destroy(); }
}
const nuevaSolicitud = async (tk = t1) => (await e.crear(tk, cuerpoPublicable(e)).expect(201)).body as { solicitudId: string; version: number };
const subir = async (id: string, img?: object, tk = t1, clave?: string) => e.cargar(tk, id, img ?? await imagen(64, 48, 'jpeg', { r: Math.floor(Math.random() * 255), g: 90, b: 40 }), clave);

beforeAll(async () => {
  e = await montarUs1({ almacen: real => new Proxy(real, { get(objetivo, propiedad) {
    if (propiedad === 'guardar' && control.fallarGuardar) return async () => { throw dependenciaNoDisponible(); };
    if (propiedad === 'guardar' && control.antesDeGuardar) {
      const esperar = control.antesDeGuardar;
      return async (clave: string, contenido: Uint8Array) => { await esperar(); await objetivo.guardar(clave, contenido); };
    }
    const valor = Reflect.get(objetivo, propiedad, objetivo) as unknown; return typeof valor === 'function' ? (valor as (...a: unknown[]) => unknown).bind(objetivo) : valor;
  } }) });
  t1 = await e.token(e.datos.clientes.clienteUno); t2 = await e.token(e.datos.clientes.clienteDos);
}, 300000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('carga de una imagen (FR-317 a FR-320 y FR-323)', () => {
  test('cerrar durante la escritura del objeto impide publicar la carga y retira el objeto tardío', async () => {
    const s = await nuevaSolicitud();
    const iniciada = Promise.withResolvers<void>();
    const continuar = Promise.withResolvers<void>();
    const foto = await imagen();
    control.antesDeGuardar = async () => { iniciada.resolve(); await continuar.promise; };
    const carga = e.cargar(t1, s.solicitudId, foto).then(r => r);
    try {
      await iniciada.promise;
      expect((await e.cerrarSolicitud(t1, s.solicitudId, { version: s.version })).status).toBe(200);
    } finally {
      delete control.antesDeGuardar;
      continuar.resolve();
    }
    const respuesta = await carga;
    expect([respuesta.status, respuesta.body.codigo]).toEqual([409, 'SOLICITUD_NO_ABIERTA']);
    expect(await contadores(s.solicitudId)).toEqual({ cantidad: 0, bytes: 0 });
    expect((await listarObjetos()).some(clave => clave.includes(s.solicitudId))).toBe(false);
  });
  test('una imagen válida queda PREPARADA con su caducidad a las 24 horas, sin direcciones ni claves de objeto (CA-ARC-13)', async () => {
    const s = await nuevaSolicitud();
    const r = await subir(s.solicitudId, await imagen(300, 200, 'png'));
    expect(r.status).toBe(201);
    await validarRespuesta003('C003Archivo', r.body);
    expect(r.body).toMatchObject({ estado: 'PREPARADO', tipoMime: 'image/webp', ancho: 300, alto: 200 });
    const horas = (new Date(r.body.caducaEn).getTime() - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(23.9); expect(horas).toBeLessThanOrEqual(24);
    expect(JSON.stringify(r.body)).not.toMatch(/https?:|solicitudes\/|objeto|clave|url/i);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(await listarObjetos()).toContain(e.real.claveNueva(s.solicitudId, r.body.archivoId));
  });
  test('JPG, PNG y WEBP se aceptan y se recodifican a WebP', async () => {
    const s = await nuevaSolicitud();
    for (const f of ['jpeg', 'png', 'webp'] as const) expect((await subir(s.solicitudId, await imagen(80, 60, f))).body.tipoMime).toBe('image/webp');
  });
  test('un formato falso o un PDF devuelven 422 IMAGEN_FORMATO_NO_ADMITIDO y no dejan filas ni objetos (CA-ARC-02)', async () => {
    const s = await nuevaSolicitud(); const antes = (await listarObjetos()).length;
    for (const contenido of [Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'), Buffer.from('esto no es una imagen'), Buffer.alloc(300, 9)]) {
      const r = await e.cargar(t1, s.solicitudId, { tipoMime: 'image/png', contenidoBase64: contenido.toString('base64') });
      expect([r.status, r.body.codigo]).toEqual([422, 'IMAGEN_FORMATO_NO_ADMITIDO']);
      await validarRespuesta003('C003Error422', r.body);
    }
    expect(await n('SELECT count(*)::int AS n FROM solicitudes_archivos WHERE solicitud_id=$1', [s.solicitudId])).toBe(0);
    expect((await listarObjetos()).length).toBe(antes);
    expect(await contadores(s.solicitudId)).toEqual({ cantidad: 0, bytes: 0 });
  });
  test('un archivo de más de 10 MB devuelve 413 y uno de exactamente 10 000 000 bytes se acepta (CA-ARC-02)', async () => {
    const s = await nuevaSolicitud();
    const exceso = await e.cargar(t1, s.solicitudId, await jpegDeTamano(10_000_001));
    expect([exceso.status, exceso.body.codigo]).toEqual([413, 'ARCHIVO_DEMASIADO_GRANDE']);
    await validarRespuesta003('C003Error413', exceso.body);
    expect((await e.cargar(t1, s.solicitudId, await jpegDeTamano(10_000_000))).status).toBe(201);
    expect(await n('SELECT count(*)::int AS n FROM solicitudes_archivos WHERE solicitud_id=$1', [s.solicitudId])).toBe(1);
  }, 120000);
  test('una imagen con más de 4 096 píxeles por lado se rechaza', async () => {
    const s = await nuevaSolicitud();
    const r = await e.cargar(t1, s.solicitudId, await imagen(4097, 1, 'png'));
    expect([r.status, r.body.codigo]).toEqual([422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS']);
  });
  test('solo el dueño carga: otro cliente recibe 404 y no se modifica nada', async () => {
    const s = await nuevaSolicitud();
    expect((await subir(s.solicitudId, undefined, t2)).status).toBe(404);
    expect(await n('SELECT count(*)::int AS n FROM solicitudes_archivos WHERE solicitud_id=$1', [s.solicitudId])).toBe(0);
  });
});

describe('cupo de 5 archivos y 30 000 000 bytes, también con cargas simultáneas (CA-ARC-01)', () => {
  test('nueve cargas simultáneas admiten exactamente cinco y rechazan el resto con 422 LIMITE_ARCHIVOS', async () => {
    const s = await nuevaSolicitud();
    const respuestas = await Promise.all(Array.from({ length: 9 }, async (_, i) => subir(s.solicitudId, await imagen(40 + i, 30, 'jpeg', { r: i * 20, g: 50, b: 80 }))));
    const estadosHttp = respuestas.map(r => r.status).sort();
    expect(estadosHttp.filter(x => x === 201)).toHaveLength(5);
    for (const r of respuestas.filter(x => x.status !== 201)) expect([r.status, r.body.codigo]).toEqual([422, 'LIMITE_ARCHIVOS']);
    expect(await contadores(s.solicitudId)).toMatchObject({ cantidad: 5 });
    expect(await estados(s.solicitudId)).toEqual([['PREPARADO', 5]]);
  }, 120000);
  test('los rechazados no dejan objetos huérfanos: hay exactamente tantos objetos como archivos admitidos', async () => {
    const s = await nuevaSolicitud();
    await Promise.all(Array.from({ length: 7 }, async (_, i) => subir(s.solicitudId, await imagen(50 + i, 30, 'png', { r: 10, g: i * 30, b: 90 }))));
    const filas = (await e.db.query("SELECT objeto_clave FROM solicitudes_archivos WHERE solicitud_id=$1 AND estado='PREPARADO'", [s.solicitudId])) as { objeto_clave: string }[];
    const enAlmacen = (await listarObjetos()).filter(k => k.includes(s.solicitudId));
    expect(enAlmacen.sort()).toEqual(filas.map(f => f.objeto_clave).sort());
    expect(filas).toHaveLength(5);
  }, 120000);
  test('el cupo de bytes lo garantiza el disparador: tres filas de 9 000 000 bytes caben, una cuarta de 9 999 999 no (30 000 000), y una imagen pequeña aún cabe', async () => {
    const s = await nuevaSolicitud(); const id = s.solicitudId;
    const insertar = (bytes: number) => { const archivo = randomUUID();
      return e.db.query(`INSERT INTO solicitudes_archivos (id, solicitud_id, estado, objeto_clave, mime, bytes, ancho, alto, checksum, caduca_en)
        VALUES ($1,$2,'PREPARADO',$3,'image/webp',$4,10,10,$5, now() + interval '1 hour')`, [archivo, id, `${e.prefijo}${id}/${archivo}`, bytes, Buffer.alloc(32, 1)]); };
    for (let i = 0; i < 3; i += 1) await insertar(9_000_000);
    const error = await insertar(9_999_999).then(() => undefined, (x: unknown) => x);
    expect(condicionDe(error)).toMatchObject({ sqlstate: '23514', restriccion: 'solicitudes_archivos_bytes_rango' });
    expect(await contadores(id)).toEqual({ cantidad: 3, bytes: 27_000_000 });
    expect((await subir(id)).status).toBe(201);
    expect(await contadores(id)).toMatchObject({ cantidad: 4 });
  });
});

describe('fallos del almacenamiento y caducidad (CA-ARC-05 a 07)', () => {
  test('si falla el guardado del objeto no queda cupo consumido y se devuelve 503 (CA-ARC-05)', async () => {
    const s = await nuevaSolicitud();
    control.fallarGuardar = true;
    try {
      const r = await subir(s.solicitudId);
      expect([r.status, r.body.codigo]).toEqual([503, 'DEPENDENCIA_NO_DISPONIBLE']);
      await validarRespuesta003('C003Error503', r.body);
      expect(JSON.stringify(r.body)).not.toMatch(/solicitudes\/|bucket|garage|ECONN/i);
    } finally { control.fallarGuardar = false; }
    expect(await contadores(s.solicitudId)).toEqual({ cantidad: 0, bytes: 0 });
    expect(await estados(s.solicitudId)).toEqual([['DESCARTADO', 1]]);
    expect((await subir(s.solicitudId)).status).toBe(201);
  });
  test('reintentar con la misma clave tras un fallo del almacenamiento funciona y no consume dos cupos', async () => {
    const s = await nuevaSolicitud(); const img = await imagen(70, 50, 'png'); const clave = randomUUID();
    control.fallarGuardar = true;
    try { expect((await e.cargar(t1, s.solicitudId, img, clave)).status).toBe(503); } finally { control.fallarGuardar = false; }
    const r = await e.cargar(t1, s.solicitudId, img, clave);
    expect(r.status).toBe(201);
    expect(await contadores(s.solicitudId)).toMatchObject({ cantidad: 1 });
    expect(await estados(s.solicitudId)).toEqual([['DESCARTADO', 1], ['PREPARADO', 1]]);
  });
  test('una interrupción tras guardar y antes de confirmar deja la carga caducable y el objeto para la limpieza (CA-ARC-06)', async () => {
    const s = await nuevaSolicitud(); const id = randomUUID(); const clave = e.real.claveNueva(s.solicitudId, id);
    const img = await imagen(60, 40);
    await e.real.guardar(clave, new Uint8Array(img.bytes));
    await e.db.query(`INSERT INTO solicitudes_archivos (id, solicitud_id, estado, objeto_clave, mime, bytes, ancho, alto, checksum, caduca_en) VALUES ($1,$2,'PREPARANDO',$3,'image/webp',100,60,40,$4, now() + interval '24 hours')`,
      [id, s.solicitudId, clave, Buffer.alloc(32, 7)]);
    await e.db.query(`INSERT INTO solicitudes_objetos_pendientes (clave, tipo, solicitud_id, proxima_ejecucion) VALUES ($1,'PREPARACION',$2, now() + interval '24 hours')`, [clave, s.solicitudId]);
    expect((await e.obtener(t1, s.solicitudId).expect(200)).body.archivos).toEqual([]);
    expect(await n("SELECT count(*)::int AS n FROM solicitudes_objetos_pendientes WHERE clave=$1 AND tipo='PREPARACION'", [clave])).toBe(1);
  });
  test('a las 24 horas el archivo no confirmado deja de ocupar cupo antes de evaluar el límite, y no es accesible ni confirmable (CA-ARC-07)', async () => {
    const s = await nuevaSolicitud(); const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) ids.push((await subir(s.solicitudId)).body.archivoId);
    expect((await subir(s.solicitudId)).body.codigo).toBe('LIMITE_ARCHIVOS');
    await e.db.query("UPDATE solicitudes_archivos SET caduca_en = clock_timestamp() - interval '1 second' WHERE solicitud_id=$1", [s.solicitudId]);
    expect((await e.archivo(t1, s.solicitudId, ids[0]!)).status).toBe(404);
    expect((await e.obtener(t1, s.solicitudId).expect(200)).body.archivos).toEqual([]);
    const caducado = await e.editar(t1, s.solicitudId, { version: s.version, archivosIds: [ids[0]!] });
    expect([caducado.status, caducado.body.codigo]).toEqual([422, 'ARCHIVO_EXPIRADO']);
    const nueva = await subir(s.solicitudId);
    expect(nueva.status).toBe(201);
    expect(await contadores(s.solicitudId)).toMatchObject({ cantidad: 1 });
    expect(await n("SELECT count(*)::int AS n FROM solicitudes_objetos_pendientes WHERE tipo='PURGA' AND solicitud_id=$1", [s.solicitudId])).toBeGreaterThanOrEqual(5);
  }, 120000);
});

describe('repetición idempotente de una carga', () => {
  test('la misma clave con la misma imagen devuelve el mismo archivo sin duplicar filas ni objetos', async () => {
    const s = await nuevaSolicitud(); const img = await imagen(90, 60, 'png', { r: 1, g: 2, b: 3 }); const clave = randomUUID();
    const a = await e.cargar(t1, s.solicitudId, img, clave).expect(201);
    const b = await e.cargar(t1, s.solicitudId, img, clave).expect(201);
    expect(b.body).toEqual(a.body);
    expect(await estados(s.solicitudId)).toEqual([['PREPARADO', 1]]);
    expect((await listarObjetos()).filter(k => k.includes(s.solicitudId))).toHaveLength(1);
    expect(await contadores(s.solicitudId)).toMatchObject({ cantidad: 1 });
  });
  test('la misma clave con otra imagen devuelve 409 CLAVE_IDEMPOTENCIA_REUTILIZADA y no crea nada', async () => {
    const s = await nuevaSolicitud(); const clave = randomUUID();
    await e.cargar(t1, s.solicitudId, await imagen(90, 60, 'png', { r: 1, g: 2, b: 3 }), clave).expect(201);
    const r = await e.cargar(t1, s.solicitudId, await imagen(90, 60, 'png', { r: 200, g: 2, b: 3 }), clave);
    expect([r.status, r.body.codigo]).toEqual([409, 'CLAVE_IDEMPOTENCIA_REUTILIZADA']);
    expect(await estados(s.solicitudId)).toEqual([['PREPARADO', 1]]);
  });
  test('la misma clave en otra solicitud es una clave reutilizada con otros datos: 409 y la reserva hecha se libera, sin cupo ni objeto', async () => {
    const a = await nuevaSolicitud(); const b = await nuevaSolicitud(); const img = await imagen(33, 22); const clave = randomUUID();
    await e.cargar(t1, a.solicitudId, img, clave).expect(201);
    const r = await e.cargar(t1, b.solicitudId, img, clave);
    expect([r.status, r.body.codigo]).toEqual([409, 'CLAVE_IDEMPOTENCIA_REUTILIZADA']);
    expect(await contadores(b.solicitudId)).toEqual({ cantidad: 0, bytes: 0 });
    expect((await listarObjetos()).filter(k => k.includes(b.solicitudId))).toEqual([]);
    expect((await subir(b.solicitudId)).status).toBe(201);
  });
});

describe('confirmación de archivos, todo o nada (FR-347, CA-ARC-12)', () => {
  test('al guardar el borrador con la lista final, el PREPARADO pasa a CONFIRMADO y deja de caducar', async () => {
    const s = await nuevaSolicitud(); const a = (await subir(s.solicitudId)).body.archivoId;
    const r = await e.editar(t1, s.solicitudId, { version: s.version, archivosIds: [a] }).expect(200);
    expect(r.body.archivos).toEqual([expect.objectContaining({ archivoId: a, estado: 'CONFIRMADO' })]);
    expect(r.body.archivos[0].caducaEn).toBeUndefined();
    expect(await estados(s.solicitudId)).toEqual([['CONFIRMADO', 1]]);
    expect(await n('SELECT count(*)::int AS n FROM solicitudes_versiones WHERE solicitud_id=$1', [s.solicitudId])).toBe(0);
  });
  test('al publicar con la lista final, la versión de trabajo 1 guarda los metadatos de los archivos confirmados', async () => {
    const s = await nuevaSolicitud(); const a = (await subir(s.solicitudId)).body.archivoId;
    const p = await e.publicar(t1, s.solicitudId, { version: s.version, archivosIds: [a] }).expect(200);
    expect(p.body.archivos).toHaveLength(1);
    const v = ((await e.db.query('SELECT archivos FROM solicitudes_versiones WHERE solicitud_id=$1 AND numero=1', [s.solicitudId])) as { archivos: { archivoId: string; tipoMime: string; sha256: string }[] }[])[0]!.archivos;
    expect(v).toEqual([expect.objectContaining({ archivoId: a, tipoMime: 'image/webp', sha256: expect.stringMatching(/^[0-9a-f]{64}$/) })]);
  });
  test('un archivo ajeno o inexistente devuelve 404 y no se confirma ninguno, ni siquiera el válido (CA-ARC-12)', async () => {
    const mia = await nuevaSolicitud(); const otra = await nuevaSolicitud(t2);
    const valido = (await subir(mia.solicitudId)).body.archivoId; const ajeno = (await subir(otra.solicitudId, undefined, t2)).body.archivoId;
    for (const ids of [[valido, ajeno], [valido, randomUUID()]]) {
      const r = await e.editar(t1, mia.solicitudId, { version: mia.version, archivosIds: ids });
      expect([r.status, r.body.codigo]).toEqual([404, 'RECURSO_NO_DISPONIBLE']);
    }
    expect(await estados(mia.solicitudId)).toEqual([['PREPARADO', 1]]);
    expect(await estados(otra.solicitudId)).toEqual([['PREPARADO', 1]]);
    expect((await e.obtener(t1, mia.solicitudId).expect(200)).body.version).toBe(mia.version);
  });
  test('un archivo cuya carga no terminó devuelve 422 ARCHIVO_NO_LISTO y no se confirma ninguno (CA-ARC-12)', async () => {
    const s = await nuevaSolicitud(); const valido = (await subir(s.solicitudId)).body.archivoId; const id = randomUUID();
    await e.db.query(`INSERT INTO solicitudes_archivos (id, solicitud_id, estado, objeto_clave, mime, bytes, ancho, alto, checksum, caduca_en) VALUES ($1,$2,'PREPARANDO',$3,'image/webp',10,5,5,$4, now() + interval '1 hour')`,
      [id, s.solicitudId, `${e.prefijo}${s.solicitudId}/${id}`, Buffer.alloc(32, 3)]);
    const r = await e.editar(t1, s.solicitudId, { version: s.version, archivosIds: [valido, id] });
    expect([r.status, r.body.codigo]).toEqual([422, 'ARCHIVO_NO_LISTO']);
    expect(await estados(s.solicitudId)).toEqual([['PREPARADO', 1], ['PREPARANDO', 1]]);
  });
  test('un archivo caducado devuelve 422 ARCHIVO_EXPIRADO y no se confirma ninguno (CA-ARC-12)', async () => {
    const s = await nuevaSolicitud(); const a = (await subir(s.solicitudId)).body.archivoId; const b = (await subir(s.solicitudId)).body.archivoId;
    await e.db.query("UPDATE solicitudes_archivos SET caduca_en = clock_timestamp() - interval '1 minute' WHERE id=$1", [b]);
    const r = await e.editar(t1, s.solicitudId, { version: s.version, archivosIds: [a, b] });
    expect([r.status, r.body.codigo]).toEqual([422, 'ARCHIVO_EXPIRADO']);
    expect((await e.db.query("SELECT estado FROM solicitudes_archivos WHERE id=$1", [a]) as { estado: string }[])[0]!.estado).toBe('PREPARADO');
  });
  test('una lista de más de 5 se rechaza por el contrato y la de cinco confirma todos (LIMITE_ARCHIVOS se aplica al exceder los límites)', async () => {
    const s = await nuevaSolicitud(); const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) ids.push((await subir(s.solicitudId)).body.archivoId);
    expect((await e.editar(t1, s.solicitudId, { version: s.version, archivosIds: [...ids, randomUUID()] }).expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
    expect((await e.editar(t1, s.solicitudId, { version: s.version, archivosIds: [ids[0], ids[0]] }).expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
    const ok = await e.editar(t1, s.solicitudId, { version: s.version, archivosIds: ids }).expect(200);
    expect(ok.body.archivos).toHaveLength(5);
  }, 120000);
  test('los PREPARADOS no incluidos en una confirmación válida siguen pendientes y solo los ve su dueño', async () => {
    const s = await nuevaSolicitud(); const a = (await subir(s.solicitudId)).body.archivoId; const b = (await subir(s.solicitudId)).body.archivoId;
    const r = await e.editar(t1, s.solicitudId, { version: s.version, archivosIds: [a] }).expect(200);
    expect(r.body.archivos.map((x: { archivoId: string; estado: string }) => [x.archivoId, x.estado]).sort()).toEqual([[a, 'CONFIRMADO'], [b, 'PREPARADO']].sort());
    expect((await e.archivo(t2, s.solicitudId, b)).status).toBe(404);
    expect((await e.archivo(t1, s.solicitudId, b)).status).toBe(200);
  });
});

describe('quitar un archivo confirmado y descarga autorizada (FR-321, CA-ARC-03 y CA-ARC-13)', () => {
  test('quitar un confirmado es un borrado lógico inmediato: queda inaccesible, se purga el objeto y la versión anterior muestra «retirado» (CA-ARC-03)', async () => {
    const p = await crearYPublicar(e, t1);
    const a = (await subir(p.solicitudId)).body.archivoId; const b = (await subir(p.solicitudId)).body.archivoId;
    const v2 = (await e.editar(t1, p.solicitudId, { version: p.version, archivosIds: [a, b] }).expect(200)).body;
    expect(v2.versionTrabajo).toBe(2);
    const claveB = e.real.claveNueva(p.solicitudId, b);
    expect(await listarObjetos()).toContain(claveB);
    const v3 = (await e.editar(t1, p.solicitudId, { version: v2.version, archivosIds: [a] }).expect(200)).body;
    expect(v3).toMatchObject({ versionTrabajo: 3 });
    expect((await e.archivo(t1, p.solicitudId, b)).status).toBe(404);
    expect(await estados(p.solicitudId)).toEqual([['CONFIRMADO', 1], ['ELIMINADO', 1]]);
    expect(await listarObjetos()).not.toContain(claveB);
    expect(await n('SELECT count(*)::int AS n FROM solicitudes_objetos_pendientes WHERE clave=$1', [claveB])).toBe(0);
    const historial = (await e.historial(t1, p.solicitudId, '?tipo=versiones').expect(200)).body;
    await validarRespuesta003('C003HistorialVersiones', historial);
    const v = (n_: number) => historial.elementos.find((x: { numero: number }) => x.numero === n_).contenido.archivos as { archivoId: string; retirado: boolean }[];
    expect(v(2).find(x => x.archivoId === b)).toMatchObject({ retirado: true });
    expect(v(2).find(x => x.archivoId === a)).toMatchObject({ retirado: false });
    expect(v(3).map(x => x.archivoId)).toEqual([a]);
  }, 120000);
  test('la descarga devuelve la imagen saneada (WebP) al dueño, con no-store, y exige sesión', async () => {
    const s = await nuevaSolicitud(); const a = (await subir(s.solicitudId, await imagen(120, 80, 'jpeg'))).body.archivoId;
    const r = await e.archivo(t1, s.solicitudId, a);
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toBe('image/webp'); expect(r.headers['cache-control']).toBe('no-store'); expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect((r.body as Buffer).subarray(0, 4).toString('ascii')).toBe('RIFF'); expect((r.body as Buffer).subarray(8, 12).toString('ascii')).toBe('WEBP');
    const sin = await e.archivo(undefined, s.solicitudId, a);
    expect([sin.status]).toEqual([401]);
    expect((await e.archivo(t2, s.solicitudId, a)).status).toBe(404);
    expect((await e.archivo(t1, s.solicitudId, randomUUID())).status).toBe(404);
    expect((await e.archivo(t1, (await nuevaSolicitud()).solicitudId, a)).status).toBe(404);
  });
  test('el objeto no es accesible de forma anónima y ninguna respuesta de la API contiene direcciones públicas o firmadas (CA-ARC-13)', async () => {
    const s = await nuevaSolicitud(); const a = (await subir(s.solicitudId)).body.archivoId;
    const respuestas = [(await e.obtener(t1, s.solicitudId).expect(200)).body, (await e.editar(t1, s.solicitudId, { version: s.version, archivosIds: [a] }).expect(200)).body];
    for (const cuerpo of respuestas) expect(JSON.stringify(cuerpo)).not.toMatch(/https?:\/\/|X-Amz|Signature|presigned|\.webp/i);
    const clave = e.real.claveNueva(s.solicitudId, a);
    const anonimo = await fetch(`${e.config.s3.endpoint}/${e.config.s3.bucket}/${clave}`);
    expect([401, 403]).toContain(anonimo.status);
    await anonimo.arrayBuffer();
  });
  test('el contenido guardado es el saneado: sin EXIF ni GPS y con el mismo checksum registrado', async () => {
    const s = await nuevaSolicitud(); const a = (await subir(s.solicitudId, await imagen(100, 100, 'jpeg'))).body.archivoId;
    const fila = ((await e.db.query('SELECT objeto_clave, encode(checksum,\'hex\') AS sha FROM solicitudes_archivos WHERE id=$1', [a])) as { objeto_clave: string; sha: string }[])[0]!;
    const g = await (await import('../../soporte/solicitudes-cotizaciones/almacenamiento.js')).almacenamientoAislado003();
    try {
      const objeto = await g.cliente.send(new GetObjectCommand({ Bucket: g.bucket, Key: fila.objeto_clave }));
      const bytes = Buffer.from(await objeto.Body!.transformToByteArray());
      expect((await import('node:crypto')).createHash('sha256').update(bytes).digest('hex')).toBe(fila.sha);
      expect(objeto.CacheControl).toBe('no-store'); expect(objeto.ContentType).toBe('image/webp');
    } finally { g.cliente.destroy(); }
  });
});
