import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { FuentesPublicas } from '../../../src/modulos/prestadores/aplicacion/perfil-publico.js';
import { validarRespuesta002 } from '../../soporte/prestadores-catalogo/contrato-002.js';
import { cat, montarHu05, prest, serv, type EntornoHu05 } from '../../soporte/prestadores-catalogo/fixtures-hu05.js';

/** Dobles de las fuentes de calificaciones (011) y verificaciones (012), por separado. */
let fuentes: FuentesPublicas = { calificaciones: false, verificaciones: false };
let e: EntornoHu05;
beforeAll(async () => { e = await montarHu05({ fuentes: () => fuentes }); }, 120000);
afterAll(async () => { await e?.cerrar(); });

const ids = (r: { body: { elementos: { servicioId: string }[] } }) => r.body.elementos.map(x => x.servicioId);
const titular = () => e.datos.titular.token;
const publicado = async (titulo: string, categoriaId = cat.H1a) => (await e.publicar(titular(), { titulo, descripcion: 'D', categoriaId }).expect(201)).body as { servicioId: string };
/** Consulta la oferta por todas las vías públicas: búsqueda, listado del perfil y detalle. */
const vias = async (servicioId: string, categoria: string) => ({
  busqueda: ids(await e.servicios(`?categoria=${categoria}&tamano=50`)).includes(servicioId),
  perfil: ids({ body: (await e.perfilPublico(prest.A, '?tamano=50')).body.servicios }).includes(servicioId),
  detalle: (await e.servicio(servicioId)).status,
});

