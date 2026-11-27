import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { crearYPublicar, cuerpoPublicable, imagen, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T046 · ciclo de vida de una solicitud con PostgreSQL real: CA-SOL-01 y 05 a 08, CA-BOR-01 a 10, CA-VER-01 a 07, CA-CIE-01 y 02, CA-AVI-02 a 04 y CA-DAT.
let e: EntornoUs1; let t1: string; let t2: string; let tAna: string; let tBeto: string;
const n = async (sql: string, p: unknown[] = []) => Number(((await e.db.query(sql, p)) as { n: number }[])[0]!.n);
const fila = async (id: string) => ((await e.db.query('SELECT version, version_trabajo, estado FROM solicitudes WHERE id=$1', [id])) as { version: number; version_trabajo: number; estado: string }[])[0]!;
const avisos = async (solicitudId: string) => (await e.db.query('SELECT tipo, cuenta_destinatario_id AS cuenta, version_trabajo AS v, estado FROM avisos_negocio WHERE solicitud_id=$1 ORDER BY tipo, cuenta_destinatario_id', [solicitudId])) as { tipo: string; cuenta: string; v: number | null; estado: string }[];
const bitacora = async (id: string) => (await e.db.query('SELECT tipo FROM solicitudes_bitacora WHERE solicitud_id=$1 ORDER BY ocurrida_en, id', [id]) as { tipo: string }[]).map(x => x.tipo);
const versiones = (id: string) => n('SELECT count(*)::int AS n FROM solicitudes_versiones WHERE solicitud_id=$1', [id]);
/** Una cotización no retirada de `prestador` sobre la solicitud: las lecturas de autoría las resuelven con datos reales. */
const cotizar = (solicitudId: string, p: { prestadorId: string; cuentaId: string }, estado: 'ACTIVA' | 'RETIRADA' = 'ACTIVA') =>
  e.db.query('INSERT INTO cotizaciones (id,solicitud_id,prestador_id,prestador_cuenta_id,estado,retirada_en) VALUES ($1,$2,$3,$4,$5,$6)', [randomUUID(), solicitudId, p.prestadorId, p.cuentaId, estado, estado === 'RETIRADA' ? new Date().toISOString() : null]);
const dirigida = (p: { prestadorId: string }, extra: object = {}) => ({ tipo: 'DIRIGIDA', prestadorId: p.prestadorId, descripcion: 'Instalar un baño completo en la planta alta.', categoriaId: e.datos.categorias.A1, distrito: 'ayacucho', fechaDesde: '2031-04-01', ...extra });

beforeAll(async () => {
  e = await montarUs1();
  [t1, t2, tAna, tBeto] = await Promise.all([e.token(e.datos.clientes.clienteUno), e.token(e.datos.clientes.clienteDos), e.token(e.datos.prestadores.ana), e.token(e.datos.prestadores.beto)]) as [string, string, string, string];
}, 300000);
afterAll(async () => { await e?.cerrar(); }, 120000);

describe('borrador (CA-BOR-01, 06 y 07, CA-VER-07)', () => {
  test('se guarda con solo el tipo, queda en BORRADOR con versión 1 y de trabajo 0 y deja la bitácora CREADA (CA-BOR-01)', async () => {
    const r = await e.crear(t1, { tipo: 'PUBLICADA' }).expect(201);
    await validarRespuesta003('C003SolicitudPrivada', r.body);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body).toMatchObject({ tipo: 'PUBLICADA', estado: 'BORRADOR', version: 1, versionTrabajo: 0, archivos: [], compartirFotografias: false });
    expect(await bitacora(r.body.solicitudId)).toEqual(['CREADA']);
    expect(await avisos(r.body.solicitudId)).toEqual([]);
  });
  test('editar un borrador sube solo la versión de control, no crea versiones de trabajo y no avisa a nadie (CA-VER-07 y CA-AVI-03)', async () => {
    const c = await e.crear(t1, { tipo: 'PUBLICADA' }).expect(201);
    const r = await e.editar(t1, c.body.solicitudId, { version: 1, descripcion: 'Texto del borrador' }).expect(200);
    expect(r.body).toMatchObject({ version: 2, versionTrabajo: 0, descripcion: 'Texto del borrador' });
    expect(await versiones(c.body.solicitudId)).toBe(0);
    expect(await bitacora(c.body.solicitudId)).toEqual(['CREADA', 'BORRADOR_EDITADO']);
    expect(await avisos(c.body.solicitudId)).toEqual([]);
  });
  test('un borrador solo lo ve su dueño: otro cliente y un prestador reciben 404 (CA-BOR-06)', async () => {
    const c = await e.crear(t1, { tipo: 'PUBLICADA', descripcion: 'Privado' }).expect(201);
    for (const tk of [t2, tAna, tBeto]) { const r = await e.obtener(tk, c.body.solicitudId).expect(404); expect(r.body.codigo).toBe('RECURSO_NO_DISPONIBLE'); await validarRespuesta003('C003Error404', r.body); }
    const lista = await e.listar(t2).expect(200);
    expect(JSON.stringify(lista.body)).not.toContain(c.body.solicitudId);
    await e.obtener(t1, c.body.solicitudId).expect(200);
  });
  test('un borrador se descarta cerrándolo: queda CERRADA, deja bitácora y no registra avisos (CA-BOR-07)', async () => {
    const c = await e.crear(t1, dirigida(e.datos.prestadores.ana)).expect(201);
    const r = await e.cerrarSolicitud(t1, c.body.solicitudId, { version: c.body.version }).expect(200);
    expect(r.body).toMatchObject({ estado: 'CERRADA', version: 2, versionTrabajo: 0 });
    expect(await bitacora(c.body.solicitudId)).toEqual(['CREADA', 'CERRADA']);
    expect(await avisos(c.body.solicitudId)).toEqual([]);
  });
});

