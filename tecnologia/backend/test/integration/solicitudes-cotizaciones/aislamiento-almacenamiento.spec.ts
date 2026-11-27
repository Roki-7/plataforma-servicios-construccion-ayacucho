import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { crearAplicacionCompleta003 } from '../../../src/composicion/aplicacion-003.js';
import { persistencia003 } from '../../../src/composicion/persistencia.js';
import { persistenciaOferta002 } from '../../../src/composicion/oferta-002.js';
import { aplicarMigraciones003, persistenciaOferta003 } from '../../../src/composicion/migraciones-003.js';
import { OrigenPostgresDocker } from '../../../src/composicion/respaldo-002.js';
import { UnidadDeTrabajoPostgres } from '../../../src/compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { SolicitudesS3 } from '../../../src/modulos/solicitudes/infraestructura/archivos/solicitudes-s3.js';
import { PortafolioS3 } from '../../../src/modulos/prestadores/infraestructura/archivos/portafolio-s3.js';
import { LimpiezaPortafolio } from '../../../src/modulos/prestadores/infraestructura/archivos/limpieza-portafolio.js';
import { clavesDeRespaldo, respaldarPortafolio, sha256, type InstantaneaPortafolio } from '../../../src/modulos/prestadores/infraestructura/respaldo/respaldo-portafolio.js';
import { FotografiasS3 } from '../../../src/modulos/usuarios-acceso/infraestructura/almacenamiento/fotografias-s3.js';
import { limpiarTemporales } from '../../../src/modulos/usuarios-acceso/infraestructura/almacenamiento/limpiar-temporales.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';
import { almacenamientoAislado003 } from '../../soporte/solicitudes-cotizaciones/almacenamiento.js';
import { iniciarSesion003, sembrarDatos003 } from '../../soporte/solicitudes-cotizaciones/datos.js';
import { configuracionDePrueba003 } from '../../soporte/solicitudes-cotizaciones/entorno.js';
import { leerConfiguracion003, recursos003 } from '../../../scripts/entorno-003.js';

/**
 * CP-307 y CP-310 con Garage real (T040). El plan decidió reutilizar el bucket único con el prefijo `solicitudes/` y aislar por aplicación, porque Garage no
 * tiene política por prefijo. Estas comprobaciones demuestran que ese aislamiento se sostiene. SI ALGUNA FALLA, SE REABRE LA DECISIÓN Y SE JUSTIFICA UN BUCKET PROPIO.
 * Solo se crean y borran objetos por clave exacta o bajo prefijos de prueba `pruebas/<uuid>/…`; los de la clave real `solicitudes/` los borra la propia prueba.
 */
let cliente: S3Client; let bucket: string; let cerrarAlmacen: () => Promise<number>; let prefijoPrueba: string;
let base: Awaited<ReturnType<typeof baseAislada003>>; let db: DataSource; let uow: UnidadDeTrabajoPostgres; let directorio: string;
const aBorrar: string[] = [];
const uuid = () => randomUUID();
const endpoint = recursos003.S3_ENDPOINT;

async function poner(clave: string, contenido = randomBytes(24)): Promise<Buffer> {
  await cliente.send(new PutObjectCommand({ Bucket: bucket, Key: clave, Body: contenido, ContentType: 'image/webp' })); aBorrar.push(clave);
  return contenido;
}
const existe = async (clave: string): Promise<boolean> => {
  try { await cliente.send(new GetObjectCommand({ Bucket: bucket, Key: clave })); return true; } catch { return false; }
};
async function listar(prefijo: string): Promise<string[]> {
  const claves: string[] = []; let token: string | undefined;
  do {
    const p = await cliente.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefijo, ContinuationToken: token }));
    for (const o of p.Contents ?? []) if (o.Key) claves.push(o.Key);
    token = p.IsTruncated ? p.NextContinuationToken : undefined;
  } while (token);
  return claves;
}

beforeAll(async () => {
  const a = await almacenamientoAislado003(); cliente = a.cliente; bucket = a.bucket; cerrarAlmacen = a.cerrar; prefijoPrueba = a.prefijo;
  base = await baseAislada003(); await aplicarMigraciones003(base.url);
  db = persistencia003(base.url, persistenciaOferta002, persistenciaOferta003); await db.initialize(); uow = new UnidadDeTrabajoPostgres(db);
  directorio = await mkdtemp(join(tmpdir(), 'aislamiento-003-'));
}, 180000);
afterAll(async () => {
  try {
    for (const clave of aBorrar) await cliente?.send(new DeleteObjectCommand({ Bucket: bucket, Key: clave })).catch(() => undefined);
    if (db?.isInitialized) await db.destroy();
    await base?.cerrar(); await rm(directorio, { recursive: true, force: true });
  } finally { await cerrarAlmacen?.(); }
}, 120000);

