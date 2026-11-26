import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { crearAplicacionCompleta002 } from '../../../src/composicion/aplicacion-002.js';
import { aplicarMigraciones003 } from '../../../src/composicion/migraciones-003.js';
import { ApiPrestadores } from '../../../src/modulos/prestadores/api-publica.js';
import { RepositorioPrestadoresPostgres } from '../../../src/modulos/prestadores/infraestructura/persistencia/perfiles-y-portafolio.js';
import { CategoriasDeOfertaPostgres } from '../../../src/modulos/catalogo/infraestructura/persistencia/categorias-de-oferta.js';
import { baseAislada003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';
import { almacenEnMemoria003, configuracionDePrueba003 } from '../../soporte/solicitudes-cotizaciones/entorno.js';
import { exigirBaseDeLa003, iniciarSesion003, marcadorDeSiembra003, sembrarDatos003, type Datos003 } from '../../soporte/solicitudes-cotizaciones/datos.js';
import { leerConfiguracion003 } from '../../../scripts/entorno-003.js';

// T042: los datos ficticios cubren lo que necesitan las historias y no tocan la base de validación de la 002.
type Aplicacion = Awaited<ReturnType<typeof crearAplicacionCompleta002>>;
let base: Awaited<ReturnType<typeof baseAislada003>>; let app: Aplicacion; let datos: Datos003; let origen: string;
let prestadores: ApiPrestadores; let categoriasDeOferta: CategoriasDeOfertaPostgres;
const cubre = async (clave: keyof Datos003['prestadores']) => [...await categoriasDeOferta.categoriasDeOferta(datos.prestadores[clave].prestadorId)].sort();
const orden = (...ids: string[]) => [...ids].sort();

beforeAll(async () => {
  base = await baseAislada003(); await aplicarMigraciones003(base.url);
  const config = await configuracionDePrueba003(base.url); origen = config.origen;
  app = await crearAplicacionCompleta002(config, { prestadores: { almacen: almacenEnMemoria003() }, worker: false });
  datos = await sembrarDatos003(app, origen);
  prestadores = new ApiPrestadores(new RepositorioPrestadoresPostgres(app.uow)); categoriasDeOferta = new CategoriasDeOfertaPostgres(app.uow);
}, 240000);
afterAll(async () => { await app?.app.close(); await base?.cerrar(); }, 60000);

describe('datos ficticios de la 003', () => {
  test('hay dos clientes, seis prestadores y una cuenta con ambos perfiles', () => {
    expect(Object.keys(datos.clientes)).toEqual(['clienteUno', 'clienteDos']);
    expect(Object.keys(datos.prestadores).sort()).toEqual(['ana', 'beto', 'carla', 'dario', 'elena', 'gema']);
    expect([...datos.ambosPerfiles.perfiles].sort()).toEqual(['cliente', 'prestador']);
    expect(new Set([...Object.values(datos.clientes), ...Object.values(datos.prestadores)].map(c => c.cuentaId)).size).toBe(8);
  });
  test('todo es ficticio: correos .invalid, sin teléfonos y con identificadores deterministas', () => {
    for (const c of [...Object.values(datos.clientes), ...Object.values(datos.prestadores)]) expect(c.correo).toMatch(/@example\.invalid$/);
    expect(datos.categorias.A).toBe(marcadorDeSiembra003);
    expect(datos.prestadores.ana.prestadorId).toBe('00000000-0000-4003-8000-000000000200');
  });
  test('las cuentas pueden iniciar sesión con su contraseña ficticia y sus perfiles son los registrados', async () => {
    for (const c of [datos.clientes.clienteUno, datos.prestadores.ana, datos.ambosPerfiles]) {
      const token = await iniciarSesion003(app, origen, c);
      expect((await app.usuariosAcceso.exigir(token)).cuentaId).toBe(c.cuentaId);
    }
  });
  test('categorías: A con A1 y A2, la hermana A2, B y una inactiva', async () => {
    const filas = await app.db.query('SELECT id, nivel, categoria_padre_id AS padre, activa FROM catalogo_clasificaciones ORDER BY id') as { id: string; nivel: number; padre: string | null; activa: boolean }[];
    const por = (id: string) => filas.find(f => f.id === id)!;
    expect(por(datos.categorias.A)).toMatchObject({ nivel: 1, padre: null, activa: true });
    expect(por(datos.categorias.A1)).toMatchObject({ nivel: 2, padre: datos.categorias.A, activa: true });
    expect(por(datos.categorias.A2)).toMatchObject({ nivel: 2, padre: datos.categorias.A, activa: true });
    expect(por(datos.categorias.B)).toMatchObject({ nivel: 1, padre: null, activa: true });
    expect(por(datos.categorias.inactiva)).toMatchObject({ nivel: 1, activa: false });
  });
  test('las categorías que cubre cada prestador cumplen la regla de Catálogo (T019)', async () => {
    expect(await cubre('ana')).toEqual([datos.categorias.A]);
    expect(await cubre('beto')).toEqual(orden(datos.categorias.A1, datos.categorias.A));
    expect(await cubre('carla')).toEqual(orden(datos.categorias.A2, datos.categorias.A));
    expect(await cubre('dario')).toEqual([datos.categorias.B]);
    expect(await cubre('gema')).toEqual([datos.categorias.A]);
  });
  test('un prestador tiene especialidad pero ningún servicio publicado, y por eso no cubre ninguna categoría', async () => {
    const elena = datos.prestadores.elena;
    expect(await cubre('elena')).toEqual([]);
    expect(await prestadores.especialidadesDe(elena.prestadorId)).toEqual([datos.categorias.A1]);
    const estados = (await app.db.query('SELECT estado FROM catalogo_servicios WHERE prestador_id=$1', [elena.prestadorId]) as { estado: string }[]).map(s => s.estado);
    expect(estados).toEqual(['PAUSADO']);
  });
  test('los distritos y coberturas son distintos entre prestadores (T017)', async () => {
    expect(await prestadores.distritosDe(datos.prestadores.ana.prestadorId)).toEqual(['ayacucho', 'carmen-alto']);
    expect(await prestadores.distritosDe(datos.prestadores.carla.prestadorId)).toEqual(['san-juan-bautista']);
    expect(await prestadores.distritosDe(datos.prestadores.dario.prestadorId)).toEqual(['andres-avelino-caceres-dorregaray', 'jesus-nazareno']);
    expect(await prestadores.distritosDe(datos.ambosPerfiles.prestadorId)).toEqual(['ayacucho', 'san-juan-bautista']);
  });
  test('cada prestador tiene perfil publicable asociado a su cuenta', async () => {
    for (const p of Object.values(datos.prestadores)) expect(await prestadores.perfilPorId(p.prestadorId)).toEqual({ prestadorId: p.prestadorId, cuentaId: p.cuentaId, publicable: true });
  });
  test('la proyección pública de la 002 refleja a los prestadores sembrados', async () => {
    const n = ((await app.db.query('SELECT count(*)::int AS n FROM catalogo_proyeccion_prestadores WHERE publicable')) as { n: number }[])[0]!.n;
    expect(Number(n)).toBe(6);
  });
});

describe('aislamiento de la semilla', () => {
  test('rechaza cualquier base que no sea de la 003: la de validación 002, la de 001 y las de prueba de otras funcionalidades', () => {
    for (const nombre of ['ayacucho_002_validacion', 'ayacucho_002_test_abc123', 'ayacucho_001_validacion', 'ayacucho_003_restauracion_x', 'produccion']) {
      expect(() => exigirBaseDeLa003({ db: { options: { url: `postgresql://u:p@127.0.0.1:54331/${nombre}` } } } as never)).toThrow('solo actúa sobre las bases dedicadas de la 003');
    }
    for (const nombre of ['ayacucho_003_validacion', 'ayacucho_003_test_0123abcd']) expect(() => exigirBaseDeLa003({ db: { options: { url: `postgresql://u:p@127.0.0.1:54331/${nombre}` } } } as never)).not.toThrow();
  });
  test('el comando verifica la base con exigirBase003 antes de abrir ninguna conexión de aplicación', async () => {
    const { readFile } = await import('node:fs/promises');
    const guion = await readFile('scripts/seed-solicitudes-cotizaciones.ts', 'utf8');
    expect(guion.indexOf('exigirBase003(env')).toBeGreaterThan(-1);
    expect(guion.indexOf('exigirBase003(env')).toBeLessThan(guion.indexOf('crearAplicacionCompleta002('));
    expect(guion).not.toMatch(/ayacucho_002|leerConfiguracion002|entorno-002/);
    const env = await leerConfiguracion003();
    expect(env['DATABASE_URL']).toContain('ayacucho_003_validacion');
  });
});
