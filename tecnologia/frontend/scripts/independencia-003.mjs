// Lógica pura, sin secretos ni acceso a Docker, del ejecutor de navegador de la 003 (T006).
// Solo maneja identidades (nombres y puertos): nunca contraseñas, claves ni cadenas de conexión completas.
import { identidad001Referencia, identidad002Esperada, puertosEnsayoRestauracion } from './independencia-002.mjs';

/** Matriz del ejecutor de navegador 003: motores y anchos de viewport (PR07). */
export const navegadores003 = Object.freeze(['chromium', 'firefox', 'webkit']);
export const anchos003 = Object.freeze([360, 768, 1366]);
export const origen003 = 'https://localhost:8447';

/** Identidad dedicada de la validación 003 (coincide con tecnologia/backend/scripts/entorno-003.ts). */
export const identidad003Esperada = Object.freeze({
  proyectoCompose: 'ayacucho-003-validacion', baseDatos: 'ayacucho_003_validacion', puertoBaseDatos: 54331,
  puertoRedis: 63801, espacioRedis: 'ayacucho:003:validacion', bucket: 'plataforma-003-validacion', puertoObjetos: 3911,
  puertoApi: 3004, puertoWeb: 5177, puertoSmtp: 1027, puertoCorreoWeb: 8027, origen: 'https://localhost:8447',
});

/** Puertos de las réplicas y del proxy del ejecutor 002 (scripts/replicas-002.mjs). La 003 tampoco puede usarlos. */
export const puertosReservados002 = Object.freeze([3003, 5176, 8446]);

const claves = ['proyectoCompose', 'baseDatos', 'puertoBaseDatos', 'puertoRedis', 'espacioRedis', 'bucket', 'puertoObjetos', 'puertoApi', 'puertoWeb', 'puertoSmtp', 'puertoCorreoWeb', 'origen'];
const puertosDe = (identidad) => ['puertoBaseDatos', 'puertoRedis', 'puertoObjetos', 'puertoApi', 'puertoWeb', 'puertoSmtp', 'puertoCorreoWeb']
  .map((k) => identidad[k]).concat([Number(new URL(identidad.origen).port)]);

/**
 * Comprueba que ningún recurso de la 003 coincide con los de la 001, la 002 ni los puertos reservados, y que no hay puertos repetidos
 * dentro de la propia 003. Solo devuelve problemas, nunca datos sensibles.
 */
export function validarIndependencia003() {
  const problemas = [];
  for (const [nombre, otra] of [['001', identidad001Referencia], ['002', identidad002Esperada]]) {
    for (const k of claves) if (identidad003Esperada[k] === otra[k]) problemas.push(`El recurso ${k} de la 003 coincide con el de la ${nombre}.`);
  }
  const ocupados = new Set([...puertosDe(identidad001Referencia), ...puertosDe(identidad002Esperada), ...puertosEnsayoRestauracion, ...puertosReservados002]);
  const propios = puertosDe(identidad003Esperada);
  for (const p of propios) if (ocupados.has(p)) problemas.push(`El puerto ${p} de la 003 ya está reservado por otra funcionalidad.`);
  if (new Set(propios).size !== propios.length) problemas.push('La 003 repite un puerto en su propia identidad.');
  return { ok: problemas.length === 0, problemas };
}
