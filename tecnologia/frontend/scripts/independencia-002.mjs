// Lógica pura, sin secretos ni acceso a Docker, del ejecutor de navegador 002 (T075).
// Solo maneja identidades (nombres y puertos): nunca contraseñas, claves ni cadenas de conexión completas.

/** Matriz del ejecutor de navegador 002: motores y anchos de viewport (T075). */
export const navegadores002 = Object.freeze(['chromium', 'firefox', 'webkit']);
export const anchos002 = Object.freeze([360, 768, 1366]);
export const origen002 = 'https://localhost:8444';

/** Identidad dedicada de la validación 002 (coincide con tecnologia/backend/scripts/entorno-002.ts). */
export const identidad002Esperada = Object.freeze({
  proyectoCompose: 'ayacucho-002-validacion', baseDatos: 'ayacucho_002_validacion', puertoBaseDatos: 54330,
  puertoRedis: 63800, espacioRedis: 'ayacucho:002:validacion', bucket: 'portafolio-002-validacion', puertoObjetos: 3910,
  puertoApi: 3002, puertoWeb: 5175, puertoSmtp: 1026, puertoCorreoWeb: 8026, origen: 'https://localhost:8444',
});

/** Referencia de la validación 001 (tecnologia/compose.yaml y dev:prepare). Solo se compara; nunca se usa. */
export const identidad001Referencia = Object.freeze({
  proyectoCompose: 'ayacucho-001-validacion', baseDatos: 'ayacucho_001_validacion', puertoBaseDatos: 54329,
  puertoRedis: 63799, espacioRedis: 'ayacucho:001:validacion', bucket: 'usuarios-validacion', puertoObjetos: 3900,
  puertoApi: 3000, puertoWeb: 5173, puertoSmtp: 1025, puertoCorreoWeb: 8025, origen: 'https://localhost:8443',
});

/** Puertos del proyecto descartable del ensayo de restauración (T071); tampoco pueden coincidir con los de la 002. */
export const puertosEnsayoRestauracion = Object.freeze([54341, 63851, 3930]);

/** Semilla determinista de la 002 (tecnologia/backend/src/composicion/semilla-002.ts). */
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const semillaClasificaciones = Object.freeze([
  { id: uuid(9001), nombre: 'Construcción', nivel: 1, padre: '', activa: true },
  { id: uuid(9002), nombre: 'Albañilería', nivel: 2, padre: uuid(9001), activa: true },
  { id: uuid(9003), nombre: 'Electricidad', nivel: 2, padre: uuid(9001), activa: false },
  { id: uuid(9004), nombre: 'Acabados', nivel: 1, padre: '', activa: true },
  { id: uuid(9005), nombre: 'Pintura', nivel: 2, padre: uuid(9004), activa: true },
  { id: uuid(9006), nombre: 'Obsoleta', nivel: 1, padre: '', activa: false },
]);

/** Interpreta un archivo .env (KEY=valor, con o sin comillas). */
export function leerEnv(texto) {
  const env = {};
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linea);
    if (!m) continue;
    env[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return env;
}

const puertoDe = (valor) => { try { const p = new URL(valor).port; return p ? Number(p) : undefined; } catch { return undefined; } };
const baseDe = (valor) => { try { return decodeURIComponent(new URL(valor).pathname.slice(1)); } catch { return undefined; } };

/** Extrae solo la identidad (sin credenciales) de un archivo de entorno de backend. */
export function identidadDesdeEnv(env) {
  return {
    baseDatos: baseDe(env['DATABASE_URL'] ?? ''), puertoBaseDatos: puertoDe(env['DATABASE_URL'] ?? ''),
    puertoRedis: puertoDe(env['REDIS_URL'] ?? ''), espacioRedis: env['REDIS_NAMESPACE'],
    bucket: env['S3_BUCKET'], puertoObjetos: puertoDe(env['S3_ENDPOINT'] ?? ''),
    puertoApi: env['PORT'] ? Number(env['PORT']) : undefined, puertoSmtp: env['SMTP_PORT'] ? Number(env['SMTP_PORT']) : undefined,
    origen: env['PUBLIC_ORIGIN'],
  };
}

