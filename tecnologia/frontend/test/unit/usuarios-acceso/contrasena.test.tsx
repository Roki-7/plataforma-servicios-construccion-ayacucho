import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ContrasenaWeb } from '../../../src/features/usuarios-acceso/aplicacion/contrasena.js';
import { CambiarContrasena } from '../../../src/features/usuarios-acceso/presentacion/CambiarContrasena.js';
import { EditarPerfil } from '../../../src/features/usuarios-acceso/presentacion/EditarPerfil.js';
import { ErrorApi, type ApiUsuarios } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';

afterEach(cleanup);
const nueva = ' ' + '𠮷'.repeat(126) + ' ';
const actual = ' actual exacta ';
const datos = { contrasenaActual: actual, nuevaContrasena: nueva, confirmacionContrasena: nueva };
const enviar = () => fireEvent.click(screen.getByRole('button', {name: 'Cambiar contraseña'}));
function llenar(confirmacion = nueva, valor = nueva) {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), {target: {value: actual}});
  fireEvent.change(screen.getByLabelText('Nueva contraseña', {exact: true}), {target: {value: valor}});
  fireEvent.change(screen.getByLabelText('Confirmar nueva contraseña'), {target: {value: confirmacion}});
}
test.each([['confirmación distinta', nueva.trim(), nueva], ['longitud insuficiente', '𠮷'.repeat(14), '𠮷'.repeat(14)], ['longitud excesiva', '𠮷'.repeat(129), '𠮷'.repeat(129)]])('CA-CLA-03 %s no llega a la API', (_nombre, confirmacion, valor) => {
  const cambiar = vi.fn();
  render(<CambiarContrasena cambiar={cambiar}/>);
  llenar(confirmacion, valor);
  enviar();
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(cambiar).not.toHaveBeenCalled();
});
test('CA-CLA-03 conserva espacios y puntos completos; rechazo del catálogo no informa éxito', async () => {
  const cambiar = vi.fn().mockRejectedValue(new ErrorApi(422, 'CONTRASENA_NO_ADMITIDA', 'Elija otra contraseña.'));
  render(<CambiarContrasena cambiar={cambiar}/>);
  llenar();
  enviar();
  await screen.findByText('Elija otra contraseña.');
  expect(cambiar).toHaveBeenCalledWith(datos);
  expect(screen.queryByRole('status')).toBeNull();
});
test('CA-CLA-04 formulario específico enlaza recuperación y limpia las tres entradas al completar', async () => {
  const cambiar = vi.fn().mockResolvedValue({codigo: 'CONTRASENA_CAMBIADA', mensaje: 'Contraseña actualizada.'});
  render(<CambiarContrasena cambiar={cambiar}/>);
  expect(screen.getByRole('link', {name: /olvidé/i}).getAttribute('href')).toBe('/recuperar');
  llenar();
  enviar();
  await screen.findByText('Contraseña actualizada.');
  for (const nombre of ['Contraseña actual', 'Nueva contraseña', 'Confirmar nueva contraseña']) {
    expect((screen.getByLabelText(nombre, {exact: true}) as HTMLInputElement).value).toBe('');
  }
});
test('CA-CLA-04 el formulario de perfil ordinario carece de entradas de contraseña', () => {
  render(<EditarPerfil perfil={{cuentaId:'550e8400-e29b-41d4-a716-446655440000', correo:'ficticia@example.invalid', nombreMostrar:'Titular', telefono:null, distrito:null, fotografiaId:null, perfiles:['cliente'], telefonoCompartible:false, version:1}} guardar={vi.fn()} subir={vi.fn()} actualizado={vi.fn()} recargar={vi.fn()}/>);
  expect(screen.queryByLabelText(/contraseña/i)).toBeNull();
});
test('CA-CLA-01 reintento ambiguo conserva cuerpo, versión y clave; el siguiente cambio los obtiene de nuevo', async () => {
  let falla = true;
  const enviar = vi.fn(async (operacion: string) => {
    if (operacion === 'consultarPerfil') return {version: 1};
    if (falla) { falla = false; throw new Error('Respuesta perdida'); }
    return {mensaje: 'Contraseña actualizada.'};
  });
  const clave = vi.fn().mockReturnValueOnce('primera').mockReturnValueOnce('segunda');
  const web = new ContrasenaWeb({enviar} as unknown as ApiUsuarios, clave);
  await expect(web.cambiar(datos)).rejects.toThrow('Respuesta perdida');
  await web.cambiar({...datos});
  expect(enviar.mock.calls[1]).toEqual(enviar.mock.calls[2]);
  await web.cambiar(datos);
  expect(clave).toHaveBeenCalledTimes(2);
});
