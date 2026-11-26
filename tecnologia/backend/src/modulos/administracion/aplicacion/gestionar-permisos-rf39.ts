import { createPublicKey, verify, type KeyObject } from 'node:crypto';
import type { UnidadDeTrabajo } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import type { UsuariosAcceso } from '../../usuarios-acceso/api-publica.js';
import { PERMISO_RF39, type AuditoriaRf39, type PermisosRf39, type RegistroOperativo } from './puertos.js';

export interface IdentidadOperativa { readonly principal: string; readonly rol: 'FIRMANTE' | 'EJECUTOR'; readonly cuentaId?: string }
/** Configuración protegida fuera del repositorio. La clave es solo la PÚBLICA del Product Owner. */
export interface ConfiguracionRf39 {
  readonly entorno: string; readonly clavePublicaFirmante: string | KeyObject;
  readonly identidades: readonly IdentidadOperativa[]; readonly minutosConstancia?: number; readonly ahora?: () => Date;
}
export interface CargaAprobacion {
  readonly aprobacionId: string; readonly accion: 'CONCEDER' | 'REVOCAR'; readonly permiso: typeof PERMISO_RF39; readonly cuentaId: string;
  readonly motivo: string; readonly entorno: string; readonly emitidaEn: string; readonly venceEn: string; readonly constanciaId?: string; readonly firmante: string;
}
export interface AprobacionFirmada { readonly aprobacion: CargaAprobacion; readonly firma: string }

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fechaUtc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const claves = ['aprobacionId', 'accion', 'permiso', 'cuentaId', 'motivo', 'entorno', 'emitidaEn', 'venceEn', 'constanciaId', 'firmante'] as const;
const sinPermiso = (m = 'No está autorizado para esta operación.') => new ErrorAplicacion(403, 'SIN_PERMISO', m);
const invalida = (m = 'La aprobación no es válida.') => new ErrorAplicacion(403, 'APROBACION_NO_VALIDA', m);

/** Bytes firmados: JSON con el orden fijo de campos. Quien firma y quien verifica deben usar exactamente esta serialización. */
export function bytesAprobacion(a: CargaAprobacion): Buffer {
  return Buffer.from(JSON.stringify(Object.fromEntries(claves.filter(k => a[k] !== undefined).map(k => [k, a[k]]))), 'utf8');
}

export class GestionarPermisosRf39 {
  private readonly clave: KeyObject;
  constructor(private readonly d: { readonly usuarios: Pick<UsuariosAcceso, 'exigir'>; readonly uow: UnidadDeTrabajo; readonly permisos: PermisosRf39;
    readonly registro: RegistroOperativo; readonly auditoria: AuditoriaRf39; readonly configuracion: ConfiguracionRf39 }) {
    this.clave = typeof d.configuracion.clavePublicaFirmante === 'string' ? createPublicKey(d.configuracion.clavePublicaFirmante) : d.configuracion.clavePublicaFirmante;
    if (this.clave.asymmetricKeyType !== 'ed25519') throw new Error('La clave de firma debe ser Ed25519.');
    const firmantes = d.configuracion.identidades.filter(i => i.rol === 'FIRMANTE');
    if (firmantes.length !== 1) throw new Error('La configuración protegida debe identificar a un único firmante.');
  }
  private ahora(): Date { return this.d.configuracion.ahora?.() ?? new Date(); }

  /**
   * La persona designada acredita su cuenta con su propia sesión 001. Se conserva la cuenta y un identificador opaco; nunca el Bearer.
   * Solo un principal del host habilitado como ejecutor puede emitirla: una identidad no habilitada no crea registros.
   */
  async emitirConstancia(principal: string, token: string): Promise<{ constanciaId: string; cuentaId: string }> {
    this.ejecutor(principal);
    const { cuentaId } = await this.d.usuarios.exigir(token);
    const constanciaId = await this.d.registro.crearConstancia(cuentaId, this.d.configuracion.entorno, this.d.configuracion.minutosConstancia ?? 15);
    return { constanciaId, cuentaId };
  }

  /** `principal` lo obtiene el comando del sistema operativo. Jamás se lee de argumentos, variables de usuario ni de la red. */
  private ejecutor(principal: string) {
    const i = this.d.configuracion.identidades.find(x => x.principal === principal && x.rol === 'EJECUTOR');
    if (!i) throw sinPermiso('El principal del host no está habilitado para operar RF39.');
    return i;
  }

