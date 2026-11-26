import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { validarRespuesta002 } from '../../soporte/prestadores-catalogo/contrato-002.js';
import { cat, foto, montarHu05, prest, serv, trabajo, total, type EntornoHu05 } from '../../soporte/prestadores-catalogo/fixtures-hu05.js';

let e: EntornoHu05;
beforeAll(async () => { e = await montarHu05(); }, 120000);
afterAll(async () => { await e?.cerrar(); });

const idsServicios = (r: { body: { elementos: { servicioId: string }[] } }) => r.body.elementos.map(x => x.servicioId);
const idsPrestadores = (r: { body: { elementos: { prestadorId: string }[] } }) => r.body.elementos.map(x => x.prestadorId);
const paginados = Array.from({ length: 25 }, (_v, i) => `00000000-0000-4000-8000-${String(1001 + i).padStart(12, '0')}`);
const ordenados = (xs: string[]) => [...xs].sort();
const nombres = { A: 'Ana Albañil', B: 'Beto Electricista', C: 'Carla Pintora', D: 'Daniel Inactivo', E: 'Elena Sin Servicios', G: 'Gabriela Paginada' };

describe('GET /servicios (buscarServicios002)', () => {
  test('sin filtros devuelve solo la oferta visible, paginada con valores por defecto y DTO cerrado', async () => {
    const r = await e.servicios().expect(200);
    await validarRespuesta002('C002PaginaServicios', r.body);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({ total, pagina: 1, tamano: 20 });
    expect(r.body.elementos).toHaveLength(20);
    for (const x of r.body.elementos) expect(Object.keys(x).sort()).toEqual(['categoriaId', 'descripcion', 'estado', 'prestadorId', 'servicioId', 'titulo']);
    const todo = await e.servicios('?tamano=50').expect(200);
    expect(idsServicios(todo)).toEqual(ordenados([serv.s1, serv.s3, serv.s4, serv.s6, ...paginados]));
    for (const oculto of [serv.s2, serv.s5, serv.s7, serv.s8]) expect(idsServicios(todo)).not.toContain(oculto);
  });

  test('cada filtro y sus combinaciones devuelven solo coincidencias, e incluyen las subcategorías activas de una raíz (CA-BUS-01)', async () => {
    const consulta = async (q: string) => ordenados(idsServicios(await e.servicios(`?tamano=50&${q}`).expect(200)));
    expect(await consulta(`categoria=${cat.H1a}`)).toEqual([serv.s1]);
    expect(await consulta(`categoria=${cat.H1b}`)).toEqual(ordenados([serv.s3, serv.s4, ...paginados]));
    expect(await consulta(`categoria=${cat.R1}`)).toEqual(ordenados([serv.s1, serv.s3, serv.s4, ...paginados]));
    expect(await consulta(`categoria=${cat.R2}`)).toEqual([serv.s6]);
    expect(await consulta(`categoria=${cat.R3}`)).toEqual([]);
    expect(await consulta(`categoria=${cat.H3a}`)).toEqual([]);
    expect(await consulta(`especialidad=${cat.H1a}`)).toEqual(ordenados([serv.s1, serv.s3]));
    expect(await consulta('distrito=carmen-alto')).toEqual(ordenados([serv.s1, serv.s3]));
    expect(await consulta('distrito=san-juan-bautista')).toEqual([serv.s6]);
    expect(await consulta('disponibilidad=false')).toEqual([serv.s4]);
    expect(await consulta('disponibilidad=true')).toEqual(ordenados([serv.s1, serv.s3, serv.s6, ...paginados]));
    expect(await consulta(`categoria=${cat.H1b}&distrito=ayacucho&disponibilidad=true`)).toEqual(ordenados([serv.s3, ...paginados]));
    expect(await consulta(`categoria=${cat.H1b}&distrito=ayacucho&disponibilidad=false`)).toEqual([serv.s4]);
    expect(await consulta(`categoria=${cat.R1}&especialidad=${cat.H1a}&distrito=carmen-alto`)).toEqual(ordenados([serv.s1, serv.s3]));
    expect(await consulta(`categoria=${cat.R2}&distrito=ayacucho`)).toEqual([]);
    expect((await e.servicios(`?categoria=${cat.H1b.toUpperCase()}&tamano=50`).expect(200)).body.total).toBe(27);
  });

  test('las páginas recorren todas las coincidencias con el mismo total, sin repetir ni omitir (CA-BUS-01)', async () => {
    const filtro = `categoria=${cat.H1b}&disponibilidad=true`;
    const todas: string[] = [];
    for (const [pagina, esperados] of [[1, 10], [2, 10], [3, 6], [4, 0]] as const) {
      const r = await e.servicios(`?${filtro}&pagina=${pagina}&tamano=10`).expect(200);
      expect(r.body).toMatchObject({ total: 26, pagina, tamano: 10 });
      expect(r.body.elementos).toHaveLength(esperados);
      todas.push(...idsServicios(r));
    }
    expect(todas).toEqual([...todas].sort());
    expect(new Set(todas).size).toBe(26);
    expect(ordenados(todas)).toEqual(ordenados([serv.s3, ...paginados]));
  });

  test('un resultado vacío válido responde 200 y los filtros no admitidos 400 (CA-BUS-02, CA-BUS-04)', async () => {
    const vacio = await e.servicios(`?especialidad=${randomUUID()}`).expect(200);
    await validarRespuesta002('C002PaginaServicios', vacio.body);
    expect(vacio.body).toEqual({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    expect((await e.servicios('?pagina=999').expect(200)).body).toMatchObject({ elementos: [], total, pagina: 999 });
    for (const q of ['calificacion=5', 'calificacion=', 'pagina=0', 'tamano=0', 'tamano=51', 'pagina=x', 'pagina=01', 'pagina=1e1', 'pagina=1&pagina=2', 'disponibilidad=1', 'disponibilidad=TRUE',
      'distrito=huanta', 'distrito=%FF', 'categoria=no-uuid', `categoria=${cat.R1}&categoria=${cat.R2}`, 'otra=1', 'estado=PAUSADO', 'prestadorId=' + prest.A]) {
      const r = await e.servicios(`?${q}`).expect(400);
      await validarRespuesta002('C002Error400', r.body);
    }
  });
});

describe('GET /servicios/{servicioId} (obtenerServicioPublico002)', () => {
  test('un servicio visible se muestra y los no visibles responden igual que uno inexistente (CA-SER-08)', async () => {
    const ok = await e.servicio(serv.s1).expect(200);
    await validarRespuesta002('C002ServicioPublico', ok.body);
    expect(ok.body).toEqual({ servicioId: serv.s1, prestadorId: prest.A, titulo: 'Muros de albañilería', descripcion: 'Descripción de Muros de albañilería', categoriaId: cat.H1a, estado: 'PUBLICADO' });
    expect((await e.servicio(serv.s1.toUpperCase()).expect(200)).body.servicioId).toBe(serv.s1);
    const inexistente = (await e.servicio(randomUUID()).expect(404)).body;
    await validarRespuesta002('C002Error404', inexistente);
    for (const oculto of [serv.s2, serv.s5, serv.s7, serv.s8]) expect((await e.servicio(oculto).expect(404)).body).toEqual(inexistente);
    await validarRespuesta002('C002Error400', (await e.servicio('no-es-uuid').expect(400)).body);
  });

  test('`servicios/mios` no se interpreta como un identificador y sigue exigiendo sesión', async () => {
    await e.servicios('/mios').expect(401);
    await e.http.get('/api/v1/servicios/mios').set('Authorization', `Bearer ${e.datos.titular.token}`).expect(200);
  });
});

describe('GET /prestadores (buscarPrestadores002)', () => {
  test('lista prestadores publicables de forma independiente de sus servicios, con orden estable por nombre', async () => {
    const r = await e.prestadores().expect(200);
    await validarRespuesta002('C002PaginaPrestadores', r.body);
    expect(r.body).toMatchObject({ total: 6, pagina: 1, tamano: 20 });
    expect(r.body.elementos.map((x: { nombrePublico: string }) => x.nombrePublico)).toEqual([nombres.A, nombres.B, nombres.C, nombres.D, nombres.E, nombres.G]);
    expect(idsPrestadores(r)).not.toContain(prest.F);
    for (const x of r.body.elementos) expect(Object.keys(x).sort()).toEqual(['disponibilidadDeclarada', 'distritos', 'especialidadesIds', 'nombrePublico', 'prestadorId', 'tipo']);
    const dos = await e.prestadores('?pagina=2&tamano=4').expect(200);
    expect(dos.body).toMatchObject({ total: 6, pagina: 2, tamano: 4 });
    expect(dos.body.elementos.map((x: { nombrePublico: string }) => x.nombrePublico)).toEqual([nombres.E, nombres.G]);
  });

  test('los filtros combinan especialidad, zona y disponibilidad, y la categoría exige un servicio visible coincidente (CA-BUS-01)', async () => {
    const consulta = async (q: string) => idsPrestadores(await e.prestadores(`?${q}`).expect(200));
    expect(await consulta(`especialidad=${cat.H1a}`)).toEqual([prest.A, prest.E]);
    expect(await consulta('distrito=ayacucho')).toEqual([prest.A, prest.B, prest.D, prest.G]);
    expect(await consulta('disponibilidad=false')).toEqual([prest.B]);
    expect(await consulta(`especialidad=${cat.H1a}&distrito=jesus-nazareno&disponibilidad=true`)).toEqual([prest.E]);
    expect(await consulta(`categoria=${cat.H1a}`)).toEqual([prest.A]);
    expect(await consulta(`categoria=${cat.R1}`)).toEqual([prest.A, prest.B, prest.G]);
    expect(await consulta(`categoria=${cat.R2}`)).toEqual([prest.C]);
    expect(await consulta(`categoria=${cat.H3a}`)).toEqual([]);
    expect(await consulta(`categoria=${cat.R1}&disponibilidad=false`)).toEqual([prest.B]);
    const vacio = await e.prestadores(`?especialidad=${randomUUID()}`).expect(200);
    expect(vacio.body).toEqual({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    for (const q of ['calificacion=4', 'pagina=0', 'tamano=51', 'distrito=huanta', 'disponibilidad=si', 'especialidad=x', 'otra=1', 'especialidad=' + cat.H1a + '&especialidad=' + cat.H1b]) await e.prestadores(`?${q}`).expect(400);
  });
});

describe('GET /prestadores/{prestadorId} (obtenerPerfilPublico002)', () => {
  test('perfil público con datos declarados, trabajos, servicios visibles y los dos avisos exactos (CA-BUS-03, CA-BUS-04, CA-BUS-05)', async () => {
    const r = await e.perfilPublico(prest.A).expect(200);
    await validarRespuesta002('C002PrestadorPublico', r.body);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({ prestadorId: prest.A, nombrePublico: nombres.A, experiencia: `Experiencia ficticia de ${nombres.A}`, disponibilidadDeclarada: true, distritos: ['ayacucho', 'carmen-alto'], especialidadesIds: [cat.H1a] });
    expect(r.body.avisos).toEqual({ calificaciones: 'Calificaciones aún no disponibles', verificaciones: 'Verificaciones aún no disponibles' });
    expect(r.body.trabajos).toEqual([{ trabajoId: trabajo.A, titulo: 'Fachada pública', descripcion: 'Trabajo anterior publicable',
      fotografias: [{ fotografiaId: foto.A, tipoMime: 'image/webp', ancho: 800, alto: 600, ruta: `/api/v1/prestadores/${prest.A}/trabajos/${trabajo.A}/fotografias/${foto.A}` }] }]);
    expect(idsServicios({ body: r.body.servicios })).toEqual(ordenados([serv.s1, serv.s3]));
    expect(r.body.servicios).toMatchObject({ total: 2, pagina: 1, tamano: 20 });
    const texto = JSON.stringify(r.body);
    for (const prohibido of ['Sin valoraciones', 'estrella', 'puntuaci', 'insignia', 'Verificado']) expect(texto).not.toContain(prohibido);
  });

  test('un perfil sin servicios visibles es válido, y la lista de servicios se pagina con su propio total', async () => {
    const d = await e.perfilPublico(prest.D).expect(200);
    await validarRespuesta002('C002PrestadorPublico', d.body);
    expect(d.body.servicios).toEqual({ elementos: [], total: 0, pagina: 1, tamano: 20 });
    const g = await e.perfilPublico(prest.G, '?pagina=2&tamano=10').expect(200);
    await validarRespuesta002('C002PrestadorPublico', g.body);
    expect(g.body.servicios).toMatchObject({ total: 25, pagina: 2, tamano: 10 });
    expect(g.body.servicios.elementos).toHaveLength(10);
    expect((await e.perfilPublico(prest.G, '?pagina=3&tamano=10').expect(200)).body.servicios.elementos).toHaveLength(5);
  });

  test('un perfil inexistente o no publicable es 404 y los parámetros inválidos 400', async () => {
    const a = (await e.perfilPublico(randomUUID()).expect(404)).body;
    await validarRespuesta002('C002Error404', a);
    expect((await e.perfilPublico(prest.F).expect(404)).body).toEqual(a);
    for (const q of ['?calificacion=5', '?pagina=0', '?tamano=51', '?otra=1', '?pagina=1&pagina=2']) await e.perfilPublico(prest.A, q).expect(400);
    await e.perfilPublico('no-es-uuid').expect(400);
    await e.perfilPublico('perfil').expect(400);
  });

  test('las respuestas públicas son anónimas y omiten cuenta, sesión, contacto y objetos privados (CA-BUS-08)', async () => {
    const respuestas = [await e.perfilPublico(prest.A), await e.prestadores('?tamano=50'), await e.servicios('?tamano=50'), await e.servicio(serv.s1)];
    for (const r of respuestas) {
      expect(r.status).toBe(200);
      const texto = JSON.stringify(r.body);
      for (const prohibido of [e.datos.cuentaA, 'cuentaId', 'cuenta_id', 'correo', 'email', 'telefono', 'sesion', 'token', 'objetoClave', 'objeto_clave', 'checksum', 'portafolio/', 'documento', 'direccion', 'password', 'contrasena']) {
        expect(texto.toLowerCase()).not.toContain(prohibido.toLowerCase());
      }
    }
    // Una credencial inválida no cambia la respuesta: son consultas anónimas.
    await e.http.get(`/api/v1/prestadores/${prest.A}`).set('Authorization', `Bearer ${'Z'.repeat(43)}`).expect(200);
  });
});
