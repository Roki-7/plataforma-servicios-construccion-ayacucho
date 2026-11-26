import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { CreateBucketCommand, DeleteObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import type { AlmacenPortafolio, ObjetoListado } from '../../../src/modulos/prestadores/aplicacion/puertos/puertos.js';
import { LimpiezaPortafolio } from '../../../src/modulos/prestadores/infraestructura/archivos/limpieza-portafolio.js';
import { almacenDePrueba002, clasificaciones002, montarHu03, perfilValido, type EntornoHu03 } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';
import { base64, crearImagen, marcadorSensible } from '../../soporte/prestadores-catalogo/imagenes.js';

/** Almacén real con fallos inyectables: simula una caída de Garage sin detener el servicio compartido. */
class AlmacenInestable implements AlmacenPortafolio {
  caido = { guardar: false, eliminar: false };
  constructor(private readonly real: AlmacenPortafolio) {}
  claveNueva(id: string) { return this.real.claveNueva(id); }
  pertenece(clave: string) { return this.real.pertenece(clave); }
  guardar(clave: string, bytes: Uint8Array) { return this.caido.guardar ? Promise.reject(new Error('Garage caído')) : this.real.guardar(clave, bytes); }
  leer(clave: string) { return this.real.leer(clave); }
  eliminar(clave: string) { return this.caido.eliminar ? Promise.reject(new Error('Garage caído')) : this.real.eliminar(clave); }
  listar(): AsyncIterable<ObjetoListado> { return this.real.listar(); }
}

let e: EntornoHu03;
let s3: Awaited<ReturnType<typeof almacenDePrueba002>>;
let inestable: AlmacenInestable;
beforeAll(async () => { s3 = await almacenDePrueba002(); inestable = new AlmacenInestable(s3.almacen); e = await montarHu03({ almacen: inestable }); });
afterAll(async () => { try { await e?.cerrar(); } finally { await s3?.limpiar(); } });

const trabajo = { titulo: 'Fachada ficticia', descripcion: 'Trabajo anterior de prueba.' };
const jpeg = async (extra: Parameters<typeof crearImagen>[0] = {}) => base64(await crearImagen({ color: '#' + randomUUID().slice(0, 6), ...extra }));
const cuerpo = async (versionTrabajo: number, extra: Parameters<typeof crearImagen>[0] = {}) => ({ versionTrabajo, tipoMime: 'image/jpeg', contenidoBase64: await jpeg(extra) });
async function conTrabajo() {
  const cuenta = await e.nuevaCuenta('prestador');
  const perfil = (await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002)).expect(201)).body;
  const creado = (await e.crearTrabajo(cuenta.token, { versionPerfil: perfil.version, ...trabajo }).expect(201)).body;
  return { cuenta, prestadorId: perfil.prestadorId as string, perfilVersion: creado.versionPerfil as number, trabajoId: creado.trabajo.trabajoId as string, version: creado.trabajo.version as number };
}
const limpieza = (extra: Partial<ConstructorParameters<typeof LimpiezaPortafolio>[2]> = {}, ahora?: () => Date) =>
  new LimpiezaPortafolio(e.db, inestable, { arrendamientoSegundos: 120, lote: 50, reintentoSegundos: 1, gracia: 15 * 60 * 1000, ...extra }, ahora);
const pendientes = async (clave?: string) => await e.db.query(`SELECT clave,tipo,intentos FROM prestadores_objetos_pendientes${clave ? ' WHERE clave=$1' : ''} ORDER BY clave`, clave ? [clave] : []) as { clave: string; tipo: string; intentos: number }[];
const objetosFotografia = async (fotoId: string) => ((await e.db.query('SELECT objeto_clave FROM prestadores_fotografias WHERE id=$1', [fotoId])) as { objeto_clave: string }[])[0]?.objeto_clave;
const bloquear = async (sql: string, parametros: unknown[]) => {
  const q = e.db.createQueryRunner();
  await q.connect(); await q.startTransaction();
  await q.query(sql, parametros);
  return async () => { try { await q.rollbackTransaction(); } finally { await q.release(); } };
};
const hastaQue = async (condicion: () => Promise<boolean>, ms = 4000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await condicion()) return; await new Promise(r => setTimeout(r, 50)); } throw new Error('Condición no alcanzada.'); };

