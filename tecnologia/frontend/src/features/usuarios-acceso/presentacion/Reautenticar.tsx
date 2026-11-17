import {useState} from 'react';
export function Reautenticar({acreditar}:{acreditar:(contrasena:string)=>Promise<unknown>}){
 const [contrasena,setContrasena]=useState(''),[mensaje,setMensaje]=useState(''),[ocupado,setOcupado]=useState(false);
 return <section><h3>Acreditar acceso para cambiar correo</h3><form onSubmit={async e=>{e.preventDefault();setOcupado(true);setMensaje('');try{await acreditar(contrasena);setMensaje('Contraseña acreditada en esta sesión. Puede solicitar el cambio.');}catch(error){setMensaje(error instanceof Error?error.message:'No fue posible acreditar su acceso.');}finally{setContrasena('');setOcupado(false);}}}><label>Contraseña actual<input type="password" autoComplete="current-password" value={contrasena} onChange={e=>setContrasena(e.target.value)}/></label><button disabled={ocupado}>Acreditar contraseña</button></form>{mensaje&&<p>{mensaje}</p>}</section>;
}
