import { datosInvalidos, ErrorAplicacion } from './errores.js';
import { validarNuevaContrasena } from './politica-contrasena.js';

export interface DatosCambioContrasena {
  version: number;
  contrasenaActual: string;
  nuevaContrasena: string;
  confirmacionContrasena: string;
}

export function validarIdentificacionCambio(datos: DatosCambioContrasena): void {
  if (!Number.isSafeInteger(datos.version) || datos.version < 1) throw datosInvalidos();
  if (typeof datos.contrasenaActual !== 'string' || !datos.contrasenaActual.isWellFormed() || [...datos.contrasenaActual].length > 128) {
    throw datosInvalidos('Revise la contraseña actual.');
  }
}

export function validarCambioContrasena(datos: DatosCambioContrasena): void {
  validarIdentificacionCambio(datos);
  validarNuevaContrasena(datos.nuevaContrasena, datos.confirmacionContrasena);
}

export function versionDesactualizada(): ErrorAplicacion {
  return new ErrorAplicacion(409, 'VERSION_DESACTUALIZADA', 'El perfil cambió. Consulte de nuevo.');
}
