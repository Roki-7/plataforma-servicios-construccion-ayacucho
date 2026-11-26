import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test, expect } from './soporte.js';

/**
 * T075 · Aislamiento entre corridas. Esta prueba CREA datos persistentes ficticios (una cuenta y una categoría) en la base DESCARTABLE de la ejecución.
 * El ejecutor retira esa base al terminar, de modo que la corrida siguiente vuelve a empezar desde la semilla exacta (seis clasificaciones y el operador
 * ficticio) sin que quede rastro; la validación local no se toca. T076 a T079 heredan este mismo mecanismo.
 */
const origen = 'https://localhost:8444';
const semilla = ['Construcción', 'Albañilería', 'Electricidad', 'Acabados', 'Pintura', 'Obsoleta'];
interface CategoriaAdmin { categoriaId: string; nombre: string; activaPropia: boolean }

test('crea datos ficticios en la base descartable sin alterar la semilla', async ({ request, registroDispositivo }, testInfo) => {
  const ruta = process.env['E2E_OPERADOR_002'];
  expect(ruta, 'El ejecutor debe aportar la credencial del operador ficticio de la base descartable.').toBeTruthy();
  const operador = JSON.parse(await readFile(ruta!, 'utf8')) as { correo: string; contrasena: string };
  const cabeceras = (clave?: string) => ({ origin: origen, ...(clave ? { 'idempotency-key': clave } : {}) });

  const sesion = await request.post('/api/v1/sesiones', { headers: cabeceras(), data: { correo: operador.correo, contrasena: operador.contrasena } });
  expect(sesion.status()).toBe(200);
  const autorizacion = { authorization: `Bearer ${((await sesion.json()) as { tokenAcceso: string }).tokenAcceso}` };
  const listar = async () => {
    const r = await request.get('/api/v1/admin/categorias', { headers: autorizacion });
    expect(r.status()).toBe(200);
    return ((await r.json()) as { categorias: CategoriaAdmin[] }).categorias;
  };

  // Estado inicial: la semilla determinista, presente y sin alteraciones.
  const antes = await listar();
  for (const nombre of semilla) expect(antes.map((c) => c.nombre), `falta la categoría de semilla ${nombre}`).toContain(nombre);

  // Datos ficticios únicos de esta ejecución y de este proyecto.
  const nombre = `Aislamiento ${registroDispositivo.ejecucion.slice(0, 8)} ${testInfo.project.name}`;
  const crear = await request.post('/api/v1/admin/categorias', { headers: { ...autorizacion, ...cabeceras(randomUUID()) }, data: { nombre, motivo: 'Prueba de aislamiento entre corridas (T075)' } });
  expect(crear.status()).toBe(201);
  const correo = `e2e-002-${randomUUID()}@example.invalid`; const contrasena = `${randomUUID()} ficticia`;
  const alta = await request.post('/api/v1/cuentas', { headers: cabeceras(randomUUID()), data: { nombreMostrar: 'Cuenta ficticia de aislamiento', correo, contrasena, confirmacionContrasena: contrasena, perfiles: ['prestador'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: '001-v1' } });
  expect(alta.status()).toBe(201);

  // Los cambios son visibles dentro de la ejecución; la semilla sigue intacta.
  const despues = await listar();
  expect(despues).toHaveLength(antes.length + 1);
  expect(despues.map((c) => c.nombre)).toContain(nombre);
  for (const nombreSemilla of semilla) expect(despues.map((c) => c.nombre)).toContain(nombreSemilla);
});
