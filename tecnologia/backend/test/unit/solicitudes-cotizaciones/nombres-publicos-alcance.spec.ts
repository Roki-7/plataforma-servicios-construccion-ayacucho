import { describe, expect, test } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registroOferta003 } from '../../../src/composicion/oferta-003.js';

// `nombresPublicos` (Prestadores) es una lectura interna: no filtra por `publicable` ni conoce al solicitante. Desde T084 tiene UN consumidor legítimo: los casos de uso de
// Cotizaciones que ya verificaron que quien pregunta es el cliente dueño de la solicitud y que pasan solo los autores de cotizaciones de ESA solicitud. La composición solo
// conecta el puerto con la API de Prestadores. Nunca desde un controlador. Esta prueba vigila que no aparezcan otros consumidores ni exposición HTTP directa.
const fuentes = readdirSync(resolve('src'), { recursive: true }).map(String).map(f => f.replaceAll('\\', '/')).filter(f => f.endsWith('.ts'));
const usan = fuentes.filter(f => readFileSync(resolve('src', f), 'utf8').includes('nombresPublicos'));
const leer = (ruta: string) => readFileSync(resolve('src', ruta), 'utf8');

describe('alcance de nombresPublicos', () => {
  test('solo aparece en Prestadores (que la define), en el puerto y el caso de uso de Cotizaciones, y en el adaptador de composición', () => {
    expect(usan.sort()).toEqual([
      'composicion/cotizaciones-003.ts',
      'modulos/cotizaciones/aplicacion/cotizaciones.ts',
      'modulos/cotizaciones/aplicacion/puertos/entorno.ts',
      'modulos/prestadores/api-publica.ts',
      'modulos/prestadores/aplicacion/puertos/puertos.ts',
      'modulos/prestadores/infraestructura/persistencia/perfiles-y-portafolio.ts',
    ]);
  });
  test('ningún controlador ni archivo de presentación de ningún módulo la referencia', () => {
    expect(usan.filter(f => /presentacion|\.controller\.ts$/.test(f))).toEqual([]);
  });
  test('el caso de uso la llama solo tras comprobar la titularidad del cliente dueño y con los autores de cotizaciones de esa solicitud', () => {
    const texto = leer('modulos/cotizaciones/aplicacion/cotizaciones.ts');
    expect([...texto.matchAll(/nombres\.nombresPublicos\(/g)]).toHaveLength(2);
    const lista = texto.slice(texto.indexOf('async listarDeSolicitud'), texto.indexOf('private async participante'));
    expect(lista.indexOf('esClienteDe(')).toBeGreaterThan(-1);
    expect(lista.indexOf('esClienteDe(')).toBeLessThan(lista.indexOf('nombres.nombresPublicos('));
    expect(lista).toMatch(/elementos\.map\(c => c\.prestadorId\)/);
    const detalle = texto.slice(texto.indexOf('async obtener('), texto.indexOf('// ─── HU11'));
    expect(detalle).toMatch(/esDueno \? \(await this\.d\.nombres\.nombresPublicos\(\[cotizacion\.prestadorId\]\)\)/);
  });
  test('la composición solo conecta el puerto con Prestadores, sin lógica de acceso', () => {
    const texto = leer('composicion/cotizaciones-003.ts');
    expect(texto).toMatch(/nombres: \{ nombresPublicos: ids => prestadores\.nombresPublicos\(ids\) \}/);
    expect([...texto.matchAll(/nombresPublicos/g)]).toHaveLength(2);
  });
  test('sin las opciones de las historias, la composición base no registra ninguna ruta HTTP', () => {
    expect(registroOferta003().controladores).toEqual([]);
  });
  test('la API documenta que es de uso interno y que el llamador debe verificar el título de acceso', () => {
    const texto = leer('modulos/prestadores/api-publica.ts');
    expect(texto).toMatch(/USO INTERNO/);
    expect(texto).toMatch(/título de acceso/);
  });
});
