import { generateKeyPairSync, randomUUID, sign, type KeyObject } from 'node:crypto';
import type { RegistroPersistencia002 } from '../../../src/composicion/persistencia.js';
import { registroCategorias002, GESTIONAR_PERMISOS_RF39_002, type OpcionesCategorias002 } from '../../../src/composicion/categorias-002.js';
import type { OpcionesBusqueda002 } from '../../../src/composicion/busqueda-002.js';
import { bytesAprobacion, type CargaAprobacion, type ConfiguracionRf39, type GestionarPermisosRf39 } from '../../../src/modulos/administracion/aplicacion/gestionar-permisos-rf39.js';
import { origenWeb002, registrarCuenta, type CuentaPrueba } from './fixtures-hu03.js';
import { montarHu05 } from './fixtures-hu05.js';

export const firmantePrueba = 'po-prueba';
export const ejecutorPrueba = 'operador-prueba';
export const entornoPrueba = 'prueba-002';

export interface OpcionesHu25 { readonly busqueda?: OpcionesBusqueda002; readonly categorias?: Omit<OpcionesCategorias002, 'configuracionRf39'>; readonly registrar?: (linea: string) => void }

/**
 * Monta US4 sobre US2 y US3 con sus rutas reales. La clave Ed25519 se genera en memoria para cada arnés: nunca hay una clave privada en el repositorio.
 * El permiso RF39 se concede por el flujo operativo (constancia, aprobación firmada, comando interno), no por SQL.
 */
export async function montarHu25(opciones: OpcionesHu25 = {}) {
  const par = generateKeyPairSync('ed25519');
  const configuracion: ConfiguracionRf39 = { entorno: entornoPrueba, clavePublicaFirmante: par.publicKey,
    identidades: [{ principal: firmantePrueba, rol: 'FIRMANTE' }, { principal: ejecutorPrueba, rol: 'EJECUTOR' }, { principal: 'otro-operador', rol: 'EJECUTOR', cuentaId: randomUUID() }] };
  const registro = registroCategorias002({ ...opciones.categorias, configuracionRf39: configuracion });
  const e = await montarHu05(opciones.busqueda ?? {}, opciones.registrar, { controladores: registro.controladores, proveedores: registro.proveedores,
    operaciones: registro.operaciones, persistencia: registro.persistencia as readonly RegistroPersistencia002[] });
  const gestor = e.app.get<GestionarPermisosRf39>(GESTIONAR_PERMISOS_RF39_002);
  const get = (ruta: string, token?: string) => { const t = e.http.get(`/api/v1${ruta}`); if (token) t.set('Authorization', `Bearer ${token}`); return t; };
  const escritura = (t: ReturnType<typeof e.http.post>, token: string | undefined, clave?: string, origen: string | null = origenWeb002) => {
    if (token) t.set('Authorization', `Bearer ${token}`);
    if (origen) t.set('Origin', origen);
    t.set('Idempotency-Key', clave ?? randomUUID());
    return t;
  };
  const firmar = (carga: CargaAprobacion, clave: KeyObject = par.privateKey) => ({ aprobacion: carga, firma: sign(null, bytesAprobacion(carga), clave).toString('base64') });
  const carga = (accion: 'CONCEDER' | 'REVOCAR', cuentaId: string, extra: Partial<CargaAprobacion> = {}): CargaAprobacion => ({
    aprobacionId: randomUUID(), accion, permiso: 'RF39_CATEGORIAS', cuentaId, motivo: 'Designación de prueba', entorno: entornoPrueba,
    emitidaEn: new Date(Date.now() - 60_000).toISOString(), venceEn: new Date(Date.now() + 600_000).toISOString(), firmante: firmantePrueba, ...extra });
  const cuenta = (): Promise<CuentaPrueba> => registrarCuenta(e, e.http, 'cliente');
  /** Flujo operativo completo: constancia con la sesión de la persona, aprobación del Product Owner y comando interno. */
  const habilitar = async (c: CuentaPrueba, principal = ejecutorPrueba) => {
    const { constanciaId } = await gestor.emitirConstancia(principal, c.token);
    await gestor.conceder(principal, firmar(carga('CONCEDER', c.cuentaId, { constanciaId })));
  };
  const revocar = (c: CuentaPrueba, principal = ejecutorPrueba) => gestor.revocar(principal, firmar(carga('REVOCAR', c.cuentaId)));
  const admin = '/admin/categorias';
  return {
    ...e, gestor, firmar, carga, cuenta, habilitar, revocar, llavePrivada: par.privateKey,
    publicas: () => get('/categorias'),
    listar: (token?: string) => get(admin, token),
    crear: (token: string | undefined, cuerpo: object, clave?: string, origen?: string | null) => escritura(e.http.post(`/api/v1${admin}`), token, clave, origen).send(cuerpo),
    editar: (token: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(e.http.patch(`/api/v1${admin}/${id}`) as never, token, clave).send(cuerpo),
    previsualizar: (token: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(e.http.post(`/api/v1${admin}/${id}/previsualizaciones-desactivacion`), token, clave).send(cuerpo),
    desactivar: (token: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(e.http.post(`/api/v1${admin}/${id}/desactivaciones`), token, clave).send(cuerpo),
    activar: (token: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(e.http.post(`/api/v1${admin}/${id}/activaciones`), token, clave).send(cuerpo),
    filaCategoria: async (id: string) => ((await e.db.query('SELECT nombre,activa,version,categoria_padre_id FROM catalogo_clasificaciones WHERE id=$1', [id])) as Record<string, unknown>[])[0]!,
    auditoria: async () => (await e.db.query('SELECT responsable,aprobacion_id,accion,recurso_tipo,recurso_id,motivo FROM administracion_auditoria ORDER BY ocurrio_en, id')) as Record<string, unknown>[],
  };
}
export type EntornoHu25 = Awaited<ReturnType<typeof montarHu25>>;
