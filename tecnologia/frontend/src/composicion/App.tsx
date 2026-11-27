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
import { BarraLateral, type EnlaceMenu } from './BarraLateral.js';
import { PortadaMarca } from '../compartido/Marca.js';
import { useCuentaSesion } from '../features/usuarios-acceso/presentacion/useCuentaSesion.js';
import { EditorSolicitud } from '../features/solicitudes-cotizaciones/presentacion/EditorSolicitud.js';
import { ListaSolicitudes } from '../features/solicitudes-cotizaciones/presentacion/ListaSolicitudes.js';
import { Oportunidades, SolicitudesRecibidas } from '../features/solicitudes-cotizaciones/presentacion/ListasPrestador.js';
import { DetalleSolicitudPrestador } from '../features/solicitudes-cotizaciones/presentacion/DetalleSolicitudPrestador.js';
import { solicitudesWeb } from './solicitudes-cotizaciones.js';
import './estilos.css';
import '../features/solicitudes-cotizaciones/presentacion/solicitudes.css';

const uuidRuta = '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})';
const detalleSolicitud = new RegExp('^/solicitudes/' + uuidRuta + '$');
const esRutaSolicitudes = (ruta: string) => ruta === '/solicitudes' || ruta === '/solicitudes/nueva' || detalleSolicitud.test(ruta);
const detalleSolicitudPrestador = new RegExp('^/prestador/solicitudes/' + uuidRuta + '$');
/** Recorrido del prestador (HU08): oportunidades, solicitudes recibidas y su detalle de solo lectura. */
const esRutaPrestadorSolicitudes = (ruta: string) => ruta === '/prestador/oportunidades' || ruta === '/prestador/solicitudes' || detalleSolicitudPrestador.test(ruta);

