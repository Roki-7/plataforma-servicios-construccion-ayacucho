import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile, readdir, copyFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AlmacenPortafolio } from '../../../src/modulos/prestadores/aplicacion/puertos/puertos.js';
import { cifrar, clavesDeRespaldo, descifrar, ErrorRespaldo, firmarManifiesto, respaldarPortafolio, restaurarPortafolio, sha256, validarDestino, verificarFirma, verificarConjunto,
  type DestinoPostgres, type Manifiesto, type ObjetoInventario, type OrigenPostgres } from '../../../src/modulos/prestadores/infraestructura/respaldo/respaldo-portafolio.js';

const clave64 = () => randomBytes(32).toString('base64');
const claves = clavesDeRespaldo(clave64());
const uuid = () => randomUUID();
const migraciones = ['A1', 'B2'];
const prefijoOrigen = `pruebas/${uuid()}/portafolio/`;

class AlmacenMemoria implements AlmacenPortafolio {
  objetos = new Map<string, Uint8Array>();
  constructor(readonly prefijo: string) {}
  claveNueva(p: string) { return `${this.prefijo}${p}/${uuid()}`; }
  async guardar(c: string, b: Uint8Array) { this.objetos.set(c, b); }
  async leer(c: string) { const b = this.objetos.get(c); if (!b) throw new Error('ausente'); return b; }
  async eliminar(c: string) { this.objetos.delete(c); }
  async *listar() { for (const c of this.objetos.keys()) yield { clave: c, modificado: new Date() }; }
  pertenece(c: string) { return c.startsWith(this.prefijo); }
}
const foto = (almacen: AlmacenMemoria, n: number): ObjetoInventario => {
  const bytes = randomBytes(40 + n); const clave = `${prefijoOrigen}${uuid()}/${uuid()}`; almacen.objetos.set(clave, bytes);
  return { clave, bytes: bytes.length, mime: 'image/webp', sha256: sha256(bytes) };
};
class OrigenFalso implements OrigenPostgres {
  cerrada = false; abierta = 0;
  constructor(readonly fotos: ObjetoInventario[], readonly opciones: { drenaje?: boolean; mayor?: number; migraciones?: string[]; volcado?: string } = {}) {}
  async abrirInstantanea() {
    if (this.opciones.drenaje) throw new ErrorRespaldo('DRENAJE_NO_CONFIRMADO', 'sin drenaje');
    this.abierta++;
    return { snapshotId: '00000003-00000002-1', corteUtc: '2026-11-19T12:00:00.000Z', postgresMayor: this.opciones.mayor ?? 18, migraciones: this.opciones.migraciones ?? migraciones,
      fotografias: this.fotos, preparaciones: 1, purgas: 2, cerrar: async () => { this.cerrada = true; } };
  }
  async volcar() { return Buffer.from(this.opciones.volcado ?? '-- volcado ficticio\nSELECT 1;\n'); }
}
class DestinoFalso implements DestinoPostgres {
  postgresMayor = 18; eventos: string[] = []; abierta = false; espacio: string | undefined; puerta: { estado: 'CERRADO' | 'ABIERTO'; backupId: string } | null = null; borraPuertaAlRestaurar = false; refs: { clave: string; bytes: number; mime: string; sha256: string }[] = [];
  constructor(private readonly fotos: ObjetoInventario[], private readonly prefijoOrigenLocal: string, private readonly fallaEn?: string) {}
  private evento(e: string) { this.eventos.push(e); if (this.fallaEn === e) throw new Error(`fallo inyectado en ${e}`); }
  async crearBaseNueva() { this.evento('crear'); }
  async restaurar() { this.evento('restaurar'); this.refs = this.fotos.map(f => ({ ...f })); if (this.borraPuertaAlRestaurar) this.puerta = null; }
  async cerrarPuerta(id: string) { this.evento('cerrar-puerta'); this.puerta = { estado: 'CERRADO', backupId: id }; }
  async estadoPuerta() { return this.puerta; }
  async remapearClaves(o: string, d: string) { this.evento('remapear'); this.refs = this.refs.map(r => ({ ...r, clave: d + r.clave.slice(o.length) })); }
  async reconciliar() { this.evento('reconciliar'); return { preparacionesDescartadas: 1, purgasConservadas: 2 }; }
  async referencias() { return this.refs; }
  async abrirPuerta(e: string) { this.evento('abrir-puerta'); this.abierta = true; this.espacio = e; if (this.puerta) this.puerta = { ...this.puerta, estado: 'ABIERTO' }; }
}

