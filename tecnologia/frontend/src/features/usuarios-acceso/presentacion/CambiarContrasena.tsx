import { useState, type FormEvent } from 'react';
import type { OperacionResultado } from '../modelos/contratos.js';
import type { CredencialesCambio } from '../aplicacion/contrasena.js';
import { validarNuevaContrasenaWeb } from '../aplicacion/recuperacion.js';
import { ErrorApi } from '../aplicacion/puertos.js';

export function CambiarContrasena({ cambiar }: { cambiar: (datos: CredencialesCambio) => Promise<OperacionResultado> }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    const formulario = evento.currentTarget;
    const valores = new FormData(formulario);
    const contrasenaActual = String(valores.get('actual') ?? '');
    const nuevaContrasena = String(valores.get('nueva') ?? '');
    const confirmacionContrasena = String(valores.get('confirmacion') ?? '');
    setMensaje('');
    if (!contrasenaActual || /[\uD800-\uDFFF]/u.test(contrasenaActual) || [...contrasenaActual].length > 128) {
      setError('Introduzca su contraseña actual de hasta 128 caracteres.');
      return;
    }
    const errores = validarNuevaContrasenaWeb(nuevaContrasena, confirmacionContrasena);
    setError('');
    if (Object.keys(errores).length) {
      setError(Object.values(errores)[0]!);
      return;
    }
    setOcupado(true);
    try {
      const resultado = await cambiar({ contrasenaActual, nuevaContrasena, confirmacionContrasena });
      formulario.reset();
      setMensaje(resultado.mensaje);
    } catch (fallo) {
      setError(fallo instanceof ErrorApi ? fallo.message : 'No se pudo confirmar el cambio. Puede reintentar con los mismos datos.');
    } finally {
      setOcupado(false);
    }
  }

  return <section>
    <h2>Cambiar contraseña</h2>
    <p>Use entre 15 y 128 caracteres. Puede pegar la contraseña y usar espacios.</p>
    <form noValidate onSubmit={enviar}>
      <fieldset disabled={ocupado}>
        <label>Contraseña actual<input name="actual" type="password" autoComplete="current-password" /></label>
        <label>Nueva contraseña<input name="nueva" type="password" autoComplete="new-password" /></label>
        <label>Confirmar nueva contraseña<input name="confirmacion" type="password" autoComplete="new-password" /></label>
        <button type="submit">{ocupado ? 'Guardando…' : 'Cambiar contraseña'}</button>
      </fieldset>
    </form>
    {error && <p role="alert">{error}</p>}
    {mensaje && <p role="status">{mensaje}</p>}
    <p><a href="/recuperar">Olvidé mi contraseña</a></p>
  </section>;
}
