import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Registro as DatosRegistro, RegistroResultado, ImagenEntrada } from '../modelos/contratos.js';
import { PRIVACIDAD_VERSION, validarRegistroWeb } from '../aplicacion/registro.js';
import { ErrorApi } from '../aplicacion/puertos.js';
export function Registro({ registrar }: { registrar: (datos: DatosRegistro) => Promise<RegistroResultado> }) {
  const [errores, setErrores] = useState<Record<string, string>>({}); const [ocupado, setOcupado] = useState(false); const [mensaje, setMensaje] = useState('');
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); if (ocupado) return; const form = evento.currentTarget; const valores = new FormData(form); const texto = (k: string) => String(valores.get(k) ?? '');
    const d = { nombreMostrar: texto('nombreMostrar'), correo: texto('correo'), contrasena: texto('contrasena'), confirmacionContrasena: texto('confirmacionContrasena'), seleccion: texto('seleccion'), aceptada: valores.get('privacidad') === 'on' }; const invalidos = validarRegistroWeb(d);
    if ([...texto('telefono')].length > 32) invalidos['telefono'] = 'Use hasta 32 caracteres.'; if ([...texto('distrito')].length > 100) invalidos['distrito'] = 'Use hasta 100 caracteres.';
    setErrores(invalidos); setMensaje(''); if (Object.keys(invalidos).length) return; setOcupado(true);
    try {
      const archivo = valores.get('fotografia'); let fotografia: ImagenEntrada | undefined;
      if (archivo instanceof File && archivo.size > 0) {
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type) || archivo.size > 10000000) { setErrores({ fotografia: 'Elija JPG, PNG o WEBP de hasta 10 MB.' }); return; }
        const contenidoBase64 = await new Promise<string>((ok, no) => { const lector = new FileReader(); lector.onload = () => ok(String(lector.result).split(',')[1] ?? ''); lector.onerror = no; lector.readAsDataURL(archivo); });
        fotografia = { tipoContenido: archivo.type as ImagenEntrada['tipoContenido'], contenidoBase64 };
      }
      const resultado = await registrar({ nombreMostrar: d.nombreMostrar, correo: d.correo, contrasena: d.contrasena, confirmacionContrasena: d.confirmacionContrasena, perfiles: d.seleccion === 'ambos' ? ['cliente', 'prestador'] : [d.seleccion as 'cliente' | 'prestador'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: PRIVACIDAD_VERSION, telefono: texto('telefono') || null, distrito: texto('distrito') || null, ...(fotografia ? { fotografia } : {}) });
      form.reset(); setMensaje(`Cuenta creada con perfil ${resultado.perfiles.join(' y ')}. El inicio de sesión estará disponible en la próxima etapa.`);
    } catch (error) { const campos: Record<string, string> = {}; if (error instanceof ErrorApi) for (const detalle of error.detalles) if (detalle.campo) campos[detalle.campo] = detalle.motivo; setErrores(campos); setMensaje(error instanceof Error ? error.message : 'No fue posible crear la cuenta.'); }
    finally { setOcupado(false); }
  }
  const error = (campo: string) => errores[campo] ? <span id={`error-${campo}`} className="error">{errores[campo]}</span> : null;
  return <section><h2>Crear cuenta</h2><p>Una cuenta para persona o empresa. Puede elegir uno o ambos perfiles.</p><form onSubmit={enviar} noValidate>
    <label>Nombre para mostrar<input name="nombreMostrar" autoComplete="name" aria-describedby="error-nombreMostrar" /></label>{error('nombreMostrar')}
    <label>Correo<input name="correo" type="email" autoComplete="email" aria-describedby="error-correo" /></label>{error('correo')}
    <p id="politica-clave">Use de 15 a 128 caracteres. Puede pegar una contraseña y usar espacios; evite contraseñas comunes o comprometidas.</p>
    <label>Contraseña<input name="contrasena" type="password" autoComplete="new-password" aria-describedby="politica-clave error-contrasena" /></label>{error('contrasena')}
    <label>Confirmar contraseña<input name="confirmacionContrasena" type="password" autoComplete="new-password" aria-describedby="error-confirmacionContrasena" /></label>{error('confirmacionContrasena')}
    <label>Perfil de la cuenta<select name="seleccion" defaultValue=""><option value="">Seleccione un perfil</option><option value="cliente">Cliente</option><option value="prestador">Prestador</option><option value="ambos">Cliente y prestador</option></select></label>{error('perfiles')}
    <label>Teléfono (opcional)<input name="telefono" type="tel" autoComplete="tel" /></label>{error('telefono')}
    <p>Registrar su teléfono no autoriza compartirlo.</p>
    <label>Distrito (opcional)<input name="distrito" /></label>{error('distrito')}
    <label>Fotografía (opcional)<input name="fotografia" type="file" accept="image/jpeg,image/png,image/webp" /></label>{error('fotografia')}
    <details><summary>Política de privacidad · {PRIVACIDAD_VERSION}</summary><p>Usamos el nombre y correo para identificar y gestionar su cuenta. La contraseña se protege con Argon2id. Teléfono, distrito y fotografía son opcionales y privados; no autorizan publicar ni compartir su teléfono. Puede solicitar acceso, corrección o eliminación de sus datos al responsable de la plataforma.</p></details>
    <label className="confirmacion"><input type="checkbox" name="privacidad" />Acepto la política de privacidad vigente ({PRIVACIDAD_VERSION}).</label>{error('privacidad')}
    <button disabled={ocupado} type="submit">{ocupado ? 'Creando cuenta…' : 'Crear cuenta'}</button>
  </form>{mensaje && <p role="status">{mensaje}</p>}</section>;
}