describe('escrituras simultáneas por último cupo', () => {
  test('dos intentos por el último cupo de foto se serializan: uno confirma y el otro no excede el límite', async () => {
    const t = await conTrabajo();
    let v = t.version;
    for (let i = 0; i < 3; i++) v = (await e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(v)).expect(201)).body.versionTrabajo;
    const [a, b] = await Promise.all([e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(v)), e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(v))]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((await e.obtenerPerfil(t.cuenta.token).expect(200)).body.trabajos[0].fotografias).toHaveLength(4);
    const quinta = await e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(v + 1)).expect(422);
    expect(quinta.body.codigo).toBe('LIMITE_PORTAFOLIO');
    // Los objetos de los intentos perdedores no quedan publicados: solo existen las cuatro imágenes vinculadas.
    const vinculadas = ((await e.db.query('SELECT objeto_clave FROM prestadores_fotografias WHERE trabajo_id=$1', [t.trabajoId])) as { objeto_clave: string }[]).map(f => f.objeto_clave);
    expect(vinculadas).toHaveLength(4);
    const enBucket = await s3.claves();
    for (const clave of vinculadas) expect(enBucket).toContain(clave);
  }, 60000);

  test('dos intentos por el último cupo de trabajo se serializan y el portafolio no supera diez', async () => {
    const cuenta = await e.nuevaCuenta('prestador');
    let version = (await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002)).expect(201)).body.version as number;
    for (let i = 0; i < 9; i++) version = (await e.crearTrabajo(cuenta.token, { versionPerfil: version, ...trabajo, titulo: `Trabajo ${i}` }).expect(201)).body.versionPerfil;
    const [a, b] = await Promise.all([e.crearTrabajo(cuenta.token, { versionPerfil: version, ...trabajo, titulo: 'Último 1' }), e.crearTrabajo(cuenta.token, { versionPerfil: version, ...trabajo, titulo: 'Último 2' })]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((await e.obtenerPerfil(cuenta.token).expect(200)).body.trabajos).toHaveLength(10);
    const total = Number(((await e.db.query('SELECT count(*)::int AS n FROM prestadores_trabajos t JOIN prestadores_perfiles p ON p.id=t.prestador_id WHERE p.cuenta_id=$1', [cuenta.cuentaId])) as { n: number }[])[0]!.n);
    expect(total).toBe(10);
  }, 60000);

  test('la misma clave de idempotencia registra una sola fotografía y no deja objetos sobrantes', async () => {
    const t = await conTrabajo();
    const clave = randomUUID();
    const datos = await cuerpo(t.version);
    const [a, b] = await Promise.all([e.agregarFoto(t.cuenta.token, t.trabajoId, datos, clave), e.agregarFoto(t.cuenta.token, t.trabajoId, datos, clave)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body).toEqual(b.body);
    const filas = await e.db.query('SELECT objeto_clave FROM prestadores_fotografias WHERE trabajo_id=$1', [t.trabajoId]) as { objeto_clave: string }[];
    expect(filas).toHaveLength(1);
    const enBucket = (await s3.claves()).filter(k => k.includes(t.prestadorId));
    expect(enBucket).toEqual([filas[0]!.objeto_clave]);
  }, 30000);
});

