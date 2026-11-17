import { useState } from 'react';
import type { FormEvent } from 'react';
import type { InicioSesion } from '../modelos/contratos.js';
import { ErrorApi } from '../aplicacion/puertos.js';
export function Acceso({ entrar }: { entrar: (datos: InicioSesion) => Promise<void> }) {
  const [mensaje, setMensaje] = useState(''); const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (ocupado) return; const form = e.currentTarget; const valores = new FormData(form); const correo = String(valores.get('correo') ?? ''); const contrasena = String(valores.get('contrasena') ?? '');
    if (!correo || !contrasena || [...contrasena].length > 128) { setMensaje('Ingrese correo y contraseña completos (hasta 128 caracteres).'); return; }
    setOcupado(true); setMensaje('');
    try { await entrar({ correo, contrasena }); form.reset(); }
    catch (error) { setMensaje(error instanceof ErrorApi && error.http === 429 ? 'La cuenta está temporalmente bloqueada. Espere 15 minutos desde el quinto fallo antes de volver a intentarlo.' : error instanceof Error ? error.message : 'No fue posible iniciar sesión.'); }
    finally { setOcupado(false); }
  }
  return <section><h2>Iniciar sesión</h2><form onSubmit={enviar} noValidate><label>Correo<input type="email" name="correo" autoComplete="username" /></label><label>Contraseña<input type="password" name="contrasena" autoComplete="current-password" /></label><button disabled={ocupado}>{ocupado ? 'Ingresando…' : 'Iniciar sesión'}</button></form>{mensaje && <p role="status">{mensaje}</p>}<p><a href="/recuperar">Olvidé mi contraseña</a></p></section>;
}
