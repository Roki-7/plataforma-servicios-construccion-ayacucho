import { describe, expect, test } from '@jest/globals';
import { analizarTextos, detectarDatosPersonales, mensajesDeDeteccion, type CodigoDeteccion } from '../../../src/modulos/solicitudes/dominio/datos-personales.js';
import { evaluarTextoLibre } from '../../../src/modulos/solicitudes/dominio/solicitud.js';

// T044 · FR-315, FR-316, FR-348 y CA-DAT-01 a 08. Los ejemplos de la tabla son los de la sección «Criterios verificables de datos personales» de la especificación.
const codigos = (texto: string): CodigoDeteccion[] => detectarDatosPersonales(texto, 'descripcion').map(d => d.codigo);

describe('ejemplos que se rechazan en una publicada (CA-DAT-01 y CA-DAT-08)', () => {
  test.each([
    ['Llámame al 981 234 567', 'POSIBLE_TELEFONO'],
    ['+51 981234567', 'POSIBLE_TELEFONO'],
    ['escríbeme a juan@correo.com', 'POSIBLE_CORREO'],
    ['wa.me/51981234567', 'POSIBLE_ENLACE_O_MENSAJERIA'],
    ['www.ejemplo.pe/contacto', 'POSIBLE_ENLACE_O_MENSAJERIA'],
    ['escríbeme por WhatsApp', 'POSIBLE_ENLACE_O_MENSAJERIA'],
  ] as const)('«%s» se rechaza (%s)', (texto, codigo) => {
    expect(codigos(texto)).toContain(codigo);
    const { rechazos, advertencias } = analizarTextos({ descripcion: texto }, true);
    expect(rechazos.map(r => r.codigo)).toContain(codigo);
    expect(advertencias.map(a => a.codigo)).not.toContain(codigo);
    expect(() => evaluarTextoLibre({ descripcion: texto }, true)).toThrow(expect.objectContaining({ http: 422, codigo: 'DATOS_PERSONALES_EN_TEXTO' }));
  });
});

describe('ejemplos que solo generan advertencia, también en una publicada (CA-DAT-03)', () => {
  test.each([['mi DNI 12345678', 'POSIBLE_DOCUMENTO'], ['Jr. Lima 123 cerca del mercado', 'POSIBLE_DIRECCION']] as const)('«%s» → %s', (texto, codigo) => {
    expect(codigos(texto)).toEqual([codigo]);
    const { rechazos, advertencias } = analizarTextos({ descripcion: texto }, true);
    expect(rechazos).toEqual([]);
    expect(advertencias.map(a => a.codigo)).toEqual([codigo]);
    expect(evaluarTextoLibre({ descripcion: texto }, true).map(a => a.codigo)).toEqual([codigo]);
  });
  test.each([['documento 12345678', 'POSIBLE_DOCUMENTO'], ['RUC 20123456789', 'POSIBLE_DOCUMENTO'], ['DNI: 12345678', 'POSIBLE_DOCUMENTO'], ['Av. Los Libertadores 450', 'POSIBLE_DIRECCION'],
    ['Psje. Las Flores s/n', 'POSIBLE_DIRECCION'], ['Calle Grau 12', 'POSIBLE_DIRECCION'], ['Mz. B Lt. 4', 'POSIBLE_DIRECCION']] as const)('«%s» → %s', (texto, codigo) => {
    expect(codigos(texto)).toContain(codigo);
  });
  test('los dígitos de un documento no se cuentan además como teléfono (RUC de 11 dígitos)', () => {
    expect(codigos('RUC 20123456789')).toEqual(['POSIBLE_DOCUMENTO']);
    expect(analizarTextos({ descripcion: 'RUC 20123456789' }, true).rechazos).toEqual([]);
  });
});

describe('ejemplos exentos: no se rechazan ni se advierten (CA-DAT-04 y FR-348)', () => {
  test.each([
    'Pared de 2.50 x 3.00 m, presupuesto S/ 1 500 000',
    'Necesito 120 m2 de piso en 3 pisos',
    'Entrega el 26/11/2026',
    // montos con indicador monetario delante o detrás, con o sin separadores
    'Presupuesto S/ 1 500 000 000', 'Presupuesto S/. 1,500,000,000.00', 'Presupuesto PEN 2 500 000 000', 'Presupuesto $ 1 500 000 000', 'Presupuesto USD 1 500 000 000',
    'Presupuesto 1 500 000 000 soles', 'Presupuesto 1 500 000 000 dólares',
    // cantidades de menos de 9 dígitos
    'Son 12345678 clavos', 'Necesito 100 ladrillos y 250 bolsas', 'Presupuesto S/ 1500', 'Presupuesto de 1 500 000 soles',
    // medidas con unidad, porcentajes y numeraciones cortas
    'Cubrir 120.5 cm por 80 mm', 'Pesa 250 kg y 40 L', 'Son 12 und de 3 m', 'Un 15% de descuento sobre 100 m²', 'Descuento del 100%',
    'Lote 12, manzana B, piso 3', 'manzana B lote 12 piso 3', 'Habitación 204 del piso 3', 'Entrega el 3/1/2027 o el 05-01-2027',
  ])('«%s»', (texto) => {
    expect(codigos(texto)).toEqual([]);
    expect(analizarTextos({ descripcion: texto }, true)).toEqual({ rechazos: [], advertencias: [] });
  });
  test('un monto con indicador monetario tampoco se confunde con un teléfono aunque tenga 9 o más dígitos', () => {
    expect(codigos('S/ 123456789')).toEqual([]);
    expect(codigos('123 456 789 soles')).toEqual([]);
  });
  test('sin el indicador monetario, la misma secuencia de 9 o más dígitos sí es un teléfono', () => {
    expect(codigos('123456789')).toEqual(['POSIBLE_TELEFONO']);
    expect(codigos('981-234-567')).toEqual(['POSIBLE_TELEFONO']);
    expect(codigos('(064) 123 456')).toEqual(['POSIBLE_TELEFONO']);
    expect(codigos('981.234.567')).toEqual(['POSIBLE_TELEFONO']);
    expect(codigos('51 981 234 567')).toEqual(['POSIBLE_TELEFONO']);
  });
  test('ocho dígitos no son un teléfono', () => { expect(codigos('12 345 678')).toEqual([]); });
});

