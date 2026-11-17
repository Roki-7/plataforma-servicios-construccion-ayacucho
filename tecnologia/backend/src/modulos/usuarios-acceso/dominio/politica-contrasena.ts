import { datosInvalidos, dependenciaNoDisponible, ErrorAplicacion } from './errores.js';
export function validarNuevaContrasena(contrasena: unknown, confirmacion: unknown): asserts contrasena is string {
  if (typeof contrasena !== 'string' || !contrasena.isWellFormed() || [...contrasena].length < 15 || [...contrasena].length > 128) throw datosInvalidos('Use entre 15 y 128 caracteres.', [{ campo: 'contrasena', motivo: 'Use entre 15 y 128 puntos de código.' }]);
  if (confirmacion !== contrasena) throw datosInvalidos('Las contraseñas deben coincidir.', [{ campo: 'confirmacionContrasena', motivo: 'La confirmación debe coincidir exactamente.' }]);
}
export async function politicaNuevaContrasena(contrasena: string, confirmacion: string, catalogo: { preparada(): Promise<boolean>; rechazada(valor: string): Promise<boolean> }): Promise<void> {
  validarNuevaContrasena(contrasena, confirmacion);
  if (!await catalogo.preparada()) throw dependenciaNoDisponible();
  if (await catalogo.rechazada(contrasena)) throw new ErrorAplicacion(422, 'CONTRASENA_NO_ADMITIDA', 'Elija otra contraseña; esta es común o está comprometida.', [{ campo: 'contrasena', motivo: 'Elija otra contraseña.' }]);
}
