import type {RepositorioRegistro,LectorSesion,Reloj,GeneradorSecretos} from './puertos/puertos.js';
import type {RepositorioCambiosCorreo} from './puertos/correo.js';
import type {Idempotencia} from '../../../compartido/aplicacion/idempotencia.js';
import {identidadVigente} from './consultar-perfil.js';
import {validarCambioCorreo} from '../dominio/cambio-correo.js';
import {ErrorAplicacion,datosInvalidos} from '../dominio/errores.js';
import {perfilResultado} from './perfil-resultado.js';
export class ConfirmarCambioCorreo {
 constructor(private readonly cuentas:RepositorioRegistro,private readonly cambios:RepositorioCambiosCorreo,private readonly lector:LectorSesion,private readonly idempotencia:Idempotencia,private readonly reloj:Reloj,private readonly secretos:GeneradorSecretos){}
 async ejecutar(tokenCambio:string,datos:{version:number;versionDesafio:number},clave:string,tokenAcceso:string){
  if(!/^[A-Za-z0-9_-]{43}$/.test(tokenCambio)||![datos.version,datos.versionDesafio].every(v=>Number.isSafeInteger(v)&&v>0))throw datosInvalidos();
  const i=await identidadVigente(this.lector,tokenAcceso);
  return this.idempotencia.ejecutar({ambito:{tipo:'usuario',id:i.cuentaId},autorizar:async()=>(await identidadVigente(this.lector,tokenAcceso)).cuentaId,metodo:'POST',rutaLogica:'/perfil/cambios-correo/{token}/confirmacion',token:tokenCambio,clave,cuerpo:datos},async tx=>{
   const p=await this.cuentas.perfilBloqueado(i.cuentaId,tx);await this.cuentas.exigirSesion(i,this.reloj.ahora(),tx);
   const c=await this.cambios.bloquear(this.secretos.digest(tokenCambio),tx);const ahora=this.reloj.ahora();validarCambioCorreo(c,i.cuentaId,datos.versionDesafio,ahora);
   if(p.version!==datos.version)throw new ErrorAplicacion(409,'VERSION_DESACTUALIZADA','El perfil cambió. Consulte de nuevo.');
   await this.cambios.confirmar(c,ahora,tx);return {http:200,cuerpo:{...perfilResultado(await this.cuentas.perfilBloqueado(i.cuentaId,tx))}};
  });
 }
}