describe('publicar: datos obligatorios, validaciones y referencias (CA-BOR-02 a 05 y 08 a 10, CA-SOL-02 a 04)', () => {
  test('publicar con campos faltantes devuelve 422 SOLICITUD_INCOMPLETA con el detalle y conserva el borrador (CA-BOR-02)', async () => {
    const c = await e.crear(t1, { tipo: 'PUBLICADA', medidas: '3 x 2 m' }).expect(201);
    const r = await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(422);
    expect(r.body.codigo).toBe('SOLICITUD_INCOMPLETA');
    expect(r.body.detalles.map((d: { campo: string }) => d.campo)).toEqual(['descripcion', 'categoriaId', 'distrito', 'fechaDesde']);
    await validarRespuesta003('C003Error422', r.body);
    expect(await fila(c.body.solicitudId)).toMatchObject({ estado: 'BORRADOR', version: 1, version_trabajo: 0 });
  });
  test('un distrito fuera del catálogo se rechaza y no cambia el borrador (CA-SOL-04)', async () => {
    const c = await e.crear(t1, cuerpoPublicable(e)).expect(201);
    const r = await e.editar(t1, c.body.solicitudId, { version: 1, distrito: 'huanta' }).expect(400);
    expect(r.body.codigo).toBe('DATOS_INVALIDOS');
    expect(await fila(c.body.solicitudId)).toMatchObject({ estado: 'BORRADOR', version: 1 });
  });
  test('la fecha deseada no puede ser anterior a hoy en Lima y el periodo debe ser coherente', async () => {
    const pasada = await e.crear(t1, cuerpoPublicable(e, { fechaDesde: '2020-01-01', fechaHasta: undefined })).expect(201);
    const r = await e.publicar(t1, pasada.body.solicitudId, { version: 1 }).expect(422);
    expect([r.body.codigo, r.body.detalles[0].campo]).toEqual(['FECHA_NO_VALIDA', 'fechaDesde']);
    const incoherente = await e.crear(t1, cuerpoPublicable(e, { fechaDesde: '2031-05-10', fechaHasta: '2031-05-09' })).expect(422);
    expect(incoherente.body.codigo).toBe('FECHA_NO_VALIDA');
  });
  test('la categoría debe estar efectivamente activa', async () => {
    const r = await e.crear(t1, cuerpoPublicable(e, { categoriaId: e.datos.categorias.inactiva })).expect(422);
    expect(r.body.codigo).toBe('CATEGORIA_NO_ACTIVA');
    expect((await e.crear(t1, cuerpoPublicable(e, { categoriaId: randomUUID() })).expect(422)).body.codigo).toBe('CATEGORIA_NO_ACTIVA');
  });
  test('una dirigida al propio cliente devuelve 422 AUTODIRECCION_NO_PERMITIDA (CA-SOL-03)', async () => {
    const gema = e.datos.ambosPerfiles; const tg = await e.token(gema);
    const r = await e.crear(tg, dirigida(gema)).expect(422);
    expect(r.body.codigo).toBe('AUTODIRECCION_NO_PERMITIDA');
  });
  test('una dirigida a un prestador inexistente o con un servicio de otro prestador devuelve 422 (CA-BOR-10)', async () => {
    expect((await e.crear(t1, dirigida({ prestadorId: randomUUID() })).expect(422)).body.codigo).toBe('PRESTADOR_NO_DISPONIBLE');
    const ajeno = await e.crear(t1, dirigida(e.datos.prestadores.ana, { servicioId: e.datos.prestadores.beto.servicios[0]!.id, categoriaId: undefined })).expect(422);
    expect(ajeno.body.codigo).toBe('SERVICIO_NO_PERTENECE_AL_PRESTADOR');
  });
  test('con servicio, enviar otra categoría devuelve 422 y la categoría se toma del servicio (CA-SOL-02)', async () => {
    const beto = e.datos.prestadores.beto; const servicioId = beto.servicios[0]!.id;
    const mala = await e.crear(t1, dirigida(beto, { servicioId, categoriaId: e.datos.categorias.B })).expect(422);
    expect(mala.body.codigo).toBe('CATEGORIA_NO_COINCIDE_CON_SERVICIO');
    const buena = await e.crear(t1, dirigida(beto, { servicioId, categoriaId: undefined })).expect(201);
    expect(buena.body).toMatchObject({ categoriaId: e.datos.categorias.A1, servicio: { servicioId, categoriaId: e.datos.categorias.A1 } });
    expect(buena.body.servicio.titulo).toBe('Instalación sanitaria');
  });
  test('un servicio no elegible falla sin guardar, aunque antes lo fuera (CA-SOL-01 y CA-BOR-03)', async () => {
    const carla = e.datos.prestadores.carla; const servicioId = carla.servicios[0]!.id;
    const antes = await n('SELECT count(*)::int AS n FROM solicitudes');
    await e.crear(t1, dirigida(carla, { servicioId, categoriaId: undefined })).expect(201); // elegible
    await e.db.query("UPDATE catalogo_servicios SET estado='PAUSADO' WHERE id=$1", [servicioId]);
    const r = await e.crear(t1, dirigida(carla, { servicioId, categoriaId: undefined })).expect(422);
    expect(r.body.codigo).toBe('SERVICIO_NO_ELEGIBLE');
    expect(await n('SELECT count(*)::int AS n FROM solicitudes')).toBe(antes + 1);
    await e.db.query("UPDATE catalogo_servicios SET estado='PUBLICADO' WHERE id=$1", [servicioId]);
  });
  test('un servicio elegible al guardar que se retira antes de publicar impide publicar (CA-BOR-04)', async () => {
    const dario = e.datos.prestadores.dario; const servicioId = dario.servicios[0]!.id;
    const c = await e.crear(t1, dirigida(dario, { servicioId, categoriaId: undefined })).expect(201);
    await e.db.query("UPDATE catalogo_servicios SET estado='PAUSADO' WHERE id=$1", [servicioId]);
    const r = await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(422);
    expect(r.body.codigo).toBe('SERVICIO_NO_ELEGIBLE');
    expect(await fila(c.body.solicitudId)).toMatchObject({ estado: 'BORRADOR', version: 1 });
    await e.db.query("UPDATE catalogo_servicios SET estado='PUBLICADO' WHERE id=$1", [servicioId]);
  });
  test('un servicio cuya categoría cambió impide publicar (CA-BOR-05)', async () => {
    const ana = e.datos.prestadores.ana; const servicioId = ana.servicios[0]!.id;
    const c = await e.crear(t1, dirigida(ana, { servicioId, categoriaId: undefined })).expect(201);
    await e.db.query('UPDATE catalogo_servicios SET categoria_id=$2 WHERE id=$1', [servicioId, e.datos.categorias.B]);
    const r = await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(422);
    expect(r.body.codigo).toBe('CATEGORIA_NO_COINCIDE_CON_SERVICIO');
    await e.db.query('UPDATE catalogo_servicios SET categoria_id=$2 WHERE id=$1', [servicioId, e.datos.categorias.A]);
  });
  test('una dirigida sin servicio se publica aunque el prestador no cubra el distrito ni declare la categoría, con ambas advertencias (CA-BOR-08)', async () => {
    const dario = e.datos.prestadores.dario;
    const c = await e.crear(t1, dirigida(dario, { distrito: 'ayacucho', categoriaId: e.datos.categorias.A1 })).expect(201);
    expect(c.body.advertencias.map((a: { codigo: string }) => a.codigo).sort()).toEqual(['CATEGORIA_FUERA_DE_ESPECIALIDADES', 'DISTRITO_FUERA_DE_COBERTURA']);
    const p = await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200);
    expect(p.body.estado).toBe('ABIERTA');
    expect(p.body.advertencias.map((a: { codigo: string }) => a.codigo).sort()).toEqual(['CATEGORIA_FUERA_DE_ESPECIALIDADES', 'DISTRITO_FUERA_DE_COBERTURA']);
    await validarRespuesta003('C003SolicitudPrivada', p.body);
  });
  test('una dirigida con servicio elegible se publica aunque el prestador no cubra el distrito, y solo advierte del distrito (CA-BOR-09)', async () => {
    const ana = e.datos.prestadores.ana;
    const c = await e.crear(t1, dirigida(ana, { servicioId: ana.servicios[0]!.id, categoriaId: undefined, distrito: 'jesus-nazareno' })).expect(201);
    const p = await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200);
    expect(p.body.advertencias.map((a: { codigo: string }) => a.codigo)).toEqual(['DISTRITO_FUERA_DE_COBERTURA']);
  });
  test('no existe campo de título ni de dirección exacta (CA-SOL-10)', async () => {
    for (const extra of [{ titulo: 'x' }, { direccion: 'Jr. Lima 1' }, { cuentaId: randomUUID() }, { clienteCuentaId: randomUUID() }, { estado: 'ABIERTA' }]) {
      expect((await e.crear(t1, { tipo: 'PUBLICADA', ...extra }).expect(400)).body.codigo).toBe('PROPIEDAD_NO_ADMITIDA');
    }
    expect((await e.crear(t1, { tipo: 'PUBLICADA', descripcion: 'x'.repeat(2001) }).expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
    expect((await e.crear(t1, { tipo: 'PUBLICADA', medidas: 'x'.repeat(501) }).expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
    await e.crear(t1, { tipo: 'PUBLICADA', descripcion: 'x'.repeat(2000), medidas: 'y'.repeat(500) }).expect(201);
  });
});

describe('versionado (CA-SOL-05 a 07, CA-VER-01 a 06)', () => {
  test('la primera publicación crea la versión de trabajo 1, sube el control y deja bitácora PUBLICADA, sin avisos si es publicada (CA-VER-06 y CA-AVI-03)', async () => {
    const c = await e.crear(t1, cuerpoPublicable(e)).expect(201);
    const p = await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200);
    expect(p.body).toMatchObject({ estado: 'ABIERTA', version: 2, versionTrabajo: 1 });
    expect(await versiones(c.body.solicitudId)).toBe(1);
    expect(await bitacora(c.body.solicitudId)).toEqual(['CREADA', 'PUBLICADA']);
    expect(await avisos(c.body.solicitudId)).toEqual([]);
  });
  test('un cambio relevante crea la versión 2, y no la 1 otra vez (CA-VER-03 y CA-VER-06)', async () => {
    const p = await crearYPublicar(e, t1);
    const r = await e.editar(t1, p.solicitudId, { version: p.version, descripcion: 'Descripción corregida del muro.' }).expect(200);
    expect(r.body).toMatchObject({ version: p.version + 1, versionTrabajo: 2, descripcion: 'Descripción corregida del muro.' });
    expect(await versiones(p.solicitudId)).toBe(2);
    expect(await bitacora(p.solicitudId)).toEqual(['CREADA', 'PUBLICADA', 'EDITADA']);
  });
  test.each([['medidas', { medidas: '4 x 2 m' }], ['categoriaId', { categoriaId: 'A2' }], ['distrito', { distrito: 'carmen-alto' }], ['fechaDesde', { fechaDesde: '2031-03-12' }], ['fechaHasta', { fechaHasta: '2031-03-25' }]] as const)(
    'cambiar %s es relevante: crea una versión de trabajo (CA-VER-03)', async (_campo, cambio) => {
      const p = await crearYPublicar(e, t1);
      const cuerpo = 'categoriaId' in cambio ? { categoriaId: e.datos.categorias.A2 } : cambio;
      const r = await e.editar(t1, p.solicitudId, { version: p.version, ...cuerpo }).expect(200);
      expect(r.body.versionTrabajo).toBe(2);
    });
  test('cambiar solo el permiso de compartir sube el control, deja bitácora PRIVACIDAD_CAMBIADA y no crea versión de trabajo ni avisos (CA-VER-01)', async () => {
    const p = await crearYPublicar(e, t1);
    await cotizar(p.solicitudId, e.datos.prestadores.ana);
    const r = await e.editar(t1, p.solicitudId, { version: p.version, compartirFotografias: true }).expect(200);
    expect(r.body).toMatchObject({ version: p.version + 1, versionTrabajo: 1, compartirFotografias: true });
    expect(await versiones(p.solicitudId)).toBe(1);
    expect(await bitacora(p.solicitudId)).toEqual(['CREADA', 'PUBLICADA', 'PRIVACIDAD_CAMBIADA']);
    expect(await avisos(p.solicitudId)).toEqual([]);
  });
  test('cambiar el permiso con una versión de control desactualizada devuelve 409 (CA-VER-04)', async () => {
    const p = await crearYPublicar(e, t1);
    const r = await e.editar(t1, p.solicitudId, { version: p.version - 1, compartirFotografias: true }).expect(409);
    expect(r.body.codigo).toBe('VERSION_DESACTUALIZADA');
    await validarRespuesta003('C003Error409', r.body);
    expect((await fila(p.solicitudId)).version).toBe(p.version);
  });
  test('un cambio relevante y uno de privacidad juntos crean UNA versión de trabajo y dos entradas de bitácora (CA-VER-05)', async () => {
    const p = await crearYPublicar(e, t1);
    const r = await e.editar(t1, p.solicitudId, { version: p.version, descripcion: 'Otra descripción', compartirFotografias: true }).expect(200);
    expect(r.body).toMatchObject({ versionTrabajo: 2, compartirFotografias: true });
    expect(await versiones(p.solicitudId)).toBe(2);
    expect((await bitacora(p.solicitudId)).slice(2)).toEqual(['EDITADA', 'PRIVACIDAD_CAMBIADA']);
  });
  test('una edición idéntica al estado vigente no tiene efectos: ni versión, ni bitácora, ni aviso (CA-SOL-07)', async () => {
    const p = await crearYPublicar(e, t1);
    await cotizar(p.solicitudId, e.datos.prestadores.ana);
    const antes = { f: await fila(p.solicitudId), b: await bitacora(p.solicitudId), v: await versiones(p.solicitudId) };
    const r = await e.editar(t1, p.solicitudId, { version: p.version, descripcion: `  ${p.descripcion as string}  `, distrito: 'ayacucho', compartirFotografias: false }).expect(200);
    expect(r.body.version).toBe(p.version);
    expect({ f: await fila(p.solicitudId), b: await bitacora(p.solicitudId), v: await versiones(p.solicitudId) }).toEqual(antes);
    expect(await avisos(p.solicitudId)).toEqual([]);
  });
  test('la misma petición con la misma clave devuelve el mismo resultado sin versión ni aviso nuevos; con otro cuerpo, 409 (CA-SOL-06)', async () => {
    const p = await crearYPublicar(e, t1);
    await cotizar(p.solicitudId, e.datos.prestadores.ana);
    const clave = randomUUID();
    const primera = await e.editar(t1, p.solicitudId, { version: p.version, descripcion: 'Texto nuevo' }, clave).expect(200);
    const replay = await e.editar(t1, p.solicitudId, { version: p.version, descripcion: 'Texto nuevo' }, clave).expect(200);
    expect(replay.body).toEqual(primera.body);
    expect(await versiones(p.solicitudId)).toBe(2);
    expect((await avisos(p.solicitudId)).length).toBe(1);
    const otro = await e.editar(t1, p.solicitudId, { version: p.version, descripcion: 'Distinto' }, clave).expect(409);
    expect(otro.body.codigo).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
  });
  test('la creación también es idempotente: la misma clave no duplica solicitudes', async () => {
    const clave = randomUUID(); const antes = await n('SELECT count(*)::int AS n FROM solicitudes');
    const a = await e.crear(t1, { tipo: 'PUBLICADA' }, clave).expect(201); const b = await e.crear(t1, { tipo: 'PUBLICADA' }, clave).expect(201);
    expect(b.body.solicitudId).toBe(a.body.solicitudId);
    expect(await n('SELECT count(*)::int AS n FROM solicitudes')).toBe(antes + 1);
  });
  test('una edición concurrente con la misma versión: una gana y la otra recibe 409 VERSION_DESACTUALIZADA', async () => {
    const p = await crearYPublicar(e, t1);
    const resultados = await Promise.all([e.editar(t1, p.solicitudId, { version: p.version, descripcion: 'A' }), e.editar(t1, p.solicitudId, { version: p.version, descripcion: 'B' })]);
    expect(resultados.map(r => r.status).sort()).toEqual([200, 409]);
    expect(resultados.find(r => r.status === 409)!.body.codigo).toBe('VERSION_DESACTUALIZADA');
    expect(await fila(p.solicitudId)).toMatchObject({ version: p.version + 1, version_trabajo: 2 });
  });
});

describe('campos inmutables, servicio retirado y cierre (CA-SOL-08 y 09, CA-CIE-01 y 02)', () => {
  test('cambiar el tipo, el prestador o el servicio tras publicar devuelve 422 CAMPO_NO_MODIFICABLE sin cambios; el mismo valor no es un cambio (CA-SOL-09)', async () => {
    const ana = e.datos.prestadores.ana; const servicioId = ana.servicios[0]!.id;
    const c = await e.crear(t1, dirigida(ana, { servicioId, categoriaId: undefined })).expect(201);
    const p = (await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200)).body;
    for (const [cambio, campo] of [[{ tipo: 'PUBLICADA' }, 'tipo'], [{ prestadorId: e.datos.prestadores.beto.prestadorId }, 'prestadorId'], [{ servicioId: e.datos.prestadores.beto.servicios[0]!.id }, 'servicioId'],
      [{ categoriaId: e.datos.categorias.B }, 'categoriaId']] as const) {
      const r = await e.editar(t1, p.solicitudId, { version: p.version, ...cambio }).expect(422);
      expect([r.body.codigo, r.body.detalles[0].campo]).toEqual(['CAMPO_NO_MODIFICABLE', campo]);
    }
    expect((await fila(p.solicitudId)).version).toBe(p.version);
    await e.editar(t1, p.solicitudId, { version: p.version, tipo: 'DIRIGIDA', prestadorId: ana.prestadorId, servicioId }).expect(200);
  });
  test('un servicio retirado tras publicar deja la solicitud ABIERTA con la copia guardada y permite seguir editando otros datos (CA-SOL-08 y FR-313)', async () => {
    const beto = e.datos.prestadores.beto; const servicioId = beto.servicios[0]!.id;
    const c = await e.crear(t1, dirigida(beto, { servicioId, categoriaId: undefined })).expect(201);
    const p = (await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200)).body;
    await e.db.query("UPDATE catalogo_servicios SET estado='RETIRADO' WHERE id=$1", [servicioId]);
    const leida = await e.obtener(t1, p.solicitudId).expect(200);
    expect(leida.body).toMatchObject({ estado: 'ABIERTA', servicio: { servicioId, titulo: 'Instalación sanitaria' } });
    await e.editar(t1, p.solicitudId, { version: p.version, medidas: '2 baños' }).expect(200);
  });
  test('una solicitud CERRADA rechaza edición, publicación, cierre y archivos con 409, y se lee con normalidad (CA-CIE-01)', async () => {
    const p = await crearYPublicar(e, t1);
    const cerrada = (await e.cerrarSolicitud(t1, p.solicitudId, { version: p.version }).expect(200)).body;
    for (const r of [await e.editar(t1, p.solicitudId, { version: cerrada.version, medidas: 'x' }), await e.publicar(t1, p.solicitudId, { version: cerrada.version }),
      await e.cerrarSolicitud(t1, p.solicitudId, { version: cerrada.version }), await e.cargar(t1, p.solicitudId, await imagen())]) {
      expect([r.status, r.body.codigo]).toEqual([409, 'SOLICITUD_NO_ABIERTA']);
      await validarRespuesta003('C003Error409', r.body);
    }
    const leida = await e.obtener(t1, p.solicitudId).expect(200);
    expect(leida.body.estado).toBe('CERRADA');
    expect(await versiones(p.solicitudId)).toBe(1);
  });
  test('cerrar una ABIERTA no crea versión de trabajo, deja bitácora y registra un aviso por prestador interesado, sin duplicados (CA-CIE-02, CA-VER-02 y CA-AVI-04)', async () => {
    const p = await crearYPublicar(e, t1);
    await cotizar(p.solicitudId, e.datos.prestadores.ana); await cotizar(p.solicitudId, e.datos.prestadores.beto); await cotizar(p.solicitudId, e.datos.prestadores.carla, 'RETIRADA');
    const clave = randomUUID();
    const r = await e.cerrarSolicitud(t1, p.solicitudId, { version: p.version }, clave).expect(200);
    expect(r.body).toMatchObject({ estado: 'CERRADA', version: p.version + 1, versionTrabajo: 1 });
    expect(await versiones(p.solicitudId)).toBe(1);
    expect(await bitacora(p.solicitudId)).toEqual(['CREADA', 'PUBLICADA', 'CERRADA']);
    const registrados = await avisos(p.solicitudId);
    expect(registrados.map(a => [a.tipo, a.cuenta, a.v, a.estado])).toEqual([e.datos.prestadores.ana, e.datos.prestadores.beto].map(x => x.cuentaId).sort().map(c => ['SOLICITUD_CERRADA', c, null, 'REGISTRADO']));
    await e.cerrarSolicitud(t1, p.solicitudId, { version: p.version }, clave).expect(200);
    expect((await avisos(p.solicitudId)).length).toBe(2);
  });
});

