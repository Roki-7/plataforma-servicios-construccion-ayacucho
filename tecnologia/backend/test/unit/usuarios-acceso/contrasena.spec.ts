import { jest } from '@jest/globals';
import { CambiarContrasena } from '../../../src/modulos/usuarios-acceso/aplicacion/cambiar-contrasena.js';
import { idCuenta } from '../../../src/modulos/usuarios-acceso/dominio/identificadores.js';

const id = idCuenta('550e8400-e29b-41d4-a716-446655440000');
const actual = ' contraseña actual exacta ';
const nueva = ' ' + '𠮷'.repeat(126) + ' ';
function entorno(correcta = true, rechazada = false) {
  const tx = { id: 'ficticia' };
  const cuenta = { id, correo: 'titular@example.invalid', version: 1n, versionCredencial: 1n, contrasenaHash: 'phc anterior' };
  const cuentas = {
    leerCredencial: jest.fn(async () => cuenta),
    bloquear: jest.fn(async () => cuenta),
    exigirSesion: jest.fn(async () => {}),
    establecerContrasena: jest.fn(async () => {}),
  };
  const lector = { leer: async () => ({ cuentaId: id, sesionId: 'sesion', perfiles: ['cliente'] as const, autenticadaConContrasenaEn: null, versionSesion: 1n }) };
  const hash = { verificar: jest.fn(async (_valor: string, _phc: string) => correcta), crear: jest.fn(async (_valor: string) => 'phc nuevo') };
  const catalogo = { preparada: async () => true, rechazada: jest.fn(async (_valor: string) => rechazada) };
  const servicio = new CambiarContrasena(cuentas, lector, {
    consultarUsuario: async () => null,
    ejecutar: async (_solicitud, trabajo) => trabajo(tx),
  }, hash, catalogo, { ahora: () => new Date() });
  return { servicio, cuentas, hash, catalogo };
}
test('CA-CLA-02 actual incorrecta no escribe credencial ni acredita autenticación', async () => {
  const e = entorno(false);
  await expect(e.servicio.ejecutar({version: 1, contrasenaActual: actual, nuevaContrasena: nueva, confirmacionContrasena: nueva}, 'clave-ficticia-suficiente', 'acceso')).rejects.toMatchObject({ http: 422, codigo: 'CONTRASENA_ACTUAL_INVALIDA' });
  expect(e.hash.verificar).toHaveBeenCalledWith(actual, 'phc anterior');
  expect(e.hash.crear).not.toHaveBeenCalled();
  expect(e.cuentas.establecerContrasena).not.toHaveBeenCalled();
});
test.each([
  ['14 puntos', '𠮷'.repeat(14), '𠮷'.repeat(14), false, 400],
  ['129 puntos', '𠮷'.repeat(129), '𠮷'.repeat(129), false, 400],
  ['confirmación distinta', nueva, nueva.trim(), false, 400],
  ['común', 'passwordpassword', 'passwordpassword', true, 422],
  ['comprometida', 'comprometida ficticia 001', 'comprometida ficticia 001', true, 422],
])('CA-CLA-03 rechaza %s sin escribir credencial', async (_nombre, valor, confirmacion, rechazada, http) => {
  const e = entorno(true, rechazada);
  await expect(e.servicio.ejecutar({version: 1, contrasenaActual: actual, nuevaContrasena: valor, confirmacionContrasena: confirmacion}, 'clave-ficticia-suficiente', 'acceso')).rejects.toMatchObject({ http });
  expect(e.hash.crear).not.toHaveBeenCalled();
  expect(e.cuentas.establecerContrasena).not.toHaveBeenCalled();
});
test('CA-CLA-03 entrega 128 puntos completos, espacios y sufijo al catálogo y al hash', async () => {
  const e = entorno();
  await expect(e.servicio.ejecutar({version: 1, contrasenaActual: actual, nuevaContrasena: nueva, confirmacionContrasena: nueva}, 'clave-ficticia-suficiente', 'acceso')).resolves.toMatchObject({ http: 200 });
  expect(e.catalogo.rechazada).toHaveBeenCalledWith(nueva);
  expect(e.hash.crear).toHaveBeenCalledWith(nueva);
  expect(e.cuentas.establecerContrasena).toHaveBeenCalledTimes(1);
});
