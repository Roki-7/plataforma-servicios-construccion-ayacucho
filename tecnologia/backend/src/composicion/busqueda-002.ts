import type { Provider, Type } from '@nestjs/common';
import type { UnidadDeTrabajoPostgres } from '../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { RevisionDeOferta } from '../modulos/catalogo/api-publica.js';
import { BusquedaPublicaServicio } from '../modulos/catalogo/aplicacion/busqueda-publica.js';
import type { ConsultasPublicas } from '../modulos/catalogo/aplicacion/puertos/consultas-publicas.js';
import { CatalogoCache, type AlmacenCache } from '../modulos/catalogo/infraestructura/cache/catalogo-cache.js';
import { IndicesBusqueda1795000000006 } from '../modulos/catalogo/infraestructura/migraciones/indices-busqueda.js';
import { ConsultasPublicasPostgres } from '../modulos/catalogo/infraestructura/persistencia/consultas-publicas.js';
import { BUSQUEDA_PUBLICA_002, BusquedaController } from '../modulos/catalogo/presentacion/busqueda.controller.js';
import { PerfilPublicoServicio, type FuentesPublicas } from '../modulos/prestadores/aplicacion/perfil-publico.js';
import { RepositorioPrestadoresPostgres } from '../modulos/prestadores/infraestructura/persistencia/perfiles-y-portafolio.js';
import { PERFIL_PUBLICO_002, PerfilPublicoController } from '../modulos/prestadores/presentacion/perfil-publico.controller.js';
import { REVISION_OFERTA_002, UNIDAD_DE_TRABAJO_002 } from './app.module.js';

export const CONSULTAS_PUBLICAS_002 = Symbol('Consultas públicas de Catálogo');

/** Las cuatro operaciones públicas de HU05. */
export const operacionesBusquedaPublica002 = ['buscarServicios002', 'obtenerServicioPublico002', 'buscarPrestadores002', 'obtenerPerfilPublico002'] as const;

export interface OpcionesBusqueda002 {
  /** Caché de lectura con respaldo en PostgreSQL. Sin ella todas las lecturas van a PostgreSQL. */
  readonly cache?: { readonly almacen: AlmacenCache; readonly entorno: string; readonly versionRepresentacion?: string; readonly ttlSegundos?: number };
  /** Disponibilidad de las fuentes de calificaciones (011) y verificaciones (012). Por defecto, ninguna. */
  readonly fuentes?: () => FuentesPublicas;
}

/**
 * Registro explícito de HU05. El orden de los controladores importa: en la aplicación completa deben ir después de los de
 * `prestadores/perfil` y `servicios/mios` para que las rutas literales se resuelvan antes que las de parámetro.
 */
export function registroBusqueda002(opciones: OpcionesBusqueda002 = {}): {
  readonly controladores: readonly Type[]; readonly proveedores: readonly Provider[];
  readonly persistencia: readonly { readonly migraciones: readonly (new () => IndicesBusqueda1795000000006)[] }[];
  readonly operaciones: readonly string[];
} {
  const proveedores: Provider[] = [
    { provide: CONSULTAS_PUBLICAS_002, inject: [UNIDAD_DE_TRABAJO_002, REVISION_OFERTA_002], useFactory: (uow: UnidadDeTrabajoPostgres, revision: RevisionDeOferta): ConsultasPublicas => {
      const consultas = new ConsultasPublicasPostgres(uow);
      return opciones.cache ? new CatalogoCache(consultas, revision, opciones.cache.almacen, { entorno: opciones.cache.entorno,
        versionRepresentacion: opciones.cache.versionRepresentacion ?? 'v1', ttlSegundos: opciones.cache.ttlSegundos ?? 60 }) : consultas;
    } },
    { provide: BUSQUEDA_PUBLICA_002, inject: [CONSULTAS_PUBLICAS_002], useFactory: (consultas: ConsultasPublicas) => new BusquedaPublicaServicio(consultas) },
    { provide: PERFIL_PUBLICO_002, inject: [UNIDAD_DE_TRABAJO_002, CONSULTAS_PUBLICAS_002],
      useFactory: (uow: UnidadDeTrabajoPostgres, consultas: ConsultasPublicas) => new PerfilPublicoServicio(new RepositorioPrestadoresPostgres(uow), consultas, opciones.fuentes) },
  ];
  return { controladores: [BusquedaController, PerfilPublicoController], proveedores, persistencia: [{ migraciones: [IndicesBusqueda1795000000006] }], operaciones: operacionesBusquedaPublica002 };
}