describe('avisos de negocio (CA-AVI-02 a 04)', () => {
  test('publicar por primera vez una dirigida registra exactamente un aviso REGISTRADO para el destinatario, idempotente (CA-AVI-02)', async () => {
    const ana = e.datos.prestadores.ana;
    const c = await e.crear(t1, dirigida(ana)).expect(201);
    const clave = randomUUID();
    await e.publicar(t1, c.body.solicitudId, { version: 1 }, clave).expect(200);
    await e.publicar(t1, c.body.solicitudId, { version: 1 }, clave).expect(200);
    expect((await avisos(c.body.solicitudId)).map(a => [a.tipo, a.cuenta, a.v, a.estado])).toEqual([['SOLICITUD_DIRIGIDA_PUBLICADA', ana.cuentaId, 1, 'REGISTRADO']]);
  });
  test('si la publicación falla no queda aviso ni cambio alguno: es atómica con la transacción (CA-AVI-02 y CA-SOL-05)', async () => {
    const carla = e.datos.prestadores.carla;
    const c = await e.crear(t1, dirigida(carla)).expect(201);
    await e.db.query('ALTER TABLE avisos_negocio ADD CONSTRAINT bloqueo_de_prueba CHECK (false) NOT VALID');
    try {
      const r = await e.publicar(t1, c.body.solicitudId, { version: 1 });
      expect(r.status).toBe(503);
      expect(r.body.codigo).toBe('DEPENDENCIA_NO_DISPONIBLE');
      expect(JSON.stringify(r.body)).not.toMatch(/avisos_negocio|constraint|bloqueo_de_prueba/);
    } finally { await e.db.query('ALTER TABLE avisos_negocio DROP CONSTRAINT bloqueo_de_prueba'); }
    expect(await fila(c.body.solicitudId)).toMatchObject({ estado: 'BORRADOR', version: 1, version_trabajo: 0 });
    expect(await versiones(c.body.solicitudId)).toBe(0);
    expect(await avisos(c.body.solicitudId)).toEqual([]);
    await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200);
  });
  test('un cambio relevante tras la versión 1 registra un aviso por prestador interesado: destinatario y autores no retirados, sin duplicados (CA-AVI-04)', async () => {
    const ana = e.datos.prestadores.ana; const beto = e.datos.prestadores.beto;
    const c = await e.crear(t1, dirigida(ana)).expect(201);
    const p = (await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200)).body;
    await cotizar(p.solicitudId, ana); await cotizar(p.solicitudId, beto);
    const r = await e.editar(t1, p.solicitudId, { version: p.version, descripcion: 'Cambio relevante' }).expect(200);
    const cambiados = (await avisos(p.solicitudId)).filter(a => a.tipo === 'SOLICITUD_CAMBIADA');
    expect(cambiados.map(a => [a.cuenta, a.v]).sort()).toEqual([[ana.cuentaId, r.body.versionTrabajo], [beto.cuentaId, r.body.versionTrabajo]].sort());
    expect((await avisos(p.solicitudId)).filter(a => a.tipo === 'SOLICITUD_DIRIGIDA_PUBLICADA')).toHaveLength(1);
  });
  test('en una publicada sin cotizaciones, editar y cerrar no registran avisos, y quien no cotizó no recibe ninguno (CA-AVI-04)', async () => {
    const p = await crearYPublicar(e, t1);
    const r = await e.editar(t1, p.solicitudId, { version: p.version, medidas: '5 x 5' }).expect(200);
    await e.cerrarSolicitud(t1, p.solicitudId, { version: r.body.version }).expect(200);
    expect(await avisos(p.solicitudId)).toEqual([]);
  });
  test('la atomicidad del cambio relevante: si el aviso falla, no queda la versión de trabajo (CA-SOL-05)', async () => {
    const p = await crearYPublicar(e, t1);
    await cotizar(p.solicitudId, e.datos.prestadores.carla);
    await e.db.query('ALTER TABLE avisos_negocio ADD CONSTRAINT bloqueo_de_prueba2 CHECK (false) NOT VALID');
    try { expect((await e.editar(t1, p.solicitudId, { version: p.version, descripcion: 'No debe quedar' })).status).toBe(503); }
    finally { await e.db.query('ALTER TABLE avisos_negocio DROP CONSTRAINT bloqueo_de_prueba2'); }
    expect(await fila(p.solicitudId)).toMatchObject({ version: p.version, version_trabajo: 1 });
    expect(await versiones(p.solicitudId)).toBe(1);
    expect((await e.obtener(t1, p.solicitudId).expect(200)).body.descripcion).not.toBe('No debe quedar');
  });
});

