import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { SolicitudesS3 } from '../../../src/modulos/solicitudes/infraestructura/archivos/solicitudes-s3.js';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';

// T036 · adaptador de almacenamiento de solicitudes sobre el bucket existente. Con un cliente doble: no necesita Garage. El comportamiento contra Garage real
// (acceso anónimo, aislamiento frente a 001 y 002) está en `aislamiento-almacenamiento.spec.ts` (integración).
const uuidA = '123e4567-e89b-42d3-a456-426614174000';
const uuidB = '223e4567-e89b-42d3-a456-426614174001';
const uuidC = '323e4567-e89b-42d3-a456-426614174002';
const BUCKET = 'bucket-unico';

interface Llamada { comando: unknown; opciones: { abortSignal?: AbortSignal } | undefined }
function clienteDoble(respuesta: (comando: unknown) => unknown = () => ({})) {
  const llamadas: Llamada[] = [];
  const cliente = { send: async (comando: unknown, opciones?: { abortSignal?: AbortSignal }) => { llamadas.push({ comando, opciones }); const r = respuesta(comando); if (r instanceof Error) throw r; return r; } };
  return { cliente: cliente as never, llamadas };
}
const adaptador = (respuesta?: (c: unknown) => unknown, prefijo?: string) => { const d = clienteDoble(respuesta); return { almacen: new SolicitudesS3(d.cliente, BUCKET, prefijo), ...d }; };

describe('forma estricta de la clave', () => {
  test('acepta solicitudes/<uuid>/<uuid> y la genera con esa forma', () => {
    const { almacen } = adaptador();
    expect(almacen.pertenece(`solicitudes/${uuidA}/${uuidB}`)).toBe(true);
    expect(almacen.claveNueva(uuidA, uuidB)).toBe(`solicitudes/${uuidA}/${uuidB}`);
  });
  test('rechaza cualquier otra forma: otros prefijos, niveles de más o de menos, mayúsculas, espacios, sufijos y rutas relativas', () => {
    const { almacen } = adaptador();
    const malas = ['', 'solicitudes', 'solicitudes/', `solicitudes/${uuidA}`, `solicitudes/${uuidA}/`, `solicitudes/${uuidA}/${uuidB}/extra`, `solicitudes/${uuidA}/${uuidB}/`,
      `/solicitudes/${uuidA}/${uuidB}`, `x/solicitudes/${uuidA}/${uuidB}`, `usuarios/${uuidA}/${uuidB}`, `portafolio/${uuidA}/${uuidB}`, `solicitudes/${uuidA.toUpperCase()}/${uuidB}`,
      `solicitudes/${uuidA}/${uuidB} `, `solicitudes/${uuidA}/${uuidB}.webp`, `solicitudes/../portafolio/${uuidB}`, `solicitudes/${uuidA}/../${uuidB}`, 'solicitudes/no-uuid/otro',
      `solicitudes/${uuidA}/${uuidB}\n`, `pruebas/${uuidC}/solicitudes/${uuidA}/${uuidB}`, `solicitudes\\${uuidA}\\${uuidB}`, `solicitudes/${uuidA}//${uuidB}`];
    for (const clave of malas) expect([clave, almacen.pertenece(clave)]).toEqual([clave, false]);
  });
  test('la variante de pruebas solo la acepta un almacén creado con un prefijo pruebas/<uuid>/solicitudes/', () => {
    const { almacen } = adaptador(undefined, `pruebas/${uuidC}/solicitudes/`);
    expect(almacen.pertenece(`pruebas/${uuidC}/solicitudes/${uuidA}/${uuidB}`)).toBe(true);
    expect(almacen.claveNueva(uuidA, uuidB)).toBe(`pruebas/${uuidC}/solicitudes/${uuidA}/${uuidB}`);
    expect(almacen.pertenece(`solicitudes/${uuidA}/${uuidB}`)).toBe(false);
    expect(almacen.pertenece(`pruebas/${uuidA}/solicitudes/${uuidA}/${uuidB}`)).toBe(false);
  });
  test('rechaza al construirse cualquier prefijo que no sea solicitudes/ o pruebas/<uuid>/solicitudes/', () => {
    for (const prefijo of ['', 'solicitudes', 'usuarios/', 'portafolio/', 'pruebas/solicitudes/', `pruebas/${uuidC}/portafolio/`, `pruebas/${uuidC}/solicitudes`, `x/pruebas/${uuidC}/solicitudes/`, '/']) {
      expect(() => adaptador(undefined, prefijo)).toThrow('Prefijo de solicitudes no válido');
    }
  });
  test('claveNueva exige UUID válidos y nunca produce una clave que el propio almacén rechace', () => {
    const { almacen } = adaptador();
    expect(() => almacen.claveNueva('../x', uuidB)).toThrow();
    expect(() => almacen.claveNueva(uuidA, 'no-uuid')).toThrow();
    expect(() => almacen.claveNueva(`${uuidA}/${uuidB}`, uuidB)).toThrow();
    expect(almacen.pertenece(almacen.claveNueva(uuidA, uuidB))).toBe(true);
  });
});