describe('correo, enlaces y mensajería: variantes', () => {
  test.each(['usuario@dominio', 'a.b+c@mail.org', 'JUAN@CORREO.PE'])('correo «%s»', (t) => expect(codigos(t)).toContain('POSIBLE_CORREO'));
  test.each(['http://x', 'https://sitio', 'WWW.Ejemplo', 'mira sitio.com', 'pagina.pe', 'red.net', 'grupo.org/inicio', 'WA.ME/123', 't.me/canal', 'por TELEGRAM', 'whatsapp'])('enlace «%s»', (t) => expect(codigos(t)).toContain('POSIBLE_ENLACE_O_MENSAJERIA'));
  test.each(['Mide 2.5 m y pesa 3 kg', 'pared.', 'Terminar el 3.er piso', 'el arroz.', 'S/ 2.50'])('no es enlace «%s»', (t) => expect(codigos(t)).not.toContain('POSIBLE_ENLACE_O_MENSAJERIA'));
  test('un texto sin arroba no es un correo', () => { expect(codigos('arroba @ suelta y @usuario')).not.toContain('POSIBLE_CORREO'); });
});

describe('efecto según el tipo de solicitud (FR-315 y FR-316)', () => {
  const texto = 'Llámame al 981 234 567 o escribe a juan@correo.com, mi DNI 12345678';
  test('en una publicada rechaza correo, enlace y teléfono; el documento y la dirección advierten', () => {
    const { rechazos, advertencias } = analizarTextos({ descripcion: texto }, true);
    expect(rechazos.map(r => r.codigo).sort()).toEqual(['POSIBLE_CORREO', 'POSIBLE_TELEFONO']);
    expect(advertencias.map(a => a.codigo)).toEqual(['POSIBLE_DOCUMENTO']);
  });
  test('en una dirigida o un borrador, todo es advertencia y nada se rechaza (CA-DAT-02 y CA-DAT-06)', () => {
    const { rechazos, advertencias } = analizarTextos({ descripcion: texto }, false);
    expect(rechazos).toEqual([]);
    expect(advertencias.map(a => a.codigo).sort()).toEqual(['POSIBLE_CORREO', 'POSIBLE_DOCUMENTO', 'POSIBLE_TELEFONO']);
    expect(evaluarTextoLibre({ descripcion: texto }, false)).toHaveLength(3);
  });
  test('analiza la descripción y las medidas, e indica el campo', () => {
    const { rechazos } = analizarTextos({ descripcion: 'Texto limpio', medidas: 'Escribir a x@y.pe' }, true);
    expect(rechazos).toEqual([{ codigo: 'POSIBLE_CORREO', campo: 'medidas' }]);
    expect(() => evaluarTextoLibre({ descripcion: 'limpio', medidas: 'x@y.pe' }, true)).toThrow(expect.objectContaining({ detalles: [{ campo: 'medidas', motivo: expect.any(String) }] }));
  });
  test('los campos ausentes o vacíos no se analizan', () => {
    expect(analizarTextos({ descripcion: null, medidas: undefined }, true)).toEqual({ rechazos: [], advertencias: [] });
    expect(analizarTextos({ descripcion: '' }, true)).toEqual({ rechazos: [], advertencias: [] });
  });
});

describe('privacidad de la función y de los mensajes', () => {
  test('el resultado no contiene el texto analizado', () => {
    const texto = 'Mi teléfono es 981 234 567 y mi correo juan.perez@correo.com';
    expect(JSON.stringify(analizarTextos({ descripcion: texto }, true))).not.toMatch(/981|juan|perez|correo\.com/);
    expect(JSON.stringify(evaluarTextoLibre({ descripcion: texto }, false))).not.toMatch(/981|juan|perez|correo\.com/);
  });
  test('ningún mensaje afirma que el texto esté protegido, verificado o seguro (CA-DAT-06)', () => {
    for (const mensaje of Object.values(mensajesDeDeteccion)) {
      expect(mensaje).not.toMatch(/protegid|verificad|segur|garantiz[ao]\b(?! quién)|cifrad|privad/i);
      expect(mensaje).toMatch(/no puede garantizar/);
    }
  });
  test('la detección es independiente del estado: no usa expresiones con estado entre llamadas', () => {
    for (let i = 0; i < 4; i += 1) expect(codigos('Llámame al 981 234 567')).toEqual(['POSIBLE_TELEFONO']);
    for (let i = 0; i < 4; i += 1) expect(codigos('escríbeme a juan@correo.com')).toContain('POSIBLE_CORREO');
  });
});
