/* global __ENV, open */
// T081 · Escenario k6 de la 002 (EQ-01/PR01 y base de EQ-03/PR03): búsqueda y consulta de la oferta pública con 1 000 prestadores y 5 000 servicios ficticios.
//
// Qué hace: cada usuario virtual recorre un trayecto reproducible (categorías → búsqueda de servicios → página siguiente → detalle → perfil del prestador → búsqueda de
// prestadores → perfil) con una pausa de 3 a 8 s entre peticiones. La mezcla sale de un generador sembrado (mulberry32), de modo que la misma semilla y el mismo número de
// usuario repiten las mismas consultas. Cada respuesta se comprueba contra el manifiesto que calcula `carga.ts` con las reglas de visibilidad de las consultas públicas
// (total, tamaño de página, orden, estados, categorías admitidas, 404 de lo no disponible, avisos de 011/012 y ausencia de datos personales).
//
// Etiquetas: cada petición lleva `name` (plantilla de ruta sin identificadores) y `operacion`; el `url` completo se excluye de las etiquetas del sistema, así que ningún
// identificador de servicio, prestador o consulta llega a las métricas.
//
// Ejecución (la prepara `ejecutar-e2e-002.mjs --carga`, con una base, un bucket y un espacio Redis descartables):
//   (T083: ORIGEN=https://localhost:8446 es el balanceador de réplicas del ensayo EQ-03/PR03.)
//   k6 run -e CARGA_002=true -e ORIGEN=https://localhost:8444 -e MANIFIESTO=<manifiesto.json> -e RESUMEN=<resumen.json> -e PERFIL=humo|nominal|ensayo-rapido test/performance/prestadores-catalogo.k6.js
//
// Cobertura POSTERIOR (no incluida aquí): las 10 000 solicitudes del escenario integral de EQ-01 y las comparaciones de cotizaciones requieren funcionalidades posteriores a la 002.
import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const origen = __ENV.ORIGEN || 'https://localhost:8444';
if (__ENV.CARGA_002 !== 'true' || !['https://localhost:8444', 'https://localhost:8446', 'http://127.0.0.1:3002'].includes(origen)) {
  throw new Error('Se requiere el entorno de carga descartable de la 002 (ejecutar-e2e-002.mjs --carga) y un origen local de la 002.');
}
if (!__ENV.MANIFIESTO) throw new Error('Falta MANIFIESTO (el manifiesto de resultados esperados).');
const api = origen + '/api/v1';
const manifiesto = new SharedArray('manifiesto-carga-002', () => [JSON.parse(open(__ENV.MANIFIESTO))])[0];
const semilla = Number(__ENV.SEMILLA || manifiesto.semilla);
const tamano = manifiesto.tamanoPagina;
// Control negativo (solo para verificar el escenario): desplaza en 1 el total esperado; la corrida DEBE fallar por corrección.
const sesgo = __ENV.CONTROL_NEGATIVO === 'true' ? 1 : 0;
// Muestras del manifiesto por tipo de resultado esperado: servicios visibles y no disponibles; perfiles publicables y no publicables.
const visiblesDeMuestra = manifiesto.detalleServicios.filter((x) => x[2]); const ocultos = manifiesto.detalleServicios.filter((x) => !x[2]);
const perfilesPublicables = manifiesto.perfiles.filter((x) => x[1] >= 0); const perfilesNoPublicables = manifiesto.perfiles.filter((x) => x[1] < 0);

const perfil = __ENV.PERFIL || 'humo';
const perfiles = {
  // Verificación del escenario: pocos usuarios con las pausas reales de 3 a 8 s.
  humo: { executor: 'constant-vus', vus: Number(__ENV.VUS || 5), duration: __ENV.DURACION || '90s' },
  // Corrida nominal de EQ-01 (T082): 50 usuarios virtuales durante 15 minutos.
  nominal: { executor: 'constant-vus', vus: Number(__ENV.VUS || 50), duration: __ENV.DURACION || '15m' },
  // Solo para comprobar la corrección de todas las rutas en segundos: pausas de 0,2 a 0,6 s. NO es representativo de carga.
  'ensayo-rapido': { executor: 'per-vu-iterations', vus: Number(__ENV.VUS || 3), iterations: Number(__ENV.ITERACIONES || 6), maxDuration: '5m' },
};
if (!perfiles[perfil]) throw new Error('PERFIL no válido: humo, nominal o ensayo-rapido.');
const pausaRapida = perfil === 'ensayo-rapido';