describe('acceso anónimo', () => {
  test('sin firma, listar, leer, escribir y borrar en el bucket se rechaza (401 o 403)', async () => {
    const clave = `pruebas/${uuid()}/solicitudes/${uuid()}/${uuid()}`; await poner(clave);
    const estados: number[] = [];
    for (const [metodo, ruta, cuerpo] of [['GET', `/${bucket}?list-type=2&prefix=solicitudes%2F`], ['GET', `/${bucket}/${clave}`], ['HEAD', `/${bucket}/${clave}`], ['PUT', `/${bucket}/${clave}`, 'x'],
      ['DELETE', `/${bucket}/${clave}`], ['GET', `/${bucket}/solicitudes/${uuid()}/${uuid()}`]] as const) {
      const r = await fetch(`${endpoint}${ruta}`, { method: metodo, ...(cuerpo ? { body: cuerpo } : {}), signal: AbortSignal.timeout(8000) }); await r.arrayBuffer(); estados.push(r.status);
    }
    expect(estados.every(e => e === 401 || e === 403)).toBe(true);
    expect(await existe(clave)).toBe(true);
  });
  test('el bucket no es un sitio web y la identidad de la aplicación solo tiene lectura y escritura', async () => {
    const { execFileSync } = await import('node:child_process');
    const info = execFileSync('docker', ['exec', 'ayacucho-003-validacion-objetos-1', '/garage', 'bucket', 'info', bucket], { encoding: 'utf8' });
    expect(info).toMatch(/Website access:\s+false/);
    expect(info).toMatch(/\bRW\b/);
    expect(info).not.toMatch(/\bRWO\b/);
  });
  test('la configuración local usa un único bucket para la 003 y no define credenciales adicionales', async () => {
    const env = await leerConfiguracion003();
    expect(env['S3_BUCKET']).toBe(bucket);
    expect(Object.keys(env).filter(k => /^S3_.*(ACCESS|SECRET)/.test(k)).sort()).toEqual(['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']);
  });
});

describe('adaptador de solicitudes sobre el bucket real', () => {
  test('guarda, lee, lista y borra con el prefijo de prueba, y el borrado repetido no falla', async () => {
    const almacen = new SolicitudesS3(cliente, bucket, prefijoPrueba);
    const clave = almacen.claveNueva(uuid(), uuid()); const bytes = new Uint8Array(randomBytes(64));
    await almacen.guardar(clave, bytes); aBorrar.push(clave);
    expect(Buffer.from(await almacen.leer(clave)).equals(Buffer.from(bytes))).toBe(true);
    const listadas: string[] = []; for await (const o of almacen.listar()) listadas.push(o.clave);
    expect(listadas).toContain(clave);
    await almacen.eliminar(clave); await almacen.eliminar(clave);
    expect(await existe(clave)).toBe(false);
  });
  test('con el prefijo real solicitudes/ opera solo sobre su forma estricta y lista únicamente ese prefijo', async () => {
    const almacen = new SolicitudesS3(cliente, bucket);
    const clave = almacen.claveNueva(uuid(), uuid()); await almacen.guardar(clave, new Uint8Array([1, 2, 3])); aBorrar.push(clave);
    const ajena = await poner(`portafolio/${uuid()}/${uuid()}`); void ajena;
    const listadas: string[] = []; for await (const o of almacen.listar()) listadas.push(o.clave);
    expect(listadas).toContain(clave);
    expect(listadas.every(k => k.startsWith('solicitudes/'))).toBe(true);
    await almacen.eliminar(clave);
    expect(await existe(clave)).toBe(false);
  });
  test('rechaza claves fuera de su prefijo sin tocarlas: un objeto de portafolio/ o usuarios/ sigue intacto', async () => {
    const almacen = new SolicitudesS3(cliente, bucket);
    const portafolio = `portafolio/${uuid()}/${uuid()}`; const usuarios = `usuarios/${uuid()}/${uuid()}`;
    await poner(portafolio); await poner(usuarios);
    for (const clave of [portafolio, usuarios]) {
      await expect(almacen.leer(clave)).rejects.toThrow('fuera del ámbito');
      await expect(almacen.eliminar(clave)).rejects.toThrow('fuera del ámbito');
      await expect(almacen.guardar(clave, new Uint8Array([9]))).rejects.toThrow('fuera del ámbito');
      expect(await existe(clave)).toBe(true);
    }
  });
  test('una clave con el prefijo de pruebas no es válida para el almacén de producción y viceversa', async () => {
    const produccion = new SolicitudesS3(cliente, bucket); const pruebas = new SolicitudesS3(cliente, bucket, prefijoPrueba);
    const k1 = produccion.claveNueva(uuid(), uuid()); const k2 = pruebas.claveNueva(uuid(), uuid());
    expect(pruebas.pertenece(k1)).toBe(false); expect(produccion.pertenece(k2)).toBe(false);
  });
});

