import {ErrorApi,type ApiUsuarios} from './puertos.js';
import type {SolicitarCambioCorreo} from '../modelos/contratos.js';
import {leerEnlaceRecuperacion,type EnlaceRecuperacion} from './recuperacion.js';
export class CorreoWeb {
 private enlace:EnlaceRecuperacion|null=null;private readonly intentos=new Map<string,{cuerpo:string;clave:string}>();
 private confirmacion:{token:string;datos:{version:number;versionDesafio:number};clave:string}|undefined;
 constructor(private readonly api:ApiUsuarios,private readonly nuevaClave:()=>string){}
 cargarEnlace(fragmento:string){this.enlace=leerEnlaceRecuperacion(fragmento);this.confirmacion=undefined;this.intentos.delete('confirmar');}
 tieneEnlace(){return this.enlace!==null;}
 limpiar(){this.intentos.clear();}
 private clave(operacion:string,datos:unknown){const cuerpo=JSON.stringify(datos);let anterior=this.intentos.get(operacion);if(anterior?.cuerpo!==cuerpo){anterior={cuerpo,clave:this.nuevaClave()};this.intentos.set(operacion,anterior);}return anterior.clave;}
 acreditar=(contrasenaActual:string)=>this.api.enviar('reautenticarSesion',{contrasenaActual});
 solicitar=(datos:SolicitarCambioCorreo)=>this.api.enviar('solicitarCambioCorreo',datos,{clave:this.clave('solicitar',datos)});
 confirmar=async()=>{
  if(!this.enlace)throw new Error('El enlace no es válido. Solicite un cambio nuevo.');
  if(!this.confirmacion){const perfil=await this.api.enviar('consultarPerfil',undefined);const datos={version:perfil.version,versionDesafio:this.enlace.version};this.confirmacion={token:this.enlace.token,datos,clave:this.clave('confirmar',{token:this.enlace.token,...datos})};}
  const intento=this.confirmacion;
  try{const r=await this.api.enviar('confirmarCambioCorreo',intento.datos,{clave:intento.clave,parametros:{token:intento.token}});this.enlace=null;this.confirmacion=undefined;this.intentos.delete('confirmar');return r;}
  catch(error){if(error instanceof ErrorApi&&error.codigo==='VERSION_DESACTUALIZADA')this.confirmacion=undefined;throw error;}
 };
}
