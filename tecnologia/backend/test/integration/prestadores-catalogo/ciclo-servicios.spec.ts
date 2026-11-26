import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ConsultasPublicasPostgres } from '../../../src/modulos/catalogo/infraestructura/persistencia/consultas-publicas.js';
import { clasificaciones04 as c, montarHu04, servicioValido, type EntornoHu04 } from '../../soporte/prestadores-catalogo/fixtures-hu04.js';

let e: EntornoHu04;
beforeAll(async () => { e = await montarHu04(); });
afterAll(async () => { await e?.cerrar(); });

type S = { servicioId: string; version: number; estado: string; titulo: string };
const publicar = async (token = e.datos.prestador.token, extra: object = {}) => (await e.publicar(token, servicioValido(c, extra)).expect(201)).body as S;
const fila = async (id: string) => ((await e.db.query('SELECT titulo,descripcion,estado,version,categoria_id FROM catalogo_servicios WHERE id=$1', [id])) as Record<string, unknown>[])[0]!;
const claves = async () => Number(((await e.db.query("SELECT count(*)::int AS n FROM claves_idempotencia WHERE ambito LIKE 'oferta002:%'")) as { n: number }[])[0]!.n);

describe('escrituras simultáneas e idempotencia', () => {
  test('una clave idéntica registra una sola mutación aunque lleguen dos intentos a la vez', async () => {
    const clave = randomUUID();
    const antes = await e.revision();
    const [a, b] = await Promise.all([e.publicar(e.datos.prestador.token, servicioValido(c), clave), e.publicar(e.datos.prestador.token, servicioValido(c), clave)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body).toEqual(b.body);
    expect(Number(((await e.db.query('SELECT count(*)::int AS n FROM catalogo_servicios WHERE id=$1', [a.body.servicioId])) as { n: number }[])[0]!.n)).toBe(1);
    expect(await e.revision()).toBe(antes + 1n);
    // El mismo intento sobre una transición tampoco se repite.
    const s = a.body as S;
    const k = randomUUID();
    const [t1, t2] = await Promise.all([e.transicionar(e.datos.prestador.token, s.servicioId, { version: 1, destino: 'PAUSADO' }, k), e.transicionar(e.datos.prestador.token, s.servicioId, { version: 1, destino: 'PAUSADO' }, k)]);
    expect([t1.status, t2.status]).toEqual([200, 200]);
    expect(t1.body).toEqual(t2.body);
    expect(await fila(s.servicioId)).toMatchObject({ estado: 'PAUSADO', version: 2 });
  }, 30000);

  test('dos transiciones simultáneas con la misma versión se serializan: una confirma y la otra se rechaza', async () => {
    const s = await publicar();
    const antes = await e.revision();
    const [a, b] = await Promise.all([e.transicionar(e.datos.prestador.token, s.servicioId, { version: 1, destino: 'PAUSADO' }), e.transicionar(e.datos.prestador.token, s.servicioId, { version: 1, destino: 'RETIRADO' })]);
    // Una sola confirma. El perdedor recibe 409 si el ganador pausó (la versión quedó obsoleta) o 422 si el ganador retiró (estado terminal).
    const [ganadora, perdedora] = a.status === 200 ? [a, b] : [b, a];
    expect(ganadora.status).toBe(200);
    const final = await fila(s.servicioId);
    expect(final.version).toBe(2);
    expect(final.estado).toBe(ganadora.body.estado);
    expect([perdedora.status, perdedora.body.codigo]).toEqual(ganadora.body.estado === 'RETIRADO' ? [422, 'SERVICIO_RETIRADO'] : [409, 'VERSION_DESACTUALIZADA']);
    expect(await e.revision()).toBe(antes + 1n);
  }, 30000);

  test('una edición y una transición con la misma versión no pierden ninguna escritura confirmada', async () => {
    const s = await publicar();
    const [a, b] = await Promise.all([e.editar(e.datos.prestador.token, s.servicioId, { version: 1, titulo: 'Editado' }), e.transicionar(e.datos.prestador.token, s.servicioId, { version: 1, destino: 'PAUSADO' })]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const final = await fila(s.servicioId);
    expect(final.version).toBe(2);
    expect(a.status === 200 ? final.titulo : final.estado).toBe(a.status === 200 ? 'Editado' : 'PAUSADO');
  }, 30000);
});

describe('un fallo de escritura conserva el estado, los datos y la clave', () => {
  test('el servicio, la revisión y la clave de idempotencia no cambian y el reintento se ejecuta una sola vez', async () => {
    const s = await publicar();
    await e.db.query(`CREATE OR REPLACE FUNCTION catalogo_prueba_falla() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.titulo = 'FALLA-PRUEBA' THEN RAISE EXCEPTION 'Fallo inyectado de prueba' USING ERRCODE = 'XX000'; END IF; RETURN NEW; END; $$`);
    await e.db.query('CREATE TRIGGER catalogo_prueba_falla BEFORE UPDATE ON catalogo_servicios FOR EACH ROW EXECUTE FUNCTION catalogo_prueba_falla()');
    const antes = { servicio: await fila(s.servicioId), revision: await e.revision(), claves: await claves() };
    const clave = randomUUID();
    try {
      const r = await e.editar(e.datos.prestador.token, s.servicioId, { version: 1, titulo: 'FALLA-PRUEBA' }, clave).expect(503);
      expect(r.body.codigo).toBe('DEPENDENCIA_NO_DISPONIBLE');
    } finally { await e.db.query('DROP TRIGGER catalogo_prueba_falla ON catalogo_servicios'); await e.db.query('DROP FUNCTION catalogo_prueba_falla()'); }
    expect(await fila(s.servicioId)).toEqual(antes.servicio);
    expect(await e.revision()).toBe(antes.revision);
    expect(await claves()).toBe(antes.claves);
    const reintento = await e.editar(e.datos.prestador.token, s.servicioId, { version: 1, titulo: 'FALLA-PRUEBA' }, clave).expect(200);
    expect(reintento.body).toMatchObject({ titulo: 'FALLA-PRUEBA', version: 2 });
    expect(await e.revision()).toBe(antes.revision + 1n);
  }, 30000);

  test('los rechazos de negocio no avanzan la revisión ni dejan claves confirmadas', async () => {
    const s = await publicar();
    const antes = { revision: await e.revision(), claves: await claves() };
    await e.transicionar(e.datos.prestador.token, s.servicioId, { version: 1, destino: 'PUBLICADO' }).expect(422);
    await e.editar(e.datos.prestador.token, s.servicioId, { version: 9, titulo: 'x' }).expect(409);
    await e.publicar(e.datos.prestador.token, servicioValido(c, { categoriaId: c.inactiva })).expect(422);
    await e.mios(e.datos.prestador.token).expect(200);
    expect(await e.revision()).toBe(antes.revision);
    expect(await claves()).toBe(antes.claves);
  }, 30000);
});

describe('referencias históricas y registro retirado', () => {
  test('pausar y retirar conservan el registro y las referencias de los tres tipos, que siguen consultables', async () => {
    const s = await publicar();
    await e.sembrarReferencias(s.servicioId);
    await e.transicionar(e.datos.prestador.token, s.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    expect(await e.referencias(s.servicioId)).toEqual(['CONTRATACION', 'COTIZACION', 'SOLICITUD']);
    await e.transicionar(e.datos.prestador.token, s.servicioId, { version: 2, destino: 'RETIRADO' }).expect(200);
    expect(await e.referencias(s.servicioId)).toEqual(['CONTRATACION', 'COTIZACION', 'SOLICITUD']);
    expect(await e.elegibilidad.registro(s.servicioId)).toMatchObject({ servicioId: s.servicioId, estado: 'RETIRADO', version: 3, prestadorId: e.datos.perfiles.prestador });
    expect(await e.elegibilidad.registro(randomUUID())).toBeNull();
  }, 30000);

  test('PostgreSQL impide borrar un servicio y reabrir o modificar un registro RETIRADO', async () => {
    const s = await publicar();
    await e.sembrarReferencias(s.servicioId);
    await expect(e.db.query('DELETE FROM catalogo_servicios WHERE id=$1', [s.servicioId])).rejects.toMatchObject({ code: '23514' });
    await e.transicionar(e.datos.prestador.token, s.servicioId, { version: 1, destino: 'RETIRADO' }).expect(200);
    await expect(e.db.query("UPDATE catalogo_servicios SET estado='PUBLICADO' WHERE id=$1", [s.servicioId])).rejects.toMatchObject({ code: '23514' });
    await expect(e.db.query("UPDATE catalogo_servicios SET titulo='x' WHERE id=$1", [s.servicioId])).rejects.toMatchObject({ code: '23514' });
    await expect(e.db.query("INSERT INTO catalogo_servicios(id,prestador_id,categoria_id,titulo,descripcion,estado) VALUES ($1,$2,$3,'x','x','BORRADO')", [randomUUID(), e.datos.perfiles.prestador, c.hija])).rejects.toMatchObject({ code: '23514' });
    expect(await e.referencias(s.servicioId)).toHaveLength(3);
    expect(await fila(s.servicioId)).toMatchObject({ estado: 'RETIRADO', version: 2 });
  }, 30000);
});

describe('elegibilidad vigente (CA-SER-09)', () => {
  test('solo PUBLICADO con clasificación efectivamente activa es elegible', async () => {
    const t = e.datos.prestador.token;
    const publicado = await publicar(t);
    const pausado = await publicar(t); await e.transicionar(t, pausado.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    const retirado = await publicar(t); await e.transicionar(t, retirado.servicioId, { version: 1, destino: 'RETIRADO' }).expect(200);
    const propia = await publicar(t, { categoriaId: c.raizActiva2 });
    const hijaDePadre = await publicar(t, { categoriaId: c.raiz });
    const hijaConPadre = await publicar(t);
    await e.db.query('UPDATE catalogo_clasificaciones SET activa=false WHERE id=$1', [c.raizActiva2]);
    await e.db.query('UPDATE catalogo_clasificaciones SET activa=false WHERE id=$1', [c.raiz]);
    try {
      const resultado = async (s: S) => e.elegibilidad.evaluar(s.servicioId);
      expect(await resultado(publicado)).toMatchObject({ elegible: false, motivo: 'CLASIFICACION_INACTIVA' });
      expect(await resultado(propia)).toMatchObject({ elegible: false, motivo: 'CLASIFICACION_INACTIVA' });
      expect(await resultado(hijaDePadre)).toMatchObject({ elegible: false, motivo: 'CLASIFICACION_INACTIVA' });
      // La hija conserva su estado propio activo, pero su raíz inactiva la deja inelegible.
      expect(await resultado(hijaConPadre)).toMatchObject({ elegible: false, motivo: 'CLASIFICACION_INACTIVA' });
      // El estado del servicio no cambia por la actividad de su clasificación.
      expect((await fila(publicado.servicioId)).estado).toBe('PUBLICADO');
    } finally {
      await e.db.query('UPDATE catalogo_clasificaciones SET activa=true WHERE id=ANY($1::uuid[])', [[c.raiz, c.raizActiva2]]);
    }
    expect(await e.elegibilidad.evaluar(publicado.servicioId)).toEqual({ servicioId: publicado.servicioId, elegible: true });
    expect(await e.elegibilidad.evaluar(hijaConPadre.servicioId)).toEqual({ servicioId: hijaConPadre.servicioId, elegible: true });
    expect(await e.elegibilidad.evaluar(pausado.servicioId)).toMatchObject({ elegible: false, motivo: 'ESTADO_NO_PUBLICADO' });
    expect(await e.elegibilidad.evaluar(retirado.servicioId)).toMatchObject({ elegible: false, motivo: 'ESTADO_NO_PUBLICADO' });
    expect(await e.elegibilidad.evaluar(randomUUID())).toMatchObject({ elegible: false, motivo: 'NO_EXISTE' });
    // La evaluación no crea solicitudes ni modifica el servicio.
    expect(await fila(publicado.servicioId)).toMatchObject({ estado: 'PUBLICADO', version: 1 });
  }, 30000);

  test('con contexto transaccional el bloqueo compartido serializa los cambios de elegibilidad hasta el commit', async () => {
    const t = e.datos.prestador.token;
    const s = await publicar(t);
    let liberar!: () => void;
    const espera = new Promise<void>(resolver => { liberar = resolver; });
    let evaluada!: () => void;
    const lista = new Promise<void>(resolver => { evaluada = resolver; });
    // Equivale a Solicitudes (003): evalúa y guarda dentro de la misma unidad de trabajo.
    const solicitud = e.uow.ejecutar(async (tx) => {
      const r = await e.elegibilidad.evaluar(s.servicioId, tx);
      evaluada();
      await espera;
      return r;
    });
    await lista;
    let terminada = false;
    const pausa = e.transicionar(t, s.servicioId, { version: 1, destino: 'PAUSADO' }).then(r => { terminada = true; return r; });
    await new Promise(r => setTimeout(r, 700));
    expect(terminada).toBe(false);
    liberar();
    expect((await solicitud).elegible).toBe(true);
    expect((await pausa).status).toBe(200);
    expect(await e.elegibilidad.evaluar(s.servicioId)).toMatchObject({ elegible: false, motivo: 'ESTADO_NO_PUBLICADO' });
  }, 30000);
});

describe('CA-SER-08 en la capa de datos: exclusión de las consultas públicas tras pausar o retirar', () => {
  test('consultas sucesivas dejan de devolver el servicio y conservan el resto del prestador', async () => {
    const publicas = new ConsultasPublicasPostgres(e.uow);
    await e.db.query(`INSERT INTO catalogo_proyeccion_prestadores(prestador_id,nombre_publico,tipo,disponibilidad_declarada,especialidades,distritos,publicable)
      VALUES($1,'Prestador 04','TECNICO',true,$2::uuid[],'{ayacucho}',true) ON CONFLICT (prestador_id) DO NOTHING`, [e.datos.perfiles.prestador, [c.hija]]);
    const t = e.datos.prestador.token;
    const [a, b, resto] = [await publicar(t), await publicar(t), await publicar(t)];
    const visibles = async () => (await publicas.serviciosVisiblesDe(e.datos.perfiles.prestador, 1, 50)).elementos.map(x => x.servicioId);
    const filtro = { categoria: c.hija, pagina: 1, tamano: 50 };
    const buscados = async () => (await publicas.buscarServicios(filtro)).elementos.map(x => x.servicioId);
    for (const s of [a, b, resto]) { expect(await visibles()).toContain(s.servicioId); expect(await buscados()).toContain(s.servicioId); expect(await publicas.servicioVisible(s.servicioId)).not.toBeNull(); }
    await e.transicionar(t, a.servicioId, { version: 1, destino: 'PAUSADO' }).expect(200);
    await e.transicionar(t, b.servicioId, { version: 1, destino: 'RETIRADO' }).expect(200);
    for (let i = 0; i < 3; i++) {
      for (const s of [a, b]) { expect(await visibles()).not.toContain(s.servicioId); expect(await buscados()).not.toContain(s.servicioId); expect(await publicas.servicioVisible(s.servicioId)).toBeNull(); }
      expect(await visibles()).toContain(resto.servicioId);
    }
    // El registro histórico sigue disponible para los procesos autorizados, aunque no sea visible al público.
    expect(await e.elegibilidad.registro(b.servicioId)).toMatchObject({ estado: 'RETIRADO' });
    const pagina = await publicas.buscarServicios({ ...filtro, pagina: 1, tamano: 1 });
    expect(pagina.total).toBe((await buscados()).length);
  }, 30000);
});