const operaciones = ['categorias', 'busqueda_servicios', 'busqueda_servicios_pagina', 'busqueda_prestadores', 'detalle_servicio', 'detalle_servicio_no_disponible', 'perfil_prestador', 'perfil_prestador_no_publicable'];
let fallosRegistrados = 0;
const correccion = new Rate('correccion');
const erroresTecnicos = new Rate('errores_tecnicos');
const thresholds = { http_req_failed: ['rate<0.01'], errores_tecnicos: ['rate<0.01'], correccion: ['rate==1'] };
for (const o of operaciones) { thresholds[`http_req_duration{operacion:${o}}`] = ['p(95)<2000']; thresholds[`correccion{operacion:${o}}`] = ['rate==1']; }

export const options = {
  scenarios: { oferta_publica: { ...perfiles[perfil], exec: 'trayecto', tags: { escenario: __ENV.ESCENARIO || perfil } } },
  thresholds,
  // Sin `url` entre las etiquetas del sistema: los identificadores y las consultas no se convierten en series de métricas.
  systemTags: ['status', 'method', 'name', 'scenario', 'check', 'error', 'error_code', 'expected_response'],
  summaryTrendStats: ['count', 'avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  insecureSkipTLSVerify: false,
};

/** Generador pseudoaleatorio sembrado (mismo algoritmo que `carga.ts`). */
function mulberry32(a) { let s = a >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const elegir = (azar, lista) => lista[Math.floor(azar() * lista.length)];
/** Pausa de 3 a 8 s entre peticiones (perfil rápido: 0,2 a 0,6 s). */
function pausar(azar) { sleep(pausaRapida ? 0.2 + azar() * 0.4 : 3 + azar() * 5); }

const privado = /correo|contrasena|contraseña|documento|direcci[oó]n|tel[eé]fono|token|cuentaId|@example/i;
function tecnico(res) { erroresTecnicos.add(res.status === 0 || res.status >= 500 || res.status === 429); }
function pedir(ruta, nombre, operacion, esperado) {
  const res = http.get(api + ruta, { tags: { name: nombre, operacion }, responseCallback: http.expectedStatuses(esperado), headers: { Accept: 'application/json' } });
  tecnico(res); return res;
}
/** Aserciones de una operación: todas cuentan para la tasa de corrección etiquetada por operación. */
function comprobar(res, operacion, reglas) {
  const resultados = check(res, reglas, { operacion });
  correccion.add(resultados, { operacion });
  // Diagnóstico: una comprobación fallida deja una línea con la operación, el estado, la duración y la hora (sin identificadores ni contenido); hasta 5 por usuario virtual.
  if (!resultados && fallosRegistrados++ < 5) console.warn(JSON.stringify({ evento: 'comprobacion_fallida', operacion, estado: res.status, duracion_ms: Math.round(res.timings.duration), hora: new Date().toISOString() }));
  return resultados;
}
const json = (res) => { try { return res.json(); } catch { return null; } };
const sinDatosPrivados = (res) => !privado.test(res.body || '');
const cuerpoPaginado = (c, total, enPagina, pagina) => c && c.total === total + sesgo && c.pagina === pagina && c.tamano === tamano && Array.isArray(c.elementos) && c.elementos.length === enPagina;

export function setup() {
  const salud = http.get(api + '/salud', { tags: { name: 'GET /salud', operacion: 'preparacion' } });
  if (salud.status !== 200) throw new Error('La API de la 002 no responde en ' + origen + '.');
  const todas = http.get(api + '/servicios?tamano=1', { tags: { name: 'GET /servicios', operacion: 'preparacion' } });
  const c = json(todas);
  if (!c || c.total !== manifiesto.busquedaServicios[0].total) throw new Error('La base no contiene el conjunto de carga esperado (total de servicios visibles distinto del manifiesto).');
  return { semilla };
}

function categorias() {
  const res = pedir('/categorias', 'GET /categorias', 'categorias', 200); const c = json(res);
  comprobar(res, 'categorias', { 'categorías 200': (r) => r.status === 200, 'categorías vigentes del manifiesto': () => !!c && Array.isArray(c.categorias) && c.categorias.length === manifiesto.categoriasPublicas, 'sin datos privados': sinDatosPrivados });
}

function buscarServicios(esperada, pagina, operacion) {
  const enPagina = Math.max(0, Math.min(tamano, esperada.total - (pagina - 1) * tamano));
  const ruta = '/servicios?' + (esperada.consulta ? esperada.consulta + '&' : '') + 'pagina=' + pagina + '&tamano=' + tamano;
  const res = pedir(ruta, 'GET /servicios', operacion, 200); const c = json(res);
  comprobar(res, operacion, {
    'búsqueda de servicios 200': (r) => r.status === 200,
    'total, página y tamaño esperados': () => cuerpoPaginado(c, esperada.total, enPagina, pagina),
    'solo servicios PUBLICADOS': () => !!c && Array.isArray(c.elementos) && c.elementos.every((e) => e.estado === 'PUBLICADO'),
    'categorías admitidas por el filtro': () => !!c && Array.isArray(c.elementos) && (esperada.categoriasValidas.length === 0 || c.elementos.every((e) => esperada.categoriasValidas.indexOf(e.categoriaId) >= 0)),
    'orden estable por identificador': () => !!c && Array.isArray(c.elementos) && c.elementos.every((e, i) => i === 0 || c.elementos[i - 1].servicioId < e.servicioId),
    'sin datos privados': sinDatosPrivados,
  });
  return c && c.elementos ? c.elementos : [];
}

function buscarPrestadores(esperada, pagina) {
  const enPagina = Math.max(0, Math.min(tamano, esperada.total - (pagina - 1) * tamano));
  const ruta = '/prestadores?' + (esperada.consulta ? esperada.consulta + '&' : '') + 'pagina=' + pagina + '&tamano=' + tamano;
  const res = pedir(ruta, 'GET /prestadores', 'busqueda_prestadores', 200); const c = json(res);
  comprobar(res, 'busqueda_prestadores', {
    'búsqueda de prestadores 200': (r) => r.status === 200,
    'total, página y tamaño esperados': () => cuerpoPaginado(c, esperada.total, enPagina, pagina),
    'orden por nombre': () => !!c && Array.isArray(c.elementos) && c.elementos.every((e, i) => i === 0 || c.elementos[i - 1].nombrePublico.toLowerCase() <= e.nombrePublico.toLowerCase()),
    'solo campos públicos': () => !!c && Array.isArray(c.elementos) && c.elementos.every((e) => Object.keys(e).sort().join(',') === 'disponibilidadDeclarada,distritos,especialidadesIds,nombrePublico,prestadorId,tipo'),
    'sin datos privados': sinDatosPrivados,
  });
  return c && c.elementos ? c.elementos : [];
}

function detalle(id, visible) {
  const operacion = visible ? 'detalle_servicio' : 'detalle_servicio_no_disponible';
  const res = pedir('/servicios/' + id, 'GET /servicios/{id}', operacion, visible ? 200 : 404); const c = json(res);
  comprobar(res, operacion, visible
    ? { 'detalle 200': (r) => r.status === 200, 'detalle del servicio pedido y publicado': () => !!c && c.servicioId === id && c.estado === 'PUBLICADO', 'sin datos privados': sinDatosPrivados }
    : { 'servicio no disponible: 404': (r) => r.status === 404, 'error RECURSO_NO_DISPONIBLE sin revelar el estado': () => !!c && c.codigo === 'RECURSO_NO_DISPONIBLE' && !/PAUSADO|RETIRADO/.test(res.body) });
}

function perfilPrestador(id, serviciosVisibles) {
  const publicable = serviciosVisibles >= 0; const operacion = publicable ? 'perfil_prestador' : 'perfil_prestador_no_publicable';
  const res = pedir('/prestadores/' + id + '?pagina=1&tamano=' + tamano, 'GET /prestadores/{id}', operacion, publicable ? 200 : 404); const c = json(res);
  comprobar(res, operacion, publicable
    ? { 'perfil 200': (r) => r.status === 200, 'perfil del prestador pedido': () => !!c && c.prestadorId === id, 'servicios visibles esperados': () => !!c && !!c.servicios && c.servicios.total === serviciosVisibles,
      'avisos independientes de 011 y 012': () => !!c && !!c.avisos && c.avisos.calificaciones === 'Calificaciones aún no disponibles' && c.avisos.verificaciones === 'Verificaciones aún no disponibles', 'sin datos privados': sinDatosPrivados }
    : { 'perfil no publicable: 404': (r) => r.status === 404, 'error RECURSO_NO_DISPONIBLE': () => !!c && c.codigo === 'RECURSO_NO_DISPONIBLE' });
}

/** Un trayecto de usuario: mismas decisiones para la misma semilla, usuario virtual e iteración. */
export function trayecto() {
  const azar = mulberry32(semilla + exec.vu.idInTest * 104729 + exec.scenario.iterationInInstance * 7919);
  categorias(); pausar(azar);
  const esperada = elegir(azar, manifiesto.busquedaServicios); const elementos = buscarServicios(esperada, 1, 'busqueda_servicios'); pausar(azar);
  if (esperada.paginas > 1 && azar() < 0.5) { buscarServicios(esperada, 2 + Math.floor(azar() * (Math.min(esperada.paginas, 5) - 1)), 'busqueda_servicios_pagina'); pausar(azar); }
  // Detalle: normalmente de un resultado recién mostrado; a veces un servicio ya no disponible (pausado, retirado o de clasificación inactiva).
  const sorteo = azar();
  if (sorteo < 0.12) detalle(elegir(azar, ocultos)[0], false);
  else if (elementos.length > 0 && sorteo < 0.9) detalle(elegir(azar, elementos).servicioId, true);
  else detalle(elegir(azar, visiblesDeMuestra)[0], true);
  pausar(azar);
  const [idPerfil, visibles] = azar() < 0.08 ? elegir(azar, perfilesNoPublicables) : elegir(azar, perfilesPublicables); perfilPrestador(idPerfil, visibles); pausar(azar);
  if (azar() < 0.4) {
    const p = elegir(azar, manifiesto.busquedaPrestadores); const encontrados = buscarPrestadores(p, 1); pausar(azar);
    if (encontrados.length > 0) { const e = encontrados[Math.floor(azar() * encontrados.length)]; const conocido = manifiesto.perfiles.find((x) => x[0] === e.prestadorId); if (conocido) { perfilPrestador(conocido[0], conocido[1]); pausar(azar); } }
  }
}

/** Resumen por operación (p95, errores, corrección, RPS) en JSON y una tabla breve en pantalla. */
export function handleSummary(datos) {
  const m = datos.metrics; const valor = (clave, estadistico) => (m[clave] && m[clave].values ? m[clave].values[estadistico] : null);
  const segundos = (datos.state && datos.state.testRunDurationMs ? datos.state.testRunDurationMs : 0) / 1000;
  const porOperacion = {};
  for (const o of operaciones) {
    const duracion = `http_req_duration{operacion:${o}}`;
    const n = valor(duracion, 'count') || 0;
    porOperacion[o] = { peticiones: n, rps: segundos > 0 ? n / segundos : 0, p95_ms: valor(duracion, 'p(95)'), p99_ms: valor(duracion, 'p(99)'), media_ms: valor(duracion, 'avg'), max_ms: valor(duracion, 'max'), correccion: valor(`correccion{operacion:${o}}`, 'rate') };
  }
  const resumen = {
    escenario: 'prestadores-catalogo', perfil, origen, semilla, duracion_s: segundos, manifiesto: manifiesto.conteos, categoriasPublicas: manifiesto.categoriasPublicas, coberturaPosterior: manifiesto.coberturaPosterior,
    global: { peticiones: valor('http_reqs', 'count'), rps: valor('http_reqs', 'rate'), p95_ms: valor('http_req_duration', 'p(95)'), p99_ms: valor('http_req_duration', 'p(99)'), fallos_http: valor('http_req_failed', 'rate'), errores_tecnicos: valor('errores_tecnicos', 'rate'), correccion: valor('correccion', 'rate'), iteraciones: valor('iterations', 'count') },
    porOperacion, umbrales: Object.fromEntries(Object.entries(datos.metrics).filter(([, v]) => v.thresholds).map(([k, v]) => [k, Object.fromEntries(Object.entries(v.thresholds).map(([t, x]) => [t, x.ok]))])),
  };
  const filas = operaciones.map((o) => { const x = porOperacion[o]; return `  ${o.padEnd(32)} n=${String(x.peticiones).padStart(5)}  p95=${x.peticiones === 0 || x.p95_ms === null ? '-' : x.p95_ms.toFixed(0).padStart(5)} ms  correccion=${x.peticiones === 0 || x.correccion === null ? '-' : x.correccion}`; });
  const salida = { stdout: `\nEscenario ${perfil} · ${resumen.global.peticiones} peticiones · p95 global ${resumen.global.p95_ms === null ? '-' : resumen.global.p95_ms.toFixed(0)} ms · errores técnicos ${resumen.global.errores_tecnicos}\n${filas.join('\n')}\n` };
  if (__ENV.RESUMEN) salida[__ENV.RESUMEN] = JSON.stringify(resumen, null, 2);
  return salida;
}
