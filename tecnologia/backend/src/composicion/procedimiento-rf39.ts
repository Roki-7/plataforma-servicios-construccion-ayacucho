import { crearAplicacion } from './app.module.js';
import { GESTIONAR_PERMISOS_RF39_002, registroCategorias002 } from './categorias-002.js';
import type { Configuracion } from './configuracion.js';
import type { ConfiguracionRf39, GestionarPermisosRf39 } from '../modulos/administracion/aplicacion/gestionar-permisos-rf39.js';

/**
 * Compone el procedimiento operativo con la misma persistencia, identidad 001 y unidad de trabajo que la aplicación.
 * No escucha en ningún puerto: la red HTTP no ofrece altas ni revocaciones de permisos.
 */
export async function crearProcedimientoRf39(config: Configuracion, configuracionRf39: ConfiguracionRf39): Promise<{ gestor: GestionarPermisosRf39; cerrar: () => Promise<void> }> {
  const registro = registroCategorias002({ configuracionRf39 });
  const e = await crearAplicacion(config, { worker: false, oferta002: { ...registro, modo: 'prueba', persistencia: registro.persistencia } });
  return { gestor: e.app.get<GestionarPermisosRf39>(GESTIONAR_PERMISOS_RF39_002), cerrar: () => e.app.close() };
}
