import type { Provider, Type } from '@nestjs/common';
import { distritosCanonicos, type ClasificacionesEfectivas, type ProyeccionPublica, type RevisionDeOferta } from '../modulos/catalogo/api-publica.js';
import { FotografiasPortafolioServicio } from '../modulos/prestadores/aplicacion/fotografias-portafolio.js';
import { PerfilProfesionalServicio } from '../modulos/prestadores/aplicacion/perfil-profesional.js';
import type { AlmacenPortafolio, SaneadorImagen } from '../modulos/prestadores/aplicacion/puertos/puertos.js';
import { SaneadorSharp } from '../modulos/prestadores/infraestructura/archivos/sanear-imagen.js';
import { PerfilesYPortafolio1795000000004 } from '../modulos/prestadores/infraestructura/migraciones/perfiles-y-portafolio.js';
import { RepositorioPrestadoresPostgres } from '../modulos/prestadores/infraestructura/persistencia/perfiles-y-portafolio.js';
import { PerfilProfesionalController, PERFIL_PROFESIONAL_002 } from '../modulos/prestadores/presentacion/perfil-profesional.controller.js';
import { FOTOGRAFIAS_PORTAFOLIO_002, PortafolioController } from '../modulos/prestadores/presentacion/portafolio.controller.js';
import type { UnidadDeTrabajoPostgres } from '../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { Idempotencia002 } from '../compartido/aplicacion/idempotencia.js';
import type { UsuariosAcceso } from '../modulos/usuarios-acceso/api-publica.js';
import {
  CLASIFICACIONES_EFECTIVAS_002, IDEMPOTENCIA_002, PROYECCION_PUBLICA_002, REVISION_OFERTA_002, UNIDAD_DE_TRABAJO_002, USUARIOS_ACCESO_002,
} from './app.module.js';

export const REPOSITORIO_PRESTADORES_002 = Symbol('Repositorio de Prestadores');
export const ALMACEN_PORTAFOLIO_002 = Symbol('Almacén privado de portafolio');
export const SANEADOR_IMAGEN_002 = Symbol('Saneador de imágenes de portafolio');

/** Los ocho contratos de HU03. */
export const operacionesPerfilYPortafolio002 = [
  'obtenerMiPerfilProfesional002', 'guardarMiPerfilProfesional002', 'crearTrabajoAnterior002', 'editarTrabajoAnterior002',
  'agregarFotografiaPortafolio002', 'reemplazarFotografiaPortafolio002', 'eliminarFotografiaPortafolio002', 'obtenerFotografiaPublica002',
] as const;

export interface OpcionesPrestadores002 {
  readonly almacen: AlmacenPortafolio;
  readonly saneador?: SaneadorImagen;
  readonly retrasoPurgaSegundos?: number;
}

/** Registro explícito de Prestadores para la composición de 002 (arnés por historia y, en T066, aplicación completa). */
export function registroPrestadores002(opciones: OpcionesPrestadores002): {
  readonly controladores: readonly Type[]; readonly proveedores: readonly Provider[];
  readonly persistencia: readonly { readonly migraciones: readonly (new () => PerfilesYPortafolio1795000000004)[] }[];
  readonly operaciones: readonly string[];
} {
  const proveedores: Provider[] = [
    { provide: ALMACEN_PORTAFOLIO_002, useValue: opciones.almacen },
    { provide: SANEADOR_IMAGEN_002, useValue: opciones.saneador ?? new SaneadorSharp() },
    { provide: REPOSITORIO_PRESTADORES_002, inject: [UNIDAD_DE_TRABAJO_002],
      useFactory: (uow: UnidadDeTrabajoPostgres) => new RepositorioPrestadoresPostgres(uow, { retrasoPurgaSegundos: opciones.retrasoPurgaSegundos ?? 60 }) },
    { provide: PERFIL_PROFESIONAL_002,
      inject: [REPOSITORIO_PRESTADORES_002, IDEMPOTENCIA_002, USUARIOS_ACCESO_002, REVISION_OFERTA_002, PROYECCION_PUBLICA_002, CLASIFICACIONES_EFECTIVAS_002],
      useFactory: (repositorio: RepositorioPrestadoresPostgres, idempotencia: Idempotencia002, usuarios: UsuariosAcceso, revision: RevisionDeOferta,
        proyeccion: ProyeccionPublica, clasificaciones: ClasificacionesEfectivas) => new PerfilProfesionalServicio({
        repositorio, idempotencia, usuarios, revision, proyeccion, clasificaciones, cobertura: new Set(Object.keys(distritosCanonicos)),
      }) },
    { provide: FOTOGRAFIAS_PORTAFOLIO_002, inject: [REPOSITORIO_PRESTADORES_002, IDEMPOTENCIA_002, USUARIOS_ACCESO_002, SANEADOR_IMAGEN_002, ALMACEN_PORTAFOLIO_002],
      useFactory: (repositorio: RepositorioPrestadoresPostgres, idempotencia: Idempotencia002, usuarios: UsuariosAcceso, saneador: SaneadorImagen, almacen: AlmacenPortafolio) =>
        new FotografiasPortafolioServicio({ repositorio, idempotencia, usuarios, saneador, almacen }) },
  ];
  return { controladores: [PerfilProfesionalController, PortafolioController], proveedores,
    persistencia: [{ migraciones: [PerfilesYPortafolio1795000000004] }], operaciones: operacionesPerfilYPortafolio002 };
}
