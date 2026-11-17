import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Registro } from '../features/usuarios-acceso/presentacion/Registro.js';
import { HabilitarPerfil } from '../features/usuarios-acceso/presentacion/HabilitarPerfil.js';
import type { Perfil } from '../features/usuarios-acceso/modelos/contratos.js';
import { Acceso } from '../features/usuarios-acceso/presentacion/Acceso.js';
import { EstadoSesion } from '../features/usuarios-acceso/presentacion/EstadoSesion.js';
import { usuarios, sesion } from './usuarios-acceso.js';
import './estilos.css';
export function App() {
  const [ruta, setRuta] = useState(location.pathname); const [estado, setEstado] = useState(sesion.estado()); const [cargando, setCargando] = useState(true); const [mensaje, setMensaje] = useState('');
  const [registrado, setRegistrado] = useState<Perfil>(); const [perfil, setPerfil] = useState<Perfil>();
  useEffect(() => { const quitar = sesion.suscribir(() => setEstado(sesion.estado())); void sesion.restaurar().catch(() => setMensaje('No fue posible recuperar la sesión. Inicie sesión de nuevo.')).finally(() => setCargando(false)); const navegar = () => setRuta(location.pathname); window.addEventListener('popstate', navegar); return () => { quitar(); window.removeEventListener('popstate', navegar); }; }, []);
  useEffect(() => { if (!estado.autenticada || estado.cerrando) return; const timer = setTimeout(() => { void sesion.renovar().catch(() => { setPerfil(undefined); setMensaje('No fue posible renovar la sesión. Inicie sesión de nuevo.'); }); }, Math.max(0, estado.venceAcceso - Date.now() - 30000)); return () => clearTimeout(timer); }, [estado.autenticada, estado.cerrando, estado.venceAcceso]);
  function navegar(e: MouseEvent<HTMLAnchorElement>) { if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; e.preventDefault(); const siguiente = new URL(e.currentTarget.href).pathname; history.pushState(null, '', siguiente); setRuta(siguiente); setMensaje(''); }
  const acceso = <Acceso entrar={async (datos) => { setPerfil(undefined); await sesion.entrar(datos); if (registrado?.correo.toLowerCase() === datos.correo.toLowerCase()) setPerfil(registrado); setMensaje('Sesión iniciada.'); }} />;
  return <main><header><h1>Plataforma Ayacucho</h1><nav><a href="/registro" onClick={navegar}>Crear cuenta</a> · <a href="/acceso" onClick={navegar}>Acceder</a> · <a href="/habilitar-perfil" onClick={navegar}>Mis perfiles</a></nav></header>
    {estado.autenticada && <EstadoSesion ocupado={estado.cerrando} cerrar={async () => { try { await sesion.cerrar(); setMensaje('Sesión cerrada.'); } catch { setMensaje('No se pudo confirmar el cierre en el servidor. Se retiró el acceso de esta pantalla.'); } finally { setPerfil(undefined); setRegistrado(undefined); } }} />}
    {cargando ? <p>Comprobando sesión…</p> : ruta === '/recuperar' ? <section><h2>Recuperación de acceso</h2><p>La recuperación de contraseña estará disponible en la próxima etapa.</p></section> : ruta === '/acceso' ? estado.autenticada ? <p>Puede continuar usando su cuenta.</p> : acceso : ruta === '/habilitar-perfil' ? !estado.autenticada ? acceso : perfil ? <HabilitarPerfil key={perfil.cuentaId} perfilInicial={perfil} habilitar={async (d) => { const actualizado = await usuarios.habilitar(d); setPerfil(actualizado); setRegistrado(actualizado); return actualizado; }} /> : <section><h2>Perfiles de mi cuenta</h2><p>La consulta de perfiles guardados estará disponible en la próxima etapa. Puede añadir el perfil faltante tras registrar e iniciar sesión en esta pantalla.</p></section> : <Registro registrar={async (d) => { const r = await usuarios.registrar(d); setRegistrado({ cuentaId: r.cuentaId, nombreMostrar: d.nombreMostrar, correo: d.correo, telefono: d.telefono ?? null, distrito: d.distrito ?? null, fotografiaId: null, perfiles: r.perfiles, telefonoCompartible: false, version: r.version }); return r; }} />}
    {mensaje && <p role="status">{mensaje}</p>}
  </main>;
}
