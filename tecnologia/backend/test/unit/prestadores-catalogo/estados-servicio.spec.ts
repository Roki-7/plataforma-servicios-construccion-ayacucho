import { describe, expect, jest, test } from '@jest/globals';
import type { Idempotencia002 } from '../../../src/compartido/aplicacion/idempotencia.js';
import type { ContextoTransaccion } from '../../../src/compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import type { RevisionDeOferta } from '../../../src/modulos/catalogo/api-publica.js';
import { ElegibilidadServicioPostgres } from '../../../src/modulos/catalogo/aplicacion/elegibilidad-servicio.js';
import type { RepositorioServicios } from '../../../src/modulos/catalogo/aplicacion/puertos/servicios.js';
import { ServiciosPropiosServicio } from '../../../src/modulos/catalogo/aplicacion/servicios-propios.js';
import { clasificacionActiva, type Clasificacion } from '../../../src/modulos/catalogo/dominio/clasificacion.js';
import { esElegible, estadosServicio, exigirClasificacionActiva, exigirEditable, exigirPublicable, exigirTransicion, transicionesPermitidas, validarDatosServicio,
  type EstadoServicio, type Servicio } from '../../../src/modulos/catalogo/dominio/servicio.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rechazo = (fn: () => unknown) => { try { fn(); } catch (e) { return e as ErrorAplicacion; } throw new Error('Debía rechazar.'); };
const rechazoAsync = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as ErrorAplicacion; } throw new Error('Debía rechazar.'); };
const datos = { titulo: 'Servicio ficticio', descripcion: 'Descripción ficticia' };

describe('máquina de estados del servicio', () => {
  test.each([['PUBLICADO', 'PAUSADO'], ['PUBLICADO', 'RETIRADO'], ['PAUSADO', 'PUBLICADO'], ['PAUSADO', 'RETIRADO']] as const)('permite %s → %s', (origen, destino) => {
    expect(() => exigirTransicion(origen, destino)).not.toThrow();
  });
  test('solo existen esas cuatro transiciones', () => {
    const todas = estadosServicio.flatMap(o => estadosServicio.filter(d => !(o === 'RETIRADO') && transicionesPermitidas[o].includes(d)).map(d => `${o}>${d}`));
    expect(todas.sort()).toEqual(['PAUSADO>PUBLICADO', 'PAUSADO>RETIRADO', 'PUBLICADO>PAUSADO', 'PUBLICADO>RETIRADO']);
  });
  test.each([['PUBLICADO', 'PUBLICADO'], ['PAUSADO', 'PAUSADO']] as const)('rechaza permanecer en %s', (origen, destino) => {
    const e = rechazo(() => exigirTransicion(origen, destino));
    expect([e.http, e.codigo]).toEqual([422, 'TRANSICION_NO_ADMITIDA']);
  });
  test.each(estadosServicio)('RETIRADO es terminal y no admite pasar a %s', (destino) => {
    const e = rechazo(() => exigirTransicion('RETIRADO', destino));
    expect([e.http, e.codigo]).toEqual([422, 'SERVICIO_RETIRADO']);
  });
  test('la edición solo aplica en PUBLICADO o PAUSADO', () => {
    expect(() => exigirEditable('PUBLICADO')).not.toThrow();
    expect(() => exigirEditable('PAUSADO')).not.toThrow();
    expect(rechazo(() => exigirEditable('RETIRADO')).codigo).toBe('SERVICIO_RETIRADO');
  });
});

describe('datos del servicio', () => {
  test('título hasta 120 y descripción hasta 2000, obligatorios y en texto plano', () => {
    expect(validarDatosServicio({ titulo: 't'.repeat(120), descripcion: 'd'.repeat(2000) })).toBeTruthy();
    expect(rechazo(() => validarDatosServicio({ titulo: 't'.repeat(121), descripcion: 'x' })).detalles[0]).toMatchObject({ campo: 'titulo' });
    expect(rechazo(() => validarDatosServicio({ titulo: 'x', descripcion: 'd'.repeat(2001) })).detalles[0]).toMatchObject({ campo: 'descripcion' });
    expect(rechazo(() => validarDatosServicio({ titulo: ' ', descripcion: 'x' })).detalles[0]).toMatchObject({ campo: 'titulo', motivo: 'Es obligatorio.' });
    expect(rechazo(() => validarDatosServicio({ titulo: '<script>x</script>', descripcion: 'x' })).codigo).toBe('DATOS_INVALIDOS');
    expect(validarDatosServicio({ descripcion: 'Solo descripción' }, true)).toEqual({ descripcion: 'Solo descripción' });
  });
});