describe('datos personales en texto libre (CA-DAT-01 a 07)', () => {
  test('publicar con un teléfono, un correo o un enlace devuelve 422 DATOS_PERSONALES_EN_TEXTO y conserva el borrador (CA-DAT-01)', async () => {
    for (const texto of ['Llámame al 981 234 567', 'escríbeme a juan@correo.com', 'escríbeme por WhatsApp']) {
      const c = await e.crear(t1, cuerpoPublicable(e, { descripcion: texto })).expect(201);
      const r = await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(422);
      expect([r.body.codigo, r.body.detalles[0].campo]).toEqual(['DATOS_PERSONALES_EN_TEXTO', 'descripcion']);
      expect(JSON.stringify(r.body)).not.toMatch(/981|juan|correo\.com/);
      expect((await fila(c.body.solicitudId)).estado).toBe('BORRADOR');
    }
  });
  test('un borrador con esos datos se guarda con advertencia y falla al publicar (CA-DAT-02)', async () => {
    const c = await e.crear(t1, cuerpoPublicable(e, { descripcion: 'Llámame al 981 234 567' })).expect(201);
    expect(c.body.advertencias.map((a: { codigo: string }) => a.codigo)).toEqual(['POSIBLE_TELEFONO']);
    expect(c.body.advertencias[0].mensaje).not.toMatch(/protegid|verificad|segur/i);
    await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(422);
  });
  test('un posible documento o dirección solo genera advertencia, también al publicar (CA-DAT-03)', async () => {
    const c = await e.crear(t1, cuerpoPublicable(e, { descripcion: 'Mi DNI 12345678, Jr. Lima 123 cerca del mercado' })).expect(201);
    const p = await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200);
    expect(p.body.advertencias.map((a: { codigo: string }) => a.codigo).sort()).toEqual(['POSIBLE_DIRECCION', 'POSIBLE_DOCUMENTO']);
  });
  test('los textos exentos no se rechazan ni advierten (CA-DAT-04)', async () => {
    const c = await e.crear(t1, cuerpoPublicable(e, { descripcion: 'Pared de 2.50 x 3.00 m, presupuesto S/ 1 500 000', medidas: 'Necesito 120 m2 de piso en 3 pisos. Entrega el 26/11/2026' })).expect(201);
    expect(c.body.advertencias).toEqual([]);
    await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200);
  });
  test('editar una publicada con un teléfono devuelve 422 (CA-DAT-05)', async () => {
    const p = await crearYPublicar(e, t1);
    const r = await e.editar(t1, p.solicitudId, { version: p.version, medidas: '+51 981234567' }).expect(422);
    expect([r.body.codigo, r.body.detalles[0].campo]).toEqual(['DATOS_PERSONALES_EN_TEXTO', 'medidas']);
    expect((await fila(p.solicitudId)).version).toBe(p.version);
  });
  test('una dirigida con un teléfono en el texto se guarda y se publica con advertencias, sin bloquear ni prometer protección (CA-DAT-06)', async () => {
    const c = await e.crear(t1, dirigida(e.datos.prestadores.ana, { descripcion: 'Llámame al 981 234 567 para coordinar' })).expect(201);
    expect(c.body.advertencias.some((a: { codigo: string }) => a.codigo === 'POSIBLE_TELEFONO')).toBe(true);
    const p = await e.publicar(t1, c.body.solicitudId, { version: 1 }).expect(200);
    expect(p.body.estado).toBe('ABIERTA');
    for (const a of p.body.advertencias as { mensaje: string }[]) expect(a.mensaje).not.toMatch(/protegid|verificad|segur|cifrad/i);
  });
  test('ninguna respuesta contiene el correo ni los datos de la cuenta del cliente (CA-DAT-07)', async () => {
    const p = await crearYPublicar(e, t1);
    const cuenta = e.datos.clientes.clienteUno;
    const respuestas = [p, (await e.obtener(t1, p.solicitudId).expect(200)).body, (await e.listar(t1).expect(200)).body, (await e.historial(t1, p.solicitudId, '?tipo=versiones').expect(200)).body,
      (await e.historial(t1, p.solicitudId, '?tipo=bitacora').expect(200)).body.elementos.map((x: { actorCuentaId: string }) => ({ ...x, actorCuentaId: undefined }))];
    for (const cuerpo of respuestas) { const texto = JSON.stringify(cuerpo); expect(texto).not.toContain(cuenta.correo); expect(texto).not.toContain(cuenta.cuentaId); expect(texto).not.toMatch(/"(telefono|correo|nombreMostrar|contrasena)"\s*:/i); }
  });
});

