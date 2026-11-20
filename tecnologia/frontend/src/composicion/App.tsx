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
import { ServiciosPropios } from '../features/prestadores-catalogo/presentacion/ServiciosPropios.js';
import { BuscarOferta } from '../features/prestadores-catalogo/presentacion/BuscarOferta.js';
import { DetallePrestador, DetalleServicio } from '../features/prestadores-catalogo/presentacion/DetallePrestador.js';
import { busquedaWeb, categoriasWeb, portafolioWeb, serviciosWeb } from './prestadores-catalogo.js';
import { mensajeDeError } from '../features/prestadores-catalogo/aplicacion/portafolio.js';
import type { OpcionCategoria } from '../features/prestadores-catalogo/aplicacion/categorias.js';
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
    // Las pantallas profesionales conservan su destino tras iniciar sesión (la URL no cambia mientras se muestra el acceso). El resto de los recorridos base no cambia.
    if (location.pathname !== '/confirmar-correo' || !correoWeb.tieneEnlace()) ir(rutasProfesionales.includes(location.pathname) ? location.pathname : '/cuenta');
  }} />;
  const pantallaRecuperacion = recuperacion.tieneEnlace() ? <EstablecerContrasena key={enlaceVersion} establecer={(nueva, confirmacion) => recuperacion.consumir(nueva, confirmacion)} completada={() => { sesion.invalidar(); history.replaceState(null, '', '/acceso'); setRuta('/acceso'); setMensaje('Contraseña actualizada. Inicie sesión con su nueva contraseña.'); }} /> : recuperacion.enlaceInvalido ? <section><h2>Enlace no válido</h2><p>Solicite un enlace nuevo para recuperar el acceso.</p><a href="/recuperar">Solicitar un enlace nuevo</a></section> : <RecuperarAcceso solicitar={(correo) => recuperacion.solicitar(correo)} />;
  const rutaCuenta = ruta === '/cuenta' || ruta === '/habilitar-perfil';
  let contenido: ReactNode;
  const uuidRuta = '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})';
  const prestadorRuta = new RegExp('^/prestadores/' + uuidRuta + '$').exec(ruta)?.[1]; const servicioRuta = new RegExp('^/servicios/' + uuidRuta + '$').exec(ruta)?.[1];
  if (cargando && ruta !== '/buscar' && !prestadorRuta && !servicioRuta) contenido = <p>Comprobando sesión…</p>;
  else if (ruta === '/buscar') contenido = <PantallaBusqueda alVerPrestador={id => ir('/prestadores/' + id)} alVerServicio={id => ir('/servicios/' + id)} />;
  else if (prestadorRuta) contenido = <DetallePrestador key={prestadorRuta} busqueda={busquedaWeb} prestadorId={prestadorRuta} alVerServicio={id => ir('/servicios/' + id)} />;
  else if (servicioRuta) contenido = <DetalleServicio key={servicioRuta} busqueda={busquedaWeb} servicioId={servicioRuta} alVerPrestador={id => ir('/prestadores/' + id)} />;
  else if (ruta === '/recuperar') contenido = pantallaRecuperacion;
  else if (estado.autenticada) {
    if (ruta === '/confirmar-correo') contenido = <PantallaConfirmarCorreo key={enlaceVersion} />;
    else if (ruta === '/cambiar-contrasena') contenido = <PantallaCambiarContrasena />;
    else if (ruta === '/prestador/perfil') contenido = <RequierePrestador><PantallaPerfilProfesional /></RequierePrestador>;
    else if (ruta === '/prestador/servicios') contenido = <RequierePrestador><PantallaServicios /></RequierePrestador>;
    else contenido = <Perfil vista={ruta === '/habilitar-perfil' ? 'perfiles' : 'cuenta'} servicio={perfilWeb} habilitar={usuarios.habilitar} correo={correoWeb} />;
  } else if (rutaCuenta || ['/acceso', '/confirmar-correo', '/cambiar-contrasena', '/prestador/perfil', '/prestador/servicios'].includes(ruta)) {
    contenido = <>{rutaCuenta && <EstadoAcceso autenticada={false} comprobando={false} />}{acceso}</>;
  } else {
    contenido = <Registro registrar={usuarios.registrar} iniciarSesion={correo => { setCorreoInicial(correo); ir('/acceso'); }} />;
  }

  return <main>
    <header>
      <h1>Plataforma Ayacucho</h1>
      <nav aria-label="Navegación principal">
        <a href="/buscar" aria-current={ruta === '/buscar' ? 'page' : undefined} onClick={navegar}>Buscar servicios</a>
        {estado.autenticada ? <>
          <a href="/cuenta" aria-current={ruta === '/cuenta' ? 'page' : undefined} onClick={navegar}>Mi cuenta</a>
          <a href="/habilitar-perfil" aria-current={ruta === '/habilitar-perfil' ? 'page' : undefined} onClick={navegar}>Mis perfiles</a>
          <a href="/prestador/perfil" aria-current={ruta === '/prestador/perfil' ? 'page' : undefined} onClick={navegar}>Mi perfil profesional</a>
          <a href="/prestador/servicios" aria-current={ruta === '/prestador/servicios' ? 'page' : undefined} onClick={navegar}>Mis servicios</a>
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

/** Rutas privadas de los flujos de Prestadores y Catálogo. Tras iniciar sesión desde una de ellas se vuelve a la misma pantalla. */
const rutasProfesionales = ['/prestador/perfil', '/prestador/servicios'];

type EstadoCategorias = { readonly opciones?: readonly OpcionCategoria[]; readonly error?: string };
/** Categorías activas de la consulta pública (anónima). Se cargan una vez y se pueden reintentar. */
function useCategorias(): EstadoCategorias & { readonly reintentar: () => void } {
  const [estado, setEstado] = useState<EstadoCategorias>({}); const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    categoriasWeb.cargar().then(opciones => { if (activo) setEstado({ opciones }); }).catch(e => { if (activo) setEstado({ error: mensajeDeError(e) }); });
    return () => { activo = false; };
  }, [intento]);
  return { ...estado, reintentar: () => { categoriasWeb.reiniciar(); setEstado({}); setIntento(n => n + 1); } };
}