describe('actividad de la clasificación y elegibilidad', () => {
  const raiz = (activa: boolean): Clasificacion => ({ id: uuid(1), nombre: 'Raíz', nivel: 1, categoriaPadreId: null, activa, version: 1 });
  const hija = (activa: boolean): Clasificacion => ({ id: uuid(2), nombre: 'Hija', nivel: 2, categoriaPadreId: uuid(1), activa, version: 1 });
  test.each([
    ['raíz activa', clasificacionActiva(raiz(true)), true],
    ['raíz inactiva', clasificacionActiva(raiz(false)), false],
    ['hija activa con raíz activa', clasificacionActiva(hija(true), raiz(true)), true],
    ['hija con estado propio activo y raíz inactiva', clasificacionActiva(hija(true), raiz(false)), false],
    ['hija inactiva con raíz activa', clasificacionActiva(hija(false), raiz(true)), false],
    ['hija sin su padre resuelto', clasificacionActiva(hija(true)), false],
  ] as const)('%s', (_n, resultado, esperado) => expect(resultado).toBe(esperado));
  test('solo PUBLICADO con clasificación efectivamente activa es elegible', () => {
    for (const estado of estadosServicio) for (const activa of [true, false]) expect(esElegible({ estado }, activa)).toBe(estado === 'PUBLICADO' && activa);
  });
  test('publicar o reactivar exige datos conformes y clasificación activa, con la causa', () => {
    expect(() => exigirPublicable(datos, true)).not.toThrow();
    const e = rechazo(() => exigirPublicable(datos, false));
    expect([e.http, e.codigo, e.detalles[0]?.campo]).toEqual([422, 'CATEGORIA_NO_ACTIVA', 'categoriaId']);
    expect(rechazo(() => exigirPublicable({ titulo: ' ', descripcion: 'x' }, true)).http).toBe(400);
    expect(() => exigirClasificacionActiva(true)).not.toThrow();
  });
});

