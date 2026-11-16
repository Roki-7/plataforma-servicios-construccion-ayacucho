import { describe, expect, test } from 'vitest';
import { ApiUsuariosHttp, claveIdempotencia } from '../../src/features/usuarios-acceso/infraestructura/api-usuarios.js';

describe('Adaptador HTTP fundacional, sin casos de uso ni pantallas de historias', () => {
  test('Mantiene credenciales en memoria y conserva exactamente el texto enviado', async () => {
    const secreto = 'x'.repeat(43); const texto = '  🔐 frase ficticia sin transformar  ';
    let llamadas = 0;
    const solicitar: typeof fetch = async (_url, init) => {
      llamadas++; const headers = new Headers(init?.headers);
      expect(headers.get('Authorization') === secreto).toBe(false);
      expect(init?.credentials).toBe('same-origin'); expect(init?.cache).toBe('no-store'); expect(init?.referrerPolicy).toBe('no-referrer');
      expect(JSON.parse(String(init?.body)).contrasena === texto).toBe(true);
      return new Response(JSON.stringify({ codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Credenciales no válidas.', detalles: [] }), { status: 401 });
    };
    const api = new ApiUsuariosHttp(() => secreto, solicitar);
    await expect(api.enviar('iniciarSesion', { correo: 'ficticio@example.invalid', contrasena: texto })).rejects.toMatchObject({ http: 401, codigo: 'CREDENCIALES_INVALIDAS' });
    expect(llamadas).toBe(1); expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
  });
  test.each([401, 403, 409, 422, 503])('Propaga el rechazo HTTP %s sin retry automático ni éxito falso', async (http) => {
    let llamadas = 0; const solicitar: typeof fetch = async () => { llamadas++; return new Response(JSON.stringify({ codigo: 'RECHAZO_FICTICIO', mensaje: 'No se completó.', detalles: [] }), { status: http }); };
    await expect(new ApiUsuariosHttp(() => undefined, solicitar).enviar('consultarPerfil', undefined)).rejects.toMatchObject({ http });
    expect(llamadas).toBe(1);
  });
  test('Reenvío explícito usa la misma clave y el mismo cuerpo; no genera otra por error de red', async () => {
    const clave = claveIdempotencia(); expect(clave).toMatch(/^[a-f0-9]{32}$/);
    const enviados: string[] = []; const claves: (string | null)[] = [];
    const solicitar: typeof fetch = async (_url, init) => { enviados.push(String(init?.body)); claves.push(new Headers(init?.headers).get('Idempotency-Key')); throw new TypeError('Falla ficticia de red'); };
    const api = new ApiUsuariosHttp(() => 'x'.repeat(43), solicitar);
    for (let i = 0; i < 2; i++) await expect(api.enviar('actualizarPerfil', { version: 1, nombreMostrar: 'Persona ficticia' }, { clave })).rejects.toMatchObject({ http: 503 });
    expect(enviados[0]).toBe(enviados[1]); expect(claves).toEqual([clave, clave]); expect(claveIdempotencia() === clave).toBe(false);
  });
});
