import { describe, expect, jest, test } from '@jest/globals';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import type { RevisionDeOferta } from '../../../src/modulos/catalogo/api-publica.js';
import { BusquedaPublicaServicio, normalizarFiltros, paginacion } from '../../../src/modulos/catalogo/aplicacion/busqueda-publica.js';
import type { ConsultasPublicas, FiltrosOferta } from '../../../src/modulos/catalogo/aplicacion/puertos/consultas-publicas.js';
import { CatalogoCache, type AlmacenCache } from '../../../src/modulos/catalogo/infraestructura/cache/catalogo-cache.js';
import { paginaPublica, servicioPublico } from '../../../src/modulos/catalogo/presentacion/representacion-publica.js';
import { PerfilPublicoServicio, avisoCalificaciones, avisoVerificaciones, presentarAvisos, sinFuentes, type FuentesPublicas } from '../../../src/modulos/prestadores/aplicacion/perfil-publico.js';
import type { PerfilProfesional } from '../../../src/modulos/prestadores/dominio/perfil-profesional.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rechazo = (fn: () => unknown) => { try { fn(); } catch (e) { return e as ErrorAplicacion; } throw new Error('Debía rechazar.'); };
const rechazoAsync = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as ErrorAplicacion; } throw new Error('Debía rechazar.'); };

