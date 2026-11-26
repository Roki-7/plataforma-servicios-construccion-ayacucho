import {CambiarCorreo} from './CambiarCorreo.js';
import {Reautenticar} from './Reautenticar.js';
import type {CorreoWeb} from '../aplicacion/correo.js';
import { useCallback, useEffect, useState } from 'react';
import type { Perfil as DatosPerfil, FotografiaLectura } from '../modelos/contratos.js';
import type { PerfilWeb } from '../aplicacion/perfil.js';
import type { HabilitarPerfil as DatosHabilitar } from '../modelos/contratos.js';
import { EditarPerfil } from './EditarPerfil.js';
import { HabilitarPerfil } from './HabilitarPerfil.js';
import { mensajeAcceso } from './EstadoAcceso.js';
import { Avatar } from '../../../compartido/Avatar.js';
import { useFotoUrl } from './useFotoUrl.js';
export function FotoPerfil({id,leer,nombre=''}:{id:string;leer:(id:string)=>Promise<FotografiaLectura>;nombre?:string}){
 const {url,error}=useFotoUrl(id,leer);
 return error?<p role="status">No fue posible cargar la fotografía.</p>:url?<Avatar nombre={nombre} url={url} tamano="grande" alt="Fotografía de mi cuenta"/>:<p>Cargando fotografía…</p>;
}
export function Perfil({vista,servicio,habilitar,correo,alActualizar}:{vista:'cuenta'|'perfiles';servicio:PerfilWeb;correo?:CorreoWeb;habilitar:(d:DatosHabilitar)=>Promise<DatosPerfil>;alActualizar?:(p:DatosPerfil)=>void}){
 const [perfil,setPerfil]=useState<DatosPerfil>(),[error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[revision,setRevision]=useState(0);
 const consultar=servicio.consultar;
 const recargar=useCallback(()=>{setError('');setMensaje('');setPerfil(undefined);setRevision(v=>v+1)},[]);
 useEffect(()=>{let viva=true;void consultar().then(p=>{if(viva)setPerfil(p)}).catch(e=>{if(viva)setError(mensajeAcceso(e))});return()=>{viva=false}},[consultar,revision]);
 if(error)return <section><h2>{vista === 'cuenta' ? 'Mi cuenta' : 'Mis perfiles'}</h2><p role="status">{error}</p><button onClick={recargar}>Reintentar consulta</button></section>;
 if(!perfil)return <p>Cargando mi cuenta…</p>;
 if (vista === 'perfiles') return <HabilitarPerfil perfilInicial={perfil} habilitar={async datos => {
  const actualizado = await habilitar(datos);
  setPerfil(actualizado);
  alActualizar?.(actualizado);
  return actualizado;
 }} />;
 return <section className="pagina-cuenta">
  <div className="cabecera-pagina"><p className="sobretitulo">Tu espacio</p>
  <div className="cuenta-identidad">{perfil.fotografiaId ? <FotoPerfil id={perfil.fotografiaId} leer={servicio.leer} nombre={perfil.nombreMostrar} /> : <Avatar nombre={perfil.nombreMostrar} tamano="grande" />}
  <div className="cuenta-datos"><h2>Mi cuenta</h2><p className="cuenta-nombre">{perfil.nombreMostrar}</p>
  <p className="intro">{perfil.correo}</p>
  <p><span className="etiqueta-estado">{perfil.telefonoCompartible ? 'El teléfono está autorizado para compartir.' : 'El teléfono es privado.'}</span></p></div></div></div>
  <div className="columnas-cuenta"><div className="columna-cuenta">
  <EditarPerfil key={`${perfil.cuentaId}:${perfil.version}`} perfil={perfil} guardar={servicio.guardar} subir={servicio.subir} actualizado={p => { setPerfil(p); setMensaje('Perfil actualizado.'); alActualizar?.(p); }} recargar={recargar} />
  {mensaje && <p className="aviso" aria-live="polite">{mensaje}</p>}
  </div><div className="columna-cuenta">
  <section className="acciones-cuenta">
    <h2>Acceso y seguridad</h2>
    <p><a href="/cambiar-contrasena">Cambiar contraseña</a></p>
    {correo && <>
      <Reautenticar acreditar={correo.acreditar} />
      <CambiarCorreo version={perfil.version} correo={perfil.correo} solicitar={correo.solicitar} />
    </>}
  </section>
  </div></div>
 </section>;
}
