import { describe, expect, test } from '@jest/globals';
import { decidirAcceso, type EntradaDeAcceso } from '../../../src/modulos/solicitudes/dominio/politica-acceso.js';

// T034 · política única de acceso y fotografías. FR-324 a FR-328 y CA-PRI-02 a 08. Función pura: sin infraestructura ni otros módulos.
const CLIENTE = 'cliente'; const PRESTADOR = 'prestador'; const OTRO = 'otro';
const base = (extra: Partial<EntradaDeAcceso> = {}): EntradaDeAcceso => ({
  solicitud: { tipo: 'PUBLICADA', estado: 'ABIERTA', clienteCuentaId: CLIENTE, prestadorCuentaId: null, compartirFotografias: false, ...extra.solicitud },
  actor: { cuentaId: PRESTADOR, tienePerfilPrestador: true, ...extra.actor },
  compatible: extra.compatible ?? false,
  autorNoRetirado: extra.autorNoRetirado ?? false,
});
const dirigidaA = (cuenta: string | null, estado: 'BORRADOR' | 'ABIERTA' | 'CERRADA' = 'ABIERTA') => ({ tipo: 'DIRIGIDA' as const, estado, clienteCuentaId: CLIENTE, prestadorCuentaId: cuenta, compartirFotografias: false });

describe('dueño', () => {
  test('lee todo, ve las fotografías y la bitácora, y no puede cotizar su propia solicitud, en cualquier estado', () => {
    for (const estado of ['BORRADOR', 'ABIERTA', 'CERRADA'] as const) {
      const d = decidirAcceso(base({ solicitud: { tipo: 'PUBLICADA', estado, clienteCuentaId: CLIENTE, prestadorCuentaId: null, compartirFotografias: false }, actor: { cuentaId: CLIENTE, tienePerfilPrestador: true }, compatible: true }));
      expect(d).toMatchObject({ acceso: 'DUENO', puedeLeer: true, fotografias: 'VISIBLES', puedeVerVersiones: true, puedeVerBitacora: true, puedeCotizar: false, enOportunidades: false });
    }
  });
});

describe('FR-324: el acceso del prestador es la unión de tres títulos independientes', () => {
  test('(a) destinatario de una dirigida: accede en ABIERTA y también en CERRADA, y puede cotizar solo mientras está abierta', () => {
    const abierta = decidirAcceso(base({ solicitud: dirigidaA(PRESTADOR) }));
    expect(abierta).toMatchObject({ acceso: 'PRESTADOR', puedeLeer: true, puedeCotizar: true, enOportunidades: true, titulos: { destinatario: true, compatible: false, autor: false } });
    const cerrada = decidirAcceso(base({ solicitud: dirigidaA(PRESTADOR, 'CERRADA') }));
    expect(cerrada).toMatchObject({ acceso: 'PRESTADOR', puedeLeer: true, puedeCotizar: false, enOportunidades: false });
  });
  test('(b) compatible con una publicada ABIERTA: accede, la ve como oportunidad y puede cotizar', () => {
    expect(decidirAcceso(base({ compatible: true }))).toMatchObject({ acceso: 'PRESTADOR', puedeLeer: true, puedeCotizar: true, enOportunidades: true, titulos: { destinatario: false, compatible: true, autor: false } });
  });
  test('(b) no incluye una publicada CERRADA ni una dirigida a otro: la compatibilidad solo vale para publicadas abiertas', () => {
    expect(decidirAcceso(base({ solicitud: { tipo: 'PUBLICADA', estado: 'CERRADA', clienteCuentaId: CLIENTE, prestadorCuentaId: null, compartirFotografias: true }, compatible: true }))).toMatchObject({ acceso: 'NINGUNO', puedeLeer: false });
    expect(decidirAcceso(base({ solicitud: dirigidaA(OTRO), compatible: true }))).toMatchObject({ acceso: 'NINGUNO', puedeLeer: false, puedeCotizar: false });
  });
  test('(c) autor de una cotización no retirada: sigue leyendo con la solicitud CERRADA, pero no puede cotizar de nuevo ni la ve como oportunidad', () => {
    const d = decidirAcceso(base({ solicitud: { tipo: 'PUBLICADA', estado: 'CERRADA', clienteCuentaId: CLIENTE, prestadorCuentaId: null, compartirFotografias: false }, autorNoRetirado: true }));
    expect(d).toMatchObject({ acceso: 'PRESTADOR', puedeLeer: true, puedeCotizar: false, enOportunidades: false, titulos: { autor: true } });
  });
  test('los títulos se acumulan sin estorbarse', () => {
    const d = decidirAcceso(base({ solicitud: dirigidaA(PRESTADOR), autorNoRetirado: true }));
    expect(d.titulos).toEqual({ destinatario: true, compatible: false, autor: true });
  });
  test('sin ningún título no hay acceso, y un borrador solo lo ve su dueño', () => {
    expect(decidirAcceso(base())).toMatchObject({ acceso: 'NINGUNO', puedeLeer: false, fotografias: 'OCULTAS', puedeVerVersiones: false, puedeVerBitacora: false });
    expect(decidirAcceso(base({ solicitud: dirigidaA(PRESTADOR, 'BORRADOR'), compatible: true, autorNoRetirado: true }))).toMatchObject({ acceso: 'NINGUNO', puedeLeer: false });
  });
  test('quien no tiene perfil prestador no obtiene ningún título', () => {
    expect(decidirAcceso(base({ solicitud: dirigidaA(PRESTADOR), actor: { cuentaId: PRESTADOR, tienePerfilPrestador: false }, compatible: true, autorNoRetirado: true }))).toMatchObject({ acceso: 'NINGUNO', puedeLeer: false });
  });
});