let dir: string;
beforeAll(async () => { dir = await mkdtemp(join(tmpdir(), 'respaldo-unit-')); });
afterAll(async () => { await rm(dir, { recursive: true, force: true }); });
const respaldo = async (origen: OrigenFalso, almacen: AlmacenMemoria, k = claves) => respaldarPortafolio({ origen, almacen, claves: k, directorio: dir,
  origenLogico: { baseLogica: 'ayacucho_002_test_x', bucket: 'b', prefijo: prefijoOrigen, espacioRedis: 'ayacucho:002:origen' }, aplicacion: 'prueba' });
const rechazo = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as ErrorRespaldo; } throw new Error('Debía rechazar.'); };
const opcionesRestauracion = (backupId: string, destino: DestinoFalso, almacen: AlmacenMemoria, extra: object = {}) => ({ directorio: dir, backupId, claves, destinoPostgres: destino, almacenDestino: almacen,
  prefijoDestino: `pruebas/${uuid()}/portafolio/`, postgresMayorOrigen: 18, migracionesEsperadas: migraciones, ...extra });

describe('claves, cifrado y firma', () => {
  test('exige una clave aleatoria de 32 bytes en base64', () => {
    for (const mala of [undefined, '', 'abc', Buffer.alloc(16).toString('base64'), Buffer.alloc(33).toString('base64')]) expect(() => clavesDeRespaldo(mala)).toThrow(ErrorRespaldo);
    expect(clavesDeRespaldo(clave64()).cifrado).toHaveLength(32);
  });
  test('descifra solo con la misma clave, el mismo respaldo y el mismo nombre de artefacto', () => {
    const id = uuid(); const c = cifrar(claves, id, 'volcado.sql.enc', Buffer.from('secreto'));
    expect(c.toString()).not.toContain('secreto');
    expect(descifrar(claves, id, 'volcado.sql.enc', c).toString()).toBe('secreto');
    for (const intento of [() => descifrar(claves, uuid(), 'volcado.sql.enc', c), () => descifrar(claves, id, 'otro.enc', c), () => descifrar(clavesDeRespaldo(clave64()), id, 'volcado.sql.enc', c),
      () => descifrar(claves, id, 'volcado.sql.enc', Buffer.concat([c.subarray(0, 20), Buffer.from([c[20]! ^ 1]), c.subarray(21)])), () => descifrar(claves, id, 'volcado.sql.enc', c.subarray(0, 10))]) {
      expect(intento).toThrow(expect.objectContaining({ codigo: 'ARTEFACTO_ALTERADO' }));
    }
  });
  test('la firma del manifiesto detecta cualquier alteración', () => {
    const base: Manifiesto = { version: 1, backupId: uuid(), estado: 'COMPLETO', corteUtc: 'x', origen: { baseLogica: 'a', bucket: 'b', prefijo: 'p', espacioRedis: 'e' },
      versiones: { postgresMayor: 18, aplicacion: 'a', migraciones: ['A'] }, volcado: { archivo: 'v', sha256: 'h', bytes: 1 }, objetos: [], conteos: { fotografiasVigentes: 0, preparacionesInconclusas: 0, purgasPendientes: 0, objetosCopiados: 0 } };
    const firmado = firmarManifiesto(claves, base);
    expect(verificarFirma(claves, firmado)).toBe(true);
    expect(verificarFirma(claves, { ...firmado, estado: 'INCOMPLETO' })).toBe(false);
    expect(verificarFirma(claves, { ...firmado, versiones: { ...firmado.versiones, migraciones: ['B'] } })).toBe(false);
    expect(verificarFirma(clavesDeRespaldo(clave64()), firmado)).toBe(false);
    expect(verificarFirma(claves, base)).toBe(false);
  });
});

