import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Acceso } from '../../../src/features/usuarios-acceso/presentacion/Acceso.js';
afterEach(() => { cleanup(); vi.useRealTimers(); });
test('CA-SES-07 tras cerrar sesión el campo de contraseña se vacía aunque el navegador lo rellene y el ojo no la revela', async () => {
  vi.useFakeTimers();
  render(<Acceso entrar={vi.fn()} correoInicial="ana@example.invalid" trasCierre />);
  const campo = screen.getByLabelText('Contraseña', { exact: true }) as HTMLInputElement;
  expect(campo).toHaveAttribute('autocomplete', 'off');
  campo.value = 'valor rellenado por el navegador';
  await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
  expect(campo.value).toBe('');
  expect(screen.getByLabelText('Correo')).toHaveValue('ana@example.invalid');
  await act(async () => { screen.getByRole('button', { name: /Mostrar el valor de «Contraseña»/ }).click(); });
  expect(campo).toHaveAttribute('type', 'text'); expect(campo.value).toBe('');
});
test('CA-SES-07 lo escrito por la persona tras cerrar sesión no se borra', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<Acceso entrar={vi.fn()} trasCierre />);
  const campo = screen.getByLabelText('Contraseña', { exact: true }) as HTMLInputElement;
  await user.type(campo, 'clave nueva');
  await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
  expect(campo.value).toBe('clave nueva');
});