  private verificar(principal: string, firmada: AprobacionFirmada, accion: 'CONCEDER' | 'REVOCAR') {
    const a = firmada.aprobacion;
    if (typeof a !== 'object' || a === null || typeof firmada.firma !== 'string' || Object.keys(a).some(k => !(claves as readonly string[]).includes(k))) throw invalida();
    if (!uuid.test(a.aprobacionId) || !uuid.test(a.cuentaId) || a.permiso !== PERMISO_RF39 || a.accion !== accion) throw invalida();
    if (typeof a.motivo !== 'string' || a.motivo.trim() === '' || [...a.motivo].length > 500) throw invalida();
    if (!fechaUtc.test(a.emitidaEn) || !fechaUtc.test(a.venceEn) || (a.constanciaId !== undefined) !== (accion === 'CONCEDER') || (a.constanciaId !== undefined && !uuid.test(a.constanciaId))) throw invalida();
    let firmaValida = false;
    try { firmaValida = verify(null, bytesAprobacion(a), this.clave, Buffer.from(firmada.firma, 'base64')); } catch { firmaValida = false; }
    if (!firmaValida) throw invalida('La firma de la aprobación no es válida.');
    const firmante = this.d.configuracion.identidades.find(i => i.rol === 'FIRMANTE')!;
    if (a.firmante !== firmante.principal) throw invalida('El firmante de la aprobación no está designado.');
    if (principal === firmante.principal) throw sinPermiso('El ejecutor no puede ser el firmante de la aprobación.');
    if (a.entorno !== this.d.configuracion.entorno) throw invalida('La aprobación corresponde a otro entorno.');
    const ahora = this.ahora(); const emitida = new Date(a.emitidaEn); const vence = new Date(a.venceEn);
    if (!(emitida <= ahora && ahora < vence)) throw invalida('La aprobación no está vigente.');
    // La firma ya se verificó sobre el contenido original. Desde aquí los UUID se comparan y se persisten en minúsculas.
    const normalizada: CargaAprobacion = { ...a, aprobacionId: uuidEnMinusculas(a.aprobacionId), cuentaId: uuidEnMinusculas(a.cuentaId),
      ...(a.constanciaId !== undefined ? { constanciaId: uuidEnMinusculas(a.constanciaId) } : {}) };
    return { a: normalizada, emitida, vence, firmante: firmante.principal };
  }

  conceder(principal: string, firmada: AprobacionFirmada): Promise<void> { return this.aplicar(principal, firmada, 'CONCEDER'); }
  revocar(principal: string, firmada: AprobacionFirmada): Promise<void> { return this.aplicar(principal, firmada, 'REVOCAR'); }

  /** Una transacción: permiso, consumo de aprobación y constancia, y auditoría se confirman juntos o ninguno. Orden: permiso, constancia, aprobación. */
  private async aplicar(principal: string, firmada: AprobacionFirmada, accion: 'CONCEDER' | 'REVOCAR'): Promise<void> {
    const ejecutor = this.ejecutor(principal);
    const { a, emitida, vence, firmante } = this.verificar(principal, firmada, accion);
    if (ejecutor.cuentaId !== undefined && uuidEnMinusculas(ejecutor.cuentaId) === a.cuentaId) throw sinPermiso('El ejecutor no puede modificar su propio permiso.');
    await this.d.uow.ejecutar(async tx => {
      const permiso = await this.d.permisos.bloquear(tx, a.cuentaId);
      if (accion === 'REVOCAR' && permiso?.estado !== 'VIGENTE') throw new ErrorAplicacion(409, 'PERMISO_NO_VIGENTE', 'La cuenta no tiene un permiso vigente que revocar.');
      if (accion === 'CONCEDER') {
        if (permiso?.estado === 'VIGENTE') throw new ErrorAplicacion(409, 'PERMISO_YA_VIGENTE', 'La cuenta ya tiene el permiso.');
        const c = await this.d.registro.bloquearConstancia(tx, a.constanciaId as string);
        if (!c || c.cuentaId !== a.cuentaId || c.entorno !== a.entorno || !c.vigente || c.consumida) throw invalida('La constancia de identidad no es válida para esta cuenta.');
        await this.d.registro.consumirConstancia(tx, c.id);
      }
      const nueva = await this.d.registro.consumirAprobacion(tx, { id: a.aprobacionId, firmante, ejecutor: principal, accion, cuentaId: a.cuentaId, entorno: a.entorno,
        emitidaEn: emitida, venceEn: vence, motivo: a.motivo, constanciaId: a.constanciaId ?? null });
      if (!nueva) throw invalida('La aprobación ya fue utilizada.');
      if (accion === 'CONCEDER') await this.d.permisos.conceder(tx, a.cuentaId); else await this.d.permisos.revocar(tx, a.cuentaId);
      await this.d.auditoria.registrar(tx, { responsable: `operativo:${principal}`, aprobacionId: a.aprobacionId, accion: accion === 'CONCEDER' ? 'PERMISO_RF39_CONCEDIDO' : 'PERMISO_RF39_REVOCADO',
        recursoTipo: 'PERMISO_RF39', recursoId: a.cuentaId, motivo: a.motivo });
    });
  }
}