describe('listados y paginación', () => {
  test('mis solicitudes: orden determinista, total de la misma lectura, filtro por estado y esquema del contrato', async () => {
    const dueno = e.datos.clientes.clienteDos; const tk = await e.token(dueno);
    const antes = (await e.listar(tk).expect(200)).body.total as number;
    for (let i = 0; i < 3; i += 1) await e.crear(tk, { tipo: 'PUBLICADA', descripcion: `Solicitud ${i}` }).expect(201);
    const p = await crearYPublicar(e, tk);
    const todas = await e.listar(tk, '?tamano=2&pagina=1').expect(200);
    await validarRespuesta003('C003PaginaSolicitudes', todas.body);
    expect(todas.body).toMatchObject({ total: antes + 4, pagina: 1, tamano: 2 });
    expect(todas.body.elementos).toHaveLength(2);
    const otra = await e.listar(tk, '?tamano=2&pagina=2').expect(200);
    expect(new Set([...todas.body.elementos, ...otra.body.elementos].map((x: { solicitudId: string }) => x.solicitudId)).size).toBe(4);
    const abiertas = await e.listar(tk, '?estado=ABIERTA').expect(200);
    expect(abiertas.body.elementos.map((x: { solicitudId: string }) => x.solicitudId)).toContain(p.solicitudId);
    expect(abiertas.body.elementos.every((x: { estado: string }) => x.estado === 'ABIERTA')).toBe(true);
    const vacia = await e.listar(tk, '?pagina=999').expect(200);
    expect(vacia.body).toMatchObject({ elementos: [], total: antes + 4 });
    expect((await e.listar(tk, '?tamano=51').expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
    expect((await e.listar(tk, '?pagina=0').expect(400)).body.codigo).toBe('DATOS_INVALIDOS');
  });
  test('mis solicitudes solo incluye las propias', async () => {
    const lista = (await e.listar(t2).expect(200)).body.elementos as { solicitudId: string }[];
    const ajenas = new Set(((await e.db.query('SELECT id FROM solicitudes WHERE cliente_cuenta_id=$1', [e.datos.clientes.clienteUno.cuentaId])) as { id: string }[]).map(x => x.id));
    expect(lista.some(x => ajenas.has(x.solicitudId))).toBe(false);
  });
  test('rol=prestador lista las dirigidas al prestador (salvo borradores) y aquellas donde tiene cotización no retirada, también cerradas', async () => {
    const ana = e.datos.prestadores.ana;
    const d = (await e.publicar(t1, (await e.crear(t1, dirigida(ana)).expect(201)).body.solicitudId, { version: 1 }).expect(200)).body;
    const borrador = (await e.crear(t1, dirigida(ana)).expect(201)).body;
    const publicada = await crearYPublicar(e, t1); await cotizar(publicada.solicitudId, ana);
    const cerrada = (await e.cerrarSolicitud(t1, d.solicitudId, { version: d.version }).expect(200)).body;
    const r = await e.listar(tAna, '?rol=prestador&tamano=50').expect(200);
    await validarRespuesta003('C003PaginaSolicitudes', r.body);
    const porId = new Map((r.body.elementos as { solicitudId: string; titulos: string[]; estado: string }[]).map(x => [x.solicitudId, x]));
    expect(porId.get(cerrada.solicitudId)).toMatchObject({ estado: 'CERRADA', titulos: ['DESTINATARIO'] });
    expect(porId.get(publicada.solicitudId)?.titulos).toEqual(['AUTOR_DE_COTIZACION']);
    expect(porId.has(borrador.solicitudId)).toBe(false);
    expect((await e.listar(t1, '?rol=prestador').expect(403)).body.codigo).toBe('SIN_PERMISO');
  });
});