describe('reemplazo, eliminación y recuperación ante caídas de Garage', () => {
  test('un reemplazo fallido por caída del almacén conserva la imagen anterior y no cambia el recuento', async () => {
    const t = await conTrabajo();
    const alta = (await e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(t.version)).expect(201)).body;
    const fotoId = alta.fotografia.fotografiaId as string;
    const antes = (await e.fotoPublica(t.prestadorId, t.trabajoId, fotoId).expect(200)).body.contenidoBase64;
    inestable.caido.guardar = true;
    try { await e.reemplazarFoto(t.cuenta.token, t.trabajoId, fotoId, await cuerpo(alta.versionTrabajo)).expect(503); } finally { inestable.caido.guardar = false; }
    expect((await e.fotoPublica(t.prestadorId, t.trabajoId, fotoId).expect(200)).body.contenidoBase64).toBe(antes);
    const perfil = (await e.obtenerPerfil(t.cuenta.token).expect(200)).body;
    expect(perfil.trabajos[0].fotografias).toHaveLength(1);
    expect(perfil.trabajos[0].version).toBe(alta.versionTrabajo);
    // La preparación quedó registrada para su recuperación y el siguiente reemplazo funciona.
    expect((await pendientes()).some(p => p.tipo === 'PREPARACION')).toBe(true);
    await e.reemplazarFoto(t.cuenta.token, t.trabajoId, fotoId, await cuerpo(alta.versionTrabajo, { color: '#00ff00' })).expect(200);
  }, 30000);

  test('el borrado revoca la entrega al confirmar aunque Garage esté caído y el limpiador lo reintenta', async () => {
    await limpieza().ejecutar(); // vacía los trabajos vencidos de las demás pruebas
    const t = await conTrabajo();
    const alta = (await e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(t.version)).expect(201)).body;
    const fotoId = alta.fotografia.fotografiaId as string;
    const clave = (await objetosFotografia(fotoId))!;
    inestable.caido.eliminar = true;
    try {
      const baja = await e.eliminarFoto(t.cuenta.token, t.trabajoId, fotoId, alta.versionTrabajo).expect(200);
      expect(baja.body.versionTrabajo).toBe(alta.versionTrabajo + 1);
      await e.fotoPublica(t.prestadorId, t.trabajoId, fotoId).expect(404);
      expect(await pendientes(clave)).toEqual([expect.objectContaining({ tipo: 'PURGA', intentos: 0 })]);
      const fallida = await limpieza().ejecutar();
      expect(fallida).toMatchObject({ purgados: 0, reintentos: 1 });
      expect(await pendientes(clave)).toEqual([expect.objectContaining({ tipo: 'PURGA', intentos: 1 })]);
      expect(await s3.claves()).toContain(clave);
    } finally { inestable.caido.eliminar = false; }
    const recuperada = await limpieza({}, () => new Date(Date.now() + 3_600_000)).ejecutar();
    expect(recuperada).toMatchObject({ purgados: 1, reintentos: 0 });
    expect(await pendientes(clave)).toEqual([]);
    expect(await s3.claves()).not.toContain(clave);
    expect((await e.obtenerPerfil(t.cuenta.token).expect(200)).body.trabajos[0].fotografias).toEqual([]);
    // Se libera el cupo: el trabajo admite otra fotografía.
    await e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(alta.versionTrabajo + 1)).expect(201);
  }, 30000);

  test('una preparación vencida y un objeto huérfano se recuperan; los objetos referenciados y ajenos al ámbito se respetan', async () => {
    const t = await conTrabajo();
    const alta = (await e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(t.version)).expect(201)).body;
    const vinculada = (await objetosFotografia(alta.fotografia.fotografiaId))!;
    const bytes = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).webp().toBuffer();
    // Preparación vencida: objeto escrito y fila de preparación sin vínculo.
    const preparada = inestable.claveNueva(t.prestadorId);
    await inestable.guardar(preparada, bytes);
    await e.db.query("INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion) VALUES($1,'PREPARACION',$2,now() - interval '1 minute')", [preparada, t.prestadorId]);
    // Huérfano: escritura tardía sin fila ni vínculo.
    const huerfana = inestable.claveNueva(t.prestadorId);
    await inestable.guardar(huerfana, bytes);
    // Objeto de otro ámbito (por ejemplo, de la 001) en el mismo bucket: nunca se toca.
    const ajena = `pruebas/${randomUUID()}/usuarios/${randomUUID()}/${randomUUID()}`;
    await s3.cliente.send(new PutObjectCommand({ Bucket: s3.bucket, Key: ajena, Body: bytes }));
    await e.db.query("INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion) VALUES($1,'PURGA',$2,now() - interval '1 minute')", [ajena, t.prestadorId]);
    try {
      const r = await limpieza({ gracia: 0 }).ejecutar();
      expect(r.descartados).toBeGreaterThanOrEqual(2);
      expect(await pendientes(ajena)).toEqual([]);
      expect(await s3.claves()).not.toContain(preparada);
      expect(await limpieza({ gracia: 0 }).reconciliarHuerfanos()).toBe(1);
      const claves = await s3.claves();
      expect(claves).not.toContain(huerfana);
      expect(claves).toContain(vinculada);
      const fuera = await s3.cliente.send(new HeadObjectCommand({ Bucket: s3.bucket, Key: ajena }));
      expect(fuera.ContentLength).toBeGreaterThan(0);
      await e.fotoPublica(t.prestadorId, t.trabajoId, alta.fotografia.fotografiaId).expect(200);
    } finally {
      await s3.cliente.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: ajena }));
    }
  }, 30000);

  test('una purga de un objeto aún referenciado se descarta sin borrarlo', async () => {
    await limpieza().ejecutar();
    const t = await conTrabajo();
    const alta = (await e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(t.version)).expect(201)).body;
    const clave = (await objetosFotografia(alta.fotografia.fotografiaId))!;
    await e.db.query("INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion) VALUES($1,'PURGA',$2,now() - interval '1 minute')", [clave, t.prestadorId]);
    expect((await limpieza().ejecutar()).purgados).toBe(0);
    expect(await s3.claves()).toContain(clave);
    await e.fotoPublica(t.prestadorId, t.trabajoId, alta.fotografia.fotografiaId).expect(200);
  }, 30000);
});