describe('operaciones acotadas al prefijo', () => {
  test('guardar, leer y eliminar rechazan claves ajenas SIN llamar al almacenamiento', async () => {
    const { almacen, llamadas } = adaptador();
    const ajena = `portafolio/${uuidA}/${uuidB}`;
    await expect(almacen.guardar(ajena, new Uint8Array([1]))).rejects.toThrow('fuera del ámbito');
    await expect(almacen.leer(ajena)).rejects.toThrow('fuera del ámbito');
    await expect(almacen.eliminar(ajena)).rejects.toThrow('fuera del ámbito');
    await expect(almacen.eliminar('solicitudes/')).rejects.toThrow('fuera del ámbito');
    expect(llamadas).toHaveLength(0);
  });
  test('guardar usa el bucket único, la clave exacta, WebP y Cache-Control: no-store', async () => {
    const { almacen, llamadas } = adaptador();
    const clave = almacen.claveNueva(uuidA, uuidB);
    await almacen.guardar(clave, new Uint8Array([1, 2, 3]));
    const comando = llamadas[0]!.comando as PutObjectCommand;
    expect(comando).toBeInstanceOf(PutObjectCommand);
    expect(comando.input).toMatchObject({ Bucket: BUCKET, Key: clave, ContentType: 'image/webp', CacheControl: 'no-store' });
    expect(comando.input.ACL).toBeUndefined();
  });
  test('leer y eliminar usan la clave exacta del bucket único', async () => {
    const { almacen, llamadas } = adaptador(() => ({ Body: { transformToByteArray: async () => new Uint8Array([9]) }, ContentLength: 1 }));
    const clave = almacen.claveNueva(uuidA, uuidB);
    expect(await almacen.leer(clave)).toEqual(new Uint8Array([9]));
    await almacen.eliminar(clave);
    expect(llamadas[0]!.comando).toBeInstanceOf(GetObjectCommand);
    expect((llamadas[0]!.comando as GetObjectCommand).input).toEqual({ Bucket: BUCKET, Key: clave });
    expect(llamadas[1]!.comando).toBeInstanceOf(DeleteObjectCommand);
    expect((llamadas[1]!.comando as DeleteObjectCommand).input).toEqual({ Bucket: BUCKET, Key: clave });
  });
  test('listar pide solo el prefijo, pagina y descarta cualquier clave que no cumpla la forma estricta', async () => {
    const paginas = [
      { Contents: [{ Key: `solicitudes/${uuidA}/${uuidB}`, LastModified: new Date(1) }, { Key: `solicitudes/ajena.txt`, LastModified: new Date(2) }], IsTruncated: true, NextContinuationToken: 'p2' },
      { Contents: [{ Key: `solicitudes/${uuidB}/${uuidA}`, LastModified: new Date(3) }, { Key: `usuarios/${uuidA}/${uuidB}`, LastModified: new Date(4) }, { Key: `solicitudes/${uuidA}/${uuidB}` }], IsTruncated: false },
    ];
    let i = 0;
    const { almacen, llamadas } = adaptador(() => paginas[i++]);
    const claves: string[] = [];
    for await (const o of almacen.listar()) claves.push(o.clave);
    expect(claves).toEqual([`solicitudes/${uuidA}/${uuidB}`, `solicitudes/${uuidB}/${uuidA}`]);
    expect(llamadas).toHaveLength(2);
    for (const l of llamadas) expect((l.comando as ListObjectsV2Command).input.Prefix).toBe('solicitudes/');
    expect((llamadas[1]!.comando as ListObjectsV2Command).input.ContinuationToken).toBe('p2');
  });
  test('un almacén de pruebas lista solo su prefijo de pruebas', async () => {
    const prefijo = `pruebas/${uuidC}/solicitudes/`;
    const { almacen, llamadas } = adaptador(() => ({ Contents: [{ Key: `${prefijo}${uuidA}/${uuidB}`, LastModified: new Date(1) }, { Key: `solicitudes/${uuidA}/${uuidB}`, LastModified: new Date(1) }] }), prefijo);
    const claves: string[] = [];
    for await (const o of almacen.listar()) claves.push(o.clave);
    expect(claves).toEqual([`${prefijo}${uuidA}/${uuidB}`]);
    expect((llamadas[0]!.comando as ListObjectsV2Command).input.Prefix).toBe(prefijo);
  });
});

