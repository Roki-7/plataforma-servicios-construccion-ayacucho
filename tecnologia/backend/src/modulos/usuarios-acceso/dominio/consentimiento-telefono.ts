import { datosInvalidos, ErrorAplicacion } from './errores.js';
export interface EdicionPerfil { version: number; nombreMostrar?: string; telefono?: string | null; distrito?: string | null; fotografiaId?: string | null; autorizarCompartirTelefono?: boolean }
export interface ConsentimientoTelefono { telefonoHmac: Uint8Array; autorizadaEn: Date | null; revocadaEn: Date | null }
export function consentimientoEfectivo(c: ConsentimientoTelefono | null, huellas: readonly Uint8Array[]): boolean {
  return Boolean(c?.autorizadaEn && !c.revocadaEn && huellas.some(h => h.length === c.telefonoHmac.length && h.every((v,i) => v === c.telefonoHmac[i])));
}
export function decidirConsentimiento(anterior: string | null, nuevo: string | null, efectivo: boolean, decision: boolean | undefined): boolean {
  if (decision === true && !nuevo?.trim()) throw datosInvalidos('Registre un teléfono para autorizarlo.', [{ campo: 'telefono', motivo: 'Ingrese el teléfono que desea autorizar.' }]);
  return decision === true || (decision === undefined && anterior === nuevo && efectivo);
}
export function validarEdicionPerfil(valor: unknown): asserts valor is EdicionPerfil {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw datosInvalidos();
  const v = valor as Record<string, unknown>;
  if (Object.keys(v).some(k => !['version','nombreMostrar','telefono','distrito','fotografiaId','autorizarCompartirTelefono'].includes(k))) throw new ErrorAplicacion(400,'PROPIEDAD_NO_ADMITIDA','Se envió un campo no permitido.');
  if (!Number.isSafeInteger(v['version']) || Number(v['version']) < 1) throw datosInvalidos();
  for (const [campo,max] of [['nombreMostrar',200],['telefono',32],['distrito',100]] as const) {
    const dato=v[campo]; if (dato === undefined || (campo !== 'nombreMostrar' && dato === null)) continue;
    if (typeof dato !== 'string' || !dato.isWellFormed() || [...dato].length > max || (campo === 'nombreMostrar' && !dato.trim())) throw datosInvalidos('Revise los campos indicados.',[{campo,motivo:`Ingrese un valor válido de hasta ${max} caracteres.`}]);
  }
  if (v['fotografiaId'] !== undefined && v['fotografiaId'] !== null && (typeof v['fotografiaId'] !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(v['fotografiaId']))) throw datosInvalidos();
  if (v['autorizarCompartirTelefono'] !== undefined && typeof v['autorizarCompartirTelefono'] !== 'boolean') throw datosInvalidos();
}
