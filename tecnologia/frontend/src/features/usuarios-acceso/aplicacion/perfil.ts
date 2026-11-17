import type { ApiUsuarios } from './puertos.js';
import type { ActualizarPerfil, ImagenEntrada } from '../modelos/contratos.js';
export function validarPerfilWeb(d: ActualizarPerfil): Record<string,string> {
  const e:Record<string,string>={};
  const valido=(v:string)=>!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v);
  if(d.nombreMostrar !== undefined && (!valido(d.nombreMostrar) || !d.nombreMostrar.trim() || [...d.nombreMostrar].length>200))e['nombreMostrar']='Ingrese un nombre válido de hasta 200 caracteres.';
  for(const [campo,max]of [['telefono',32],['distrito',100]]as const){const v=d[campo];if(v!==undefined && v!==null && (!valido(v) || [...v].length>max))e[campo]=`Ingrese hasta ${max} caracteres válidos.`;}
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