describe('los adaptadores de 001 y 002 no ven los objetos de solicitudes/', () => {
  let solicitud: string;
  let contenidoSolicitud: Uint8Array;
  beforeAll(async () => { solicitud = `solicitudes/${uuid()}/${uuid()}`; contenidoSolicitud = await poner(solicitud); });

  test('el portafolio de 002 (portafolio/ y su variante de pruebas) no lee, lista ni borra objetos solicitudes/', async () => {
    for (const prefijo of ['portafolio/', `pruebas/${uuid()}/portafolio/`]) {
      const portafolio = new PortafolioS3(cliente, bucket, prefijo);
      await expect(portafolio.leer(solicitud)).rejects.toThrow('fuera del ámbito');
      await expect(portafolio.eliminar(solicitud)).rejects.toThrow('fuera del ámbito');
      await expect(portafolio.guardar(solicitud, new Uint8Array([1]))).rejects.toThrow('fuera del ámbito');
      const vistas: string[] = []; for await (const o of portafolio.listar()) vistas.push(o.clave);
      expect(vistas).not.toContain(solicitud);
      expect(portafolio.pertenece(solicitud)).toBe(false);
    }
    expect(await existe(solicitud)).toBe(true);
  });
  test('las fotografías de 001 (usuarios/) no eliminan objetos solicitudes/ y su limpieza de temporales los deja intactos', async () => {
    const prefijoUsuarios = `pruebas/${uuid()}/usuarios/`;
    const fotos = new FotografiasS3(cliente, bucket, db, uow, prefijoUsuarios);
    await expect(fotos.eliminarObjeto(solicitud)).rejects.toMatchObject({ http: 400 });
    const huerfano = `${prefijoUsuarios}${uuid()}/${uuid()}`; await poner(huerfano);
    // `ahora` en el futuro: todo objeto de usuarios/ sin fila es candidato. El de solicitudes/ no está en su prefijo.
    const retirados = await limpiarTemporales(db, fotos, 60_000, new Date(Date.now() + 3_600_000));
    expect(retirados).toBeGreaterThanOrEqual(1);
    expect(await existe(huerfano)).toBe(false);
    expect(await existe(solicitud)).toBe(true);
  });
  test('la limpieza de 002 conserva los objetos solicitudes/ aunque una entrada pendiente los nombre y aunque se reconcilie sin gracia', async () => {
    const prefijoPortafolio = `pruebas/${uuid()}/portafolio/`;
    const portafolio = new PortafolioS3(cliente, bucket, prefijoPortafolio);
    const prestador = uuid();
    const propio = portafolio.claveNueva(prestador); await portafolio.guardar(propio, new Uint8Array(randomBytes(16))); aBorrar.push(propio);
    // Entrada hostil: una purga vencida cuya clave es de solicitudes/. 002 debe descartarla sin borrar el objeto.
    const vencida = new Date(Date.now() - 60_000).toISOString();
    await db.query("INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion) VALUES($1,'PURGA',$2,$3),($4,'PURGA',$2,$3)", [solicitud, prestador, vencida, propio]);
    const limpieza = new LimpiezaPortafolio(db, portafolio, { arrendamientoSegundos: 120, lote: 50, reintentoSegundos: 60, gracia: 0 });
    const resultado = await limpieza.ejecutar();
    expect(resultado.purgados).toBe(1);
    expect(resultado.descartados).toBe(1);
    expect(await existe(propio)).toBe(false);
    expect(await existe(solicitud)).toBe(true);
    await limpieza.reconciliarHuerfanos();
    expect(await existe(solicitud)).toBe(true);
    expect(Number(((await db.query('SELECT count(*)::int AS n FROM prestadores_objetos_pendientes WHERE clave=$1', [solicitud])) as { n: number }[])[0]!.n)).toBe(0);
  });
  test('el respaldo de 002 con solicitudes/ presentes en el bucket es COMPLETO y no copia ni lee objetos ajenos; un inventario que nombrara uno se rechaza', async () => {
    const prefijoPortafolio = `pruebas/${uuid()}/portafolio/`; const portafolio = new PortafolioS3(cliente, bucket, prefijoPortafolio);
    const prestador = uuid(); const trabajo = uuid(); const propio = portafolio.claveNueva(prestador);
    const bytes = randomBytes(32); await portafolio.guardar(propio, bytes); aBorrar.push(propio);
    await db.query("INSERT INTO prestadores_perfiles(id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada) VALUES($1,$2,'Prestador ficticio','TECNICO','Experiencia ficticia',true)", [prestador, uuid()]);
    await db.query("INSERT INTO prestadores_trabajos(id,prestador_id,titulo,descripcion) VALUES($1,$2,'Trabajo ficticio','Descripción ficticia')", [trabajo, prestador]);
    await db.query("INSERT INTO prestadores_fotografias(id,trabajo_id,objeto_clave,mime,bytes,ancho,alto,checksum) VALUES($1,$2,$3,'image/webp',$4,64,48,decode($5,'hex'))",
      [uuid(), trabajo, propio, bytes.length, sha256(bytes)]);
    const referencia = (clave: string, b: Uint8Array) => ({ clave, bytes: b.length, mime: 'image/webp', sha256: sha256(b) });
    const origenAlterado = (fotografias: ReturnType<typeof referencia>[]) => ({
      abrirInstantanea: async (): Promise<InstantaneaPortafolio> => ({ snapshotId: 'instantanea', corteUtc: new Date().toISOString(), postgresMayor: 18, migraciones: [], fotografias, preparaciones: 0, purgas: 0, cerrar: async () => undefined }),
      volcar: async () => new Uint8Array([1, 2, 3]),
    });
    const claves = clavesDeRespaldo(randomBytes(32).toString('base64'));
    const respaldar = (origen: Parameters<typeof respaldarPortafolio>[0]['origen']) => respaldarPortafolio({ origen, almacen: portafolio, claves, directorio, aplicacion: 'prueba',
      origenLogico: { baseLogica: base.nombre, bucket, prefijo: prefijoPortafolio, espacioRedis: 'ayacucho:prueba' } });
    const manifiesto = await respaldar(new OrigenPostgresDocker(base.url, 'ayacucho-003-validacion-postgres-1'));
    expect(manifiesto).toMatchObject({ estado: 'COMPLETO', conteos: { fotografiasVigentes: 1, objetosCopiados: 1 } });
    expect(manifiesto.objetos.map(o => o.clave)).toEqual([propio]);
    await expect(respaldar(origenAlterado([referencia(solicitud, contenidoSolicitud)])))
      .rejects.toMatchObject({ codigo: 'OBJETO_AUSENTE', manifiesto: { estado: 'INCOMPLETO' } });
    expect(Buffer.from(await new SolicitudesS3(cliente, bucket).leer(solicitud))).toEqual(Buffer.from(contenidoSolicitud));
  }, 120000);

  test('la composición completa conserva el acceso de 001 y 002 con un objeto solicitudes/ presente en Garage', async () => {
    const config = await configuracionDePrueba003(base.url);
    const solicitudes = new SolicitudesS3(cliente, bucket);
    const portafolio = new PortafolioS3(cliente, bucket, `pruebas/${uuid()}/portafolio/`);
    const app = await crearAplicacionCompleta003(config, { prestadores: { almacen: portafolio }, solicitudes: { almacen: solicitudes }, worker: false });
    try {
      const datos = await sembrarDatos003(app, config.origen);
      const tokenCliente = await iniciarSesion003(app, config.origen, datos.clientes.clienteUno);
      const tokenPrestador = await iniciarSesion003(app, config.origen, datos.prestadores.beto);
      const http = request(app.app.getHttpServer());
      const perfil = await http.get('/api/v1/perfil').set('Authorization', `Bearer ${tokenCliente}`).expect(200);
      expect(perfil.body).toMatchObject({ cuentaId: datos.clientes.clienteUno.cuentaId, perfiles: ['cliente'] });
      await http.get('/api/v1/perfil').expect(401);
      const catalogo = await http.get('/api/v1/categorias').expect(200);
      expect(catalogo.body.categorias.length).toBeGreaterThan(0);
      const perfilProfesional = await http.get('/api/v1/prestadores/perfil').set('Authorization', `Bearer ${tokenPrestador}`).expect(200);
      expect(perfilProfesional.body).toMatchObject({ prestadorId: datos.prestadores.beto.prestadorId });
      await http.get('/api/v1/solicitudes/oportunidades').set('Authorization', `Bearer ${tokenPrestador}`).expect(200);
      expect(Buffer.from(await solicitudes.leer(solicitud))).toEqual(Buffer.from(contenidoSolicitud));
    } finally {
      await app.app.close();
    }
  }, 120000);
});

describe('inventario del bucket tras las pruebas', () => {
  test('los objetos de prueba se limpian por prefijo exacto y no queda ninguno bajo el prefijo de esta suite', async () => {
    const almacen = new SolicitudesS3(cliente, bucket, prefijoPrueba);
    for await (const o of almacen.listar()) await almacen.eliminar(o.clave);
    expect(await listar(prefijoPrueba)).toEqual([]);
  });
});