describe('validación del destino contra ejecuciones accidentales', () => {
  const ok = { urlBase: 'postgresql://u:p@127.0.0.1:54330/ayacucho_002_restauracion_abcd', urlOrigen: 'postgresql://u:p@127.0.0.1:54330/ayacucho_002_validacion', bucket: 'portafolio-002-validacion',
    prefijo: `pruebas/${uuid()}/portafolio/`, bucketOrigen: 'portafolio-002-validacion', prefijoOrigen: 'portafolio/', confirmo: 'ayacucho_002_restauracion_abcd' };
  test('acepta una base nueva con confirmación exacta y un prefijo de prueba nuevo', () => { expect(() => validarDestino(ok)).not.toThrow(); });
  test('rechaza el origen, la base de validación, bases de 001 o de producción, servidores no locales y nombres no previstos', () => {
    for (const base of ['ayacucho_002_validacion', 'ayacucho_001_validacion', 'produccion', 'ayacucho_002_restauracion_', 'postgres', 'ayacucho_002_test_validacion_x']) {
      const e = (() => { try { validarDestino({ ...ok, urlBase: ok.urlBase.replace('ayacucho_002_restauracion_abcd', base), confirmo: base }); } catch (x) { return x as ErrorRespaldo; } })();
      expect(e?.codigo).toBe('DESTINO_NO_PERMITIDO');
    }
    expect(() => validarDestino({ ...ok, urlBase: 'postgresql://u:p@db.example.com:5432/ayacucho_002_restauracion_abcd' })).toThrow(expect.objectContaining({ codigo: 'DESTINO_NO_PERMITIDO' }));
    expect(() => validarDestino({ ...ok, urlBase: 'no es una url' })).toThrow(ErrorRespaldo);
  });
  test('las bases ayacucho_002_test_* solo se admiten si el llamador de pruebas lo pide de forma explícita', () => {
    const prueba = { ...ok, urlBase: ok.urlBase.replace('restauracion_abcd', 'test_abcd'), confirmo: 'ayacucho_002_test_abcd' };
    expect(() => validarDestino(prueba)).toThrow(expect.objectContaining({ codigo: 'DESTINO_NO_PERMITIDO' }));
    expect(() => validarDestino({ ...prueba, permitirBasesDePrueba: true })).not.toThrow();
    expect(() => validarDestino({ ...ok, urlBase: ok.urlBase.replace('restauracion_abcd', 'validacion'), confirmo: 'ayacucho_002_validacion', permitirBasesDePrueba: true })).toThrow(ErrorRespaldo);
  });
  test('exige confirmar el nombre exacto y no admite el prefijo ni el bucket de origen', () => {
    expect(() => validarDestino({ ...ok, confirmo: '' })).toThrow(expect.objectContaining({ codigo: 'CONFIRMACION_REQUERIDA' }));
    expect(() => validarDestino({ ...ok, confirmo: 'ayacucho_002_restauracion_otro' })).toThrow(expect.objectContaining({ codigo: 'CONFIRMACION_REQUERIDA' }));
    expect(() => validarDestino({ ...ok, prefijo: 'portafolio/' })).toThrow(expect.objectContaining({ codigo: 'DESTINO_NO_PERMITIDO' }));
    expect(() => validarDestino({ ...ok, prefijo: 'cualquiera/' })).toThrow(ErrorRespaldo);
    expect(() => validarDestino({ ...ok, bucket: 'portafolio-nuevo', prefijo: 'portafolio/' })).not.toThrow();
  });
});

