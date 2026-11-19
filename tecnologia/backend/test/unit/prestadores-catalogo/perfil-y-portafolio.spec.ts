import { describe, expect, jest, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { Idempotencia002 } from '../../../src/compartido/aplicacion/idempotencia.js';
import type { ContextoTransaccion } from '../../../src/compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import { FotografiasPortafolioServicio } from '../../../src/modulos/prestadores/aplicacion/fotografias-portafolio.js';
import type { AlmacenPortafolio, RepositorioPrestadores } from '../../../src/modulos/prestadores/aplicacion/puertos/puertos.js';
import { limitesPerfil, validarEntradaPerfil, type EntradaPerfil } from '../../../src/modulos/prestadores/dominio/perfil-profesional.js';
import { exigirCupoFotografia, exigirCupoTrabajo, exigirImagenAdmitida, limitesPortafolio, validarDatosTrabajo } from '../../../src/modulos/prestadores/dominio/portafolio.js';
import { SaneadorSharp, decodificarBase64Canonico } from '../../../src/modulos/prestadores/infraestructura/archivos/sanear-imagen.js';
import { base64, crearImagen, marcadorSensible, mimeDe, pngDeTamano } from '../../soporte/prestadores-catalogo/imagenes.js';

const cobertura = new Set(['ayacucho', 'carmen-alto', 'san-juan-bautista', 'jesus-nazareno', 'andres-avelino-caceres-dorregaray']);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const perfil = (extra: Partial<EntradaPerfil> = {}): EntradaPerfil => ({ nombrePublico: 'Maestro ficticio', tipo: 'TECNICO', experiencia: 'Experiencia ficticia',
  especialidadesIds: [uuid(1)], distritos: ['ayacucho'], disponibilidadDeclarada: true, ...extra });
const rechazo = (fn: () => unknown) => { try { fn(); } catch (e) { return e as ErrorAplicacion; } throw new Error('Debía rechazar.'); };
const rechazoAsync = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as ErrorAplicacion; } throw new Error('Debía rechazar.'); };