describe('privacidad y acceso ajeno', () => {
  test('una alta con GPS no es pública antes de confirmarse y, al confirmar, se entrega solo la variante WebP saneada (CA-PRE-06)', async () => {
    const t = await conTrabajo();
    const original = await crearImagen({ sensible: true, ancho: 200, alto: 100, color: '#cc3300' });
    expect(original.includes(Buffer.from(marcadorSensible))).toBe(true);
    // Se retiene la confirmación bloqueando el perfil: el objeto ya se escribió pero aún no está vinculado.
    const liberar = await bloquear('SELECT id FROM prestadores_perfiles WHERE cuenta_id=$1 FOR UPDATE', [t.cuenta.cuentaId]);
    let alta: Promise<{ status: number; body: { fotografia: { fotografiaId: string } } }>;
    let liberada = false;
    try {
      alta = e.agregarFoto(t.cuenta.token, t.trabajoId, { versionTrabajo: t.version, tipoMime: 'image/jpeg', contenidoBase64: base64(original) }).then(r => r as never);
      await hastaQue(async () => (await s3.claves()).some(k => k.includes(t.prestadorId)));
      const pendiente = (await s3.claves()).find(k => k.includes(t.prestadorId))!;
      const idPendiente = pendiente.split('/').at(-1)!;
      const r = await e.fotoPublica(t.prestadorId, t.trabajoId, idPendiente).expect(404);
      expect(r.body.codigo).toBe('RECURSO_NO_DISPONIBLE');
      expect(r.text).not.toContain('contenidoBase64');
      expect(((await e.db.query('SELECT 1 FROM prestadores_fotografias WHERE trabajo_id=$1', [t.trabajoId])) as unknown[])).toHaveLength(0);
      await liberar(); liberada = true;
    } finally { if (!liberada) await liberar(); }
    const confirmada = await alta;
    expect(confirmada.status).toBe(201);
    const publica = await e.fotoPublica(t.prestadorId, t.trabajoId, confirmada.body.fotografia.fotografiaId).expect(200);
    const bytes = Buffer.from(publica.body.contenidoBase64 as string, 'base64');
    const meta = await sharp(bytes).metadata();
    expect([meta.format, meta.exif, meta.xmp, meta.iptc]).toEqual(['webp', undefined, undefined, undefined]);
    expect(bytes.includes(Buffer.from(marcadorSensible))).toBe(false);
    expect([meta.width, meta.height]).toEqual([200, 100]);
    expect(publica.headers['cache-control']).toBe('no-store');
  }, 30000);

  test('durante un reemplazo solo se sirve la variante anterior ya confirmada', async () => {
    const t = await conTrabajo();
    const alta = (await e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(t.version, { color: '#111111' })).expect(201)).body;
    const fotoId = alta.fotografia.fotografiaId as string;
    const anterior = (await e.fotoPublica(t.prestadorId, t.trabajoId, fotoId).expect(200)).body.contenidoBase64;
    const liberar = await bloquear('SELECT id FROM prestadores_perfiles WHERE cuenta_id=$1 FOR UPDATE', [t.cuenta.cuentaId]);
    let reemplazo: Promise<{ status: number }>; let liberada = false;
    try {
      const antes = (await s3.claves()).length;
      reemplazo = e.reemplazarFoto(t.cuenta.token, t.trabajoId, fotoId, await cuerpo(alta.versionTrabajo, { color: '#eeeeee' })).then(r => r as never);
      await hastaQue(async () => (await s3.claves()).length > antes);
      expect((await e.fotoPublica(t.prestadorId, t.trabajoId, fotoId).expect(200)).body.contenidoBase64).toBe(anterior);
      await liberar(); liberada = true;
    } finally { if (!liberada) await liberar(); }
    expect((await reemplazo).status).toBe(200);
    expect((await e.fotoPublica(t.prestadorId, t.trabajoId, fotoId).expect(200)).body.contenidoBase64).not.toBe(anterior);
  }, 30000);

  test('un titular ajeno no agrega, reemplaza ni elimina fotografías de otro portafolio y las imágenes se conservan (CA-PRE-03)', async () => {
    const t = await conTrabajo();
    const alta = (await e.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(t.version)).expect(201)).body;
    const fotoId = alta.fotografia.fotografiaId as string;
    const ajeno = await e.nuevaCuenta('prestador');
    await e.guardarPerfil(ajeno.token, perfilValido(clasificaciones002)).expect(201);
    const antes = (await e.fotoPublica(t.prestadorId, t.trabajoId, fotoId).expect(200)).body.contenidoBase64;
    const objetosAntes = (await s3.claves()).length;
    await e.agregarFoto(ajeno.token, t.trabajoId, await cuerpo(alta.versionTrabajo)).expect(404);
    await e.reemplazarFoto(ajeno.token, t.trabajoId, fotoId, await cuerpo(alta.versionTrabajo)).expect(404);
    await e.eliminarFoto(ajeno.token, t.trabajoId, fotoId, alta.versionTrabajo).expect(404);
    await e.agregarFoto((await e.nuevaCuenta('cliente')).token, t.trabajoId, await cuerpo(alta.versionTrabajo)).expect(403);
    expect((await e.fotoPublica(t.prestadorId, t.trabajoId, fotoId).expect(200)).body.contenidoBase64).toBe(antes);
    expect((await s3.claves()).length).toBe(objetosAntes);
  }, 30000);
});

