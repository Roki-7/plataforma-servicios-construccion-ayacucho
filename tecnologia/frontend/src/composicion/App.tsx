import {ConfirmarCorreo} from '../features/usuarios-acceso/presentacion/ConfirmarCorreo.js';
import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Registro } from '../features/usuarios-acceso/presentacion/Registro.js';
import { Perfil } from '../features/usuarios-acceso/presentacion/Perfil.js';
import { Acceso } from '../features/usuarios-acceso/presentacion/Acceso.js';
import { EstadoSesion } from '../features/usuarios-acceso/presentacion/EstadoSesion.js';
import { EstadoAcceso } from '../features/usuarios-acceso/presentacion/EstadoAcceso.js';
import { RecuperarAcceso } from '../features/usuarios-acceso/presentacion/RecuperarAcceso.js';
import { EstablecerContrasena } from '../features/usuarios-acceso/presentacion/EstablecerContrasena.js';
import { usuarios, sesion, recuperacion, perfilWeb, correoWeb } from './usuarios-acceso.js';
import './estilos.css';
export function App() {
  const [ruta, setRuta] = useState(location.pathname); const [estado, setEstado] = useState(sesion.estado()); const [cargando, setCargando] = useState(true); const [mensaje, setMensaje] = useState('');
  const [enlaceVersion, setEnlaceVersion] = useState(0);
  useEffect(()=>{const capturar=()=>{if(location.pathname!=='/confirmar-correo'||!location.hash)return;const fragmento=location.hash;history.replaceState(null,'','/confirmar-correo');correoWeb.cargarEnlace(fragmento);setRuta('/confirmar-correo');setEnlaceVersion(v=>v+1);};capturar();window.addEventListener('hashchange',capturar);return()=>window.removeEventListener('hashchange',capturar);},[]);
  useEffect(() => { const quitar = sesion.suscribir(() => { const siguiente=sesion.estado(); if(!siguiente.autenticada){perfilWeb.limpiar();correoWeb.limpiar();setMensaje('');} setEstado(siguiente); }); if (location.pathname === '/recuperar') setCargando(false); else void sesion.restaurar().catch(() => setMensaje('No fue posible recuperar la sesión. Inicie sesión de nuevo.')).finally(() => setCargando(false)); const navegar = () => setRuta(location.pathname); window.addEventListener('popstate', navegar); return () => { quitar(); window.removeEventListener('popstate', navegar); }; }, []);
  useEffect(() => { const capturar = () => { if (location.pathname !== '/recuperar' || !location.hash) return; const fragmento = location.hash; history.replaceState(null, '', '/recuperar'); recuperacion.cargarEnlace(fragmento); sesion.invalidar(); setCargando(false); setRuta('/recuperar'); setMensaje(''); setEnlaceVersion((v) => v + 1); }; capturar(); window.addEventListener('hashchange', capturar); return () => window.removeEventListener('hashchange', capturar); }, []);
  useEffect(() => { if (!estado.autenticada || estado.cerrando || ruta === '/recuperar') return; const timer = setTimeout(() => { void sesion.renovar().catch(() => { setMensaje('No fue posible renovar la sesión. Inicie sesión de nuevo.'); }); }, Math.max(0, estado.venceAcceso - Date.now() - 30000)); return () => clearTimeout(timer); }, [estado.autenticada, estado.cerrando, estado.venceAcceso, ruta]);
  function navegar(e: MouseEvent<HTMLAnchorElement>) { if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); const siguiente = new URL(e.currentTarget.href).pathname; history.pushState(null, '', siguiente); setRuta(siguiente); setMensaje(''); }
  const acceso = <Acceso entrar={async (datos) => { setMensaje(''); await sesion.entrar(datos); setMensaje('Sesión iniciada.'); }} />;
  const pantallaRecuperacion = recuperacion.tieneEnlace() ? <EstablecerContrasena key={enlaceVersion} establecer={(nueva, confirmacion) => recuperacion.consumir(nueva, confirmacion)} completada={() => { sesion.invalidar(); history.replaceState(null, '', '/acceso'); setRuta('/acceso'); setMensaje('Contraseña actualizada. Inicie sesión con su nueva contraseña.'); }} /> : recuperacion.enlaceInvalido ? <section><h2>Enlace no válido</h2><p>Solicite un enlace nuevo para recuperar el acceso.</p><a href="/recuperar">Solicitar un enlace nuevo</a></section> : <RecuperarAcceso solicitar={(correo) => recuperacion.solicitar(correo)} />;
  return <main><header><h1>Plataforma Ayacucho</h1><nav><a href="/registro" onClick={navegar}>Crear cuenta</a> · <a href="/acceso" onClick={navegar}>Acceder</a> · <a href="/cuenta" onClick={navegar}>Mi cuenta</a> · <a href="/habilitar-perfil" onClick={navegar}>Mis perfiles</a></nav></header>
    {estado.autenticada && <EstadoSesion ocupado={estado.cerrando} cerrar={async () => { try { await sesion.cerrar(); setMensaje('Sesión cerrada.'); } catch { setMensaje('No se pudo confirmar el cierre en el servidor. Se retiró el acceso de esta pantalla.'); } }} />}
    {(ruta==='/cuenta'||ruta==='/habilitar-perfil')&&<EstadoAcceso autenticada={estado.autenticada} comprobando={cargando}/>}
    {cargando ? <p>Comprobando sesión…</p> : ruta === '/recuperar' ? pantallaRecuperacion : ruta === '/acceso' ? estado.autenticada ? <p>Puede continuar usando su cuenta.</p> : acceso : ruta === '/confirmar-correo' ? !estado.autenticada ? acceso : <PantallaConfirmarCorreo key={enlaceVersion}/> : ruta === '/cuenta' || ruta === '/habilitar-perfil' ? !estado.autenticada ? acceso : <Perfil servicio={perfilWeb} habilitar={usuarios.habilitar} correo={correoWeb}/> : <Registro registrar={usuarios.registrar} />}
    {mensaje && <p role="status">{mensaje}</p>}
  </main>;
}

function PantallaConfirmarCorreo(){const[correo,setCorreo]=useState(''),[error,setError]=useState('');useEffect(()=>{void perfilWeb.consultar().then(p=>setCorreo(p.correo)).catch(()=>setError('No fue posible consultar su cuenta.'));},[]);return error?<p>{error}</p>:!correo?<p>Cargando mi cuenta…</p>:!correoWeb.tieneEnlace()?<p>El enlace no es válido. Solicite un cambio nuevo.</p>:<ConfirmarCorreo correo={correo} confirmar={correoWeb.confirmar}/>;}