const claves = ['baseDatos', 'puertoBaseDatos', 'puertoRedis', 'espacioRedis', 'bucket', 'puertoObjetos', 'puertoApi', 'puertoSmtp', 'origen'];

/**
 * Verifica que la configuración 002 usa exactamente sus recursos dedicados y que ninguno coincide con los de la 001
 * (si se aporta su entorno real; si no, con la referencia) ni con los del ensayo de restauración.
 * @returns {{ ok: boolean, problemas: string[], identidad002: Record<string, unknown>, referencia001: Record<string, unknown> }}
 */
export function validarIndependencia({ env002, env001 }) {
  const problemas = [];
  const actual = identidadDesdeEnv(env002);
  for (const k of claves) if (actual[k] !== identidad002Esperada[k]) problemas.push(`La configuración 002 no usa el recurso dedicado de ${k}.`);
  const otra = env001 ? { ...identidad001Referencia, ...Object.fromEntries(Object.entries(identidadDesdeEnv(env001)).filter(([, v]) => v !== undefined)) } : { ...identidad001Referencia };
  for (const k of [...claves, 'puertoWeb', 'puertoCorreoWeb']) {
    const v002 = k in actual && actual[k] !== undefined ? actual[k] : identidad002Esperada[k];
    if (v002 === otra[k]) problemas.push(`El recurso ${k} de la 002 coincide con el de la 001.`);
  }
  for (const k of ['puertoBaseDatos', 'puertoRedis', 'puertoObjetos']) if (puertosEnsayoRestauracion.includes(actual[k])) problemas.push(`El puerto ${k} de la 002 coincide con el del ensayo de restauración.`);
  if (new Set([actual.puertoApi, identidad002Esperada.puertoWeb, actual.puertoSmtp, identidad002Esperada.puertoCorreoWeb, actual.puertoBaseDatos, actual.puertoRedis, actual.puertoObjetos]).size !== 7) problemas.push('Hay puertos repetidos dentro de la propia 002.');
  return { ok: problemas.length === 0, problemas, identidad002: actual, referencia001: otra };
}

/** Convierte la salida de psql (`-tA -F '|'`) de las clasificaciones en filas. */
export function filasDeClasificaciones(salida) {
  return salida.split(/\r?\n/).filter(Boolean).map((l) => {
    const [id, nombre, nivel, padre, activa] = l.split('|');
    return { id, nombre, nivel: Number(nivel), padre: padre ?? '', activa: activa === 't' };
  });
}

/**
 * Verifica la semilla: las seis clasificaciones deterministas deben existir sin alteraciones.
 * Con `estricta` además no puede haber ninguna fila adicional (entorno limpio, como en CI).
 */
export function validarSemilla(filas, { estricta = false } = {}) {
  const porId = new Map(filas.map((f) => [f.id, f]));
  const faltantes = []; const alteradas = [];
  for (const s of semillaClasificaciones) {
    const f = porId.get(s.id);
    if (!f) { faltantes.push(s.id); continue; }
    if (f.nombre !== s.nombre || f.nivel !== s.nivel || f.padre !== s.padre || f.activa !== s.activa) alteradas.push(s.id);
  }
  const ids = new Set(semillaClasificaciones.map((s) => s.id));
  const adicionales = filas.filter((f) => !ids.has(f.id)).map((f) => f.id);
  return { ok: faltantes.length === 0 && alteradas.length === 0 && (!estricta || adicionales.length === 0), faltantes, alteradas, adicionales: adicionales.length, estricta };
}

/** Texto seguro para registrar el entorno de ejecución: solo las claves permitidas de la identidad, sin credenciales. */
export function entornoSeguro(identidad) {
  const permitidas = ['proyectoCompose', 'baseDatos', 'puertoBaseDatos', 'puertoRedis', 'espacioRedis', 'bucket', 'puertoObjetos', 'puertoApi', 'puertoWeb', 'puertoSmtp', 'puertoCorreoWeb', 'origen'];
  return Object.fromEntries(permitidas.filter((k) => identidad[k] !== undefined).map((k) => [k, identidad[k]]));
}

/** Recursos descartables de UNA ejecución (T075): base, bucket y espacio Redis propios, derivados de un identificador de 32 hexadecimales. */
export function recursosEfimeros(id) {
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('El identificador de ejecución debe tener 32 dígitos hexadecimales.');
  return { id, baseDatos: `ayacucho_002_test_${id}`, bucket: `e2e-${id}`, espacioRedis: `ayacucho:002:e2e-${id}` };
}