describe('perfil: tipos, límites exactos, especialidades y zonas', () => {
  test.each(['TRABAJADOR_DE_OFICIO', 'TECNICO', 'PROFESIONAL', 'EMPRESA'])('admite el tipo %s', (tipo) => {
    expect(validarEntradaPerfil(perfil({ tipo }), cobertura).tipo).toBe(tipo);
  });
  test('rechaza un tipo desconocido con el campo y el motivo', () => {
    expect(rechazo(() => validarEntradaPerfil(perfil({ tipo: 'GERENTE' }), cobertura)).detalles).toEqual([{ campo: 'tipo', motivo: 'Tipo de prestador no admitido.' }]);
  });
  test('límites exactos de nombre público y experiencia', () => {
    expect(validarEntradaPerfil(perfil({ nombrePublico: 'n'.repeat(limitesPerfil.nombrePublico), experiencia: 'e'.repeat(limitesPerfil.experiencia) }), cobertura)).toBeTruthy();
    expect(rechazo(() => validarEntradaPerfil(perfil({ nombrePublico: 'n'.repeat(121) }), cobertura)).detalles[0]).toMatchObject({ campo: 'nombrePublico' });
    expect(rechazo(() => validarEntradaPerfil(perfil({ experiencia: 'e'.repeat(3001) }), cobertura)).detalles[0]).toMatchObject({ campo: 'experiencia' });
    expect(rechazo(() => validarEntradaPerfil(perfil({ nombrePublico: '   ' }), cobertura)).detalles[0]).toMatchObject({ campo: 'nombrePublico', motivo: 'Es obligatorio.' });
  });
  test('los textos son planos: sin marcado ni caracteres de control', () => {
    for (const texto of ['<script>alert(1)</script>', 'a <img src=x onerror=1>', 'x\u0000y', '\uD800']) {
      expect(rechazo(() => validarEntradaPerfil(perfil({ nombrePublico: texto }), cobertura)).codigo).toBe('DATOS_INVALIDOS');
    }
    expect(validarEntradaPerfil(perfil({ experiencia: 'Línea 1\nLínea 2 con 3 < 5' }), cobertura).experiencia).toContain('3 < 5');
  });
  test('al menos una especialidad y todas distintas', () => {
    expect(rechazo(() => validarEntradaPerfil(perfil({ especialidadesIds: [] }), cobertura)).detalles[0]).toMatchObject({ campo: 'especialidadesIds' });
    expect(rechazo(() => validarEntradaPerfil(perfil({ especialidadesIds: [uuid(1), uuid(1)] }), cobertura)).detalles[0]).toMatchObject({ motivo: 'Las especialidades deben ser distintas.' });
    expect(rechazo(() => validarEntradaPerfil(perfil({ especialidadesIds: ['no-uuid'] }), cobertura)).detalles[0]).toMatchObject({ campo: 'especialidadesIds[0]' });
  });
  test('entre uno y cinco distritos distintos de la cobertura, e indica cuál zona es inválida', () => {
    expect(validarEntradaPerfil(perfil({ distritos: [...cobertura] }), cobertura).distritos).toHaveLength(5);
    expect(rechazo(() => validarEntradaPerfil(perfil({ distritos: [] }), cobertura)).detalles[0]).toMatchObject({ campo: 'distritos' });
    expect(rechazo(() => validarEntradaPerfil(perfil({ distritos: ['ayacucho', 'huanta'] }), cobertura)).detalles).toEqual([
      { campo: 'distritos[1]', motivo: 'La zona no pertenece a los distritos de cobertura.' }]);
    expect(rechazo(() => validarEntradaPerfil(perfil({ distritos: ['ayacucho', 'ayacucho'] }), cobertura)).detalles[0]).toMatchObject({ motivo: 'Los distritos deben ser distintos.' });
    expect(rechazo(() => validarEntradaPerfil(perfil({ distritos: [...cobertura, 'otro'] }), cobertura)).detalles[0]).toMatchObject({ campo: 'distritos' });
  });
  test('la disponibilidad declarada es booleana', () => {
    expect(rechazo(() => validarEntradaPerfil(perfil({ disponibilidadDeclarada: 'sí' as never }), cobertura)).detalles[0]).toMatchObject({ campo: 'disponibilidadDeclarada' });
    expect(validarEntradaPerfil(perfil({ disponibilidadDeclarada: false }), cobertura).disponibilidadDeclarada).toBe(false);
  });
});

describe('trabajos y cuotas', () => {
  test('título hasta 120 y descripción hasta 2000, ambos obligatorios', () => {
    expect(validarDatosTrabajo({ titulo: 't'.repeat(120), descripcion: 'd'.repeat(2000) })).toBeTruthy();
    expect(rechazo(() => validarDatosTrabajo({ titulo: 't'.repeat(121), descripcion: 'x' })).detalles[0]).toMatchObject({ campo: 'titulo' });
    expect(rechazo(() => validarDatosTrabajo({ titulo: 'x', descripcion: 'd'.repeat(2001) })).detalles[0]).toMatchObject({ campo: 'descripcion' });
    expect(rechazo(() => validarDatosTrabajo({ titulo: 'x' })).detalles[0]).toMatchObject({ campo: 'descripcion' });
  });
  test('la edición parcial exige al menos un campo', () => {
    expect(validarDatosTrabajo({ titulo: 'Nuevo' }, true)).toEqual({ titulo: 'Nuevo' });
    expect(rechazo(() => validarDatosTrabajo({}, true)).codigo).toBe('DATOS_INVALIDOS');
  });
  test('hasta 10 trabajos: el décimo cabe y el undécimo se rechaza indicando el límite', () => {
    expect(() => exigirCupoTrabajo(9)).not.toThrow();
    const error = rechazo(() => exigirCupoTrabajo(10));
    expect([error.http, error.codigo, error.detalles[0]?.campo]).toEqual([422, 'LIMITE_PORTAFOLIO', 'trabajos']);
    expect(error.message).toContain('10');
  });
  test('hasta 4 fotografías por trabajo y 40 por prestador, informando cuál límite', () => {
    expect(() => exigirCupoFotografia({ fotografiasEnTrabajo: 3, fotografiasEnPerfil: 39 })).not.toThrow();
    expect(rechazo(() => exigirCupoFotografia({ fotografiasEnTrabajo: 4, fotografiasEnPerfil: 4 })).message).toContain('4 fotografías');
    expect(rechazo(() => exigirCupoFotografia({ fotografiasEnTrabajo: 3, fotografiasEnPerfil: 40 })).message).toContain('40 fotografías');
  });
});

