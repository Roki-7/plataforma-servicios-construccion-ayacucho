import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { almacenDePrueba002, clasificaciones002, montarHu03, perfilValido, type CuentaPrueba, type EntornoHu03 } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';
import { clasificaciones04 as c4, montarHu04, servicioValido, type EntornoHu04 } from '../../soporte/prestadores-catalogo/fixtures-hu04.js';
import { base64, crearImagen } from '../../soporte/prestadores-catalogo/imagenes.js';

/**
 * Escrituras simultáneas por encima del tamaño del pool de conexiones. Una escritura mantiene una conexión durante su transacción;
 * si dentro de la transacción pidiera una segunda conexión (por ejemplo, para revalidar la sesión), con tantas escrituras como conexiones
 * todas esperarían una conexión que ninguna libera y vencerían con 503. El tamaño del pool NO se modifica en estas pruebas.
 */
let s3: Awaited<ReturnType<typeof almacenDePrueba002>>;
let e3: EntornoHu03;
let e4: EntornoHu04;
beforeAll(async () => {
  s3 = await almacenDePrueba002();
  e3 = await montarHu03({ almacen: s3.almacen });
  e4 = await montarHu04();
}, 120000);
afterAll(async () => {
  try { await e3?.cerrar(); } finally { try { await e4?.cerrar(); } finally { await s3?.limpiar(); } }
}, 60000);

const tamanoPool = (db: { driver: unknown }) => (db.driver as { master: { options: { max: number } } }).master.options.max;
const N = () => tamanoPool(e4.db) + 2;
const estados = (rs: { status: number }[]) => rs.map(r => r.status);
const sin503 = (rs: { status: number }[]) => expect(rs.filter(r => r.status === 503)).toHaveLength(0);
const revision = async (db: { query(sql: string): Promise<unknown> }) => BigInt(((await db.query('SELECT revision::text AS r FROM catalogo_revision_oferta')) as { r: string }[])[0]!.r);

test('el pool mantiene su tamaño de producción y las pruebas superan ese tamaño', () => {
  expect(tamanoPool(e3.db)).toBe(6);
  expect(tamanoPool(e4.db)).toBe(6);
  expect(N()).toBeGreaterThanOrEqual(8);
});

