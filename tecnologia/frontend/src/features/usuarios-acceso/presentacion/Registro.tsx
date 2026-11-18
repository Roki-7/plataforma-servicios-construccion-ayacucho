import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Registro as DatosRegistro, RegistroResultado, ImagenEntrada } from '../modelos/contratos.js';
import { PRIVACIDAD_VERSION, validarRegistroWeb } from '../aplicacion/registro.js';
import { ErrorApi } from '../aplicacion/puertos.js';
import { CampoContrasena } from './CampoContrasena.js';

export function Registro({ registrar, iniciarSesion }: { registrar: (datos: DatosRegistro) => Promise<RegistroResultado>; iniciarSesion: (correo: string) => void }) {
  const [errores, setErrores] = useState<Record<string, string>>({}); const [ocupado, setOcupado] = useState(false); const [mensaje, setMensaje] = useState('');
  const [correoCreado, setCorreoCreado] = useState('');
  const confirmacion = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (correoCreado) confirmacion.current?.focus(); }, [correoCreado]);
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
      await registrar({ nombreMostrar: d.nombreMostrar, correo: d.correo, contrasena: d.contrasena, confirmacionContrasena: d.confirmacionContrasena, perfiles: d.seleccion === 'ambos' ? ['cliente', 'prestador'] : [d.seleccion as 'cliente' | 'prestador'], politicaPrivacidadAceptada: true, politicaPrivacidadVersion: PRIVACIDAD_VERSION, telefono: texto('telefono') || null, distrito: texto('distrito') || null, ...(fotografia ? { fotografia } : {}) });
      form.reset();
      setCorreoCreado(d.correo);
    } catch (error) { const campos: Record<string, string> = {}; if (error instanceof ErrorApi) for (const detalle of error.detalles) if (detalle.campo) campos[detalle.campo] = detalle.motivo; setErrores(campos); setMensaje(error instanceof Error ? error.message : 'No fue posible crear la cuenta.'); }
    finally { setOcupado(false); }
  }
  const error = (campo: string) => errores[campo] ? <span id={`error-${campo}`} className="error">{errores[campo]}</span> : null;
  if (correoCreado) return <section className="registro-completado">
    <div role="status"><h2 tabIndex={-1} ref={confirmacion}>Tu cuenta se creó correctamente</h2></div>
    <button type="button" onClick={() => iniciarSesion(correoCreado)}>Iniciar sesión</button>
  </section>;
  return <section className="pagina-registro"><div className="cabecera-pagina"><p className="sobretitulo">Servicios de construcción en Ayacucho</p><h2>Crear cuenta</h2><p className="intro">Una cuenta para persona o empresa. Puede elegir uno o ambos perfiles.</p></div><form onSubmit={enviar} noValidate>
    <div className="grupo-campos"><h3>Datos de acceso</h3>
    <label>Nombre para mostrar<input name="nombreMostrar" autoComplete="name" aria-describedby="error-nombreMostrar" /></label>{error('nombreMostrar')}
    <label>Correo<input name="correo" type="email" autoComplete="email" aria-invalid={Boolean(errores['correo'])} aria-describedby={errores['correo'] ? 'error-correo' : undefined} /></label>{error('correo')}
    <CampoContrasena etiqueta="Contraseña" name="contrasena" autoComplete="new-password" aria-describedby="politica-clave error-contrasena" />
    <p id="politica-clave" className="ayuda">Use de 15 a 128 caracteres. Puede pegar una contraseña y usar espacios; evite contraseñas comunes o comprometidas.</p>{error('contrasena')}
    <CampoContrasena etiqueta="Confirmar contraseña" name="confirmacionContrasena" autoComplete="new-password" aria-describedby="error-confirmacionContrasena" />{error('confirmacionContrasena')}</div>
    <div className="grupo-campos"><h3>Perfil y contacto</h3>
    <label>¿Cómo usarás la plataforma?<select name="seleccion" defaultValue="" aria-describedby="ayuda-perfiles"><option value="">Seleccione una opción</option><option value="cliente">Cliente: busco y contrato servicios</option><option value="prestador">Prestador: ofrezco servicios de construcción</option><option value="ambos">Cliente y prestador: hago ambas cosas</option></select></label>
    <ul id="ayuda-perfiles" className="ayuda lista-ayuda"><li><strong>Cliente:</strong> busca y contrata servicios.</li><li><strong>Prestador:</strong> ofrece servicios; no es una verificación profesional.</li><li><strong>Ambos:</strong> una sola cuenta con los dos usos.</li></ul>
    <p className="ayuda">Podrás añadir el otro perfil después, en «Mis perfiles».</p>{error('perfiles')}
    <label>Teléfono (opcional)<input name="telefono" type="tel" autoComplete="tel" /></label>{error('telefono')}
    <p className="ayuda">Registrar su teléfono no autoriza compartirlo.</p>
    <label>Distrito (opcional)<input name="distrito" /></label>{error('distrito')}
    <label>Fotografía (opcional)<input name="fotografia" type="file" accept="image/jpeg,image/png,image/webp" /></label>{error('fotografia')}</div>
    <details className="politica"><summary>Política de privacidad · {PRIVACIDAD_VERSION}</summary><p>Usamos el nombre y correo para identificar y gestionar su cuenta. La contraseña se protege con Argon2id. Teléfono, distrito y fotografía son opcionales y privados; no autorizan publicar ni compartir su teléfono. Puede solicitar acceso, corrección o eliminación de sus datos al responsable de la plataforma.</p></details>
    <label className="confirmacion"><input type="checkbox" name="privacidad" />Acepto la política de privacidad vigente ({PRIVACIDAD_VERSION}).</label>{error('privacidad')}
    <button disabled={ocupado} type="submit">{ocupado ? 'Creando cuenta…' : 'Crear cuenta'}</button>
  </form>{mensaje && <p role="status">{mensaje}</p>}</section>;
}
