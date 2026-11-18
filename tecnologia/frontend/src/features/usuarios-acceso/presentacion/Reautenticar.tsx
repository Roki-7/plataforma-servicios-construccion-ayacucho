import { useState, type FormEvent } from 'react';
import { CampoContrasena } from './CampoContrasena.js';

export function Reautenticar({ acreditar }: { acreditar: (contrasena: string) => Promise<unknown> }) {
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    const formulario = evento.currentTarget;
    const contrasena = String(new FormData(formulario).get('contrasena') ?? '');
    setOcupado(true);
    setMensaje('');
    try {
      await acreditar(contrasena);
      setMensaje('Contraseña acreditada en esta sesión. Puede solicitar el cambio.');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No fue posible confirmar su contraseña.');
    } finally {
      formulario.reset();
      setOcupado(false);
    }
  }

  return <section>
    <h3>Verificar identidad para cambiar correo</h3><p className="ayuda">Introduce tu contraseña actual para confirmar que eres tú. La verificación es reciente y solo vale para esta sesión.</p>
    <form onSubmit={enviar}>
      <CampoContrasena etiqueta="Contraseña actual" name="contrasena" autoComplete="current-password" disabled={ocupado} />
      <button type="submit" disabled={ocupado}>Verificar mi identidad</button>
    </form>
    {mensaje && <p role="status">{mensaje}</p>}
  </section>;
}
