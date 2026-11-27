import { describe, expect, test } from '@jest/globals';
import { compararEstados, efectosDeCierre, efectosDeEdicion, efectosDePublicacion, estadoCanonico, type EstadoCanonico } from '../../../src/modulos/solicitudes/dominio/version.js';

// T043 · CA-SOL-05 a 07 y CA-VER-01 a 07: versión de control, versión de trabajo, cambios relevantes y edición idéntica.
const A = '123e4567-e89b-42d3-a456-426614174000'; const B = '223e4567-e89b-42d3-a456-426614174001'; const C = '323e4567-e89b-42d3-a456-426614174002';
const base = (extra: Partial<Parameters<typeof estadoCanonico>[0]> = {}): EstadoCanonico => estadoCanonico({
  descripcion: 'Pared de ladrillo', medidas: '3 x 2 m', categoriaId: A, distrito: 'ayacucho', fechaDesde: '2030-01-10', fechaHasta: '2030-01-20', archivosIds: [B, C], compartirFotografias: false, ...extra });
const editar = (estado: 'BORRADOR' | 'ABIERTA', antes: EstadoCanonico, despues: EstadoCanonico, version = 5, trabajo = estado === 'BORRADOR' ? 0 : 2) =>
  efectosDeEdicion(estado, version, trabajo, compararEstados(antes, despues));

describe('estado canónico', () => {
  test('recorta el texto, trata el vacío como ausente y normaliza los identificadores', () => {
    expect(estadoCanonico({ descripcion: '  hola  ', medidas: '   ', categoriaId: A.toUpperCase() })).toMatchObject({ descripcion: 'hola', medidas: null, categoriaId: A });
  });
  test('ordena los archivos y descarta repetidos: el orden de la lista no es un cambio', () => {
    expect(estadoCanonico({ archivosIds: [C, B, B] }).archivosIds).toEqual([B, C]);
    expect(compararEstados(base({ archivosIds: [B, C] }), base({ archivosIds: [C, B] })).sinCambios).toBe(true);
  });
});

describe('detección de cambios', () => {
  test.each([
    ['descripcion', { descripcion: 'Otra descripción' }], ['medidas', { medidas: '4 x 2 m' }], ['categoriaId', { categoriaId: B }], ['distrito', { distrito: 'carmen-alto' }],
    ['fechaDesde', { fechaDesde: '2030-02-01' }], ['fechaHasta', { fechaHasta: '2030-03-01' }], ['archivos', { archivosIds: [B] }],
  ] as const)('un cambio de %s es relevante del trabajo (CA-VER-03)', (campo, cambio) => {
    expect(compararEstados(base(), base(cambio))).toMatchObject({ sinCambios: false, relevantes: [campo], privacidad: false, camposCambiados: [campo] });
  });
  test('añadir o quitar un archivo cambia el conjunto de archivos confirmados', () => {
    expect(compararEstados(base({ archivosIds: [] }), base({ archivosIds: [B] })).relevantes).toEqual(['archivos']);
    expect(compararEstados(base(), base({ archivosIds: [] })).relevantes).toEqual(['archivos']);
  });
  test('el permiso de compartir fotografías es un cambio de privacidad, no relevante (CA-VER-01)', () => {
    expect(compararEstados(base(), base({ compartirFotografias: true }))).toMatchObject({ sinCambios: false, relevantes: [], privacidad: true, camposCambiados: ['compartirFotografias'] });
  });
  test('un estado idéntico no tiene cambios (CA-SOL-07), aunque difieran los espacios o el orden', () => {
    expect(compararEstados(base(), base()).sinCambios).toBe(true);
    expect(compararEstados(base(), base({ descripcion: '  Pared de ladrillo ', archivosIds: [C, B] })).sinCambios).toBe(true);
  });
  test('un cambio mixto lista relevantes y privacidad en el mismo plan (CA-VER-05)', () => {
    expect(compararEstados(base(), base({ descripcion: 'Nueva', compartirFotografias: true }))).toMatchObject({ relevantes: ['descripcion'], privacidad: true, camposCambiados: ['descripcion', 'compartirFotografias'] });
  });
  test('los campos cambiados son nombres, nunca valores', () => {
    const plan = compararEstados(base(), base({ descripcion: 'Texto secreto del cliente', medidas: '9 x 9' }));
    expect(JSON.stringify(plan.camposCambiados)).not.toMatch(/secreto|9 x 9/);
  });
});

describe('efectos de editar un borrador (CA-VER-07)', () => {
  test('sube la versión de control, no crea versión de trabajo ni avisos y deja bitácora de borrador', () => {
    expect(editar('BORRADOR', base(), base({ descripcion: 'Otra' }))).toEqual({ version: 6, versionTrabajo: 0, creaVersionDeTrabajo: false, bitacora: ['BORRADOR_EDITADO'], avisaAInteresados: false });
  });
  test('cualquier cambio de un borrador, incluida la privacidad, es solo una edición de borrador', () => {
    expect(editar('BORRADOR', base(), base({ compartirFotografias: true })).bitacora).toEqual(['BORRADOR_EDITADO']);
    expect(editar('BORRADOR', base(), base({ archivosIds: [] })).creaVersionDeTrabajo).toBe(false);
  });
});

