import {ConfirmarCorreo} from '../features/usuarios-acceso/presentacion/ConfirmarCorreo.js';
import { CambiarContrasena } from '../features/usuarios-acceso/presentacion/CambiarContrasena.js';
import { useEffect, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Registro } from '../features/usuarios-acceso/presentacion/Registro.js';
import { Perfil } from '../features/usuarios-acceso/presentacion/Perfil.js';
import { Acceso } from '../features/usuarios-acceso/presentacion/Acceso.js';
import { EstadoSesion } from '../features/usuarios-acceso/presentacion/EstadoSesion.js';
import { EstadoAcceso } from '../features/usuarios-acceso/presentacion/EstadoAcceso.js';
import { RecuperarAcceso } from '../features/usuarios-acceso/presentacion/RecuperarAcceso.js';
import { EstablecerContrasena } from '../features/usuarios-acceso/presentacion/EstablecerContrasena.js';
import { PerfilProfesional } from '../features/prestadores-catalogo/presentacion/PerfilProfesional.js';
import { portafolioWeb } from './prestadores-catalogo.js';
import { usuarios, sesion, recuperacion, perfilWeb, correoWeb, prepararCambioContrasena } from './usuarios-acceso.js';
import './estilos.css';
export function App() {
  const [ruta, setRuta] = useState(location.pathname); const [estado, setEstado] = useState(sesion.estado()); const [cargando, setCargando] = useState(true); const [mensaje, setMensaje] = useState('');
  const [enlaceVersion, setEnlaceVersion] = useState(0);
  const [correoInicial, setCorreoInicial] = useState('');
  const [cierres, setCierres] = useState(0); const [trasCierre, setTrasCierre] = useState(false);
  useEffect(()=>{const capturar=()=>{if(location.pathname!=='/confirmar-correo'||!location.hash)return;const fragmento=location.hash;history.replaceState(null,'','/confirmar-correo');correoWeb.cargarEnlace(fragmento);setRuta('/confirmar-correo');setEnlaceVersion(v=>v+1);};capturar();window.addEventListener('hashchange',capturar);return()=>window.removeEventListener('hashchange',capturar);},[]);
  useEffect(() => { let estabaAutenticada = sesion.estado().autenticada; const quitar = sesion.suscribir(() => { const siguiente=sesion.estado(); if(!siguiente.autenticada){perfilWeb.limpiar();correoWeb.limpiar();if(estabaAutenticada)setMensaje('');} estabaAutenticada=siguiente.autenticada; setEstado(siguiente); }); if (location.pathname === '/recuperar') setCargando(false); else void sesion.restaurar().catch(() => setMensaje('No fue posible recuperar la sesión. Inicie sesión de nuevo.')).finally(() => setCargando(false)); const navegar = () => setRuta(location.pathname); window.addEventListener('popstate', navegar); return () => { quitar(); window.removeEventListener('popstate', navegar); }; }, []);
  useEffect(() => { const capturar = () => { if (location.pathname !== '/recuperar' || !location.hash) return; const fragmento = location.hash; history.replaceState(null, '', '/recuperar'); recuperacion.cargarEnlace(fragmento); sesion.invalidar(); setCargando(false); setRuta('/recuperar'); setMensaje(''); setEnlaceVersion((v) => v + 1); }; capturar(); window.addEventListener('hashchange', capturar); return () => window.removeEventListener('hashchange', capturar); }, []);
  useEffect(() => { if (!estado.autenticada || estado.cerrando || ruta === '/recuperar') return; const timer = setTimeout(() => { void sesion.renovar().catch(() => { setMensaje('No fue posible renovar la sesión. Inicie sesión de nuevo.'); }); }, Math.max(0, estado.venceAcceso - Date.now() - 30000)); return () => clearTimeout(timer); }, [estado.autenticada, estado.cerrando, estado.venceAcceso, ruta]);
  function ir(siguiente: string, aviso = '') {
    if (location.pathname !== siguiente) history.pushState(null, '', siguiente);
    setRuta(siguiente);
    setMensaje(aviso);
  }

  function navegar(evento: MouseEvent<HTMLAnchorElement>) {
    if (evento.button !== 0 || evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    setCorreoInicial('');
    setTrasCierre(false);
    ir(new URL(evento.currentTarget.href).pathname);
  }

  const acceso = <Acceso key={cierres} trasCierre={trasCierre} correoInicial={correoInicial} entrar={async (datos) => {
    setMensaje('');
    await sesion.entrar(datos);
    setCorreoInicial('');
    setTrasCierre(false);
    if (location.pathname !== '/confirmar-correo' || !correoWeb.tieneEnlace()) ir('/cuenta');
  }} />;
  const pantallaRecuperacion = recuperacion.tieneEnlace() ? <EstablecerContrasena key={enlaceVersion} establecer={(nueva, confirmacion) => recuperacion.consumir(nueva, confirmacion)} completada={() => { sesion.invalidar(); history.replaceState(null, '', '/acceso'); setRuta('/acceso'); setMensaje('Contraseña actualizada. Inicie sesión con su nueva contraseña.'); }} /> : recuperacion.enlaceInvalido ? <section><h2>Enlace no válido</h2><p>Solicite un enlace nuevo para recuperar el acceso.</p><a href="/recuperar">Solicitar un enlace nuevo</a></section> : <RecuperarAcceso solicitar={(correo) => recuperacion.solicitar(correo)} />;
  const rutaCuenta = ruta === '/cuenta' || ruta === '/habilitar-perfil';
  let contenido: ReactNode;
  if (cargando) contenido = <p>Comprobando sesión…</p>;
  else if (ruta === '/recuperar') contenido = pantallaRecuperacion;
  else if (estado.autenticada) {
    if (ruta === '/confirmar-correo') contenido = <PantallaConfirmarCorreo key={enlaceVersion} />;
    else if (ruta === '/cambiar-contrasena') contenido = <PantallaCambiarContrasena />;
    else if (ruta === '/prestador/perfil') contenido = <PerfilProfesional servicio={portafolioWeb} />;
    else contenido = <Perfil vista={ruta === '/habilitar-perfil' ? 'perfiles' : 'cuenta'} servicio={perfilWeb} habilitar={usuarios.habilitar} correo={correoWeb} />;
  } else if (rutaCuenta || ['/acceso', '/confirmar-correo', '/cambiar-contrasena', '/prestador/perfil'].includes(ruta)) {
    contenido = <>{rutaCuenta && <EstadoAcceso autenticada={false} comprobando={false} />}{acceso}</>;
  } else {
    contenido = <Registro registrar={usuarios.registrar} iniciarSesion={correo => { setCorreoInicial(correo); ir('/acceso'); }} />;
  }

  return <main>
    <header>
      <h1>Plataforma Ayacucho</h1>
      <nav aria-label="Navegación principal">
        {estado.autenticada ? <>
          <a href="/cuenta" aria-current={ruta === '/cuenta' ? 'page' : undefined} onClick={navegar}>Mi cuenta</a>
          <a href="/habilitar-perfil" aria-current={ruta === '/habilitar-perfil' ? 'page' : undefined} onClick={navegar}>Mis perfiles</a>
          <a href="/prestador/perfil" aria-current={ruta === '/prestador/perfil' ? 'page' : undefined} onClick={navegar}>Mi perfil profesional</a>
          <EstadoSesion ocupado={estado.cerrando} cerrar={async () => {
            try { await sesion.cerrar(); setCierres(v => v + 1); setTrasCierre(true); ir('/acceso', 'Sesión cerrada.'); }
            catch { setCierres(v => v + 1); setTrasCierre(true); ir('/acceso', 'No se pudo confirmar el cierre en el servidor. Se retiró el acceso de esta pantalla.'); }
          }} />
        </> : <>
          <a href="/registro" aria-current={ruta === '/' || ruta === '/registro' ? 'page' : undefined} onClick={navegar}>Crear cuenta</a>
          <a href="/acceso" aria-current={ruta === '/acceso' ? 'page' : undefined} onClick={navegar}>Acceder</a>
        </>}
      </nav>
    </header>
    <div className="superficie">
      {mensaje && <p className="aviso" role="status">{mensaje}</p>}
      {contenido}
    </div>
  </main>;
}

function PantallaCambiarContrasena() {
  const [servicio] = useState(prepararCambioContrasena);
  return <CambiarContrasena cambiar={servicio.cambiar} />;
}

function PantallaConfirmarCorreo(){const[correo,setCorreo]=useState(''),[error,setError]=useState('');useEffect(()=>{void perfilWeb.consultar().then(p=>setCorreo(p.correo)).catch(()=>setError('No fue posible consultar su cuenta.'));},[]);return error?<p>{error}</p>:!correo?<p>Cargando mi cuenta…</p>:!correoWeb.tieneEnlace()?<p>El enlace no es válido. Solicite un cambio nuevo.</p>:<ConfirmarCorreo correo={correo} confirmar={correoWeb.confirmar}/>;}