describe('FR-325 y FR-326: retirar la cotización y perder la compatibilidad', () => {
  test('CA-PRI-05: quien pierde la compatibilidad no la ve como oportunidad ni cotiza de nuevo, pero con cotización no retirada conserva la lectura', () => {
    const sinCotizacion = decidirAcceso(base({ compatible: false, autorNoRetirado: false }));
    expect(sinCotizacion).toMatchObject({ acceso: 'NINGUNO', enOportunidades: false, puedeCotizar: false });
    const conCotizacion = decidirAcceso(base({ compatible: false, autorNoRetirado: true }));
    expect(conCotizacion).toMatchObject({ acceso: 'PRESTADOR', puedeLeer: true, enOportunidades: false, puedeCotizar: false });
  });
  test('CA-PRI-06: sin los títulos de destinatario ni compatibilidad, retirar la cotización quita el acceso a la solicitud', () => {
    expect(decidirAcceso(base({ autorNoRetirado: true })).puedeLeer).toBe(true);
    expect(decidirAcceso(base({ autorNoRetirado: false })).puedeLeer).toBe(false);
  });
  test('CA-PRI-07: el destinatario de una dirigida que retira su cotización conserva el acceso y las fotografías', () => {
    const d = decidirAcceso(base({ solicitud: dirigidaA(PRESTADOR), autorNoRetirado: false }));
    expect(d).toMatchObject({ acceso: 'PRESTADOR', puedeLeer: true, fotografias: 'VISIBLES' });
  });
  test('CA-PRI-08: un prestador compatible que retira su cotización sigue viendo la publicada ABIERTA y puede cotizar con otra identidad', () => {
    expect(decidirAcceso(base({ compatible: true, autorNoRetirado: false }))).toMatchObject({ acceso: 'PRESTADOR', puedeLeer: true, enOportunidades: true, puedeCotizar: true });
  });
});

