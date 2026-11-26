import type { Provider, Type } from '@nestjs/common';
import type { Idempotencia002 } from '../compartido/aplicacion/idempotencia.js';
import type { UnidadDeTrabajoPostgres } from '../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { AutorizarGestionCategorias } from '../modulos/administracion/aplicacion/autorizar-gestion-categorias.js';
import { CoordinarCategorias } from '../modulos/administracion/aplicacion/coordinar-categorias.js';
import { GestionarPermisosRf39, type ConfiguracionRf39 } from '../modulos/administracion/aplicacion/gestionar-permisos-rf39.js';
import type { AuditoriaRf39, PermisosRf39, RegistroOperativo } from '../modulos/administracion/aplicacion/puertos.js';
import { PermisosYAuditoria1795000000007 } from '../modulos/administracion/infraestructura/migraciones/permisos-y-auditoria.js';
import { AuditoriaRf39Postgres, RegistroOperativoPostgres } from '../modulos/administracion/infraestructura/persistencia/auditoria-rf39.js';
import { PermisosRf39Postgres } from '../modulos/administracion/infraestructura/persistencia/permisos-rf39.js';
import { CATEGORIAS_ADMIN_002, CategoriasAdminController } from '../modulos/administracion/presentacion/categorias-admin.controller.js';
import type { GestionClasificaciones, RevisionDeOferta } from '../modulos/catalogo/api-publica.js';
import { ClasificacionesServicio } from '../modulos/catalogo/aplicacion/clasificaciones.js';
import type { AlmacenCache } from '../modulos/catalogo/infraestructura/cache/catalogo-cache.js';
import { CategoriasConCache, type ConsultaCategorias } from '../modulos/catalogo/infraestructura/cache/categorias-cache.js';
import { ConfirmacionesDesactivacion1795000000008 } from '../modulos/catalogo/infraestructura/migraciones/confirmaciones-desactivacion.js';
import { NombresUnicosDeClasificaciones1795000000009 } from '../modulos/catalogo/infraestructura/migraciones/nombres-unicos-de-clasificaciones.js';
import { ClasificacionesPostgres } from '../modulos/catalogo/infraestructura/persistencia/clasificaciones.js';
import { CATEGORIAS_PUBLICAS_002, CategoriasPublicasController } from '../modulos/catalogo/presentacion/categorias-publicas.controller.js';
import type { UsuariosAcceso } from '../modulos/usuarios-acceso/api-publica.js';
import { IDEMPOTENCIA_002, REVISION_OFERTA_002, UNIDAD_DE_TRABAJO_002, USUARIOS_ACCESO_002 } from './app.module.js';

export const GESTION_CLASIFICACIONES_002 = Symbol('Gestión de clasificaciones de Catálogo');
export const PERMISOS_RF39_002 = Symbol('Permisos RF39 de Administración');
export const AUDITORIA_RF39_002 = Symbol('Auditoría RF39 de Administración');
export const REGISTRO_OPERATIVO_RF39_002 = Symbol('Registro operativo RF39 de Administración');
export const GESTIONAR_PERMISOS_RF39_002 = Symbol('Procedimiento operativo de permisos RF39');

/** Las siete operaciones de RF39: seis internas y la consulta pública de categorías activas. */
export const operacionesCategorias002 = ['listarCategoriasActivas002', 'listarCategoriasAdmin002', 'crearCategoria002', 'editarCategoria002',
  'previsualizarDesactivacionCategoria002', 'desactivarCategoria002', 'activarCategoria002'] as const;

export interface OpcionesCategorias002 {
  /** Caché de la consulta pública con respaldo en PostgreSQL. */
  readonly cache?: { readonly almacen: AlmacenCache; readonly entorno: string; readonly versionRepresentacion?: string; readonly ttlSegundos?: number };
  /** Configuración protegida del procedimiento operativo (clave PÚBLICA e identidades). Sin ella no se construye el procedimiento. */
  readonly configuracionRf39?: ConfiguracionRf39;
  /** Solo para pruebas: sustituye la auditoría para comprobar la reversión conjunta. */
  readonly auditoria?: (base: AuditoriaRf39) => AuditoriaRf39;
}