describe('CA-SER-08: exclusión posterior a pausa o retiro con consultas sucesivas', () => {
  test('un servicio previamente visible desaparece de la búsqueda, del perfil y del detalle, sin exponer el registro privado', async () => {
    const pausado = await publicado('Servicio que se pausará');
    const retirado = await publicado('Servicio que se retirará');
    // Búsqueda previa ya consultada: ambos aparecen.
    for (const s of [pausado, retirado]) expect(await vias(s.servicioId, cat.H1a)).toEqual({ busqueda: true, perfil: true, detalle: 200 });
    await e.transicionar(titular(), pausado.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    await e.transicionar(titular(), retirado.servicioId, { version: 1, destino: 'RETIRADO' }).expect(200);
    const noDisponible = (await e.servicio(randomUUID()).expect(404)).body;
    for (let intento = 0; intento < 3; intento++) {
      for (const s of [pausado, retirado]) expect(await vias(s.servicioId, cat.H1a)).toEqual({ busqueda: false, perfil: false, detalle: 404 });
      for (const s of [pausado, retirado]) {
        const r = await e.servicio(s.servicioId).expect(404);
        expect(r.body).toEqual(noDisponible);
        await validarRespuesta002('C002Error404', r.body);
        expect(JSON.stringify(r.body)).not.toMatch(/PAUSADO|RETIRADO|titulo|version/);
      }
    }
    // El resto de la oferta del prestador sigue visible.
    expect((await e.perfilPublico(prest.A, '?tamano=50')).body.servicios.elementos.map((x: { servicioId: string }) => x.servicioId)).toEqual(expect.arrayContaining([serv.s1, serv.s3]));
    // Reactivar el pausado lo devuelve a las tres vías.
    await e.transicionar(titular(), pausado.servicioId, { version: 2, destino: 'PUBLICADO' }).expect(200);
    expect(await vias(pausado.servicioId, cat.H1a)).toEqual({ busqueda: true, perfil: true, detalle: 200 });
  }, 60000);

  test('si el único servicio de un prestador deja de ser visible, la búsqueda de prestadores por categoría ya no lo devuelve', async () => {
    const cuenta = e.datos.otro;
    const unico = (await e.publicar(cuenta.token, { titulo: 'Único de Beto', descripcion: 'D', categoriaId: cat.H2a }).expect(201)).body as { servicioId: string };
    expect((await e.prestadores(`?categoria=${cat.H2a}&tamano=50`)).body.elementos.map((x: { prestadorId: string }) => x.prestadorId)).toEqual([prest.B, prest.C]);
    await e.transicionar(cuenta.token, unico.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    expect((await e.prestadores(`?categoria=${cat.H2a}&tamano=50`)).body.elementos.map((x: { prestadorId: string }) => x.prestadorId)).toEqual([prest.C]);
    // El prestador sigue siendo localizable sin filtro de categoría: se busca de forma independiente de sus servicios.
    expect((await e.prestadores('?tamano=50')).body.elementos.map((x: { prestadorId: string }) => x.prestadorId)).toContain(prest.B);
  }, 30000);
});

describe('CA-BUS-07: los avisos dependen de cada fuente por separado', () => {
  const casos: [FuentesPublicas, string | null, string | null][] = [
    [{ calificaciones: false, verificaciones: false }, 'Calificaciones aún no disponibles', 'Verificaciones aún no disponibles'],
    [{ calificaciones: true, verificaciones: false }, null, 'Verificaciones aún no disponibles'],
    [{ calificaciones: false, verificaciones: true }, 'Calificaciones aún no disponibles', null],
    [{ calificaciones: true, verificaciones: true }, null, null],
  ];
  test.each(casos)('fuentes %j', async (disponibles, calificaciones, verificaciones) => {
    fuentes = disponibles;
    try {
      const r = await e.perfilPublico(prest.A).expect(200);
      await validarRespuesta002('C002PrestadorPublico', r.body);
      expect(r.body.avisos).toEqual({ calificaciones, verificaciones });
      expect(JSON.stringify(r.body)).not.toMatch(/Sin valoraciones|estrella|insignia/i);
      // Los datos declarados conservan su distinción en cualquier caso.
      expect(r.body).toMatchObject({ disponibilidadDeclarada: true, experiencia: expect.stringContaining('Experiencia ficticia') });
    } finally { fuentes = { calificaciones: false, verificaciones: false }; }
  });
});

describe('CA-BUS-08: datos personales y archivos privados', () => {
  test('las consultas públicas omiten correo y datos de la cuenta, con cualquier combinación de fuentes', async () => {
    const correo = ((await e.db.query('SELECT correo FROM usuarios WHERE id=$1', [e.datos.cuentaA])) as { correo: string }[])[0]!.correo;
    expect(correo).toContain('@');
    for (const disponibles of casos2) {
      fuentes = disponibles;
      try {
        for (const r of [await e.perfilPublico(prest.A), await e.prestadores('?tamano=50'), await e.servicios('?tamano=50'), await e.servicio(serv.s1)]) {
          const texto = JSON.stringify(r.body).toLowerCase();
          expect(r.status).toBe(200);
          for (const privado of [correo, e.datos.cuentaA, 'cuentaid', 'contrasena', 'telefono', 'documento', 'direccion', 'objeto_clave', 'objetoclave', 'portafolio/']) expect(texto).not.toContain(privado.toLowerCase());
        }
      } finally { fuentes = { calificaciones: false, verificaciones: false }; }
    }
  });

  test('un visitante no obtiene el archivo privado de una cuenta y otra cuenta tampoco', async () => {
    const id = randomUUID();
    await e.db.query(`INSERT INTO fotografias_perfil(id,usuario_id,objeto_clave,mime,bytes,checksum,estado,vinculada_en) VALUES($1,$2,$3,'image/png',10,decode(repeat('00',32),'hex'),'activa',now())`, [id, e.datos.cuentaA, `usuarios/${e.datos.cuentaA}/${id}`]);
    const ruta = `/api/v1/perfil/fotografias/${id}`;
    const anonimo = await e.http.get(ruta).expect(401);
    await validarRespuesta002('C002Error401', anonimo.body);
    await e.http.get(ruta).set('Authorization', `Bearer ${'Z'.repeat(43)}`).expect(401);
    const ajena = await e.http.get(ruta).set('Authorization', `Bearer ${e.datos.otro.token}`).expect(404);
    expect(JSON.stringify(ajena.body)).not.toContain(e.datos.cuentaA);
    // Ninguna respuesta pública referencia el archivo privado.
    for (const r of [await e.perfilPublico(prest.A), await e.prestadores('?tamano=50')]) expect(JSON.stringify(r.body)).not.toContain(id);
  });
});
const casos2: FuentesPublicas[] = [
  { calificaciones: false, verificaciones: false }, { calificaciones: true, verificaciones: false },
  { calificaciones: false, verificaciones: true }, { calificaciones: true, verificaciones: true },
];
