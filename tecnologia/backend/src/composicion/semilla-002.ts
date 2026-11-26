import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { PRIVACIDAD_VERSION } from '../modulos/usuarios-acceso/dominio/cuenta.js';
import { bytesAprobacion, GestionarPermisosRf39, type CargaAprobacion } from '../modulos/administracion/aplicacion/gestionar-permisos-rf39.js';
import { AuditoriaRf39Postgres, RegistroOperativoPostgres } from '../modulos/administracion/infraestructura/persistencia/auditoria-rf39.js';
import { PermisosRf39Postgres } from '../modulos/administracion/infraestructura/persistencia/permisos-rf39.js';
import type { crearAplicacion } from './app.module.js';

type Aplicacion = Awaited<ReturnType<typeof crearAplicacion>>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Clasificaciones deterministas. La jerarquía incluye una raíz activa con dos subcategorías (una activa y una inactiva) y una raíz inactiva. */
export const clasificacionesSemilla002 = [
  { id: uuid(9001), nombre: 'Construcción', nivel: 1, padre: null, activa: true },
  { id: uuid(9002), nombre: 'Albañilería', nivel: 2, padre: uuid(9001), activa: true },
  { id: uuid(9003), nombre: 'Electricidad', nivel: 2, padre: uuid(9001), activa: false },
  { id: uuid(9004), nombre: 'Acabados', nivel: 1, padre: null, activa: true },
  { id: uuid(9005), nombre: 'Pintura', nivel: 2, padre: uuid(9004), activa: true },
  { id: uuid(9006), nombre: 'Obsoleta', nivel: 1, padre: null, activa: false },
] as const;
export const operadorSemilla002 = { correo: 'operador-categorias-002@example.invalid', nombre: 'Operador ficticio de categorías' } as const;

export interface ResultadoSemilla002 {
  readonly clasificaciones: number; readonly operadorCuentaId: string; readonly permisoConcedido: boolean;
  /** Solo se devuelve cuando la cuenta se crea en esta corrida. */
  readonly credencialNueva?: { readonly correo: string; readonly contrasena: string };
}

/**
 * Siembra datos ficticios deterministas y es idempotente. El operador ficticio se crea con el registro real de la 001 y recibe el permiso RF39 por el flujo
 * operativo (constancia, aprobación firmada y comando interno) con un firmante efímero que se genera en memoria y se descarta: no se guarda ninguna clave.
 * Debe ejecutarse solo contra una base de validación o de prueba de la 002.
 */
export async function sembrar002(app: Aplicacion, principalOperativo: string, origen: string): Promise<ResultadoSemilla002> {
  for (const c of clasificacionesSemilla002) {
    await app.db.query(`INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id,activa) VALUES($1,$2::varchar,lower($2::text),$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [c.id, c.nombre, c.nivel, c.padre, c.activa]);
  }
  await app.db.query('UPDATE catalogo_revision_oferta SET revision = revision + 1 WHERE unica');
  const existente = (await app.db.query('SELECT id FROM usuarios WHERE correo_canonico = lower($1)', [operadorSemilla002.correo]).catch(() => [])) as { id: string }[];
  let credencialNueva: ResultadoSemilla002['credencialNueva'];
  if (!(app.app.getHttpServer() as { listening: boolean }).listening) await app.app.listen(0, '127.0.0.1');
  const direccion = app.app.getHttpServer().address() as { port: number };
  const base = `http://127.0.0.1:${direccion.port}/api/v1`;
  const contrasena = `${randomBytes(18).toString('base64url')} ficticia`;
  const llamar = (ruta: string, cuerpo: object) => fetch(`${base}${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: origen, 'idempotency-key': randomUUID() }, body: JSON.stringify(cuerpo) });
  if (existente.length === 0) {
    const r = await llamar('/cuentas', { nombreMostrar: operadorSemilla002.nombre, correo: operadorSemilla002.correo, contrasena, confirmacionContrasena: contrasena, perfiles: ['cliente'],
      politicaPrivacidadAceptada: true, politicaPrivacidadVersion: PRIVACIDAD_VERSION });
    if (r.status !== 201) throw new Error('No se pudo crear el operador ficticio.');
    credencialNueva = { correo: operadorSemilla002.correo, contrasena };
  }
  return { clasificaciones: clasificacionesSemilla002.length, ...(credencialNueva ? { credencialNueva } : {}), ...(await conceder(app, principalOperativo, llamar, credencialNueva?.contrasena)) };
}

async function conceder(app: Aplicacion, principal: string, llamar: (ruta: string, cuerpo: object) => Promise<Response>, contrasena: string | undefined): Promise<{ operadorCuentaId: string; permisoConcedido: boolean }> {
  const fila = (await app.db.query('SELECT id FROM usuarios WHERE correo_canonico = lower($1)', [operadorSemilla002.correo])) as { id: string }[];
  const cuentaId = fila[0]!.id;
  const permisos = new PermisosRf39Postgres(app.uow);
  if (await permisos.vigente(cuentaId)) return { operadorCuentaId: cuentaId, permisoConcedido: false };
  if (!contrasena) throw new Error('El operador ficticio existe sin permiso y su credencial no está disponible. Elimine la base de validación descartable y repita.');
  const sesion = await llamar('/sesiones', { correo: operadorSemilla002.correo, contrasena });
  if (sesion.status !== 200) throw new Error('No se pudo iniciar la sesión del operador ficticio.');
  const token = String(((await sesion.json()) as { tokenAcceso: string }).tokenAcceso);
  const par = generateKeyPairSync('ed25519');
  const firmante = 'semilla-firmante-efimero';
  const gestor = new GestionarPermisosRf39({ usuarios: app.usuariosAcceso, uow: app.uow, permisos, registro: new RegistroOperativoPostgres(app.uow), auditoria: new AuditoriaRf39Postgres(app.uow),
    configuracion: { entorno: 'validacion-002', clavePublicaFirmante: par.publicKey, identidades: [{ principal: firmante, rol: 'FIRMANTE' }, { principal, rol: 'EJECUTOR' }] } });
  const { constanciaId } = await gestor.emitirConstancia(principal, token);
  const carga: CargaAprobacion = { aprobacionId: randomUUID(), accion: 'CONCEDER', permiso: 'RF39_CATEGORIAS', cuentaId, motivo: 'Permiso de la semilla ficticia de validación', entorno: 'validacion-002',
    emitidaEn: new Date(Date.now() - 60_000).toISOString(), venceEn: new Date(Date.now() + 600_000).toISOString(), constanciaId, firmante };
  await gestor.conceder(principal, { aprobacion: carga, firma: sign(null, bytesAprobacion(carga), par.privateKey).toString('base64') });
  return { operadorCuentaId: cuentaId, permisoConcedido: true };
}