/** La búsqueda pública no requiere sesión ni categorías: si estas no cargan, se busca sin el filtro de categoría. */
function PantallaBusqueda({ alVerPrestador, alVerServicio }: { readonly alVerPrestador: (id: string) => void; readonly alVerServicio: (id: string) => void }) {
  const { opciones } = useCategorias();
  return <BuscarOferta busqueda={busquedaWeb} categorias={opciones ?? []} alVerPrestador={alVerPrestador} alVerServicio={alVerServicio} />;
}

/** Las pantallas profesionales requieren las categorías: sin ellas no se puede elegir una especialidad ni una categoría de servicio. */
function ConCategorias({ children }: { readonly children: (opciones: readonly OpcionCategoria[]) => ReactNode }) {
  const { opciones, error, reintentar } = useCategorias();
  if (error) return <div role="alert"><p>{error}</p><p>No fue posible cargar las categorías disponibles.</p><button type="button" onClick={reintentar}>Reintentar</button></div>;
  if (!opciones) return <p>Cargando categorías…</p>;
  return <>{children(opciones)}</>;
}

function PantallaPerfilProfesional() {
  return <ConCategorias>{opciones => <PerfilProfesional servicio={portafolioWeb} especialidades={opciones} />}</ConCategorias>;
}

function PantallaServicios() {
  return <ConCategorias>{opciones => <ServiciosPropios servicio={serviciosWeb} categorias={opciones} />}</ConCategorias>;
}

/**
 * El permiso de prestador se comprueba en el servidor en cada operación. Aquí solo se evita mostrar una pantalla que la cuenta no puede usar:
 * se consulta el perfil de la cuenta (identidad de la sesión existente) y, si no tiene el perfil de prestador, se ofrece habilitarlo.
 */
function RequierePrestador({ children }: { readonly children: ReactNode }) {
  const [estado, setEstado] = useState<{ readonly perfiles?: readonly string[]; readonly error?: string }>({}); const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    perfilWeb.consultar().then(p => { if (activo) setEstado({ perfiles: p.perfiles }); }).catch(e => { if (activo) setEstado({ error: mensajeDeError(e) }); });
    return () => { activo = false; };
  }, [intento]);
  if (estado.error) return <div role="alert"><p>{estado.error}</p><button type="button" onClick={() => { setEstado({}); setIntento(n => n + 1); }}>Reintentar</button></div>;
  if (!estado.perfiles) return <p>Comprobando su perfil…</p>;
  if (!estado.perfiles.includes('prestador')) {
    return <section><h2>Perfil de prestador requerido</h2><p>Su cuenta no tiene habilitado el perfil de prestador. Habilítelo para publicar su perfil profesional y sus servicios.</p><a href="/habilitar-perfil">Habilitar perfil de prestador</a></section>;
  }
  return <>{children}</>;
}

function PantallaCambiarContrasena() {
  const [servicio] = useState(prepararCambioContrasena);
  return <CambiarContrasena cambiar={servicio.cambiar} />;
}

function PantallaConfirmarCorreo(){const[correo,setCorreo]=useState(''),[error,setError]=useState('');useEffect(()=>{void perfilWeb.consultar().then(p=>setCorreo(p.correo)).catch(()=>setError('No fue posible consultar su cuenta.'));},[]);return error?<p>{error}</p>:!correo?<p>Cargando mi cuenta…</p>:!correoWeb.tieneEnlace()?<p>El enlace no es válido. Solicite un cambio nuevo.</p>:<ConfirmarCorreo correo={correo} confirmar={correoWeb.confirmar}/>;}
