import { validarIdentificacionCambio, type DatosCambioContrasena } from '../dominio/cambio-contrasena.js';

export type CambioContrasenaDto = DatosCambioContrasena;

/** El middleware OpenAPI comprueba estructura y propiedades antes del controlador. */
export function leerCambioContrasena(dto: CambioContrasenaDto): DatosCambioContrasena {
  validarIdentificacionCambio(dto);
  const { version, contrasenaActual, nuevaContrasena, confirmacionContrasena } = dto;
  return { version, contrasenaActual, nuevaContrasena, confirmacionContrasena };
}
