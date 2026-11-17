import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SolicitudRecuperacionResultado } from '../modelos/contratos.js';
export function RecuperarAcceso({ solicitar }: { solicitar: (correo: string) => Promise<SolicitudRecuperacionResultado> }) {
  const [mensaje, setMensaje] = useState(''); const [ocupado, setOcupado] = useState(false);
  async function enviar(e: FormEvent<HTMLFormElement>) { e.preventDefault(); if (ocupado) return; const form = e.currentTarget; const correo = String(new FormData(form).get('correo') ?? ''); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || [...correo].length > 320) { setMensaje('Ingrese un correo válido.'); return; } setOcupado(true); try { setMensaje((await solicitar(correo)).mensaje); form.reset(); } catch (error) { setMensaje(error instanceof Error ? error.message : 'No fue posible solicitar el enlace.'); } finally { setOcupado(false); } }
  return <section><h2>Recuperar acceso</h2><p>Solicite un enlace para establecer una nueva contraseña. El enlace vence a los 30 minutos y solo puede usarse una vez.</p><form noValidate onSubmit={enviar}><label>Correo<input type="email" name="correo" autoComplete="email" /></label><button disabled={ocupado}>{ocupado ? 'Solicitando…' : 'Solicitar enlace'}</button></form>{mensaje && <p role="status">{mensaje}</p>}</section>;
}
