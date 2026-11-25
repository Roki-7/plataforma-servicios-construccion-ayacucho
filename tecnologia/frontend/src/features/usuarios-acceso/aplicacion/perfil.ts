import type { ApiUsuarios } from './puertos.js';
import type { ActualizarPerfil, ImagenEntrada } from '../modelos/contratos.js';
import { motivoDistrito, motivoNombre, motivoTelefono } from './validacion-contacto.js';
export function validarPerfilWeb(d: ActualizarPerfil): Record<string,string> {
  const e:Record<string,string>={};
  if(d.nombreMostrar !== undefined){const m=motivoNombre(d.nombreMostrar);if(m)e['nombreMostrar']=m;}
  if(d.telefono !== undefined && d.telefono !== null){const m=motivoTelefono(d.telefono);if(m)e['telefono']=m;}
  if(d.distrito !== undefined && d.distrito !== null){const m=motivoDistrito(d.distrito);if(m)e['distrito']=m;}
  return e;
}
export class PerfilWeb {
  private readonly intentos=new Map<string,{cuerpo:string;clave:string}>();
  constructor(private readonly api:ApiUsuarios,private readonly nuevaClave:()=>string){}
  private clave(operacion:string,datos:unknown):string {const cuerpo=JSON.stringify(datos);let intento=this.intentos.get(operacion);if(intento?.cuerpo!==cuerpo){intento={cuerpo,clave:this.nuevaClave()};this.intentos.set(operacion,intento);}return intento.clave;}
  limpiar=()=>this.intentos.clear();
  consultar=()=>this.api.enviar('consultarPerfil',undefined);
  guardar=async(d:ActualizarPerfil)=>{const p=await this.api.enviar('actualizarPerfil',d,{clave:this.clave('perfil',d)});this.intentos.clear();return p;};
  subir=(imagen:ImagenEntrada)=>this.api.enviar('subirFotografia',imagen,{clave:this.clave('foto',imagen)});
  leer=(id:string)=>this.api.enviar('leerFotografia',undefined,{parametros:{fotografiaId:id}});
}
