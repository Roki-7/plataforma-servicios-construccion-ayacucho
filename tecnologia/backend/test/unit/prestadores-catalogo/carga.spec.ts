import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cargaNominal002, distritosCarga, generarCarga002, mulberry32, tiposCarga } from '../../soporte/prestadores-catalogo/carga.js';

/** T081 · El conjunto de carga es determinista y válido, y el escenario k6 conserva sus garantías (etiquetas sin identificadores, pausas de 3 a 8 s, corrección por operación). */
const uuid = /^00000000-0000-4000-8000-\d{12}$/;

describe('conjunto de carga de la 002', () => {
  const carga = generarCarga002();

  test('contiene 1 000 prestadores y 5 000 servicios con identificadores únicos y válidos', () => {
    expect(carga.prestadores).toHaveLength(1000); expect(carga.servicios).toHaveLength(5000);
    expect(new Set(carga.prestadores.map((p) => p.id)).size).toBe(1000); expect(new Set(carga.servicios.map((s) => s.id)).size).toBe(5000);
    expect([...carga.prestadores.map((p) => p.id), ...carga.servicios.map((s) => s.id), ...carga.categorias.map((c) => c.id), ...carga.trabajos.map((t) => t.id)].every((id) => uuid.test(id))).toBe(true);
    expect(carga.manifiesto.conteos).toMatchObject({ prestadores: 1000, servicios: 5000 });
    expect(carga.servicios.filter((s) => s.prestadorId === carga.prestadores[0]!.id)).toHaveLength(5);
  });

  test('es determinista: la misma semilla repite todo y otra semilla cambia el conjunto', () => {
    expect(generarCarga002(cargaNominal002)).toEqual(carga);
    expect(generarCarga002({ ...cargaNominal002, semilla: 7 }).manifiesto.conteos.serviciosVisibles).not.toBe(carga.manifiesto.conteos.serviciosVisibles);
    const a = mulberry32(42); const b = mulberry32(42); expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test('relaciones y estados válidos: categorías existentes, jerarquía de dos niveles, estados permitidos y valores del contrato', () => {
    const categorias = new Map(carga.categorias.map((c) => [c.id, c])); const prestadores = new Set(carga.prestadores.map((p) => p.id));
    expect(carga.servicios.every((s) => categorias.has(s.categoriaId) && prestadores.has(s.prestadorId) && ['PUBLICADO', 'PAUSADO', 'RETIRADO'].includes(s.estado))).toBe(true);
    expect(carga.categorias.filter((c) => c.nivel === 2).every((c) => categorias.get(c.padreId!)?.nivel === 1)).toBe(true);
    expect(carga.prestadores.every((p) => (tiposCarga as readonly string[]).includes(p.tipo) && p.distritos.length >= 1 && p.distritos.length <= 3 && p.distritos.every((d) => (distritosCarga as readonly string[]).includes(d)) && p.especialidades.length >= 1 && p.especialidades.every((e) => categorias.has(e)))).toBe(true);
    // Hay variedad de estados y casos de exclusión (pausados, retirados, clasificación inactiva y prestadores no publicables).
    const c = carga.manifiesto.conteos; expect(c.serviciosPausados).toBeGreaterThan(0); expect(c.serviciosRetirados).toBeGreaterThan(0); expect(c.serviciosVisibles).toBeLessThan(c.serviciosPublicados); expect(c.prestadoresPublicables).toBeLessThan(1000);
  });

  test('no contiene datos personales', () => {
    const texto = JSON.stringify([carga.prestadores, carga.servicios, carga.trabajos]);
    expect(texto).not.toMatch(/@|correo|contrase|tel[eé]fono|documento|direcci[oó]n/i);
  });

  test('los resultados esperados siguen las reglas de visibilidad de las consultas públicas', () => {
    const m = carga.manifiesto; const categorias = new Map(carga.categorias.map((c) => [c.id, c])); const prestadores = new Map(carga.prestadores.map((p) => [p.id, p]));
    const activa = (id: string): boolean => { const c = categorias.get(id)!; return c.activa && (c.nivel === 1 || categorias.get(c.padreId!)!.activa); };
    const visibles = carga.servicios.filter((s) => s.estado === 'PUBLICADO' && activa(s.categoriaId) && prestadores.get(s.prestadorId)!.publicable);
    expect(m.conteos.serviciosVisibles).toBe(visibles.length); expect(m.busquedaServicios[0]).toMatchObject({ consulta: '', total: visibles.length, paginas: Math.ceil(visibles.length / 20) });
    // Un servicio pausado, retirado, de clasificación inactiva o de prestador no publicable nunca cuenta; el perfil no publicable se marca con -1.
    for (const [id, , visible] of m.detalleServicios) expect(visibles.some((s) => s.id === id)).toBe(visible);
    for (const [id, n] of m.perfiles) expect(n).toBe(prestadores.get(id)!.publicable ? visibles.filter((s) => s.prestadorId === id).length : -1);
    expect(m.categoriasPublicas).toBe(4 + carga.categorias.filter((c) => activa(c.id)).length);
    // Una subcategoría con estado propio activo bajo una raíz inactiva queda inelegible: hay categorías de ese tipo en el conjunto.
    expect(carga.categorias.some((c) => c.activa && c.nivel === 2 && !activa(c.id))).toBe(true);
    expect(m.coberturaPosterior.join(' ')).toMatch(/10 000 solicitudes/); expect(m.coberturaPosterior.join(' ')).toMatch(/cotizaciones/);
  });
});

describe('escenario k6 de la 002', () => {
  const k6 = readFileSync(resolve(process.cwd(), 'test/performance/prestadores-catalogo.k6.js'), 'utf8');

  test('las etiquetas no incluyen la URL completa ni identificadores: cada petición lleva una plantilla de ruta y su operación', () => {
    expect(k6).toMatch(/systemTags: \['status', 'method', 'name', 'scenario', 'check', 'error', 'error_code', 'expected_response'\]/);
    expect(k6).not.toMatch(/systemTags:[^\]]*'url'/);
    for (const nombre of ['GET /categorias', 'GET /servicios', 'GET /servicios/{id}', 'GET /prestadores', 'GET /prestadores/{id}']) expect(k6).toContain(`'${nombre}'`);
    expect(k6).not.toMatch(/tags:\s*\{[^}]*(servicioId|prestadorId|cuentaId)/);
  });

  test('las pausas son de 3 a 8 segundos y la mezcla usa un generador sembrado', () => {
    expect(k6).toMatch(/sleep\(pausaRapida \? 0\.2 \+ azar\(\) \* 0\.4 : 3 \+ azar\(\) \* 5\)/);
    expect(k6).toContain('mulberry32(semilla + exec.vu.idInTest'); expect(k6).not.toMatch(/Math\.random/);
  });

  test('cada operación tiene umbral de p95 ≤ 2 s y de corrección total; los errores técnicos se limitan al 1 %; hay un control negativo', () => {
    expect(k6).toContain("http_req_duration{operacion:${o}}`] = ['p(95)<2000']"); expect(k6).toContain("correccion{operacion:${o}}`] = ['rate==1']");
    expect(k6).toContain("errores_tecnicos: ['rate<0.01']"); expect(k6).toContain('CONTROL_NEGATIVO');
    for (const o of ['categorias', 'busqueda_servicios', 'busqueda_servicios_pagina', 'busqueda_prestadores', 'detalle_servicio', 'detalle_servicio_no_disponible', 'perfil_prestador', 'perfil_prestador_no_publicable']) expect(k6).toContain(`'${o}'`);
  });

  test('el perfil nominal es el de EQ-01 (50 usuarios, 15 minutos) y la cobertura posterior queda declarada', () => {
    expect(k6).toMatch(/nominal: \{ executor: 'constant-vus', vus: Number\(__ENV\.VUS \|\| 50\), duration: __ENV\.DURACION \|\| '15m' \}/);
    expect(k6).toMatch(/10 000 solicitudes/); expect(k6).toMatch(/comparaciones de cotizaciones/);
  });
});