describe('efectos de editar una solicitud ABIERTA', () => {
  test('un cambio relevante crea la siguiente versión de trabajo, avisa a los interesados y sube el control (CA-SOL-05, CA-VER-03)', () => {
    expect(editar('ABIERTA', base(), base({ distrito: 'carmen-alto' }), 7, 2)).toEqual({ version: 8, versionTrabajo: 3, creaVersionDeTrabajo: true, bitacora: ['EDITADA'], avisaAInteresados: true });
  });
  test('la primera edición tras la publicación crea la versión 2, no la 1 (CA-VER-06)', () => {
    expect(editar('ABIERTA', base(), base({ medidas: '5 x 5' }), 2, 1)).toMatchObject({ version: 3, versionTrabajo: 2, creaVersionDeTrabajo: true });
  });
  test('cambiar solo el permiso sube el control y deja bitácora, sin versión de trabajo ni avisos (CA-VER-01)', () => {
    expect(editar('ABIERTA', base(), base({ compartirFotografias: true }), 4, 3)).toEqual({ version: 5, versionTrabajo: 3, creaVersionDeTrabajo: false, bitacora: ['PRIVACIDAD_CAMBIADA'], avisaAInteresados: false });
  });
  test('un cambio mixto crea UNA sola versión de trabajo y registra ambos en la bitácora (CA-VER-05)', () => {
    const e = editar('ABIERTA', base(), base({ descripcion: 'Nueva', compartirFotografias: true }), 4, 3);
    expect(e).toEqual({ version: 5, versionTrabajo: 4, creaVersionDeTrabajo: true, bitacora: ['EDITADA', 'PRIVACIDAD_CAMBIADA'], avisaAInteresados: true });
  });
  test('varios campos relevantes en una edición siguen siendo UNA versión de trabajo', () => {
    expect(editar('ABIERTA', base(), base({ descripcion: 'N', medidas: 'M', distrito: 'carmen-alto', archivosIds: [] }), 1, 1)).toMatchObject({ versionTrabajo: 2, creaVersionDeTrabajo: true });
  });
  test('una edición idéntica no tiene ningún efecto (CA-SOL-07)', () => {
    expect(editar('ABIERTA', base(), base(), 9, 4)).toEqual({ version: 9, versionTrabajo: 4, creaVersionDeTrabajo: false, bitacora: [], avisaAInteresados: false });
    expect(editar('BORRADOR', base(), base({ descripcion: ' Pared de ladrillo' }))).toEqual({ version: 5, versionTrabajo: 0, creaVersionDeTrabajo: false, bitacora: [], avisaAInteresados: false });
  });
});

describe('publicar y cerrar', () => {
  test('la primera publicación crea la versión de trabajo 1 y sube el control (CA-VER-06)', () => {
    expect(efectosDePublicacion(3, false)).toEqual({ version: 4, versionTrabajo: 1, creaVersionDeTrabajo: true, bitacora: ['PUBLICADA'], avisaAInteresados: false, avisaAlDestinatario: false });
  });
  test('solo la primera publicación de una DIRIGIDA avisa, y solo al destinatario (CA-AVI-02 y CA-AVI-03)', () => {
    expect(efectosDePublicacion(3, true)).toMatchObject({ avisaAlDestinatario: true, avisaAInteresados: false });
    expect(efectosDePublicacion(3, false).avisaAlDestinatario).toBe(false);
  });
  test('cerrar una ABIERTA no crea versión de trabajo, deja bitácora y avisa a los interesados (CA-VER-02 y CA-CIE-02)', () => {
    expect(efectosDeCierre('ABIERTA', 6, 3)).toEqual({ version: 7, versionTrabajo: 3, creaVersionDeTrabajo: false, bitacora: ['CERRADA'], avisaAInteresados: true });
  });
  test('descartar un borrador (cerrarlo) deja bitácora y no avisa a nadie (CA-BOR-07)', () => {
    expect(efectosDeCierre('BORRADOR', 2, 0)).toEqual({ version: 3, versionTrabajo: 0, creaVersionDeTrabajo: false, bitacora: ['CERRADA'], avisaAInteresados: false });
  });
});

describe('invariantes', () => {
  test('toda decisión que cambia algo sube la versión de control exactamente en uno', () => {
    for (const estado of ['BORRADOR', 'ABIERTA'] as const) for (const despues of [base({ descripcion: 'x' }), base({ compartirFotografias: true }), base({ archivosIds: [] })]) {
      const e = editar(estado, base(), despues, 10, estado === 'ABIERTA' ? 1 : 0);
      expect(e.version).toBe(11);
    }
  });
  test('la versión de trabajo nunca baja ni sube más de uno por edición', () => {
    for (const despues of [base(), base({ descripcion: 'x' }), base({ compartirFotografias: true }), base({ descripcion: 'x', medidas: 'y', compartirFotografias: true })]) {
      const e = editar('ABIERTA', base(), despues, 3, 5);
      expect(e.versionTrabajo - 5).toBeGreaterThanOrEqual(0);
      expect(e.versionTrabajo - 5).toBeLessThanOrEqual(1);
    }
  });
  test('un borrador nunca produce versión de trabajo distinta de 0', () => {
    expect(editar('BORRADOR', base(), base({ descripcion: 'x', medidas: 'y', distrito: 'carmen-alto' })).versionTrabajo).toBe(0);
  });
});
