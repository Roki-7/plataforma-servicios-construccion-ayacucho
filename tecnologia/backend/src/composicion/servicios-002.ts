import type { Provider, Type } from '@nestjs/common';
import type { Idempotencia002 } from '../compartido/aplicacion/idempotencia.js';
import type { UnidadDeTrabajoPostgres } from '../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ClasificacionesEfectivas, RevisionDeOferta } from '../modulos/catalogo/api-publica.js';
import { ServiciosPropiosServicio } from '../modulos/catalogo/aplicacion/servicios-propios.js';
import { ElegibilidadServicioPostgres } from '../modulos/catalogo/aplicacion/elegibilidad-servicio.js';
import { ServiciosCatalogo1795000000005 } from '../modulos/catalogo/infraestructura/migraciones/servicios.js';
import { ServiciosPostgres } from '../modulos/catalogo/infraestructura/persistencia/servicios.js';
import { SERVICIOS_PROPIOS_002, ServiciosPropiosController } from '../modulos/catalogo/presentacion/servicios-propios.controller.js';
import { ApiPrestadores } from '../modulos/prestadores/api-publica.js';
import { RepositorioPrestadoresPostgres } from '../modulos/prestadores/infraestructura/persistencia/perfiles-y-portafolio.js';
import type { UsuariosAcceso } from '../modulos/usuarios-acceso/api-publica.js';
import { CLASIFICACIONES_EFECTIVAS_002, IDEMPOTENCIA_002, REVISION_OFERTA_002, UNIDAD_DE_TRABAJO_002, USUARIOS_ACCESO_002 } from './app.module.js';

export const REPOSITORIO_SERVICIOS_002 = Symbol('Repositorio de servicios de Catálogo');
export const ELEGIBILIDAD_SERVICIO_002 = Symbol('Elegibilidad de servicios de Catálogo');
export const PRESTADORES_API_002 = Symbol('API pública interna de Prestadores');

/** Las cuatro operaciones privadas de HU04. Las consultas públicas del servicio pertenecen a US3. */
export const operacionesServiciosPropios002 = ['publicarServicio002', 'listarMisServicios002', 'editarServicio002', 'cambiarEstadoServicio002'] as const;

/** Registro explícito de HU04. La migración se registra de forma aditiva: no cambia `db:migrate:002` hasta la integración de T066. */
export function registroServicios002(): {
  readonly controladores: readonly Type[]; readonly proveedores: readonly Provider[];
  readonly persistencia: readonly { readonly migraciones: readonly (new () => ServiciosCatalogo1795000000005)[] }[];
  readonly operaciones: readonly string[];
} {
  const proveedores: Provider[] = [
    { provide: REPOSITORIO_SERVICIOS_002, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new ServiciosPostgres(uow) },
    { provide: PRESTADORES_API_002, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new ApiPrestadores(new RepositorioPrestadoresPostgres(uow)) },
    { provide: ELEGIBILIDAD_SERVICIO_002, inject: [REPOSITORIO_SERVICIOS_002, REVISION_OFERTA_002],
      useFactory: (repositorio: ServiciosPostgres, revision: RevisionDeOferta) => new ElegibilidadServicioPostgres(repositorio, revision) },
    { provide: SERVICIOS_PROPIOS_002,
      inject: [REPOSITORIO_SERVICIOS_002, IDEMPOTENCIA_002, USUARIOS_ACCESO_002, REVISION_OFERTA_002, CLASIFICACIONES_EFECTIVAS_002, PRESTADORES_API_002],
      useFactory: (repositorio: ServiciosPostgres, idempotencia: Idempotencia002, usuarios: UsuariosAcceso, revision: RevisionDeOferta,
        clasificaciones: ClasificacionesEfectivas, prestadores: ApiPrestadores) => new ServiciosPropiosServicio({ repositorio, idempotencia, usuarios, revision, clasificaciones, prestadores }) },
  ];
  return { controladores: [ServiciosPropiosController], proveedores, persistencia: [{ migraciones: [ServiciosCatalogo1795000000005] }], operaciones: operacionesServiciosPropios002 };
}