describe('política de archivos', () => {
  const base = { mimeDeclarado: 'image/png', formatoReal: 'png', ancho: 100, alto: 100, bytes: 1000 };
  test('límites exactos de bytes y píxeles', () => {
    expect(() => exigirImagenAdmitida({ ...base, bytes: limitesPortafolio.bytesMaximos, ancho: 4096, alto: 4096 })).not.toThrow();
    const grande = rechazo(() => exigirImagenAdmitida({ ...base, bytes: 10_000_001 }));
    expect([grande.http, grande.codigo]).toEqual([413, 'ARCHIVO_DEMASIADO_GRANDE']);
    for (const dim of [{ ancho: 4097 }, { alto: 4097 }]) {
      const e = rechazo(() => exigirImagenAdmitida({ ...base, ...dim }));
      expect([e.http, e.codigo]).toEqual([422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS']);
    }
  });
  test('el formato real manda sobre la extensión o el tipo declarado', () => {
    for (const real of ['gif', 'tiff', 'svg', undefined]) expect(rechazo(() => exigirImagenAdmitida({ ...base, formatoReal: real })).codigo).toBe('IMAGEN_FORMATO_NO_ADMITIDO');
    expect(rechazo(() => exigirImagenAdmitida({ ...base, mimeDeclarado: 'image/jpeg' })).detalles[0]?.campo).toBe('tipoMime');
    expect(rechazo(() => exigirImagenAdmitida({ ...base, bytes: 0 })).codigo).toBe('IMAGEN_FORMATO_NO_ADMITIDO');
    expect(() => exigirImagenAdmitida({ ...base, mimeDeclarado: 'image/jpeg', formatoReal: 'jpeg' })).not.toThrow();
  });
});

describe('saneamiento de imágenes con Sharp', () => {
  const saneador = new SaneadorSharp();
  test.each(['jpeg', 'png', 'webp'] as const)('acepta %s válido y publica solo una variante WebP', async (formato) => {
    const r = await saneador.sanear(base64(await crearImagen({ formato })), mimeDe[formato]);
    expect((await sharp(r.bytes).metadata()).format).toBe('webp');
    expect([r.ancho, r.alto]).toEqual([64, 48]);
    expect(Buffer.from(r.checksum).equals(createHash('sha256').update(r.bytes).digest())).toBe(true);
  });
  test('acepta 4096 píxeles por lado y reduce la variante a 1600 sin ampliar las pequeñas', async () => {
    const r = await saneador.sanear(base64(await crearImagen({ ancho: 4096, alto: 4096 })), 'image/jpeg');
    expect([r.ancho, r.alto]).toEqual([1600, 1600]);
    const pequena = await saneador.sanear(base64(await crearImagen({ ancho: 50, alto: 20 })), 'image/jpeg');
    expect([pequena.ancho, pequena.alto]).toEqual([50, 20]);
  }, 30000);
  test('rechaza 4097 píxeles en ancho o alto con la causa', async () => {
    for (const [formato, ancho, alto] of [['png', 4097, 8], ['webp', 8, 4097]] as const) {
      const e = await rechazoAsync(saneador.sanear(base64(await crearImagen({ formato, ancho, alto })), mimeDe[formato]));
      expect(e.codigo).toBe('IMAGEN_DIMENSIONES_NO_ADMITIDAS');
    }
  });
  test('acepta un archivo de exactamente 10 000 000 bytes y rechaza uno de 10 000 001', async () => {
    const exacto = await pngDeTamano(10_000_000);
    expect(exacto.length).toBe(10_000_000);
    const r = await saneador.sanear(base64(exacto), 'image/png');
    expect(r.original.length).toBe(10_000_000);
    const e = await rechazoAsync(saneador.sanear(base64(Buffer.concat([exacto, Buffer.alloc(1)])), 'image/png'));
    expect([e.http, e.codigo]).toEqual([413, 'ARCHIVO_DEMASIADO_GRANDE']);
  }, 60000);
  test('rechaza formato real no permitido con extensión de imagen, contenido corrupto y base64 no canónico', async () => {
    const gif = base64(await crearImagen({ formato: 'gif' }));
    expect((await rechazoAsync(saneador.sanear(gif, 'image/png'))).codigo).toBe('IMAGEN_FORMATO_NO_ADMITIDO');
    expect((await rechazoAsync(saneador.sanear(gif, 'image/gif'))).codigo).toBe('IMAGEN_FORMATO_NO_ADMITIDO');
    expect((await rechazoAsync(saneador.sanear(base64(await crearImagen({ formato: 'jpeg' })), 'image/png'))).codigo).toBe('IMAGEN_FORMATO_NO_ADMITIDO');
    expect((await rechazoAsync(saneador.sanear(Buffer.from('no es una imagen').toString('base64'), 'image/png'))).codigo).toBe('IMAGEN_FORMATO_NO_ADMITIDO');
    const truncada = (await crearImagen({ formato: 'png', ancho: 300, alto: 300 })).subarray(0, 120);
    expect((await rechazoAsync(saneador.sanear(base64(truncada), 'image/png'))).codigo).toBe('IMAGEN_FORMATO_NO_ADMITIDO');
    for (const mal of ['!!!!', 'AAA', 'QUJD=QUJD', 'AAAA\n', 'QUJDRA==\u0000']) expect(rechazo(() => decodificarBase64Canonico(mal)).codigo).toBe('DATOS_INVALIDOS');
    expect(rechazo(() => decodificarBase64Canonico('A'.repeat(13_333_340))).http).toBe(413);
  });
  test('excluye EXIF, GPS, XMP, IPTC y perfiles de color, y aplica la orientación', async () => {
    const original = await crearImagen({ sensible: true, ancho: 120, alto: 80 });
    const metadatos = await sharp(original).metadata();
    expect(metadatos.exif).toBeDefined();
    expect(original.includes(Buffer.from(marcadorSensible))).toBe(true);
    const r = await saneador.sanear(base64(original), 'image/jpeg');
    const salida = await sharp(r.bytes).metadata();
    expect([salida.exif, salida.xmp, salida.iptc, salida.icc]).toEqual([undefined, undefined, undefined, undefined]);
    expect(Buffer.from(r.bytes).includes(Buffer.from(marcadorSensible))).toBe(false);
    expect(Buffer.from(r.bytes).includes(Buffer.from('Exif'))).toBe(false);
    const girada = await saneador.sanear(base64(await crearImagen({ ancho: 200, alto: 100, orientacion: 6 })), 'image/jpeg');
    expect([girada.ancho, girada.alto]).toEqual([100, 200]);
  });
});

describe('fotografías: un archivo inválido no altera las imágenes vinculadas', () => {
  const tx: ContextoTransaccion = { id: 'tx' };
  const identidad = { cuentaId: uuid(10), sesionId: uuid(11), perfiles: ['prestador'] as const };
  const trabajo = { id: uuid(20), prestadorId: uuid(30), titulo: 'T', descripcion: 'D', version: 3,
    fotografias: [{ id: uuid(40), trabajoId: uuid(20), objetoClave: 'portafolio/a/b', ancho: 10, alto: 10, bytes: 100, checksum: new Uint8Array(32) }] };
  function montar(opciones: { perfil?: boolean; trabajoPropio?: boolean; replay?: boolean; perfiles?: ('cliente' | 'prestador')[] } = {}) {
    const almacenado = new Map<string, Uint8Array>();
    const repo = {
      perfilPorCuenta: jest.fn(async () => (opciones.perfil === false ? null : { id: uuid(30), cuentaId: uuid(10), version: 1 })),
      trabajoDe: jest.fn(async () => (opciones.trabajoPropio === false ? null : trabajo)),
      contarFotografias: jest.fn(async () => 1), registrarPreparacion: jest.fn(async () => undefined),
      reemplazarFotografia: jest.fn(async () => 4), agregarFotografia: jest.fn(async () => 4),
    };
    const almacen: AlmacenPortafolio = {
      claveNueva: () => `portafolio/${uuid(30)}/${uuid(50)}`, pertenece: () => true,
      guardar: jest.fn(async (c: string, b: Uint8Array) => { almacenado.set(c, b); }),
      leer: jest.fn(async (c: string) => almacenado.get(c) ?? new Uint8Array()), eliminar: jest.fn(async () => undefined),
      listar: async function* () { /* sin objetos */ },
    };
    const idempotencia: Idempotencia002 = { ejecutar002: async (s, t) => { await s.autorizar(tx); return opciones.replay ? { http: 200, cuerpo: { repetido: true } } : t(tx); } };
    const usuarios = { exigir: jest.fn(async () => ({ ...identidad, perfiles: opciones.perfiles ?? ['prestador'] })) };
    const servicio = new FotografiasPortafolioServicio({ repositorio: repo as unknown as RepositorioPrestadores, idempotencia, usuarios, saneador: new SaneadorSharp(), almacen });
    const actor = { token: 'x'.repeat(43), identidad: { ...identidad, perfiles: opciones.perfiles ?? ['prestador'] } };
    return { servicio, repo, almacen, actor, almacenado };
  }
  const valida = async () => ({ versionTrabajo: 3, tipoMime: 'image/jpeg', contenidoBase64: base64(await crearImagen()) });

  test('el reemplazo con un archivo inválido se rechaza antes de escribir objeto, preparación o vínculo', async () => {
    const m = montar();
    for (const [mime, contenido] of [['image/png', base64(await crearImagen({ formato: 'gif' }))], ['image/png', base64(await crearImagen({ formato: 'png', ancho: 4097, alto: 4 }))]] as const) {
      const e = await rechazoAsync(m.servicio.reemplazar(m.actor, 'clave-idempotente-001', trabajo.id, uuid(40), { versionTrabajo: 3, tipoMime: mime, contenidoBase64: contenido }));
      expect(e.http).toBe(422);
    }
    expect(m.repo.registrarPreparacion).not.toHaveBeenCalled();
    expect(m.almacen.guardar).not.toHaveBeenCalled();
    expect(m.repo.reemplazarFotografia).not.toHaveBeenCalled();
  });
  test('el reemplazo válido conserva el identificador de la fotografía y confirma el nuevo objeto', async () => {
    const m = montar();
    const r = await m.servicio.reemplazar(m.actor, 'clave-idempotente-002', trabajo.id, uuid(40), await valida());
    expect(r.http).toBe(200);
    expect(r.cuerpo).toMatchObject({ fotografia: { fotografiaId: uuid(40), tipoMime: 'image/webp' }, versionTrabajo: 4 });
    expect(m.repo.registrarPreparacion).toHaveBeenCalledTimes(1);
    expect(m.repo.reemplazarFotografia).toHaveBeenCalledTimes(1);
    expect(m.almacen.eliminar).not.toHaveBeenCalled();
  });
  test('un replay idempotente no deja el objeto sobrante', async () => {
    const m = montar({ replay: true });
    expect(await m.servicio.reemplazar(m.actor, 'clave-idempotente-003', trabajo.id, uuid(40), await valida())).toMatchObject({ http: 200 });
    expect(m.repo.reemplazarFotografia).not.toHaveBeenCalled();
    expect(m.almacen.eliminar).toHaveBeenCalledTimes(1);
  });
  test('una cuenta solo cliente o un trabajo ajeno se rechazan antes de procesar la imagen', async () => {
    const cliente = montar({ perfiles: ['cliente'] });
    expect((await rechazoAsync(cliente.servicio.agregar(cliente.actor, 'clave-idempotente-004', trabajo.id, await valida()))).codigo).toBe('SIN_PERMISO');
    const ajeno = montar({ trabajoPropio: false });
    expect((await rechazoAsync(ajeno.servicio.agregar(ajeno.actor, 'clave-idempotente-005', trabajo.id, await valida()))).codigo).toBe('RECURSO_NO_DISPONIBLE');
    const sinPerfil = montar({ perfil: false });
    expect((await rechazoAsync(sinPerfil.servicio.reemplazar(sinPerfil.actor, 'clave-idempotente-006', trabajo.id, uuid(40), await valida()))).http).toBe(404);
    for (const m of [cliente, ajeno, sinPerfil]) { expect(m.almacen.guardar).not.toHaveBeenCalled(); expect(m.repo.registrarPreparacion).not.toHaveBeenCalled(); }
  });
});
