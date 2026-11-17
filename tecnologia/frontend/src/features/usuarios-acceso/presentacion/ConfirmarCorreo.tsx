import {useState} from 'react';
export function ConfirmarCorreo({correo,confirmar}:{correo:string;confirmar:()=>Promise<{correo:string}>}){
 const [mensaje,setMensaje]=useState(''),[ocupado,setOcupado]=useState(false),[completado,setCompletado]=useState(false);
 return <section><h2>Verificar nuevo correo</h2>{!completado&&<><p>Correo vigente: {correo}</p><button disabled={ocupado} onClick={async()=>{setOcupado(true);setMensaje('');try{const r=await confirmar();setCompletado(true);setMensaje('Correo actualizado: '+r.correo);}catch(error){setMensaje(error instanceof Error?error.message:'No fue posible confirmar el correo.');}finally{setOcupado(false);}}}>Confirmar nuevo correo</button></>}{mensaje&&<p>{mensaje}</p>}</section>;
}
