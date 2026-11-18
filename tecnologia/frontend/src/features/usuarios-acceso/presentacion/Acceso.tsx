import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { InicioSesion } from '../modelos/contratos.js';
import { ErrorApi } from '../aplicacion/puertos.js';
import { CampoContrasena } from './CampoContrasena.js';

export function Acceso({ entrar, correoInicial, trasCierre }: { entrar: (datos: InicioSesion) => Promise<void>; correoInicial?: string; trasCierre?: boolean }) {
  const formulario = useRef<HTMLFormElement>(null); const escribio = useRef(false);
  // Tras cerrar sesión no se conserva ni se rellena ninguna contraseña: se vacía el campo si el navegador lo completó por su cuenta.
  useEffect(() => {
    if (!trasCierre) return;
    const vaciar = () => { const campo = formulario.current?.elements.namedItem('contrasena'); if (!escribio.current && campo instanceof HTMLInputElement && campo.value) campo.value = ''; };
    const temporizadores = [0, 150, 600, 1500].map((ms) => setTimeout(vaciar, ms));
    return () => temporizadores.forEach(clearTimeout);
  }, [trasCierre]);
  const [mensaje, setMensaje] = useState(''); const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (ocupado) return; const form = e.currentTarget; const valores = new FormData(form); const correo = String(valores.get('correo') ?? ''); const contrasena = String(valores.get('contrasena') ?? '');
    if (!correo || !contrasena || [...contrasena].length > 128) { setMensaje('Ingrese correo y contraseña completos (hasta 128 caracteres).'); return; }
    setOcupado(true); setMensaje('');
    try { await entrar({ correo, contrasena }); form.reset(); }
    catch (error) { setMensaje(error instanceof ErrorApi && error.http === 429 ? 'La cuenta está temporalmente bloqueada. Espere 15 minutos desde el quinto fallo antes de volver a intentarlo.' : error instanceof Error ? error.message : 'No fue posible iniciar sesión.'); }
    finally { setOcupado(false); }
  }
  return <section><h2>Iniciar sesión</h2><form ref={formulario} onSubmit={enviar} onInput={() => { escribio.current = true; }} noValidate><label>Correo<input type="email" name="correo" autoComplete="username" defaultValue={correoInicial} /></label><CampoContrasena etiqueta="Contraseña" name="contrasena" autoComplete={trasCierre ? 'off' : 'current-password'} /><button disabled={ocupado}>{ocupado ? 'Ingresando…' : 'Iniciar sesión'}</button></form>{mensaje && <p role="status">{mensaje}</p>}<p><a href="/recuperar">Olvidé mi contraseña</a></p></section>;
}