/** Registro explícito de HU25. La red HTTP no ofrece altas ni revocaciones de permisos: eso pertenece al comando interno. */
export function registroCategorias002(opciones: OpcionesCategorias002 = {}): {
  readonly controladores: readonly Type[]; readonly proveedores: readonly Provider[];
  readonly persistencia: readonly { readonly migraciones: readonly (new () => PermisosYAuditoria1795000000007 | ConfirmacionesDesactivacion1795000000008 | NombresUnicosDeClasificaciones1795000000009)[] }[];
  readonly operaciones: readonly string[];
} {
  const proveedores: Provider[] = [
    { provide: GESTION_CLASIFICACIONES_002, inject: [UNIDAD_DE_TRABAJO_002, REVISION_OFERTA_002],
      useFactory: (uow: UnidadDeTrabajoPostgres, revision: RevisionDeOferta) => new ClasificacionesServicio(new ClasificacionesPostgres(uow), revision) },
    { provide: PERMISOS_RF39_002, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new PermisosRf39Postgres(uow) },
    { provide: AUDITORIA_RF39_002, inject: [UNIDAD_DE_TRABAJO_002],
      useFactory: (uow: UnidadDeTrabajoPostgres) => { const base = new AuditoriaRf39Postgres(uow); return opciones.auditoria ? opciones.auditoria(base) : base; } },
    { provide: REGISTRO_OPERATIVO_RF39_002, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new RegistroOperativoPostgres(uow) },
    { provide: CATEGORIAS_ADMIN_002, inject: [USUARIOS_ACCESO_002, PERMISOS_RF39_002, IDEMPOTENCIA_002, GESTION_CLASIFICACIONES_002, AUDITORIA_RF39_002],
      useFactory: (usuarios: UsuariosAcceso, permisos: PermisosRf39, idempotencia: Idempotencia002, clasificaciones: GestionClasificaciones, auditoria: AuditoriaRf39) =>
        new CoordinarCategorias({ autorizacion: new AutorizarGestionCategorias(usuarios, permisos), idempotencia, clasificaciones, auditoria }) },
    { provide: CATEGORIAS_PUBLICAS_002, inject: [GESTION_CLASIFICACIONES_002, REVISION_OFERTA_002],
      useFactory: (clasificaciones: GestionClasificaciones, revision: RevisionDeOferta): ConsultaCategorias => {
        const origen: ConsultaCategorias = { listar: () => clasificaciones.listarPublicas() };
        return opciones.cache ? new CategoriasConCache(origen, revision, opciones.cache.almacen, { entorno: opciones.cache.entorno,
          versionRepresentacion: opciones.cache.versionRepresentacion ?? 'v1', ttlSegundos: opciones.cache.ttlSegundos ?? 60 }) : origen;
      } },
    ...(opciones.configuracionRf39 ? [{ provide: GESTIONAR_PERMISOS_RF39_002, inject: [USUARIOS_ACCESO_002, UNIDAD_DE_TRABAJO_002, PERMISOS_RF39_002, REGISTRO_OPERATIVO_RF39_002, AUDITORIA_RF39_002],
      useFactory: (usuarios: UsuariosAcceso, uow: UnidadDeTrabajoPostgres, permisos: PermisosRf39, registro: RegistroOperativo, auditoria: AuditoriaRf39) =>
        new GestionarPermisosRf39({ usuarios, uow, permisos, registro, auditoria, configuracion: opciones.configuracionRf39 as ConfiguracionRf39 }) } satisfies Provider] : []),
  ];
  return { controladores: [CategoriasPublicasController, CategoriasAdminController], proveedores,
    persistencia: [{ migraciones: [PermisosYAuditoria1795000000007, ConfirmacionesDesactivacion1795000000008, NombresUnicosDeClasificaciones1795000000009] }], operaciones: operacionesCategorias002 };
}
