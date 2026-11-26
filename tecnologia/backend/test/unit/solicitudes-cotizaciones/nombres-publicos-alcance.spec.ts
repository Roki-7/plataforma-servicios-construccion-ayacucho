import { describe, expect, test } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registroOferta003 } from '../../../src/composicion/oferta-003.js';

// `nombresPublicos` (Prestadores) es una lectura interna: no filtra por `publicable` ni conoce al solicitante. Hasta T084 nadie debe consumirla y, cuando
// se consuma, solo desde casos de uso que ya verificaron el título de acceso, nunca desde un controlador. Esta prueba vigila la exposición prematura.
const fuentes = readdirSync(resolve('src'), { recursive: true }).map(String).map(f => f.replaceAll('\\', '/')).filter(f => f.endsWith('.ts'));
const usan = fuentes.filter(f => readFileSync(resolve('src', f), 'utf8').includes('nombresPublicos'));

describe('alcance de nombresPublicos', () => {
  test('solo aparece en el módulo Prestadores que la define: ningún caso de uso, adaptador ni controlador de la 003 la consume todavía', () => {
    expect(usan.sort()).toEqual([
      'modulos/prestadores/api-publica.ts',
      'modulos/prestadores/aplicacion/puertos/puertos.ts',
      'modulos/prestadores/infraestructura/persistencia/perfiles-y-portafolio.ts',
    ]);
  });
  test('ningún controlador ni archivo de presentación de ningún módulo la referencia', () => {
    expect(usan.filter(f => /presentacion|\.controller\.ts$/.test(f))).toEqual([]);
  });
  test('la composición de la 003 aún no registra ninguna ruta HTTP, así que no hay exposición posible', () => {
    expect(registroOferta003().controladores).toEqual([]);
  });
  test('la API documenta que es de uso interno y que el llamador debe verificar el título de acceso', () => {
    const texto = readFileSync(resolve('src/modulos/prestadores/api-publica.ts'), 'utf8');
    expect(texto).toMatch(/USO INTERNO/);
    expect(texto).toMatch(/título de acceso/);
  });
});
