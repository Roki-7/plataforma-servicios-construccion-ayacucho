import { useCallback, useEffect, useState } from 'react';
import type { Perfil as DatosPerfil, FotografiaLectura } from '../modelos/contratos.js';
import type { PerfilWeb } from '../aplicacion/perfil.js';
import type { HabilitarPerfil as DatosHabilitar } from '../modelos/contratos.js';
import { EditarPerfil } from './EditarPerfil.js';
import { HabilitarPerfil } from './HabilitarPerfil.js';
export function FotoPerfil({id,leer}:{id:string;leer:(id:string)=>Promise<FotografiaLectura>}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let viva=true;let creada:string|undefined;setUrl('');setError('');void leer(id).then(f=>{if(!viva)return;const bytes=Uint8Array.from(atob(f.contenidoBase64),c=>c.charCodeAt(0));creada=URL.createObjectURL(new Blob([bytes],{type:f.tipoContenido}));setUrl(creada)}).catch(()=>{if(viva)setError('No fue posible cargar la fotografía.')});return()=>{viva=false;if(creada)URL.revokeObjectURL(creada)}},[id,leer]);
 return error?<p role="status">{error}</p>:url?<img src={url} alt="Fotografía de mi cuenta" style={{maxWidth:'100%',width:160}}/>:<p>Cargando fotografía…</p>;
}
export function Perfil({servicio,habilitar}:{servicio:PerfilWeb;habilitar:(d:DatosHabilitar)=>Promise<DatosPerfil>}){
 const [perfil,setPerfil]=useState<DatosPerfil>(),[error,setError]=useState(''),[mensaje,setMensaje]=useState(''),[revision,setRevision]=useState(0);
 const consultar=servicio.consultar;
 const recargar=useCallback(()=>{setError('');setMensaje('');setPerfil(undefined);setRevision(v=>v+1)},[]);
 useEffect(()=>{let viva=true;void consultar().then(p=>{if(viva)setPerfil(p)}).catch(e=>{if(viva)setError(e instanceof Error?e.message:'No fue posible consultar el perfil.')});return()=>{viva=false}},[consultar,revision]);
 if(error)return <section><h2>Mi cuenta</h2><p role="status">{error}</p><button onClick={recargar}>Reintentar consulta</button></section>;
 if(!perfil)return <p>Cargando mi cuenta…</p>;
 return <section><h2>Mi cuenta</h2><p>{perfil.correo}</p><p>{perfil.telefonoCompartible?'El teléfono está autorizado para compartir.':'El teléfono es privado.'}</p>{perfil.fotografiaId&&<FotoPerfil id={perfil.fotografiaId} leer={servicio.leer}/>}<EditarPerfil key={`${perfil.cuentaId}:${perfil.version}`} perfil={perfil} guardar={servicio.guardar} subir={servicio.subir} actualizado={p=>{setPerfil(p);setMensaje('Perfil actualizado.')}} recargar={recargar}/>{mensaje&&<p>{mensaje}</p>}<HabilitarPerfil key={`perfiles:${perfil.version}`} perfilInicial={perfil} habilitar={async d=>{const p=await habilitar(d);setPerfil(p);setMensaje('Perfil habilitado. Se conservan su cuenta y sus datos.');return p}}/><p>El correo y la contraseña se cambian mediante sus flujos específicos, disponibles en próximas etapas.</p></section>;
}
