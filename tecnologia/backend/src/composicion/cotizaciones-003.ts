import type { Provider, Type } from '@nestjs/common';
import type { Idempotencia002 } from '../compartido/aplicacion/idempotencia.js';
import type { UnidadDeTrabajoPostgres } from '../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import { conTraduccionBd } from '../compartido/infraestructura/postgres/traduccion-errores.js';
import type { CategoriasDeOferta, RevisionDeOferta } from '../modulos/catalogo/api-publica.js';
import { CategoriasDeOfertaPostgres } from '../modulos/catalogo/infraestructura/persistencia/categorias-de-oferta.js';
import { CotizacionesServicio } from '../modulos/cotizaciones/aplicacion/cotizaciones.js';
import type { CoberturasDePrestador } from '../modulos/cotizaciones/aplicacion/puertos/entorno.js';
import { traducirCondicionCotizaciones } from '../modulos/cotizaciones/dominio/errores.js';
import { RepositorioCotizacionesPostgres } from '../modulos/cotizaciones/infraestructura/persistencia/cotizaciones.js';
import { COTIZACIONES_003, CotizacionesController, CotizacionesDeSolicitudController } from '../modulos/cotizaciones/presentacion/cotizaciones.controller.js';
import type { LecturasDePrestadores, PrestadoresApi } from '../modulos/prestadores/api-publica.js';
import { ApiSolicitudes } from '../modulos/solicitudes/aplicacion/api-solicitudes.js';
import { RepositorioSolicitudesPostgres } from '../modulos/solicitudes/infraestructura/persistencia/solicitudes.js';
import type { UsuariosAcceso } from '../modulos/usuarios-acceso/api-publica.js';
import { IDEMPOTENCIA_002, REVISION_OFERTA_002, UNIDAD_DE_TRABAJO_002, USUARIOS_ACCESO_002 } from './app.module.js';
import { PRESTADORES_API_002 } from './servicios-002.js';

/** Las cinco operaciones de HU10 (US3). El listado de cotizaciones de una solicitud y la comparación son de HU11. */
export const operacionesCotizaciones003 = [
  'enviarCotizacion003', 'listarMisCotizaciones003', 'obtenerCotizacion003', 'actualizarCotizacion003', 'retirarCotizacion003',
] as const;

export interface OpcionesCotizaciones003 {
  /** Reloj del sistema para el estado efectivo y la vigencia. Por omisión, la hora del servidor. */
  readonly ahora?: () => Date;
}

const REPOSITORIO_COTIZACIONES_003 = Symbol('Repositorio de cotizaciones de 003');
const SOLICITUDES_API_003 = Symbol('API pública de Solicitudes para Cotizaciones');

/** Adaptador de composición: categorías cubiertas (Catálogo) y zonas (Prestadores), tras el bloqueo compartido de la revisión de oferta. */
function coberturas(revision: RevisionDeOferta, categorias: CategoriasDeOferta, prestadores: LecturasDePrestadores): CoberturasDePrestador {
  return {
    async cargar(prestadorId, tx) {
      await revision.bloquear(tx, 'compartido');
      const [conjunto, distritos] = await Promise.all([categorias.categoriasDeOferta(prestadorId, tx), prestadores.distritosDe(prestadorId, tx)]);
      return { categorias: conjunto, distritos };
    },
  };
}

/**
 * Registro explícito de las cinco operaciones de HU10. Cotizaciones consume a Solicitudes por su API pública y a los demás módulos por puertos que se conectan aquí.
 * Las rutas `solicitudes/:solicitudId/cotizaciones` y `cotizaciones/...` no se solapan con las de Solicitudes.
 */
export function registroCotizaciones003(opciones: OpcionesCotizaciones003 = {}): {
  readonly controladores: readonly Type[]; readonly proveedores: readonly Provider[]; readonly operaciones: readonly string[];
} {
  const proveedores: Provider[] = [
    { provide: REPOSITORIO_COTIZACIONES_003, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new RepositorioCotizacionesPostgres(uow) },
    { provide: SOLICITUDES_API_003, inject: [UNIDAD_DE_TRABAJO_002], useFactory: (uow: UnidadDeTrabajoPostgres) => new ApiSolicitudes(new RepositorioSolicitudesPostgres(uow)) },
    { provide: COTIZACIONES_003,
      inject: [REPOSITORIO_COTIZACIONES_003, SOLICITUDES_API_003, IDEMPOTENCIA_002, USUARIOS_ACCESO_002, PRESTADORES_API_002, REVISION_OFERTA_002, UNIDAD_DE_TRABAJO_002],
      useFactory: (repositorio: RepositorioCotizacionesPostgres, solicitudes: ApiSolicitudes, idempotencia: Idempotencia002, usuarios: UsuariosAcceso,
        prestadores: PrestadoresApi & LecturasDePrestadores, revision: RevisionDeOferta, uow: UnidadDeTrabajoPostgres) =>
        new CotizacionesServicio({
          repositorio, solicitudes, idempotencia, identidades: usuarios, prestadores,
          coberturas: coberturas(revision, new CategoriasDeOfertaPostgres(uow), prestadores),
          traducirEscritura: trabajo => conTraduccionBd(traducirCondicionCotizaciones, trabajo),
          ...(opciones.ahora ? { ahora: opciones.ahora } : {}),
        }) },
  ];
  return { controladores: [CotizacionesDeSolicitudController, CotizacionesController], proveedores, operaciones: operacionesCotizaciones003 };
}