describe('respaldo coordinado', () => {
  test('un respaldo COMPLETO cubre todas las referencias, cifra los artefactos, reanuda siempre y no guarda texto claro', async () => {
    const almacen = new AlmacenMemoria(prefijoOrigen); const fotos = [foto(almacen, 1), foto(almacen, 2), foto(almacen, 3)];
    const origen = new OrigenFalso(fotos);
    const m = await respaldo(origen, almacen);
    expect(m).toMatchObject({ estado: 'COMPLETO', conteos: { fotografiasVigentes: 3, objetosCopiados: 3, preparacionesInconclusas: 1, purgasPendientes: 2 }, versiones: { postgresMayor: 18, migraciones } });
    expect(origen.cerrada).toBe(true);
    expect(verificarFirma(claves, m)).toBe(true);
    const archivos = await readdir(join(dir, m.backupId, 'objetos'));
    expect(archivos).toHaveLength(3);
    for (const a of archivos) expect((await readFile(join(dir, m.backupId, 'objetos', a))).length).toBeGreaterThan(40);
    const volcado = await readFile(join(dir, m.backupId, 'volcado.sql.enc'));
    expect(volcado.toString('utf8')).not.toContain('volcado ficticio');
    const { volcado: claro, objetos } = await verificarConjunto({ directorio: dir, backupId: m.backupId, claves, postgresMayorOrigen: 18, migracionesEsperadas: migraciones });
    expect(claro.toString()).toContain('volcado ficticio'); expect(objetos.size).toBe(3);
  });

  test('sin drenaje confirmado el respaldo se aborta INCOMPLETO y no hay artefactos restaurables', async () => {
    const almacen = new AlmacenMemoria(prefijoOrigen);
    const e = await rechazo(respaldo(new OrigenFalso([foto(almacen, 1)], { drenaje: true }), almacen));
    expect(e.codigo).toBe('DRENAJE_NO_CONFIRMADO');
    const manifiesto = (e as unknown as { manifiesto: Manifiesto }).manifiesto;
    expect(manifiesto).toMatchObject({ estado: 'INCOMPLETO', causa: 'DRENAJE_NO_CONFIRMADO' });
    const r = await rechazo(verificarConjunto({ directorio: dir, backupId: manifiesto.backupId, claves, postgresMayorOrigen: 18, migracionesEsperadas: migraciones }));
    expect(r.codigo).toBe('RESPALDO_INCOMPLETO');
  });

  test('un objeto ausente o alterado en el origen deja el conjunto INCOMPLETO y reanuda las escrituras', async () => {
    for (const [caso, esperado] of [['ausente', 'OBJETO_AUSENTE'], ['alterado', 'OBJETO_ALTERADO']] as const) {
      const almacen = new AlmacenMemoria(prefijoOrigen); const fotos = [foto(almacen, 1), foto(almacen, 2)];
      if (caso === 'ausente') almacen.objetos.delete(fotos[1]!.clave); else almacen.objetos.set(fotos[1]!.clave, Buffer.from('contenido distinto del esperado, sin el checksum'));
      const origen = new OrigenFalso(fotos);
      const e = await rechazo(respaldo(origen, almacen));
      expect(e.codigo).toBe(esperado);
      expect((e as unknown as { manifiesto: Manifiesto }).manifiesto.estado).toBe('INCOMPLETO');
      expect(origen.cerrada).toBe(true);
    }
  });

  test('la instantánea siempre se libera aunque falle una etapa intermedia', async () => {
    const almacen = new AlmacenMemoria(prefijoOrigen); const origen = new OrigenFalso([foto(almacen, 1)]);
    const e = await rechazo(respaldarPortafolio({ origen, almacen, claves, directorio: dir, origenLogico: { baseLogica: 'a', bucket: 'b', prefijo: prefijoOrigen, espacioRedis: 'e' }, aplicacion: 'p',
      intervencion: async etapa => { if (etapa === 'tras-volcado') throw new Error('interrupción'); } }));
    expect(e.codigo).toBe('FALLO_NO_CLASIFICADO'); expect(origen.cerrada).toBe(true);
  });
});

