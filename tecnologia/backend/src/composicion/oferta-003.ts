import type { Provider, Type } from '@nestjs/common';
import type { RegistroPersistencia002 } from './persistencia.js';
import { persistenciaOferta003 } from './migraciones-003.js';
import { registroCotizaciones003 } from './cotizaciones-003.js';
import { registroSolicitudes003, type OpcionesSolicitudes003 } from './solicitudes-003.js';

export interface OpcionesOferta003 {
  /** HU07 (US1): archivos de solicitudes. Sin esta opción, la composición no registra las operaciones de la historia. */
  readonly solicitudes?: OpcionesSolicitudes003;
}

/**
 * Registro explícito de las 18 operaciones de la 003 (Solicitudes y Cotizaciones). Con las 40 de la composición de la 002 forman las 58 de la aplicación compuesta.
 *
 * Cada historia registra los suyos con sus tareas (hoy, HU07 con las operaciones de solicitudes y archivos, HU08 con oportunidades y HU10 con las cinco de cotizaciones). El orden de los controladores es parte del contrato: las rutas literales
 * (`solicitudes/oportunidades`) deben registrarse antes que las de parámetro (`solicitudes/:solicitudId`). La aplicación lo verifica al arrancar
 * (`verificarRouter`). Mientras falten controladores, la composición `completa` no arranca: el router no coincide con las 58 operaciones.
 */
export function registroOferta003(opciones: OpcionesOferta003 = {}): {
  readonly controladores: readonly Type[]; readonly proveedores: readonly Provider[]; readonly persistencia: readonly RegistroPersistencia002[]; readonly operaciones: readonly string[];
} {
  // HU10 (cotizaciones) se registra junto a HU07 y HU08: comparte reloj y depende de las lecturas de Solicitudes.
  const partes = [...(opciones.solicitudes ? [registroSolicitudes003(opciones.solicitudes), registroCotizaciones003(opciones.solicitudes.ahora ? { ahora: opciones.solicitudes.ahora } : {})] : [])];
  return { controladores: partes.flatMap(p => p.controladores), proveedores: partes.flatMap(p => p.proveedores), persistencia: persistenciaOferta003, operaciones: partes.flatMap(p => p.operaciones) };
}
