import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Registro } from '../../../src/features/usuarios-acceso/presentacion/Registro.js';
import { validarRegistroWeb } from '../../../src/features/usuarios-acceso/aplicacion/registro.js';
afterEach(cleanup);
test('CA-REG-02 errores por campo sin enviar datos inválidos', async () => { const enviar = vi.fn(); render(<Registro registrar={enviar} iniciarSesion={vi.fn()} />); fireEvent.submit(screen.getByRole('button', { name: 'Crear cuenta' }).closest('form')!); expect(await screen.findByText('Ingrese su nombre para mostrar.')).toBeVisible(); expect(screen.getByText('Seleccione cliente, prestador o ambos.')).toBeVisible(); expect(enviar).not.toHaveBeenCalled(); });
test('CA-REG-05 privacidad explícita pendiente', () => { const errores = validarRegistroWeb({ nombreMostrar: 'Empresa', correo: 'a@example.invalid', contrasena: 'una frase completa', confirmacionContrasena: 'una frase completa', seleccion: 'cliente', aceptada: false }); expect(errores['privacidad']).toBeDefined(); });
test.each([14, 15, 128, 129])('CA-REG-09 %i puntos de código', (n) => { const p = '𠮷'.repeat(n); const errores = validarRegistroWeb({ nombreMostrar: 'Empresa', correo: 'a@example.invalid', contrasena: p, confirmacionContrasena: p, seleccion: 'cliente', aceptada: true }); expect(Boolean(errores['contrasena'])).toBe(n === 14 || n === 129); });
test('CA-REG-10 pegado completo, espacios, sin maxlength UTF-16', async () => { const user = userEvent.setup(); const enviar = vi.fn().mockResolvedValue({ cuentaId: 'ficticia', perfiles: ['cliente'], version: 1 }); const iniciarSesion = vi.fn(); render(<Registro registrar={enviar} iniciarSesion={iniciarSesion} />); fireEvent.change(screen.getByLabelText('Nombre para mostrar'), { target: { value: 'Empresa' } }); fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'a@example.invalid' } }); const p = ' ' + '𠮷'.repeat(125) + ' '; const input = screen.getByLabelText('Contraseña'); expect(input).not.toHaveAttribute('maxlength'); await user.click(input); await user.paste(p); fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: p } }); fireEvent.change(screen.getByLabelText('¿Cómo usarás la plataforma?'), { target: { value: 'cliente' } }); fireEvent.click(screen.getByLabelText(/Acepto la política/)); fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' })); expect(await screen.findByText('Tu cuenta se creó correctamente')).toBeVisible(); expect(enviar.mock.calls[0]?.[0].contrasena).toBe(p); expect(iniciarSesion).not.toHaveBeenCalled(); await user.click(screen.getByRole('button', { name: 'Iniciar sesión' })); expect(iniciarSesion).toHaveBeenCalledWith('a@example.invalid'); });
// Enmienda controlada de 001 (T080): las mismas reglas de contacto del perfil se aplican al registrar la cuenta (CA-PER-07 a CA-PER-10, FR-033).
const registroBase = { nombreMostrar: 'Empresa', correo: 'a@example.invalid', contrasena: 'x'.repeat(15), confirmacionContrasena: 'x'.repeat(15), seleccion: 'cliente', aceptada: true };
test('CA-PER-07 CA-PER-09 registro: teléfono y distrito inválidos, y nombre con caracteres de control, se rechazan con su motivo', () => {
  expect(validarRegistroWeb({ ...registroBase, telefono: 'abc123456' })).toEqual({ telefono: 'Use solo dígitos, espacios y los signos + - . ( ).' });
  expect(validarRegistroWeb({ ...registroBase, telefono: '12345' })).toEqual({ telefono: 'Ingrese entre 6 y 15 dígitos.' });
  expect(validarRegistroWeb({ ...registroBase, nombreMostrar: 'Ana\tPérez' })).toHaveProperty('nombreMostrar');
  expect(validarRegistroWeb({ ...registroBase, distrito: 'Ayacucho\u2029' })).toHaveProperty('distrito');
});
test('CA-PER-07 CA-PER-08 CA-PER-10 registro: teléfono válido, vacío o de solo espacios y distrito libre se admiten', () => {
  for (const telefono of ['', '   ', '+51 984 123 456', '(01) 234-5678']) expect(validarRegistroWeb({ ...registroBase, telefono, distrito: 'Distrito libre 123' })).toEqual({});
});
test('CA-PER-07 CA-PER-08 registro (pantalla): teléfono con letras muestra el error accesible y no envía; de solo espacios se envía como null', async () => {
  const enviar = vi.fn().mockResolvedValue({ cuentaId: 'ficticia', perfiles: ['cliente'], version: 1 });
  render(<Registro registrar={enviar} iniciarSesion={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Nombre para mostrar'), { target: { value: 'Empresa' } }); fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'a@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'x'.repeat(15) } }); fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'x'.repeat(15) } });
  fireEvent.change(screen.getByLabelText('¿Cómo usarás la plataforma?'), { target: { value: 'cliente' } }); fireEvent.click(screen.getByLabelText(/Acepto la política/));
  const telefono = screen.getByLabelText('Teléfono (opcional)'); expect(telefono).toHaveAttribute('inputmode', 'tel');
  fireEvent.change(telefono, { target: { value: 'sin números' } }); fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  const error = await screen.findByText('Use solo dígitos, espacios y los signos + - . ( ).'); expect(error).toBeVisible(); expect(telefono).toHaveAttribute('aria-invalid', 'true'); expect(telefono.getAttribute('aria-describedby')).toContain(error.id); expect(enviar).not.toHaveBeenCalled();
  fireEvent.change(telefono, { target: { value: '    ' } }); fireEvent.change(screen.getByLabelText('Distrito (opcional)'), { target: { value: '  ' } }); fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  expect(await screen.findByText('Tu cuenta se creó correctamente')).toBeVisible(); expect(enviar.mock.calls[0]?.[0]).toMatchObject({ telefono: null, distrito: null });
});