describe('tiempos acotados y errores', () => {
  test('cada llamada lleva una señal de aborto con un tiempo máximo de 8 s', async () => {
    const { almacen, llamadas } = adaptador(() => ({ Body: { transformToByteArray: async () => new Uint8Array() }, ContentLength: 0 }));
    const clave = almacen.claveNueva(uuidA, uuidB);
    await almacen.guardar(clave, new Uint8Array([1])); await almacen.leer(clave); await almacen.eliminar(clave);
    for await (const _ of almacen.listar()) void _;
    expect(llamadas).toHaveLength(4);
    for (const l of llamadas) expect(l.opciones?.abortSignal).toBeInstanceOf(AbortSignal);
  });
  test('un fallo del almacenamiento se informa como 503 DEPENDENCIA_NO_DISPONIBLE sin exponer su mensaje, la clave ni el bucket', async () => {
    const { almacen } = adaptador(() => new Error(`AccessDenied para solicitudes/${uuidA}/${uuidB} en ${BUCKET}`));
    const clave = almacen.claveNueva(uuidA, uuidB);
    for (const accion of [() => almacen.guardar(clave, new Uint8Array([1])), () => almacen.leer(clave), () => almacen.eliminar(clave), async () => { for await (const _ of almacen.listar()) void _; }]) {
      const error = await accion().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ErrorAplicacion);
      expect(error).toMatchObject({ http: 503, codigo: 'DEPENDENCIA_NO_DISPONIBLE' });
      expect(JSON.stringify([(error as Error).message, (error as ErrorAplicacion).detalles])).not.toMatch(/AccessDenied|solicitudes\/|bucket-unico/);
    }
  });
  test('rechaza leer un objeto que supera el tamaño máximo de una imagen saneada', async () => {
    const { almacen } = adaptador(() => ({ Body: { transformToByteArray: async () => new Uint8Array() }, ContentLength: 10_000_001 }));
    await expect(almacen.leer(almacen.claveNueva(uuidA, uuidB))).rejects.toMatchObject({ codigo: 'DEPENDENCIA_NO_DISPONIBLE' });
  });
  test('eliminar es idempotente: borrar un objeto inexistente no falla', async () => {
    const { almacen } = adaptador(() => ({}));
    const clave = almacen.claveNueva(uuidA, uuidB);
    await almacen.eliminar(clave); await almacen.eliminar(clave);
  });
});

describe('sin enlaces públicos ni firmados', () => {
  test('el adaptador no ofrece ninguna operación que genere direcciones y su código no usa firmado de URL', () => {
    const { almacen } = adaptador();
    const metodos = Object.getOwnPropertyNames(Object.getPrototypeOf(almacen)).filter(n => n !== 'constructor').sort();
    expect(metodos).toEqual(['claveNueva', 'eliminar', 'exigir', 'guardar', 'leer', 'listar', 'pertenece']); // `exigir` es privado
    const fuente = readFileSync(resolve('src/modulos/solicitudes/infraestructura/archivos/solicitudes-s3.ts'), 'utf8');
    expect(fuente).not.toMatch(/presign|getSignedUrl|s3-request-presigner|ACL|PublicRead|x-amz-acl/i);
  });
});
