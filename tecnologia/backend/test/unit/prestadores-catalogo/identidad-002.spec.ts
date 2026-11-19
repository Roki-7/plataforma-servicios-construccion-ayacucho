import { expect, jest, test } from '@jest/globals';
import { exigirIdentidad002 } from '../../../src/composicion/identidad-002.js';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import type { UsuariosAcceso } from '../../../src/modulos/usuarios-acceso/api-publica.js';

const token = 'a'.repeat(43);
const identidad = { cuentaId: 'identidad-del-servidor', sesionId: 'sesion-del-servidor', perfiles: ['prestador'] } as const;

test('la API pública interna decide la identidad a partir del Bearer opaco', async () => {
  const exigir = jest.fn<UsuariosAcceso['exigir']>().mockResolvedValue(identidad);
  await expect(exigirIdentidad002({ exigir }, `Bearer ${token}`)).resolves.toEqual(identidad);
  expect(exigir).toHaveBeenCalledWith(token);
});

test('distingue credencial ausente o malformada de una sesión rechazada', async () => {
  const exigir = jest.fn<UsuariosAcceso['exigir']>().mockRejectedValue(new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.'));
  for (const valor of [undefined, 'Basic prueba', 'Bearer token']) {
    await expect(exigirIdentidad002({ exigir }, valor)).rejects.toMatchObject({ http: 401, codigo: 'NO_AUTENTICADO' });
  }
  expect(exigir).not.toHaveBeenCalled();
  await expect(exigirIdentidad002({ exigir }, `Bearer ${token}`)).rejects.toMatchObject({ http: 401, codigo: 'SESION_NO_VALIDA' });
});