describe('restauración coordinada', () => {
  const preparar = async () => {
    const almacen = new AlmacenMemoria(prefijoOrigen); const fotos = [foto(almacen, 1), foto(almacen, 2)];
    const m = await respaldo(new OrigenFalso(fotos), almacen);
    return { fotos, m, destino: new DestinoFalso(fotos, prefijoOrigen), almacenDestino: new AlmacenMemoria('x/') };
  };
  test('restaura en destinos nuevos, remapea claves, reconcilia y abre la puerta con un espacio Redis nuevo', async () => {
    const { m, destino, almacenDestino } = await preparar();
    const prefijoDestino = `pruebas/${uuid()}/portafolio/`;
    const r = await restaurarPortafolio(opcionesRestauracion(m.backupId, destino, almacenDestino, { prefijoDestino }));
    expect(r).toMatchObject({ backupId: m.backupId, objetosRestaurados: 2, preparacionesDescartadas: 1, purgasConservadas: 2 });
    expect(r.espacioRedis).toMatch(/^ayacucho:002:restaurada-[0-9a-f]{8}-[0-9a-f]{8}$/);
    expect(r.espacioRedis).not.toBe(m.origen.espacioRedis);
    expect(destino.eventos).toEqual(['crear', 'cerrar-puerta', 'restaurar', 'remapear', 'reconciliar', 'abrir-puerta']);
    expect(destino.abierta).toBe(true); expect(destino.espacio).toBe(r.espacioRedis);
    expect([...almacenDestino.objetos.keys()].every(k => k.startsWith(prefijoDestino))).toBe(true);
    for (const f of m.objetos) expect(sha256(almacenDestino.objetos.get(prefijoDestino + f.clave.slice(prefijoOrigen.length))!)).toBe(f.sha256);
  });

  test('dos restauraciones del mismo respaldo reciben espacios Redis distintos', async () => {
    const { m } = await preparar(); const espacios = new Set<string>();
    for (let i = 0; i < 3; i++) espacios.add((await restaurarPortafolio(opcionesRestauracion(m.backupId, new DestinoFalso(m.objetos as ObjetoInventario[], prefijoOrigen), new AlmacenMemoria('x/')))).espacioRedis);
    expect(espacios.size).toBe(3);
  });

  test('un manifiesto o artefacto de otro conjunto, alterado o de otra versión se rechaza antes de tocar ningún destino', async () => {
    const { m, destino, almacenDestino } = await preparar(); const otro = await preparar();
    const casos: [string, () => Promise<unknown>, string][] = [
      ['manifiesto de otro conjunto', async () => { await mkdir(join(dir, 'mezcla'), { recursive: true }); await copyFile(join(dir, otro.m.backupId, 'manifiesto.json'), join(dir, m.backupId, 'manifiesto.json')); return restaurarPortafolio(opcionesRestauracion(m.backupId, destino, almacenDestino)); }, 'PAREJA_INCOMPATIBLE'],
    ];
    for (const [, accion, codigo] of casos) expect((await rechazo(accion())).codigo).toBe(codigo);
    expect(destino.eventos).toEqual([]);
    // Un volcado de otro conjunto: el descifrado autenticado falla porque el identificador del respaldo va en los datos autenticados.
    const b = await preparar(); const c = await preparar();
    await copyFile(join(dir, c.m.backupId, 'volcado.sql.enc'), join(dir, b.m.backupId, 'volcado.sql.enc'));
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(b.m.backupId, b.destino, b.almacenDestino)))).codigo).toBe('ARTEFACTO_ALTERADO');
    expect(b.destino.eventos).toEqual([]);
  });

  test('manifiesto alterado, INCOMPLETO, otra versión de PostgreSQL u otras migraciones no se restauran', async () => {
    const { m, destino, almacenDestino } = await preparar();
    const ruta = join(dir, m.backupId, 'manifiesto.json'); const original = await readFile(ruta, 'utf8');
    await writeFile(ruta, original.replace('"COMPLETO"', '"INCOMPLETO"'));
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, almacenDestino)))).codigo).toBe('MANIFIESTO_ALTERADO');
    await writeFile(ruta, original);
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, almacenDestino, { postgresMayorOrigen: 17 })))).codigo).toBe('VERSION_INCOMPATIBLE');
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, almacenDestino, { migracionesEsperadas: ['A1'] })))).codigo).toBe('VERSION_INCOMPATIBLE');
    const otraClave = clavesDeRespaldo(clave64());
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, almacenDestino, { claves: otraClave })))).codigo).toBe('MANIFIESTO_ALTERADO');
    expect(destino.eventos).toEqual([]);
  });

  test('un objeto ausente o alterado en el respaldo se rechaza sin crear el destino', async () => {
    for (const caso of ['ausente', 'alterado']) {
      const { m, destino, almacenDestino } = await preparar();
      const objetos = join(dir, m.backupId, 'objetos'); const archivo = (await readdir(objetos))[0]!;
      if (caso === 'ausente') await rm(join(objetos, archivo)); else { const b = await readFile(join(objetos, archivo)); b[b.length - 20] = b[b.length - 20]! ^ 1; await writeFile(join(objetos, archivo), b); }
      expect((await rechazo(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, almacenDestino)))).codigo).toBe(caso === 'ausente' ? 'OBJETO_AUSENTE' : 'ARTEFACTO_ALTERADO');
      expect(destino.eventos).toEqual([]); expect(destino.abierta).toBe(false);
    }
  });

  test('un destino con objetos no se reutiliza', async () => {
    const { m, destino, almacenDestino } = await preparar(); almacenDestino.objetos.set('x/ya-existe', Buffer.from('1'));
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, almacenDestino)))).codigo).toBe('DESTINO_NO_VACIO');
    expect(destino.eventos).toEqual([]);
  });

  test('una interrupción en cualquier etapa deja la puerta cerrada y un reintento en un destino limpio recupera el conjunto', async () => {
    const { m, fotos } = await preparar();
    for (const [falla, etapa] of [['restaurar', 'restaurar'], ['remapear', 'remapear'], ['reconciliar', 'reconciliar'], ['abrir-puerta', 'abrir-puerta']] as const) {
      const destino = new DestinoFalso(fotos, prefijoOrigen, falla);
      await expect(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, new AlmacenMemoria('x/')))).rejects.toThrow(`fallo inyectado en ${etapa}`);
      expect(destino.abierta).toBe(false);
    }
    for (const [etapa, n] of [['tras-restaurar', 0], ['tras-objetos', 1], ['tras-reconciliar', 2]] as const) {
      const destino = new DestinoFalso(fotos, prefijoOrigen);
      await expect(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, new AlmacenMemoria('x/'), { intervencion: async (e: string, c: number) => { if (e === etapa && c === n) throw new Error('interrupción'); } }))).rejects.toThrow('interrupción');
      expect(destino.abierta).toBe(false);
    }
    const limpio = new DestinoFalso(fotos, prefijoOrigen);
    await expect(restaurarPortafolio(opcionesRestauracion(m.backupId, limpio, new AlmacenMemoria('x/')))).resolves.toMatchObject({ objetosRestaurados: 2 });
    expect(limpio.abierta).toBe(true);
  });

  test('si las referencias restauradas no coinciden con el inventario o su objeto está alterado, la puerta no se abre', async () => {
    const { m, fotos } = await preparar();
    const distinta = new DestinoFalso(fotos.slice(0, 1), prefijoOrigen);
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(m.backupId, distinta, new AlmacenMemoria('x/'))))).codigo).toBe('REFERENCIAS_INCONSISTENTES');
    expect(distinta.abierta).toBe(false);
    const adulterada = new DestinoFalso(fotos.map((f, i) => i === 0 ? { ...f, sha256: sha256(Buffer.from('otro')) } : f), prefijoOrigen);
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(m.backupId, adulterada, new AlmacenMemoria('x/'))))).codigo).toBe('REFERENCIAS_INCONSISTENTES');
    expect(adulterada.abierta).toBe(false);
  });

  test('la puerta se crea CERRADA antes de restaurar ningún dato y se comprueba tras el volcado', async () => {
    const { m, fotos } = await preparar();
    const estados: (string | undefined)[] = [];
    const destino = new DestinoFalso(fotos, prefijoOrigen);
    const original = destino.restaurar.bind(destino);
    destino.restaurar = async () => { estados.push(destino.puerta?.estado); await original(); };
    await restaurarPortafolio(opcionesRestauracion(m.backupId, destino, new AlmacenMemoria('x/')));
    expect(estados).toEqual(['CERRADO']);
    expect(destino.puerta).toMatchObject({ estado: 'ABIERTO', backupId: m.backupId });
  });

  test('un fallo al crear la base, tras crearla, tras cerrar la puerta o durante el volcado deja la puerta sin abrir', async () => {
    const { m, fotos } = await preparar();
    for (const falla of ['crear', 'cerrar-puerta', 'restaurar']) {
      const destino = new DestinoFalso(fotos, prefijoOrigen, falla);
      await expect(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, new AlmacenMemoria('x/')))).rejects.toThrow(`fallo inyectado en ${falla}`);
      expect(destino.abierta).toBe(false); expect(destino.puerta?.estado).not.toBe('ABIERTO');
    }
    for (const etapa of ['tras-crear', 'tras-puerta'] as const) {
      const destino = new DestinoFalso(fotos, prefijoOrigen);
      await expect(restaurarPortafolio(opcionesRestauracion(m.backupId, destino, new AlmacenMemoria('x/'), { intervencion: async (e: string) => { if (e === etapa) throw new Error('interrupción'); } }))).rejects.toThrow('interrupción');
      expect(destino.abierta).toBe(false);
      expect(destino.puerta?.estado ?? 'sin puerta').toBe(etapa === 'tras-crear' ? 'sin puerta' : 'CERRADO');
    }
  });

  test('un volcado que menciona la puerta se rechaza y uno que la elimina se detecta', async () => {
    const almacen = new AlmacenMemoria(prefijoOrigen); const fotos = [foto(almacen, 1)];
    const conPuerta = await respaldo(new OrigenFalso(fotos, { volcado: 'DROP TABLE restauracion_002;\n' }), almacen);
    const d1 = new DestinoFalso(fotos, prefijoOrigen);
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(conPuerta.backupId, d1, new AlmacenMemoria('x/'))))).codigo).toBe('VOLCADO_CONTIENE_PUERTA');
    expect(d1.eventos).toEqual([]);
    const limpio = await respaldo(new OrigenFalso(fotos), almacen);
    const d2 = new DestinoFalso(fotos, prefijoOrigen); d2.borraPuertaAlRestaurar = true;
    expect((await rechazo(restaurarPortafolio(opcionesRestauracion(limpio.backupId, d2, new AlmacenMemoria('x/'))))).codigo).toBe('PUERTA_ALTERADA');
    expect(d2.abierta).toBe(false);
  });
});