export function App() {
  const [ruta, setRuta] = useState(location.pathname); const [estado, setEstado] = useState(sesion.estado()); const [cargando, setCargando] = useState(true); const [mensaje, setMensaje] = useState('');
  const [enlaceVersion, setEnlaceVersion] = useState(0);
  const [correoInicial, setCorreoInicial] = useState('');
  const [cierres, setCierres] = useState(0); const [trasCierre, setTrasCierre] = useState(false);
  const { cuenta, refrescar: refrescarCuenta } = useCuentaSesion(perfilWeb, estado.autenticada);
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
    const destino = new URL(evento.currentTarget.href).pathname;
    ir(destino);
    if (esRutaSolicitudes(destino) || esRutaPrestadorSolicitudes(destino)) window.scrollTo(0, 0);
  }

  const acceso = <Acceso key={cierres} trasCierre={trasCierre} correoInicial={correoInicial} entrar={async (datos) => {
    setMensaje('');
    await sesion.entrar(datos);
    setCorreoInicial('');
    setTrasCierre(false);
    if (location.pathname !== '/confirmar-correo' || !correoWeb.tieneEnlace()) {
      const destino = location.pathname;
      ir(rutasProfesionales.includes(destino) || esRutaSolicitudes(destino) || esRutaPrestadorSolicitudes(destino) ? destino : '/cuenta');
    }
  }} />;
  const pantallaRecuperacion = recuperacion.tieneEnlace() ? <EstablecerContrasena key={enlaceVersion} establecer={(nueva, confirmacion) => recuperacion.consumir(nueva, confirmacion)} completada={() => { sesion.invalidar(); history.replaceState(null, '', '/acceso'); setRuta('/acceso'); setMensaje('Contraseña actualizada. Inicie sesión con su nueva contraseña.'); }} /> : recuperacion.enlaceInvalido ? <section><h2>Enlace no válido</h2><p>Solicite un enlace nuevo para recuperar el acceso.</p><a href="/recuperar">Solicitar un enlace nuevo</a></section> : <RecuperarAcceso solicitar={(correo) => recuperacion.solicitar(correo)} />;
  const rutaCuenta = ruta === '/cuenta' || ruta === '/habilitar-perfil';
  let contenido: ReactNode;
  const prestadorRuta = new RegExp('^/prestadores/' + uuidRuta + '$').exec(ruta)?.[1]; const servicioRuta = new RegExp('^/servicios/' + uuidRuta + '$').exec(ruta)?.[1];
  const solicitudRuta = detalleSolicitud.exec(ruta)?.[1];
  const solicitudPrestadorRuta = detalleSolicitudPrestador.exec(ruta)?.[1];
  const borradorGuardado = Boolean(solicitudRuta && mensaje === 'Borrador guardado.');
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
    else if (ruta === '/prestador/oportunidades') contenido = <RequierePrestador><Oportunidades api={solicitudesWeb} categorias={categoriasWeb} alNavegar={navegar} /></RequierePrestador>;
    else if (ruta === '/prestador/solicitudes') contenido = <RequierePrestador><SolicitudesRecibidas api={solicitudesWeb} categorias={categoriasWeb} alNavegar={navegar} /></RequierePrestador>;
    else if (solicitudPrestadorRuta) contenido = <RequierePrestador><DetalleSolicitudPrestador key={solicitudPrestadorRuta} api={solicitudesWeb} categorias={categoriasWeb} id={solicitudPrestadorRuta} alNavegar={navegar} /></RequierePrestador>;
    else if (ruta === '/solicitudes') contenido = <ListaSolicitudes api={solicitudesWeb} alNavegar={navegar} />;
    else if (ruta === '/solicitudes/nueva' || solicitudRuta) contenido = <EditorSolicitud key={solicitudRuta ?? 'nueva'} id={solicitudRuta} api={solicitudesWeb} busqueda={busquedaWeb} categorias={categoriasWeb}
      alNavegar={navegar} mensajeInicial={borradorGuardado ? mensaje : undefined}
      alCrear={id => { ir('/solicitudes/' + id, 'Borrador guardado.'); window.scrollTo(0, 0); }} />;
    else contenido = <Perfil vista={ruta === '/habilitar-perfil' ? 'perfiles' : 'cuenta'} servicio={perfilWeb} habilitar={usuarios.habilitar} correo={correoWeb} alActualizar={refrescarCuenta} />;
  } else if (rutaCuenta || esRutaSolicitudes(ruta) || esRutaPrestadorSolicitudes(ruta) || ['/acceso', '/confirmar-correo', '/cambiar-contrasena', '/prestador/perfil', '/prestador/servicios'].includes(ruta)) {
    contenido = <><PortadaMarca />{rutaCuenta && <EstadoAcceso autenticada={false} comprobando={false} />}{acceso}</>;
  } else {
    contenido = <><PortadaMarca /><Registro registrar={usuarios.registrar} iniciarSesion={correo => { setCorreoInicial(correo); ir('/acceso'); }} /></>;
  }

  const enlaces: EnlaceMenu[] = estado.autenticada
    ? [{ href: '/buscar', texto: 'Buscar servicios', icono: 'buscar', actual: ruta === '/buscar' }, { href: '/cuenta', texto: 'Mi cuenta', icono: 'cuenta', actual: ruta === '/cuenta' },
      { href: '/solicitudes', texto: 'Mis solicitudes', icono: 'servicios', actual: esRutaSolicitudes(ruta) },
      { href: '/habilitar-perfil', texto: 'Mis perfiles', icono: 'perfiles', actual: ruta === '/habilitar-perfil' }, { href: '/prestador/perfil', texto: 'Mi perfil profesional', icono: 'profesional', actual: ruta === '/prestador/perfil' },
      { href: '/prestador/servicios', texto: 'Mis servicios', icono: 'servicios', actual: ruta === '/prestador/servicios' },
      { href: '/prestador/oportunidades', texto: 'Oportunidades', icono: 'buscar', actual: ruta === '/prestador/oportunidades' },
      { href: '/prestador/solicitudes', texto: 'Solicitudes recibidas', icono: 'servicios', actual: ruta === '/prestador/solicitudes' || Boolean(solicitudPrestadorRuta) }]
    : [{ href: '/buscar', texto: 'Buscar servicios', icono: 'buscar', actual: ruta === '/buscar' }, { href: '/registro', texto: 'Crear cuenta', icono: 'registro', actual: ruta === '/' || ruta === '/registro' },
      { href: '/acceso', texto: 'Acceder', icono: 'acceso', actual: ruta === '/acceso' }];
  return <div className="app">
    <a className="app-saltar" href="#contenido">Saltar al contenido</a>
    <BarraLateral ruta={ruta} enlaces={enlaces} alNavegar={navegar} cuenta={cuenta} cierre={estado.autenticada ? <EstadoSesion ocupado={estado.cerrando} cerrar={async () => {
      try { await sesion.cerrar(); setCierres(v => v + 1); setTrasCierre(true); ir('/acceso', 'Sesión cerrada.'); }
      catch { setCierres(v => v + 1); setTrasCierre(true); ir('/acceso', 'No se pudo confirmar el cierre en el servidor. Se retiró el acceso de esta pantalla.'); }
    }} /> : undefined} />
    <main id="contenido" className="app-contenido" tabIndex={-1}>
    <div className="superficie">
      {mensaje && !borradorGuardado && <p className="aviso" role="status">{mensaje}</p>}
      {contenido}
    </div>
    </main>
  </div>;
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
