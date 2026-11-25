import { describe, expect, test } from '@jest/globals';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import { clasificacionActiva, type Clasificacion } from '../../../src/modulos/catalogo/dominio/clasificacion.js';
import { cambiarEstadoClasificacion, crearClasificacion, editarNombreClasificacion, limiteNombreClasificacion, normalizarNombre } from '../../../src/modulos/catalogo/dominio/gestion-clasificaciones.js';
import { esElegible, type Servicio } from '../../../src/modulos/catalogo/dominio/servicio.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const rechazo = (fn: () => unknown) => { try { fn(); } catch (e) { return e as ErrorAplicacion; } throw new Error('Debía rechazar.'); };
const raiz = (activa = true): Clasificacion => ({ id: uuid(1), nombre: 'Construcción', nivel: 1, categoriaPadreId: null, activa, version: 1 });
const hija = (activa = true): Clasificacion => ({ id: uuid(2), nombre: 'Albañilería', nivel: 2, categoriaPadreId: uuid(1), activa, version: 1 });
const servicio = (estado: Servicio['estado']): Pick<Servicio, 'estado'> => ({ estado });

describe('HU25 · creación de clasificaciones', () => {
  test('toda clasificación nace inactiva, con versión 1 y nombre recortado', () => {
    const r = crearClasificacion({ id: uuid(1), nombre: '  Construcción  ' });
    expect(r).toMatchObject({ id: uuid(1), nombre: 'Construcción', nivel: 1, categoriaPadreId: null, activa: false, version: 1 });
    const h = crearClasificacion({ id: uuid(2), nombre: 'Albañilería', padre: raiz() });
    expect(h).toMatchObject({ nivel: 2, categoriaPadreId: uuid(1), activa: false });
  });
  test('el nombre admite hasta 120 caracteres y rechaza vacío, marcado y control', () => {
    expect(limiteNombreClasificacion).toBe(120);
    expect(() => crearClasificacion({ id: uuid(3), nombre: 'a'.repeat(120) })).not.toThrow();
    for (const nombre of ['a'.repeat(121), '   ', '<b>x</b>', 'a\u0000b', 5 as unknown as string]) {
      const e = rechazo(() => crearClasificacion({ id: uuid(3), nombre }));
      expect(e).toMatchObject({ http: 400, codigo: 'DATOS_INVALIDOS' });
    }
  });
  test('la jerarquía es de dos niveles: el padre debe ser una raíz y una hija no tiene hijas', () => {
    const e = rechazo(() => crearClasificacion({ id: uuid(3), nombre: 'Nieta', padre: hija() }));
    expect(e).toMatchObject({ http: 422, codigo: 'JERARQUIA_CATEGORIA_NO_VALIDA' });
  });
  test('la comparación de nombres ignora mayúsculas, tildes de vocales y espacios repetidos, pero distingue ñ de n', () => {
    expect(normalizarNombre('  Albañilería   Y  Muros ')).toBe(normalizarNombre('ALBAÑILERIA y muros'));
    expect(normalizarNombre('Albañilería')).not.toBe(normalizarNombre('Albanileria'));
    expect(normalizarNombre('Pintura')).not.toBe(normalizarNombre('Pinturas'));
  });
});

describe('HU25 · edición y vínculo inmutable a la raíz', () => {
  test('editar el nombre conserva jerarquía, estado e identidad y avanza la versión', () => {
    const e = editarNombreClasificacion(hija(false), 'Albañilería fina');
    expect(e).toMatchObject({ id: uuid(2), nivel: 2, categoriaPadreId: uuid(1), activa: false, nombre: 'Albañilería fina', version: 2 });
  });
  test('la edición rechaza nombres inválidos sin modificar el original', () => {
    const original = hija();
    expect(rechazo(() => editarNombreClasificacion(original, ''))).toMatchObject({ http: 400 });
    expect(original.version).toBe(1);
  });
});

describe('HU25 · activación y actividad efectiva', () => {
  test('activar y desactivar avanza la versión y conserva jerarquía', () => {
    const a = cambiarEstadoClasificacion(hija(false), true);
    expect(a).toMatchObject({ activa: true, version: 2, categoriaPadreId: uuid(1) });
    expect(cambiarEstadoClasificacion(a, false)).toMatchObject({ activa: false, version: 3 });
  });
  test('repetir el estado actual se rechaza con TRANSICION_NO_ADMITIDA, no cambia en silencio', () => {
    expect(rechazo(() => cambiarEstadoClasificacion(hija(true), true))).toMatchObject({ http: 422, codigo: 'TRANSICION_NO_ADMITIDA' });
    expect(rechazo(() => cambiarEstadoClasificacion(hija(false), false))).toMatchObject({ http: 422 });
  });
  test('una hija activa deja de ser efectiva si su raíz se desactiva, sin cambiar su estado propio', () => {
    const rInactiva = cambiarEstadoClasificacion(raiz(true), false);
    expect(clasificacionActiva(hija(true), raiz(true))).toBe(true);
    expect(clasificacionActiva(hija(true), rInactiva)).toBe(false);
    expect(hija(true).activa).toBe(true);
  });
  test('reactivar la raíz restituye la actividad efectiva de las hijas con estado propio activo', () => {
    const rInactiva = raiz(false);
    expect(clasificacionActiva(hija(true), rInactiva)).toBe(false);
    expect(clasificacionActiva(hija(true), cambiarEstadoClasificacion(rInactiva, true))).toBe(true);
    expect(clasificacionActiva(hija(false), raiz(true))).toBe(false);
  });
});

describe('HU25 · conservación del estado de los servicios', () => {
  test('desactivar la clasificación oculta un servicio PUBLICADO sin cambiar su estado propio', () => {
    const s = servicio('PUBLICADO');
    expect(esElegible(s, true)).toBe(true);
    expect(esElegible(s, false)).toBe(false);
    expect(s.estado).toBe('PUBLICADO');
  });
  test('reactivar restituye solo servicios PUBLICADO; PAUSADO y RETIRADO no se restituyen', () => {
    expect(esElegible(servicio('PUBLICADO'), true)).toBe(true);
    expect(esElegible(servicio('PAUSADO'), true)).toBe(false);
    expect(esElegible(servicio('RETIRADO'), true)).toBe(false);
  });
});
