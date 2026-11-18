import { useState, type FormEvent } from 'react';
import type { Perfil, HabilitarPerfil as DatosHabilitar } from '../modelos/contratos.js';
export function HabilitarPerfil({ perfilInicial, habilitar }: { perfilInicial: Perfil; habilitar: (datos: DatosHabilitar) => Promise<Perfil> }) {
  const [perfil, setPerfil] = useState(perfilInicial); const [confirmado, setConfirmado] = useState(false); const [ocupado, setOcupado] = useState(false); const [mensaje, setMensaje] = useState('');
  const faltante = perfil.perfiles.includes('cliente') ? 'prestador' : 'cliente';
  const tarjeta = (clave: 'cliente' | 'prestador', titulo: string, descripcion: string) => {
    const activo = perfil.perfiles.includes(clave);
    return <li className={activo ? 'tarjeta-perfil activo' : 'tarjeta-perfil'}>
      <div className="tarjeta-perfil-cabecera"><h3>{titulo}</h3><span className={activo ? 'estado estado-activo' : 'estado'}>{activo ? 'Activo' : 'Disponible para añadir'}</span></div>
      <p>{descripcion}</p>
      {clave === 'prestador' && <p className="ayuda">Habilitar este perfil no significa obtener verificación profesional ni concede administración.</p>}
    </li>;
  };
  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!confirmado) { setMensaje('Confirme que desea añadir el perfil.'); return; }
    if (ocupado) return;
    setOcupado(true);
    try { setPerfil(await habilitar({ perfil: faltante, version: perfil.version, confirmacionExplicita: true })); setMensaje('Perfil habilitado. Se conservan su cuenta y sus datos.'); }
    catch (error) { setMensaje(error instanceof Error ? error.message : 'No fue posible habilitar el perfil.'); }
    finally { setOcupado(false); }
  }
  return <section className="pagina-perfiles">
    <div className="cabecera-pagina"><p className="sobretitulo">Tu espacio</p><h2>Mis perfiles</h2><p className="intro">{perfil.nombreMostrar}</p>
      <p className="ayuda">Tienes una sola cuenta. Los perfiles indican cómo puedes usar la plataforma; añadir uno no cambia tu contraseña ni tus datos.</p></div>
    <ul className="tarjetas-perfil">
      {tarjeta('cliente', 'Cliente', 'Busca servicios y prestadores y publica solicitudes.')}
      {tarjeta('prestador', 'Prestador', 'Ofrece servicios de construcción a otros usuarios.')}
    </ul>
    {perfil.perfiles.length === 2 ? <p className="aviso">Ya tiene ambos perfiles habilitados.</p> : <form onSubmit={enviar}>
      <h3>Añadir el perfil {faltante}</h3>
      <p className="ayuda">Se conserva su identidad y su información. Habilitar prestador no acredita verificación profesional.</p>
      <label className="confirmacion"><input type="checkbox" checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />Confirmo que deseo añadir el perfil {faltante}.</label>
      <button disabled={ocupado}>Añadir {faltante}</button>
    </form>}
    {mensaje && <p role="status">{mensaje}</p>}
  </section>;
}
