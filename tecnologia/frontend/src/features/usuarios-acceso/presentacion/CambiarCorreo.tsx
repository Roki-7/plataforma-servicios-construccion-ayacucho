import {useState} from 'react';
import type {SolicitarCambioCorreo} from '../modelos/contratos.js';
export function CambiarCorreo({version,correo,solicitar}:{version:number;correo:string;solicitar:(datos:SolicitarCambioCorreo)=>Promise<{mensaje:string}>}){
 const [nuevoCorreo,setNuevoCorreo]=useState(''),[mensaje,setMensaje]=useState(''),[ocupado,setOcupado]=useState(false);
 return <section><h3>Cambiar correo de acceso</h3><p>El correo vigente sigue siendo {correo}.</p><form onSubmit={async e=>{e.preventDefault();setMensaje('');setOcupado(true);try{const r=await solicitar({nuevoCorreo,version});setMensaje(r.mensaje);}catch(error){setMensaje(error instanceof Error?error.message:'No fue posible solicitar el cambio.');}finally{setOcupado(false);}}}><label>Nuevo correo<input type="email" autoComplete="email" required value={nuevoCorreo} onChange={e=>setNuevoCorreo(e.target.value)}/></label><button disabled={ocupado}>Solicitar cambio de correo</button></form>{mensaje&&<p>{mensaje}</p>}<p>El servidor comprueba su autenticación reciente. Si se requiere, acredite su contraseña y vuelva a solicitarlo.</p></section>;
}