describe('servicios: más escrituras simultáneas que conexiones', () => {
  test('ocho titulares publican a la vez y todas las escrituras válidas se confirman', async () => {
    const n = N();
    const cuentas: CuentaPrueba[] = [];
    for (let i = 0; i < n; i++) { const cu = await e4.nuevaCuenta('prestador'); await e4.crearPerfil(cu); cuentas.push(cu); }
    const antes = await revision(e4.db);
    const respuestas = await Promise.all(cuentas.map((cu, i) => e4.publicar(cu.token, servicioValido(c4, { titulo: `Simultáneo ${i}` }))));
    expect(estados(respuestas)).toEqual(Array(n).fill(201));
    expect(new Set(respuestas.map(r => r.body.servicioId)).size).toBe(n);
    expect(new Set(respuestas.map(r => r.body.prestadorId)).size).toBe(n);
    const ids = respuestas.map(r => r.body.servicioId as string);
    expect(Number(((await e4.db.query('SELECT count(*)::int AS n FROM catalogo_servicios WHERE id = ANY($1::uuid[]) AND estado=\'PUBLICADO\' AND version=1', [ids])) as { n: number }[])[0]!.n)).toBe(n);
    expect(await revision(e4.db)).toBe(antes + BigInt(n));
    // Segunda ola: todas simultáneas a la vez, con resultados de negocio distintos y sin ningún 503.
    const s = respuestas.map(r => r.body as { servicioId: string });
    const antes2 = await revision(e4.db);
    const ola = await Promise.all([
      e4.transicionar(cuentas[0]!.token, s[0]!.servicioId, { version: 1, destino: 'PAUSADO' }),
      e4.transicionar(cuentas[1]!.token, s[1]!.servicioId, { version: 1, destino: 'RETIRADO' }),
      e4.editar(cuentas[2]!.token, s[2]!.servicioId, { version: 1, titulo: 'Editado en la ola' }),
      e4.editar(cuentas[3]!.token, s[3]!.servicioId, { version: 9, titulo: 'Versión obsoleta' }),
      e4.editar(cuentas[4]!.token, s[0]!.servicioId, { version: 1, titulo: 'Intrusión' }),
      e4.publicar(cuentas[5]!.token, servicioValido(c4, { categoriaId: c4.inactiva })),
      e4.publicar(cuentas[6]!.token, servicioValido(c4, { titulo: 'Nuevo en la ola' })),
      e4.transicionar(cuentas[7]!.token, s[7]!.servicioId, { version: 1, destino: 'PUBLICADO' }),
    ]);
    sin503(ola);
    expect(estados(ola)).toEqual([200, 200, 200, 409, 404, 422, 201, 422]);
    expect(ola[3]!.body.codigo).toBe('VERSION_DESACTUALIZADA');
    expect(ola[4]!.body.codigo).toBe('RECURSO_NO_DISPONIBLE');
    expect(ola[5]!.body.codigo).toBe('CATEGORIA_NO_ACTIVA');
    expect(ola[7]!.body.codigo).toBe('TRANSICION_NO_ADMITIDA');
    const fila = async (id: string) => ((await e4.db.query('SELECT estado,version,titulo FROM catalogo_servicios WHERE id=$1', [id])) as { estado: string; version: number; titulo: string }[])[0];
    expect(await fila(s[0]!.servicioId)).toMatchObject({ estado: 'PAUSADO', version: 2, titulo: 'Simultáneo 0' });
    expect(await fila(s[1]!.servicioId)).toMatchObject({ estado: 'RETIRADO', version: 2 });
    expect(await fila(s[2]!.servicioId)).toMatchObject({ estado: 'PUBLICADO', version: 2, titulo: 'Editado en la ola' });
    expect(await fila(s[3]!.servicioId)).toMatchObject({ estado: 'PUBLICADO', version: 1, titulo: 'Simultáneo 3' });
    expect(await fila(s[7]!.servicioId)).toMatchObject({ estado: 'PUBLICADO', version: 1 });
    expect(Number(((await e4.db.query("SELECT count(*)::int AS n FROM catalogo_servicios WHERE prestador_id=$1", [respuestas[5]!.body.prestadorId])) as { n: number }[])[0]!.n)).toBe(1);
    expect(await revision(e4.db)).toBe(antes2 + 4n); // pausa, retiro, edición y alta nueva
  }, 120000);

  test('la sesión revocada se rechaza con 401 antes de escribir, también en una ola simultánea', async () => {
    const n = N();
    const cuentas: CuentaPrueba[] = [];
    for (let i = 0; i < n; i++) { const cu = await e4.nuevaCuenta('prestador'); await e4.crearPerfil(cu); cuentas.push(cu); }
    const ola = await Promise.all(cuentas.map((cu, i) => e4.publicar(i % 2 ? 'Z'.repeat(43) : cu.token, servicioValido(c4, { titulo: `Con sesión ${i}` }))));
    sin503(ola);
    expect(estados(ola)).toEqual(cuentas.map((_cu, i) => (i % 2 ? 401 : 201)));
    expect(Number(((await e4.db.query("SELECT count(*)::int AS n FROM catalogo_servicios WHERE titulo LIKE 'Con sesión %'")) as { n: number }[])[0]!.n)).toBe(Math.ceil(n / 2));
  }, 120000);
});

describe('perfil profesional: más escrituras simultáneas que conexiones', () => {
  test('ocho prestadores guardan su perfil y crean trabajos a la vez con proyección y revisión consistentes', async () => {
    const n = N();
    const cuentas: CuentaPrueba[] = [];
    for (let i = 0; i < n; i++) cuentas.push(await e3.nuevaCuenta('prestador'));
    const antes = await revision(e3.db);
    const altas = await Promise.all(cuentas.map((cu, i) => e3.guardarPerfil(cu.token, perfilValido(clasificaciones002, { nombrePublico: `Perfil simultáneo ${i}` }))));
    sin503(altas);
    expect(estados(altas)).toEqual(Array(n).fill(201));
    const ids = altas.map(r => r.body.prestadorId as string);
    expect(new Set(ids).size).toBe(n);
    expect(Number(((await e3.db.query('SELECT count(*)::int AS n FROM catalogo_proyeccion_prestadores WHERE prestador_id = ANY($1::uuid[])', [ids])) as { n: number }[])[0]!.n)).toBe(n);
    expect(await revision(e3.db)).toBe(antes + BigInt(n));
    const ola = await Promise.all([
      ...cuentas.slice(0, 5).map((cu, i) => e3.guardarPerfil(cu.token, perfilValido(clasificaciones002, { version: 1, nombrePublico: `Actualizado ${i}` }))),
      e3.guardarPerfil(cuentas[5]!.token, perfilValido(clasificaciones002, { version: 7 })),
      e3.guardarPerfil(cuentas[6]!.token, perfilValido(clasificaciones002, { version: 1, especialidadesIds: [clasificaciones002.inactiva] })),
      e3.crearTrabajo(cuentas[7]!.token, { versionPerfil: 1, titulo: 'Trabajo simultáneo', descripcion: 'Descripción ficticia' }),
    ]);
    sin503(ola);
    expect(estados(ola)).toEqual([200, 200, 200, 200, 200, 409, 422, 201]);
    expect(ola[5]!.body.codigo).toBe('VERSION_DESACTUALIZADA');
    expect(ola[6]!.body.codigo).toBe('CATEGORIA_NO_ACTIVA');
    const nombres = ((await e3.db.query('SELECT nombre_publico FROM catalogo_proyeccion_prestadores WHERE prestador_id = ANY($1::uuid[]) ORDER BY nombre_publico', [ids.slice(0, 5)])) as { nombre_publico: string }[]).map(f => f.nombre_publico);
    expect(nombres).toEqual(['Actualizado 0', 'Actualizado 1', 'Actualizado 2', 'Actualizado 3', 'Actualizado 4']);
    expect(await revision(e3.db)).toBe(antes + BigInt(n) + 5n);
    expect((await e3.obtenerPerfil(cuentas[7]!.token).expect(200)).body).toMatchObject({ version: 2, trabajos: [{ titulo: 'Trabajo simultáneo' }] });
    expect((await e3.obtenerPerfil(cuentas[5]!.token).expect(200)).body.version).toBe(1);
  }, 180000);
});

