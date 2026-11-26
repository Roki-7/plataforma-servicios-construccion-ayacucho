import type { Provider, Type } from '@nestjs/common';
import type { RegistroPersistencia002 } from './persistencia.js';
import { persistenciaOferta003 } from './migraciones-003.js';

export interface OpcionesOferta003 {
  /** Reservado para los adaptadores de las historias (almacenamiento de archivos, reloj, etc.), que se añaden con sus tareas. */
  readonly reservado?: never;
}

/**
 * Registro explícito de las 18 operaciones de la 003 (Solicitudes y Cotizaciones). Con las 40 de la composición de la 002 forman las 58 de la aplicación compuesta.
 *
 * Hoy no hay controladores: cada historia registra los suyos con sus tareas. El orden de los controladores es parte del contrato: las rutas literales
 * (`solicitudes/oportunidades`) deben registrarse antes que las de parámetro (`solicitudes/:solicitudId`). La aplicación lo verifica al arrancar
 * (`verificarRouter`). Mientras falten controladores, la composición `completa` no arranca: el router no coincide con las 58 operaciones.
 */
export function registroOferta003(_opciones: OpcionesOferta003 = {}): {
  readonly controladores: readonly Type[]; readonly proveedores: readonly Provider[]; readonly persistencia: readonly RegistroPersistencia002[]; readonly operaciones: readonly string[];
} {
  return { controladores: [], proveedores: [], persistencia: persistenciaOferta003, operaciones: [] };
}