/**
 * Comprueba que los recursos descartables tienen exactamente la forma permitida (la misma que reconocen la configuración 002 y la limpieza de CI)
 * y que ninguno coincide con un recurso de validación 002, de la 001 ni del ensayo de restauración. Solo devuelve problemas, nunca datos sensibles.
 */
export function validarRecursosEfimeros(recursos) {
  const problemas = [];
  if (!/^ayacucho_002_test_[0-9a-f]{32}$/.test(recursos.baseDatos ?? '')) problemas.push('Nombre de base descartable no permitido.');
  if (!/^e2e-[0-9a-f]{32}$/.test(recursos.bucket ?? '')) problemas.push('Nombre de bucket descartable no permitido.');
  if (!/^ayacucho:002:e2e-[0-9a-f]{32}$/.test(recursos.espacioRedis ?? '')) problemas.push('Espacio Redis descartable no permitido.');
  const protegidos = [identidad002Esperada, identidad001Referencia];
  for (const p of protegidos) {
    if (recursos.baseDatos === p.baseDatos) problemas.push('La base descartable coincide con una base de validación.');
    if (recursos.bucket === p.bucket) problemas.push('El bucket descartable coincide con un bucket de validación.');
    if (recursos.espacioRedis === p.espacioRedis) problemas.push('El espacio Redis descartable coincide con uno de validación.');
  }
  if (recursos.espacioRedis?.startsWith(`${identidad002Esperada.espacioRedis}:`)) problemas.push('El espacio Redis descartable no puede estar dentro del de validación.');
  return { ok: problemas.length === 0, problemas };
}

/** Filas por tabla (`{ tabla: filas }`) a partir de la salida de psql `tabla|filas`. */
export function conteosDeTablas(salida) {
  return Object.fromEntries(salida.split(/\r?\n/).filter(Boolean).map((l) => { const [t, n] = l.split('|'); return [t, Number(n)]; }));
}

/** Diferencias entre dos fotos de conteos: tablas cuyo número de filas cambió (también las que aparecen o desaparecen). */
export function diferenciaDeConteos(antes, despues) {
  const cambios = {};
  for (const t of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    if ((antes[t] ?? 0) !== (despues[t] ?? 0)) cambios[t] = { antes: antes[t] ?? 0, despues: despues[t] ?? 0 };
  }
  return cambios;
}

/** `despues` solo puede conservar o perder elementos de `antes`: ninguno nuevo. Devuelve los añadidos. */
export function elementosNuevos(antes, despues) {
  const base = new Set(antes);
  return [...despues].filter((e) => !base.has(e));
}

/**
 * Decisión sobre el propietario de un bloqueo existente del ejecutor E2E (T075). Solo `'muerto'` autoriza recuperar el bloqueo; ante cualquier duda
 * (archivo ilegible o incompleto, otro anfitrión, imposibilidad de comprobar el proceso) se devuelve `'incierto'` y el bloqueo NO se toca.
 * `hechos`: `anfitrion` actual, `pid` ('existe' | 'no-existe' | 'desconocido') y `comando` del proceso (si pudo leerse).
 * @returns {'vivo' | 'muerto' | 'incierto'}
 */
export function clasificarPropietarioBloqueo(bloqueo, hechos) {
  if (!bloqueo || typeof bloqueo !== 'object' || !Number.isInteger(bloqueo.pid) || bloqueo.pid <= 0 || typeof bloqueo.token !== 'string' || typeof bloqueo.anfitrion !== 'string') return 'incierto';
  if (bloqueo.anfitrion !== hechos.anfitrion) return 'incierto';
  if (hechos.pid === 'no-existe') return 'muerto';
  if (hechos.pid !== 'existe') return 'incierto';
  if (typeof hechos.comando !== 'string' || hechos.comando.trim() === '') return 'incierto';
  // Un PID reutilizado por otro programa ya no es el propietario; el propietario real solo es una ejecución de este mismo ejecutor.
  return /ejecutar-e2e-002\.mjs/.test(hechos.comando) ? 'vivo' : 'muerto';
}