describe('persistencia, proyección y aislamiento del almacén', () => {
  const rechazaConCodigo = async (sql: string, parametros: unknown[], codigo: string) => {
    await expect(e.db.query(sql, parametros)).rejects.toMatchObject({ code: codigo });
  };
  test('PostgreSQL conserva cuenta única, UUID público distinto y restricciones de formato', async () => {
    const t = await conTrabajo();
    const insertar = 'INSERT INTO prestadores_perfiles(id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada) VALUES ($1,$2,$3,$4,$5,true)';
    await rechazaConCodigo(insertar, [randomUUID(), t.cuenta.cuentaId, 'Duplicado', 'TECNICO', 'x'], '23505');
    const mismo = randomUUID();
    await rechazaConCodigo(insertar, [mismo, mismo, 'Mismo id', 'TECNICO', 'x'], '23514');
    await rechazaConCodigo(insertar, [randomUUID(), randomUUID(), 'Tipo', 'GERENTE', 'x'], '23514');
    await rechazaConCodigo(insertar, [randomUUID(), randomUUID(), '   ', 'TECNICO', 'x'], '23514');
    await rechazaConCodigo('INSERT INTO prestadores_zonas(prestador_id,distrito_codigo) VALUES ($1,$2)', [t.prestadorId, 'huanta'], '23514');
    await rechazaConCodigo('INSERT INTO prestadores_trabajos(id,prestador_id,titulo,descripcion) VALUES ($1,$2,$3,$4)', [randomUUID(), randomUUID(), 'x', 'x'], '23503');
    const foto = "INSERT INTO prestadores_fotografias(id,trabajo_id,objeto_clave,mime,bytes,ancho,alto,checksum) VALUES ($1,$2,$3,$4,10,10,10,decode(repeat('00',32),'hex'))";
    const clave = s3.almacen.claveNueva(t.prestadorId);
    await rechazaConCodigo(foto, [randomUUID(), t.trabajoId, clave, 'image/png'], '23514');
    await rechazaConCodigo(foto, [randomUUID(), t.trabajoId, 'clave/arbitraria', 'image/webp'], '23514');
  });

  test('guardar el perfil actualiza la proyección y la revisión de Catálogo en la misma transacción', async () => {
    const revision = async () => BigInt(((await e.db.query('SELECT revision::text AS r FROM catalogo_revision_oferta')) as { r: string }[])[0]!.r);
    const cuenta = await e.nuevaCuenta('prestador');
    const r0 = await revision();
    const alta = (await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002)).expect(201)).body;
    expect(await revision()).toBe(r0 + 1n);
    const proyeccion = async () => ((await e.db.query('SELECT * FROM catalogo_proyeccion_prestadores WHERE prestador_id=$1', [alta.prestadorId])) as Record<string, unknown>[])[0];
    expect(await proyeccion()).toMatchObject({ nombre_publico: 'Maestro de obra ficticio', tipo: 'TECNICO', disponibilidad_declarada: true, publicable: true,
      especialidades: [clasificaciones002.hija], distritos: ['ayacucho'] });
    expect(Object.keys((await proyeccion())!).sort()).toEqual(['disponibilidad_declarada', 'distritos', 'especialidades', 'nombre_publico', 'prestador_id', 'publicable', 'tipo']);
    await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002, { version: 1, nombrePublico: 'Nombre nuevo', disponibilidadDeclarada: false, distritos: ['ayacucho', 'carmen-alto'] })).expect(200);
    expect(await revision()).toBe(r0 + 2n);
    expect(await proyeccion()).toMatchObject({ nombre_publico: 'Nombre nuevo', disponibilidad_declarada: false, distritos: ['ayacucho', 'carmen-alto'] });
    // Un rechazo revierte proyección y revisión juntas.
    await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002, { version: 1, nombrePublico: 'Obsoleto' })).expect(409);
    await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002, { version: 2, especialidadesIds: [clasificaciones002.inactiva] })).expect(422);
    expect(await revision()).toBe(r0 + 2n);
    expect(await proyeccion()).toMatchObject({ nombre_publico: 'Nombre nuevo' });
    // Alta de trabajo y fotografías no cambian la oferta pública.
    await e.crearTrabajo(cuenta.token, { versionPerfil: 2, ...trabajo }).expect(201);
    expect(await revision()).toBe(r0 + 2n);
  });

  test('un trabajo reclamado con arrendamiento vigente no lo procesa otro limpiador', async () => {
    await limpieza().ejecutar();
    const t = await conTrabajo();
    const clave = s3.almacen.claveNueva(t.prestadorId);
    await inestable.guardar(clave, await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).webp().toBuffer());
    await e.db.query("INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion,arrendado_hasta) VALUES($1,'PURGA',$2,now() - interval '1 minute',now() + interval '1 hour')", [clave, t.prestadorId]);
    expect(await limpieza().ejecutar()).toMatchObject({ purgados: 0, descartados: 0, reintentos: 0 });
    expect(await s3.claves()).toContain(clave);
    // Al vencer el arrendamiento, otro procesador lo recupera.
    expect(await limpieza({}, () => new Date(Date.now() + 2 * 3_600_000)).ejecutar()).toMatchObject({ purgados: 1 });
    expect(await s3.claves()).not.toContain(clave);
  });

  test('la identidad del portafolio no crea buckets ni accede a otros', async () => {
    await expect(s3.cliente.send(new CreateBucketCommand({ Bucket: `ajeno-${randomUUID()}` }))).rejects.toBeDefined();
    await expect(s3.cliente.send(new HeadBucketCommand({ Bucket: 'usuarios-validacion' }))).rejects.toBeDefined();
    await s3.cliente.send(new HeadBucketCommand({ Bucket: s3.bucket }));
    expect(() => s3.almacen.guardar('usuarios/otra-clave', new Uint8Array())).rejects.toThrow();
    expect(s3.almacen.pertenece('usuarios/a/b')).toBe(false);
  });
});