describe('FR-327 y FR-328: fotografías y permiso de compartir', () => {
  const publicada = (compartir: boolean, estado: 'ABIERTA' | 'CERRADA' = 'ABIERTA') => ({ tipo: 'PUBLICADA' as const, estado, clienteCuentaId: CLIENTE, prestadorCuentaId: null, compartirFotografias: compartir });
  test('una dirigida: las ven el cliente y el destinatario, compartidas o no', () => {
    expect(decidirAcceso(base({ solicitud: { ...dirigidaA(PRESTADOR), compartirFotografias: false } })).fotografias).toBe('VISIBLES');
    expect(decidirAcceso(base({ solicitud: { ...dirigidaA(PRESTADOR), compartirFotografias: true } })).fotografias).toBe('VISIBLES');
  });
  test('una publicada con permiso: las ven los prestadores con acceso (compatibles y autores); sin acceso no ven nada', () => {
    expect(decidirAcceso(base({ solicitud: publicada(true), compatible: true })).fotografias).toBe('VISIBLES');
    expect(decidirAcceso(base({ solicitud: publicada(true), autorNoRetirado: true })).fotografias).toBe('VISIBLES');
    expect(decidirAcceso(base({ solicitud: publicada(true) })).fotografias).toBe('OCULTAS');
  });
  test('sin permiso: el prestador con acceso ve solo que existen fotografías no compartidas', () => {
    expect(decidirAcceso(base({ solicitud: publicada(false), compatible: true })).fotografias).toBe('NO_COMPARTIDAS');
    expect(decidirAcceso(base({ solicitud: publicada(false), autorNoRetirado: true })).fotografias).toBe('NO_COMPARTIDAS');
  });
  test('CA-PRI-02: revocar el permiso quita las fotografías a todos los prestadores, incluido quien ya cotizó, en la siguiente petición', () => {
    for (const titulo of [{ compatible: true }, { autorNoRetirado: true }, { compatible: true, autorNoRetirado: true }]) {
      expect(decidirAcceso(base({ solicitud: publicada(true), ...titulo })).fotografias).toBe('VISIBLES');
      expect(decidirAcceso(base({ solicitud: publicada(false), ...titulo })).fotografias).toBe('NO_COMPARTIDAS');
    }
  });
  test('CA-PRI-03: tras revocar, el autor conserva el acceso a la solicitud y a sus versiones de trabajo', () => {
    const d = decidirAcceso(base({ solicitud: publicada(false), autorNoRetirado: true }));
    expect(d).toMatchObject({ acceso: 'PRESTADOR', puedeLeer: true, puedeVerVersiones: true });
  });
  test('CA-PRI-04: volver a compartir restablece las fotografías', () => {
    expect(decidirAcceso(base({ solicitud: publicada(false), autorNoRetirado: true })).fotografias).toBe('NO_COMPARTIDAS');
    expect(decidirAcceso(base({ solicitud: publicada(true), autorNoRetirado: true })).fotografias).toBe('VISIBLES');
  });
  test('una publicada CERRADA con permiso sigue mostrando las fotografías a quien conserva el título de autor', () => {
    expect(decidirAcceso(base({ solicitud: publicada(true, 'CERRADA'), autorNoRetirado: true })).fotografias).toBe('VISIBLES');
  });
  test('el dueño ve siempre sus fotografías, tenga o no activado el permiso', () => {
    expect(decidirAcceso(base({ solicitud: publicada(false), actor: { cuentaId: CLIENTE, tienePerfilPrestador: false } })).fotografias).toBe('VISIBLES');
  });
});

describe('historial', () => {
  test('las versiones las ven el dueño, el destinatario y los autores no retirados; la bitácora solo el dueño', () => {
    expect(decidirAcceso(base({ solicitud: dirigidaA(PRESTADOR) }))).toMatchObject({ puedeVerVersiones: true, puedeVerBitacora: false });
    expect(decidirAcceso(base({ autorNoRetirado: true }))).toMatchObject({ puedeVerVersiones: true, puedeVerBitacora: false });
    expect(decidirAcceso(base({ compatible: true }))).toMatchObject({ puedeVerVersiones: false, puedeVerBitacora: false });
    expect(decidirAcceso(base({ actor: { cuentaId: CLIENTE, tienePerfilPrestador: false } }))).toMatchObject({ puedeVerVersiones: true, puedeVerBitacora: true });
  });
});

describe('pureza y consistencia', () => {
  test('no modifica su entrada y es determinista', () => {
    const entrada = base({ solicitud: dirigidaA(PRESTADOR), autorNoRetirado: true });
    const copia = JSON.stringify(entrada);
    expect(decidirAcceso(entrada)).toEqual(decidirAcceso(entrada));
    expect(JSON.stringify(entrada)).toBe(copia);
  });
  test('toda decisión es coherente: sin lectura no hay fotografías, versiones, bitácora ni cotización', () => {
    for (const tipo of ['DIRIGIDA', 'PUBLICADA'] as const) for (const estado of ['BORRADOR', 'ABIERTA', 'CERRADA'] as const) for (const compartir of [true, false])
      for (const destinatario of [true, false]) for (const compatible of [true, false]) for (const autor of [true, false]) for (const perfil of [true, false]) {
        const d = decidirAcceso({ solicitud: { tipo, estado, clienteCuentaId: CLIENTE, prestadorCuentaId: destinatario ? PRESTADOR : OTRO, compartirFotografias: compartir },
          actor: { cuentaId: PRESTADOR, tienePerfilPrestador: perfil }, compatible, autorNoRetirado: autor });
        if (!d.puedeLeer) expect(d).toMatchObject({ acceso: 'NINGUNO', fotografias: 'OCULTAS', puedeVerVersiones: false, puedeVerBitacora: false, puedeCotizar: false, enOportunidades: false });
        if (d.puedeCotizar) expect(d.puedeLeer && estado === 'ABIERTA').toBe(true);
        if (d.enOportunidades) expect(estado).toBe('ABIERTA');
      }
  });
});