describe('normalización y paginación de filtros', () => {
  test('aplica los valores por defecto: página 1 y 20 elementos', () => {
    expect(normalizarFiltros({})).toEqual({ pagina: 1, tamano: 20 });
    expect(paginacion).toEqual({ primera: 1, tamanoPredeterminado: 20, tamanoMaximo: 50 });
  });
  test('normaliza los UUID a minúsculas, conserva el distrito y la disponibilidad booleana', () => {
    const f = normalizarFiltros({ categoria: uuid(1).replace('4000', '4ABC'.toLowerCase()).toUpperCase(), especialidad: 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF', distrito: 'ayacucho', disponibilidad: false, pagina: 3, tamano: 50 });
    expect(f).toEqual({ categoria: f.categoria?.toLowerCase(), especialidad: 'abcdefab-cdef-4abc-8def-abcdefabcdef', distrito: 'ayacucho', disponibilidad: false, pagina: 3, tamano: 50 });
    expect(normalizarFiltros({ disponibilidad: true }).disponibilidad).toBe(true);
  });
  test('rechaza límites y tipos fuera de rango con el campo', () => {
    for (const [campo, valor] of [['pagina', 0], ['pagina', 1.5], ['pagina', '1'], ['tamano', 0], ['tamano', 51], ['tamano', -1], ['tamano', Number.NaN], ['disponibilidad', 'true'], ['disponibilidad', 1], ['categoria', ''], ['distrito', 5]] as const) {
      const e = rechazo(() => normalizarFiltros({ [campo]: valor }));
      expect([e.http, e.codigo, e.detalles[0]?.campo]).toEqual([400, 'DATOS_INVALIDOS', campo]);
    }
    expect(() => normalizarFiltros({ tamano: 50, pagina: 2_147_483_647 })).not.toThrow();
  });
  test('la búsqueda envía los filtros normalizados a la fuente y devuelve página y tamaño', async () => {
    const consultas = { buscarServicios: jest.fn(async (_f: FiltrosOferta) => ({ elementos: [], total: 0 })), buscarPrestadores: jest.fn(async (_f: FiltrosOferta) => ({ elementos: [], total: 7 })),
      servicioVisible: jest.fn(async (_id: string) => null), serviciosVisiblesDe: jest.fn() } as unknown as ConsultasPublicas & { buscarServicios: jest.Mock; servicioVisible: jest.Mock };
    const busqueda = new BusquedaPublicaServicio(consultas);
    expect(await busqueda.servicios({ categoria: 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF', pagina: 2 })).toEqual({ elementos: [], total: 0, pagina: 2, tamano: 20 });
    expect(consultas.buscarServicios).toHaveBeenCalledWith({ categoria: 'abcdefab-cdef-4abc-8def-abcdefabcdef', pagina: 2, tamano: 20 });
    expect(await busqueda.prestadores({ tamano: 5 })).toMatchObject({ total: 7, pagina: 1, tamano: 5 });
    const e = await rechazoAsync(busqueda.servicio(uuid(9)));
    expect([e.http, e.codigo]).toEqual([404, 'RECURSO_NO_DISPONIBLE']);
    await busqueda.servicio('ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF').catch(() => undefined);
    expect(consultas.servicioVisible).toHaveBeenLastCalledWith('abcdefab-cdef-4abc-8def-abcdefabcdef');
  });
  test('las representaciones públicas copian solo los campos permitidos', () => {
    const sucio = { servicioId: uuid(1), prestadorId: uuid(2), titulo: 'T', descripcion: 'D', categoriaId: uuid(3), estado: 'PUBLICADO' as const, cuentaId: uuid(9), correo: 'a@b.c', objetoClave: 'x' };
    expect(Object.keys(servicioPublico(sucio)).sort()).toEqual(['categoriaId', 'descripcion', 'estado', 'prestadorId', 'servicioId', 'titulo']);
    expect(paginaPublica({ elementos: [sucio], total: 1, pagina: 1, tamano: 20 }, servicioPublico).elementos[0]).not.toHaveProperty('cuentaId');
  });
});

describe('avisos públicos independientes por fuente', () => {
  const casos: [string, FuentesPublicas, string | null, string | null][] = [
    ['ambas fuentes ausentes', { calificaciones: false, verificaciones: false }, avisoCalificaciones, avisoVerificaciones],
    ['solo calificaciones disponible', { calificaciones: true, verificaciones: false }, null, avisoVerificaciones],
    ['solo verificaciones disponible', { calificaciones: false, verificaciones: true }, avisoCalificaciones, null],
    ['ambas fuentes disponibles', { calificaciones: true, verificaciones: true }, null, null],
  ];
  test.each(casos)('%s', (_n, fuentes, calificaciones, verificaciones) => {
    expect(presentarAvisos(fuentes)).toEqual({ calificaciones, verificaciones });
  });
  test('en 002 se esperan los dos avisos exactos y nunca «Sin valoraciones», estrellas ni estados de verificación', () => {
    expect(presentarAvisos(sinFuentes)).toEqual({ calificaciones: 'Calificaciones aún no disponibles', verificaciones: 'Verificaciones aún no disponibles' });
    expect(JSON.stringify(presentarAvisos(sinFuentes))).not.toMatch(/Sin valoraciones|estrella|Verificado/);
  });

  const perfil: PerfilProfesional = { id: uuid(2), cuentaId: uuid(99), nombrePublico: 'Ana', tipo: 'TECNICO', experiencia: 'Exp', disponibilidadDeclarada: true, version: 4,
    especialidadesIds: [uuid(3)], distritos: ['ayacucho'] };
  const montar = (fuentes?: () => FuentesPublicas) => new PerfilPublicoServicio(
    { perfilPublicoPorId: async (id: string) => (id === perfil.id ? perfil : null), trabajos: async () => [{ id: uuid(5), prestadorId: perfil.id, titulo: 'Obra', descripcion: 'D', version: 3,
      fotografias: [{ id: uuid(6), trabajoId: uuid(5), objetoClave: 'portafolio/secreto', ancho: 10, alto: 20, bytes: 1, checksum: new Uint8Array(32) }] }] },
    { serviciosVisiblesDe: async () => ({ elementos: [{ servicioId: uuid(7), prestadorId: perfil.id, titulo: 'S', descripcion: 'D', categoriaId: uuid(3), estado: 'PUBLICADO' as const }], total: 1 }) }, fuentes);
  test('el perfil refleja la disponibilidad de cada fuente por separado, con dobles de las fuentes', async () => {
    for (const [, fuentes, calificaciones, verificaciones] of casos) {
      expect((await montar(() => fuentes).obtener(perfil.id, 1, 20)).avisos).toEqual({ calificaciones, verificaciones });
    }
    expect((await montar().obtener(perfil.id, 1, 20)).avisos).toEqual(presentarAvisos(sinFuentes));
  });
  test('el perfil público usa una lista explícita de campos y excluye cuenta, versión y objetos privados', async () => {
    const r = await montar().obtener(perfil.id.toUpperCase(), 1, 20);
    expect(Object.keys(r).sort()).toEqual(['avisos', 'disponibilidadDeclarada', 'distritos', 'especialidadesIds', 'experiencia', 'nombrePublico', 'prestadorId', 'servicios', 'tipo', 'trabajos']);
    const texto = JSON.stringify(r);
    for (const prohibido of [uuid(99), 'cuentaId', 'objetoClave', 'portafolio/secreto', 'checksum', 'version']) expect(texto).not.toContain(prohibido);
    expect(r.trabajos[0]!.fotografias[0]!.ruta).toBe(`/api/v1/prestadores/${perfil.id}/trabajos/${uuid(5)}/fotografias/${uuid(6)}`);
    expect(r.servicios).toEqual({ elementos: [expect.objectContaining({ servicioId: uuid(7) })], total: 1, pagina: 1, tamano: 20 });
    const e = await rechazoAsync(montar().obtener(uuid(404), 1, 20));
    expect([e.http, e.codigo]).toEqual([404, 'RECURSO_NO_DISPONIBLE']);
  });
});

describe('decorador de caché con revisión de PostgreSQL', () => {
  const pagina = { elementos: [{ servicioId: uuid(1) }], total: 1 };
  const filtros: FiltrosOferta = { categoria: uuid(4), pagina: 1, tamano: 20 };
  function montar(opciones: { cacheFalla?: boolean; revisiones?: bigint[]; guardado?: string } = {}) {
    const mapa = new Map<string, string>();
    if (opciones.guardado) mapa.set('*', opciones.guardado);
    const cache: AlmacenCache & { obtener: jest.Mock; guardar: jest.Mock } = {
      obtener: jest.fn(async (k: string) => { if (opciones.cacheFalla) throw new Error('Redis caído'); return mapa.get(k) ?? mapa.get('*') ?? null; }),
      guardar: jest.fn(async (k: string, v: string) => { if (opciones.cacheFalla) throw new Error('Redis caído'); mapa.set(k, v); }),
    } as never;
    const secuencia = [...(opciones.revisiones ?? [7n])];
    const vigente = jest.fn(async () => (secuencia.length > 1 ? secuencia.shift()! : secuencia[0]!));
    const origen = { buscarServicios: jest.fn(async () => pagina), buscarPrestadores: jest.fn(async () => pagina), servicioVisible: jest.fn(async () => null), serviciosVisiblesDe: jest.fn(async () => pagina) };
    const decorador = new CatalogoCache(origen as unknown as ConsultasPublicas, { vigente } as unknown as RevisionDeOferta, cache, { entorno: 'validacion', versionRepresentacion: 'v1', ttlSegundos: 60 });
    return { decorador, origen, cache, vigente, mapa };
  }
  test('la clave incluye entorno, versión, revisión, tipo, filtros y página; el segundo acceso es un acierto', async () => {
    const m = montar();
    expect(await m.decorador.buscarServicios(filtros)).toEqual(pagina);
    const clave = (m.cache.guardar.mock.calls[0] as unknown[])[0] as string;
    expect(clave).toMatch(/^validacion:v1:r7:servicios:[0-9a-f]{32}$/);
    expect(await m.decorador.buscarServicios(filtros)).toEqual(pagina);
    expect(m.origen.buscarServicios).toHaveBeenCalledTimes(1);
    await m.decorador.buscarServicios({ ...filtros, pagina: 2 });
    await m.decorador.buscarPrestadores(filtros);
    expect(new Set(m.cache.guardar.mock.calls.map(c => (c as unknown[])[0])).size).toBe(3);
  });
  test('una revisión nueva descarta la entrada anterior y consulta PostgreSQL', async () => {
    const m = montar({ revisiones: [7n, 7n, 8n] });
    await m.decorador.buscarServicios(filtros); // revisión 7: se guarda en r7
    await m.decorador.buscarServicios(filtros); // revisión 8: la entrada de r7 no se lee
    expect(m.origen.buscarServicios).toHaveBeenCalledTimes(2);
    const leidas = m.cache.obtener.mock.calls.map(c => (c as unknown[])[0] as string);
    expect(leidas[0]).toContain(':r7:');
    expect(leidas[1]).toContain(':r8:');
    expect([...m.mapa.keys()].filter(k => k.includes(':r7:') || k.includes(':r8:'))).toHaveLength(2);
  });
  test('si la revisión cambia al aceptar un acierto o antes de guardar, no se sirve ni se guarda un resultado antiguo', async () => {
    const acierto = montar({ guardado: JSON.stringify(pagina), revisiones: [7n, 8n] });
    expect(await acierto.decorador.buscarServicios(filtros)).toEqual(pagina);
    expect(acierto.origen.buscarServicios).toHaveBeenCalledTimes(1); // el acierto se descartó
    expect(acierto.cache.guardar).not.toHaveBeenCalled();
    const guardado = montar({ revisiones: [7n, 9n] });
    await guardado.decorador.buscarServicios(filtros);
    expect(guardado.origen.buscarServicios).toHaveBeenCalledTimes(1);
    expect(guardado.cache.guardar).not.toHaveBeenCalled();
  });
  test('un fallo de la caché o una carga inválida se resuelven desde PostgreSQL con el mismo resultado', async () => {
    for (const m of [montar({ cacheFalla: true }), montar({ guardado: '{no es json' }), montar({ guardado: JSON.stringify({ elementos: 'x', total: 'y' }) })]) {
      expect(await m.decorador.buscarServicios(filtros)).toEqual(pagina);
      expect(m.origen.buscarServicios).toHaveBeenCalledTimes(1);
    }
  });
  test('si PostgreSQL no puede comprobar la revisión, la consulta falla de forma controlada y los detalles no se almacenan', async () => {
    const m = montar();
    m.vigente.mockRejectedValue(new ErrorAplicacion(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio temporalmente no disponible.'));
    const e = await rechazoAsync(m.decorador.buscarServicios(filtros));
    expect([e.http, e.codigo]).toEqual([503, 'DEPENDENCIA_NO_DISPONIBLE']);
    expect(m.origen.buscarServicios).not.toHaveBeenCalled();
    await m.decorador.serviciosVisiblesDe(uuid(2), 1, 20); await m.decorador.servicioVisible(uuid(1));
    expect(m.cache.obtener).not.toHaveBeenCalled();
  });
});
