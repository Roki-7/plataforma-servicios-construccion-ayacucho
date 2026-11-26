import { createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { ConfiguracionRf39, IdentidadOperativa } from '../modulos/administracion/aplicacion/gestionar-permisos-rf39.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida la configuración protegida del procedimiento operativo RF39. Solo admite la clave PÚBLICA Ed25519 del Product Owner:
 * un texto que contenga una clave privada se rechaza para impedir que una clave de firma llegue a un archivo de configuración.
 */
export function cargarConfiguracionRf39(texto: string): ConfiguracionRf39 {
  let bruto: unknown;
  try { bruto = JSON.parse(texto); } catch { throw new Error('La configuración protegida de RF39 no es JSON válido.'); }
  const c = bruto as { entorno?: unknown; clavePublicaFirmante?: unknown; identidades?: unknown } | null;
  if (typeof c !== 'object' || c === null) throw new Error('La configuración protegida de RF39 es inválida.');
  if (typeof c.entorno !== 'string' || c.entorno.trim() === '') throw new Error('Falta el entorno de RF39.');
  if (typeof c.clavePublicaFirmante !== 'string' || /PRIVATE KEY/i.test(c.clavePublicaFirmante)) throw new Error('Se requiere únicamente la clave pública del firmante.');
  let tipo: string | undefined;
  try { tipo = createPublicKey(c.clavePublicaFirmante).asymmetricKeyType; } catch { throw new Error('La clave pública del firmante no es válida.'); }
  if (tipo !== 'ed25519') throw new Error('La clave del firmante debe ser Ed25519.');
  if (!Array.isArray(c.identidades)) throw new Error('Faltan las identidades de RF39.');
  const identidades = c.identidades.map((x: unknown): IdentidadOperativa => {
    const i = x as { principal?: unknown; rol?: unknown; cuentaId?: unknown };
    if (typeof i?.principal !== 'string' || i.principal.trim() === '' || (i.rol !== 'FIRMANTE' && i.rol !== 'EJECUTOR')) throw new Error('Identidad de RF39 inválida.');
    if (i.cuentaId !== undefined && (typeof i.cuentaId !== 'string' || !uuid.test(i.cuentaId))) throw new Error('La cuenta asociada de RF39 es inválida.');
    return { principal: i.principal, rol: i.rol, ...(typeof i.cuentaId === 'string' ? { cuentaId: i.cuentaId.toLowerCase() } : {}) };
  });
  const principales = identidades.map(i => i.principal);
  if (new Set(principales).size !== principales.length) throw new Error('Un principal no puede aparecer dos veces ni con dos roles.');
  if (identidades.filter(i => i.rol === 'FIRMANTE').length !== 1) throw new Error('Debe haber un único firmante designado.');
  if (!identidades.some(i => i.rol === 'EJECUTOR')) throw new Error('Debe haber al menos un ejecutor habilitado.');
  return { entorno: c.entorno, clavePublicaFirmante: c.clavePublicaFirmante, identidades };
}

/** La ruta llega por una variable del operador y debe ser absoluta. Su contenido se valida con `cargarConfiguracionRf39`. */
export async function leerConfiguracionRf39(env: NodeJS.ProcessEnv = process.env): Promise<ConfiguracionRf39> {
  const ruta = env['RF39_CONFIGURACION_PROTEGIDA'];
  if (!ruta || !isAbsolute(ruta)) throw new Error('Defina RF39_CONFIGURACION_PROTEGIDA con la ruta absoluta de la configuración protegida.');
  return cargarConfiguracionRf39(await readFile(ruta, 'utf8'));
}