describe('casos de uso: un rechazo conserva el estado y los datos', () => {
  const tx: ContextoTransaccion = { id: 'tx' };
  const servicio = (estado: EstadoServicio = 'PAUSADO', version = 4): Servicio => ({ id: uuid(20), prestadorId: uuid(30), categoriaId: uuid(40), ...datos, estado, version });
  function montar(opciones: { estado?: EstadoServicio; activa?: boolean; perfil?: boolean; propietario?: string; perfiles?: ('cliente' | 'prestador')[]; replay?: boolean } = {}) {
    const actual = servicio(opciones.estado);
    const repo = {
      crear: jest.fn(async () => undefined), actualizar: jest.fn(async (_tx: ContextoTransaccion, _id: string, _cambios: object) => 5), listarPropios: jest.fn(async () => ({ elementos: [actual], total: 1 })),
      porId: jest.fn(async () => (opciones.propietario === 'otro' ? { ...actual, prestadorId: uuid(99) } : actual)),
      clasificacionActiva: jest.fn(async () => opciones.activa ?? true),
    };
    const revision = { bloquear: jest.fn(async (_tx: ContextoTransaccion, _modo: string) => 1n), incrementar: jest.fn(async () => 2n), vigente: jest.fn(async () => 1n) };
    const idempotencia: Idempotencia002 = { ejecutar002: async (s, t) => { await s.autorizar(tx); return opciones.replay ? { http: 200, cuerpo: { repetido: true } } : t(tx); } };
    const identidad = { cuentaId: uuid(10), sesionId: uuid(11), perfiles: opciones.perfiles ?? ['prestador'] };
    const servicios = new ServiciosPropiosServicio({
      repositorio: repo as unknown as RepositorioServicios, idempotencia, usuarios: { exigir: async () => identidad },
      revision: revision as unknown as RevisionDeOferta,
      clasificaciones: { efectivamenteActivas: async (_tx, ids) => new Set(opciones.activa === false ? [] : ids) },
      prestadores: { perfilDeCuenta: async () => (opciones.perfil === false ? null : { prestadorId: uuid(30), version: 1 }) },
    });
    return { servicios, repo, revision, actor: { token: 'x'.repeat(43), identidad } };
  }
  const sinEscrituras = (m: ReturnType<typeof montar>) => { expect(m.repo.crear).not.toHaveBeenCalled(); expect(m.repo.actualizar).not.toHaveBeenCalled(); expect(m.revision.incrementar).not.toHaveBeenCalled(); };
  const clave = 'clave-idempotente-prueba';

  test('una cuenta sin perfil de prestador se rechaza antes de tocar nada (CA-SER-03)', async () => {
    const m = montar({ perfiles: ['cliente'] });
    for (const accion of [() => m.servicios.publicar(m.actor, clave, { ...datos, categoriaId: uuid(40) }), () => m.servicios.editar(m.actor, clave, uuid(20), { version: 4, titulo: 'x' }),
      () => m.servicios.cambiarEstado(m.actor, clave, uuid(20), { version: 4, destino: 'PUBLICADO' }), () => m.servicios.listarPropios(m.actor, 1, 20)]) {
      expect((await rechazoAsync(accion())).codigo).toBe('SIN_PERMISO');
    }
    expect(m.repo.porId).not.toHaveBeenCalled();
    sinEscrituras(m);
  });
  test('un servicio ajeno o inexistente se trata como no disponible (CA-SER-03)', async () => {
    for (const m of [montar({ propietario: 'otro' }), montar({ perfil: false })]) {
      expect((await rechazoAsync(m.servicios.editar(m.actor, clave, uuid(20), { version: 4, titulo: 'x' }))).http).toBe(404);
      expect((await rechazoAsync(m.servicios.cambiarEstado(m.actor, clave, uuid(20), { version: 4, destino: 'RETIRADO' }))).http).toBe(404);
      sinEscrituras(m);
    }
  });
  test('un servicio RETIRADO no se edita ni cambia de estado (CA-SER-07)', async () => {
    const m = montar({ estado: 'RETIRADO' });
    expect((await rechazoAsync(m.servicios.editar(m.actor, clave, uuid(20), { version: 4, titulo: 'x' }))).codigo).toBe('SERVICIO_RETIRADO');
    expect((await rechazoAsync(m.servicios.cambiarEstado(m.actor, clave, uuid(20), { version: 4, destino: 'PUBLICADO' }))).codigo).toBe('SERVICIO_RETIRADO');
    sinEscrituras(m);
  });
  test('publicar en una clasificación inactiva no crea el servicio (CA-SER-04)', async () => {
    const m = montar({ activa: false });
    const e = await rechazoAsync(m.servicios.publicar(m.actor, clave, { ...datos, categoriaId: uuid(40) }));
    expect([e.http, e.codigo]).toEqual([422, 'CATEGORIA_NO_ACTIVA']);
    sinEscrituras(m);
  });
  test('reactivar con la clasificación inactiva o con datos que incumplen una condición se rechaza y sigue PAUSADO (CA-SER-06)', async () => {
    const m = montar({ estado: 'PAUSADO', activa: false });
    expect((await rechazoAsync(m.servicios.cambiarEstado(m.actor, clave, uuid(20), { version: 4, destino: 'PUBLICADO' }))).codigo).toBe('CATEGORIA_NO_ACTIVA');
    sinEscrituras(m);
    const invalido = montar({ estado: 'PAUSADO' });
    invalido.repo.porId.mockResolvedValue({ ...servicio('PAUSADO'), titulo: 't'.repeat(121) });
    expect((await rechazoAsync(invalido.servicios.cambiarEstado(invalido.actor, clave, uuid(20), { version: 4, destino: 'PUBLICADO' }))).http).toBe(400);
    sinEscrituras(invalido);
  });
  test('una versión obsoleta se rechaza sin modificar el servicio, y las transiciones inválidas también', async () => {
    const m = montar({ estado: 'PUBLICADO' });
    expect((await rechazoAsync(m.servicios.editar(m.actor, clave, uuid(20), { version: 3, titulo: 'x' }))).codigo).toBe('VERSION_DESACTUALIZADA');
    expect((await rechazoAsync(m.servicios.cambiarEstado(m.actor, clave, uuid(20), { version: 3, destino: 'PAUSADO' }))).codigo).toBe('VERSION_DESACTUALIZADA');
    expect((await rechazoAsync(m.servicios.cambiarEstado(m.actor, clave, uuid(20), { version: 4, destino: 'PUBLICADO' }))).codigo).toBe('TRANSICION_NO_ADMITIDA');
    sinEscrituras(m);
  });
  test('una transición válida actualiza el estado y avanza la revisión pública', async () => {
    const m = montar({ estado: 'PUBLICADO' });
    const r = await m.servicios.cambiarEstado(m.actor, clave, uuid(20), { version: 4, destino: 'PAUSADO' });
    expect(r).toMatchObject({ http: 200, cuerpo: { estado: 'PAUSADO', version: 5, servicioId: uuid(20) } });
    expect(m.repo.actualizar).toHaveBeenCalledWith(tx, uuid(20), { estado: 'PAUSADO' });
    expect(m.revision.bloquear).toHaveBeenCalledWith(tx, 'exclusivo');
    expect(m.revision.incrementar).toHaveBeenCalledTimes(1);
  });
  test('editar un servicio PAUSADO conserva el estado y reactivarlo con condiciones vigentes lo publica (CA-SER-05)', async () => {
    const m = montar({ estado: 'PAUSADO' });
    const editado = await m.servicios.editar(m.actor, clave, uuid(20), { version: 4, titulo: 'Título nuevo' });
    expect(editado.cuerpo).toMatchObject({ estado: 'PAUSADO', titulo: 'Título nuevo' });
    expect(m.repo.actualizar).toHaveBeenCalledWith(tx, uuid(20), { titulo: 'Título nuevo' });
    const reactivado = await m.servicios.cambiarEstado(m.actor, clave, uuid(20), { version: 4, destino: 'PUBLICADO' });
    expect(reactivado.cuerpo).toMatchObject({ estado: 'PUBLICADO' });
  });
  test('un replay idempotente no vuelve a escribir', async () => {
    const m = montar({ replay: true });
    expect(await m.servicios.cambiarEstado(m.actor, clave, uuid(20), { version: 4, destino: 'PAUSADO' })).toMatchObject({ cuerpo: { repetido: true } });
    sinEscrituras(m);
  });
  test('la elegibilidad se evalúa en el estado vigente y toma el bloqueo compartido solo con transacción', async () => {
    const m = montar({ estado: 'PUBLICADO' });
    const bloquear = jest.fn(async (_tx: ContextoTransaccion, _modo: string) => 1n);
    const elegibilidad = new ElegibilidadServicioPostgres(m.repo as unknown as RepositorioServicios, { bloquear } as unknown as RevisionDeOferta);
    expect(await elegibilidad.evaluar(uuid(20))).toEqual({ servicioId: uuid(20), elegible: true });
    expect(bloquear).not.toHaveBeenCalled();
    await elegibilidad.evaluar(uuid(20), tx);
    expect(bloquear).toHaveBeenCalledWith(tx, 'compartido');
    m.repo.clasificacionActiva.mockResolvedValue(false);
    expect(await elegibilidad.evaluar(uuid(20))).toMatchObject({ elegible: false, motivo: 'CLASIFICACION_INACTIVA' });
    m.repo.porId.mockResolvedValue(null as never);
    expect(await elegibilidad.evaluar(uuid(20))).toMatchObject({ elegible: false, motivo: 'NO_EXISTE' });
  });
});
