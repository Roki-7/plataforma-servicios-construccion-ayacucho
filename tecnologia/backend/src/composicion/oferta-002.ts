import type { Provider, Type } from '@nestjs/common';
import type { RegistroPersistencia002 } from './persistencia.js';
import { PermisosYAuditoria1795000000007 } from '../modulos/administracion/infraestructura/migraciones/permisos-y-auditoria.js';
import { ConfirmacionesDesactivacion1795000000008 } from '../modulos/catalogo/infraestructura/migraciones/confirmaciones-desactivacion.js';
import { IndicesBusqueda1795000000006 } from '../modulos/catalogo/infraestructura/migraciones/indices-busqueda.js';
import { ServiciosCatalogo1795000000005 } from '../modulos/catalogo/infraestructura/migraciones/servicios.js';
import { PerfilesYPortafolio1795000000004 } from '../modulos/prestadores/infraestructura/migraciones/perfiles-y-portafolio.js';
import { registroBusqueda002, type OpcionesBusqueda002 } from './busqueda-002.js';
import { registroCategorias002, type OpcionesCategorias002 } from './categorias-002.js';
import { registroPrestadores002, type OpcionesPrestadores002 } from './prestadores-002.js';
import { registroServicios002 } from './servicios-002.js';

/** Migraciones aditivas de la 002 en orden cronológico (las comunes 001 a 003 las registra la composición de persistencia). */
export const persistenciaOferta002: readonly RegistroPersistencia002[] = [{ migraciones: [PerfilesYPortafolio1795000000004, ServiciosCatalogo1795000000005,
  IndicesBusqueda1795000000006, PermisosYAuditoria1795000000007, ConfirmacionesDesactivacion1795000000008] }];

export interface OpcionesOferta002 {
  readonly prestadores: OpcionesPrestadores002;
  readonly busqueda?: OpcionesBusqueda002;
  readonly categorias?: Omit<OpcionesCategorias002, 'configuracionRf39'>;
}

/**
 * Registro explícito de las 23 operaciones de 002 (ocho de Prestadores, cuatro de servicios propios, siete de categorías y cuatro de consulta pública).
 * Con las 17 de la 001 forman las 40 de la aplicación compuesta.
 *
 * El orden de los controladores es parte del contrato: las rutas literales (`prestadores/perfil`, `servicios/mios`) deben registrarse antes que
 * las de parámetro (`prestadores/:id`, `servicios/:id`). La aplicación lo verifica al arrancar. Las altas y revocaciones del permiso RF39 no tienen
 * ruta HTTP: pertenecen al comando operativo.
 */
export function registroOferta002(opciones: OpcionesOferta002): {
  readonly controladores: readonly Type[]; readonly proveedores: readonly Provider[]; readonly persistencia: readonly RegistroPersistencia002[]; readonly operaciones: readonly string[];
} {
  const partes = [registroPrestadores002(opciones.prestadores), registroServicios002(), registroCategorias002(opciones.categorias ?? {}), registroBusqueda002(opciones.busqueda ?? {})];
  return {
    controladores: partes.flatMap(p => p.controladores), proveedores: partes.flatMap(p => p.proveedores),
    persistencia: persistenciaOferta002, operaciones: partes.flatMap(p => p.operaciones),
  };
}