describe('fotografías: más escrituras simultáneas que conexiones', () => {
  test('ocho titulares agregan, reemplazan y eliminan fotografías a la vez sin agotar el pool', async () => {
    const n = N();
    const titulares: { cuenta: CuentaPrueba; prestadorId: string; trabajoId: string; version: number }[] = [];
    for (let i = 0; i < n; i++) {
      const cuenta = await e3.nuevaCuenta('prestador');
      const perfil = (await e3.guardarPerfil(cuenta.token, perfilValido(clasificaciones002)).expect(201)).body;
      const trabajo = (await e3.crearTrabajo(cuenta.token, { versionPerfil: perfil.version, titulo: `Trabajo ${i}`, descripcion: 'Descripción ficticia' }).expect(201)).body;
      titulares.push({ cuenta, prestadorId: perfil.prestadorId, trabajoId: trabajo.trabajo.trabajoId, version: trabajo.trabajo.version });
    }
    const cuerpo = async (versionTrabajo: number, color: string) => ({ versionTrabajo, tipoMime: 'image/jpeg', contenidoBase64: base64(await crearImagen({ color })) });
    const altas = await Promise.all(await Promise.all(titulares.map(async (t, i) => e3.agregarFoto(t.cuenta.token, t.trabajoId, await cuerpo(t.version, `#${i}${i}00${i}${i}`)))));
    sin503(altas);
    expect(estados(altas)).toEqual(Array(n).fill(201));
    const ids = titulares.map(t => t.trabajoId);
    const vigentes = (await e3.db.query('SELECT objeto_clave FROM prestadores_fotografias WHERE trabajo_id = ANY($1::uuid[])', [ids])) as { objeto_clave: string }[];
    expect(vigentes).toHaveLength(n);
    const enAlmacen = await s3.claves();
    for (const f of vigentes) expect(enAlmacen).toContain(f.objeto_clave);
    // Ola mixta: reemplazos y eliminaciones simultáneos, todas válidas.
    const fotos = altas.map(a => a.body as { fotografia: { fotografiaId: string }; versionTrabajo: number });
    const mitad = n / 2;
    const nuevos = await Promise.all(titulares.slice(0, mitad).map((t, i) => cuerpo(fotos[i]!.versionTrabajo, '#10ff10')));
    const ola = await Promise.all([
      ...titulares.slice(0, mitad).map((t, i) => e3.reemplazarFoto(t.cuenta.token, t.trabajoId, fotos[i]!.fotografia.fotografiaId, nuevos[i]!)),
      ...titulares.slice(mitad).map((t, i) => e3.eliminarFoto(t.cuenta.token, t.trabajoId, fotos[mitad + i]!.fotografia.fotografiaId, fotos[mitad + i]!.versionTrabajo)),
    ]);
    sin503(ola);
    expect(estados(ola)).toEqual([...Array(mitad).fill(200), ...Array(n - mitad).fill(200)]);
    expect(Number(((await e3.db.query('SELECT count(*)::int AS n FROM prestadores_fotografias WHERE trabajo_id = ANY($1::uuid[])', [ids])) as { n: number }[])[0]!.n)).toBe(mitad);
    // Cada baja y cada reemplazo dejó su tarea de purga en la misma transacción.
    const purgas = (await e3.db.query("SELECT count(*)::int AS n FROM prestadores_objetos_pendientes WHERE tipo='PURGA' AND prestador_id = ANY($1::uuid[])", [titulares.map(t => t.prestadorId)])) as { n: number }[];
    expect(Number(purgas[0]!.n)).toBe(n);
    for (const t of titulares.slice(mitad)) await e3.fotoPublica(t.prestadorId, t.trabajoId, fotos[titulares.indexOf(t)]!.fotografia.fotografiaId).expect(404);
    for (const [i, t] of titulares.slice(0, mitad).entries()) await e3.fotoPublica(t.prestadorId, t.trabajoId, fotos[i]!.fotografia.fotografiaId).expect(200);
  }, 180000);
});
