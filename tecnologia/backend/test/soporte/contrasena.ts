export const rutaContrasena = '/perfil/cambios-contrasena';
export const nuevaContrasenaCompleta = ' ' + '𠮷'.repeat(125) + 'a ';
export function datosCambioContrasena(contrasenaActual: string, nuevaContrasena = nuevaContrasenaCompleta, version = 1) {
  return { version, contrasenaActual, nuevaContrasena, confirmacionContrasena: nuevaContrasena };
}
