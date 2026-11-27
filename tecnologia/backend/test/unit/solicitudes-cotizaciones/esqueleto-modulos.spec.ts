import { describe, expect, test } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// T026 y T027: los esqueletos de Solicitudes y Cotizaciones respetan sus fronteras. Complementa las reglas de dependency-cruiser (prueba de arquitectura)
// con una comprobación directa de lo que importa cada archivo.
const archivos = (modulo: string) => readdirSync(resolve('src/modulos', modulo), { recursive: true }).map(String).map(f => f.replaceAll('\\', '/')).filter(f => f.endsWith('.ts'));
const importaciones = (modulo: string, archivo: string): string[] => [...readFileSync(resolve('src/modulos', modulo, archivo), 'utf8').matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/g)].map(m => m[1]!);
/** Resuelve una importación relativa a una ruta dentro de `src/` para saber a qué módulo pertenece. */
const destino = (modulo: string, archivo: string, ruta: string) => resolve('src/modulos', modulo, archivo, '..', ruta).replaceAll('\\', '/').split('/src/')[1]!;

describe('Solicitudes', () => {
  const apisPermitidas = new Set(['modulos/catalogo/api-publica.js', 'modulos/prestadores/api-publica.js', 'modulos/notificaciones/api-publica.js', 'modulos/usuarios-acceso/api-publica.js']);
  test('solo importa su propio código, lo compartido y la api-publica de Catálogo, Prestadores, Notificaciones y Usuarios y acceso', () => {
    for (const archivo of archivos('solicitudes')) for (const ruta of importaciones('solicitudes', archivo)) {
      const d = destino('solicitudes', archivo, ruta);
      const permitido = d.startsWith('modulos/solicitudes/') || d.startsWith('compartido/') || apisPermitidas.has(d) || /^composicion\/identidad-002\.js$/.test(d);
      expect([archivo, ruta, permitido]).toEqual([archivo, ruta, true]);
    }
  });
  test('su dominio no depende de otros módulos, de la aplicación, de la infraestructura ni del framework', () => {
    for (const archivo of archivos('solicitudes').filter(f => f.startsWith('dominio/'))) {
      const texto = readFileSync(resolve('src/modulos/solicitudes', archivo), 'utf8');
      expect(texto).not.toMatch(/from\s+['"](?:@nestjs|typeorm|pg|sharp|@aws-sdk)/);
      for (const ruta of importaciones('solicitudes', archivo)) {
        const d = destino('solicitudes', archivo, ruta);
        expect([archivo, ruta, d.startsWith('modulos/solicitudes/dominio/') || d.startsWith('compartido/dominio/')]).toEqual([archivo, ruta, true]);
      }
    }
  });
  test('su api-publica expone solo contratos de lectura y tipos, sin rutas HTTP ni repositorios', () => {
    const texto = readFileSync(resolve('src/modulos/solicitudes/api-publica.ts'), 'utf8');
    expect(texto).not.toMatch(/@Controller|@Get|@Post|infraestructura|Repositorio/);
    expect(texto).toMatch(/resumenes\(/); expect(texto).toMatch(/bloquearCompartido\(/); expect(texto).toMatch(/esClienteDe\(/);
  });
});

describe('Cotizaciones', () => {
  test('solo importa de otro módulo la api-publica de Solicitudes', () => {
    for (const archivo of archivos('cotizaciones')) for (const ruta of importaciones('cotizaciones', archivo)) {
      const d = destino('cotizaciones', archivo, ruta);
      const permitido = d.startsWith('modulos/cotizaciones/') || d.startsWith('compartido/') || d === 'modulos/solicitudes/api-publica.js';
      expect([archivo, ruta, permitido]).toEqual([archivo, ruta, true]);
    }
  });
  test('consume realmente a Solicitudes por su api-publica', () => {
    const consumidores = archivos('cotizaciones').filter(a => importaciones('cotizaciones', a).some(r => destino('cotizaciones', a, r) === 'modulos/solicitudes/api-publica.js'));
    expect(consumidores).toEqual(['aplicacion/puertos/solicitudes.ts']);
  });
  test('su api-publica declara las lecturas de autoría y la lectura de la cotización vigente, sin rutas ni repositorios concretos', () => {
    const texto = readFileSync(resolve('src/modulos/cotizaciones/api-publica.ts'), 'utf8');
    expect(texto).not.toMatch(/@Controller|infraestructura/);
    for (const nombre of ['autoresNoRetirados', 'solicitudesConCotizacionNoRetirada', 'tieneNoRetirada', 'obtenerVigente']) expect(texto).toContain(nombre);
  });
});

describe('Solicitudes no conoce a Cotizaciones', () => {
  test('ningún archivo de Solicitudes menciona el módulo Cotizaciones en una importación', () => {
    for (const archivo of archivos('solicitudes')) expect(readFileSync(resolve('src/modulos/solicitudes', archivo), 'utf8')).not.toMatch(/from\s+['"][^'"]*\/cotizaciones\//);
  });
});