describe('retraso de producción de 60 segundos en la purga', () => {
  // Aplicación con la regla de producción. El tiempo se controla con el reloj inyectable del limpiador, sin esperas reales.
  let e60: EntornoHu03;
  beforeAll(async () => { e60 = await montarHu03({ almacen: s3.almacen, retrasoPurgaSegundos: 60 }); });
  afterAll(async () => { await e60?.cerrar(); });
  const claveDe = async (fotoId: string) => ((await e60.db.query('SELECT objeto_clave FROM prestadores_fotografias WHERE id=$1', [fotoId])) as { objeto_clave: string }[])[0]?.objeto_clave;
  const limpiador = (ahora?: () => Date) => new LimpiezaPortafolio(e60.db, s3.almacen, { arrendamientoSegundos: 120, lote: 50, reintentoSegundos: 1, gracia: 15 * 60 * 1000 }, ahora);

  test('la purga se programa a 60 s, no borra antes de vencer y luego elimina solo la clave anterior sin referencias', async () => {
    const cuenta = await e60.nuevaCuenta('prestador');
    const perfil = (await e60.guardarPerfil(cuenta.token, perfilValido(clasificaciones002)).expect(201)).body;
    const creado = (await e60.crearTrabajo(cuenta.token, { versionPerfil: perfil.version, ...trabajo }).expect(201)).body;
    const trabajoId = creado.trabajo.trabajoId as string;
    const escritura = async (versionTrabajo: number, color: string) => ({ versionTrabajo, tipoMime: 'image/jpeg', contenidoBase64: base64(await crearImagen({ color })) });
    await limpiador(() => new Date(Date.now() + 3_600_000)).ejecutar(); // vacía las tareas de otras pruebas de esta base
    const alta = (await e60.agregarFoto(cuenta.token, trabajoId, await escritura(1, '#aa0000')).expect(201)).body;
    const fotoId = alta.fotografia.fotografiaId as string;
    const claveAnterior = (await claveDe(fotoId))!;
    const reemplazo = (await e60.reemplazarFoto(cuenta.token, trabajoId, fotoId, await escritura(alta.versionTrabajo, '#00aa00')).expect(200)).body;
    const claveNueva = (await claveDe(fotoId))!;
    expect(claveNueva).not.toBe(claveAnterior);

    // 1. Programada con 60 segundos de retraso, medidos por PostgreSQL (tolerancia de 5 s por la propia ejecución).
    const { segundos } = ((await e60.db.query("SELECT extract(epoch FROM proxima_ejecucion - now())::float AS segundos FROM prestadores_objetos_pendientes WHERE clave=$1 AND tipo='PURGA'", [claveAnterior])) as { segundos: number }[])[0]!;
    expect(segundos).toBeGreaterThan(55);
    expect(segundos).toBeLessThanOrEqual(60);

    // 2. Antes de vencer, ni con el reloj real ni 5 s antes del plazo se elimina el objeto.
    expect(await limpiador().ejecutar()).toMatchObject({ purgados: 0, descartados: 0, reintentos: 0 });
    expect(await limpiador(() => new Date(Date.now() + 50_000)).ejecutar()).toMatchObject({ purgados: 0 });
    expect(await s3.claves()).toEqual(expect.arrayContaining([claveAnterior, claveNueva]));
    await e60.fotoPublica(perfil.prestadorId, trabajoId, fotoId).expect(200);

    // 3. Vencido el plazo se elimina solo la clave anterior, que ya no está referenciada.
    expect(await limpiador(() => new Date(Date.now() + 61_000)).ejecutar()).toMatchObject({ purgados: 1, reintentos: 0 });
    const claves = await s3.claves();
    expect(claves).not.toContain(claveAnterior);
    expect(claves).toContain(claveNueva);
    expect(await claveDe(fotoId)).toBe(claveNueva);

    // 4. La nueva fotografía sigue disponible y una eliminada devuelve 404 de inmediato, antes de purgar el objeto.
    await e60.fotoPublica(perfil.prestadorId, trabajoId, fotoId).expect(200);
    await e60.eliminarFoto(cuenta.token, trabajoId, fotoId, reemplazo.versionTrabajo).expect(200);
    await e60.fotoPublica(perfil.prestadorId, trabajoId, fotoId).expect(404);
    expect(await s3.claves()).toContain(claveNueva);
    expect(await limpiador().ejecutar()).toMatchObject({ purgados: 0 });
    expect(await limpiador(() => new Date(Date.now() + 61_000)).ejecutar()).toMatchObject({ purgados: 1 });
    expect(await s3.claves()).not.toContain(claveNueva);
  }, 30000);

  test('una purga vencida no borra un objeto que volvió a estar referenciado', async () => {
    const cuenta = await e60.nuevaCuenta('prestador');
    const perfil = (await e60.guardarPerfil(cuenta.token, perfilValido(clasificaciones002)).expect(201)).body;
    const trabajoId = (await e60.crearTrabajo(cuenta.token, { versionPerfil: perfil.version, ...trabajo }).expect(201)).body.trabajo.trabajoId as string;
    const alta = (await e60.agregarFoto(cuenta.token, trabajoId, { versionTrabajo: 1, tipoMime: 'image/jpeg', contenidoBase64: base64(await crearImagen({ color: '#0000aa' })) }).expect(201)).body;
    const clave = (await claveDe(alta.fotografia.fotografiaId))!;
    await e60.db.query("INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion) VALUES($1,'PURGA',$2,now() + interval '60 seconds')", [clave, perfil.prestadorId]);
    expect(await limpiador(() => new Date(Date.now() + 61_000)).ejecutar()).toMatchObject({ purgados: 0, descartados: 1 });
    expect(await s3.claves()).toContain(clave);
    await e60.fotoPublica(perfil.prestadorId, trabajoId, alta.fotografia.fotografiaId).expect(200);
  }, 30000);
});
