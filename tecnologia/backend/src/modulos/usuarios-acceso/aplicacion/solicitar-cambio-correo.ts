import type {RepositorioCuentas,RepositorioRegistro,LectorSesion,Reloj,GeneradorSecretos,ProgramarCorreoSeguridad} from './puertos/puertos.js';
import type {RepositorioAutenticacion} from './puertos/sesiones.js';
import type {RepositorioCambiosCorreo,PlantillasCorreo} from './puertos/correo.js';
import type {Idempotencia} from '../../../compartido/aplicacion/idempotencia.js';
import {identidadVigente} from './consultar-perfil.js';
import {exigirRecencia} from '../dominio/cambio-correo.js';
import {ErrorAplicacion,datosInvalidos} from '../dominio/errores.js';
export class SolicitarCambioCorreo {
 constructor(private readonly cuentas:RepositorioCuentas&RepositorioRegistro,private readonly sesiones:RepositorioAutenticacion,private readonly cambios:RepositorioCambiosCorreo,private readonly lector:LectorSesion,private readonly idempotencia:Idempotencia,private readonly reloj:Reloj,private readonly secretos:GeneradorSecretos,private readonly correo:ProgramarCorreoSeguridad,private readonly plantillas:PlantillasCorreo){}
 async ejecutar(datos:{version:number;nuevoCorreo:string},clave:string,token:string){
  if(!Number.isSafeInteger(datos.version)||datos.version<1||typeof datos.nuevoCorreo!=='string'||!datos.nuevoCorreo.isWellFormed()||[...datos.nuevoCorreo].length>320||!/^[^\s@]+@[^\s@]+$/.test(datos.nuevoCorreo))throw datosInvalidos();
  const i=await identidadVigente(this.lector,token);
  return this.idempotencia.ejecutar({ambito:{tipo:'usuario',id:i.cuentaId},autorizar:async()=>(await identidadVigente(this.lector,token)).cuentaId,metodo:'POST',rutaLogica:'/perfil/cambios-correo',clave,cuerpo:datos},async tx=>{
   const p=await this.cuentas.perfilBloqueado(i.cuentaId,tx);await this.cuentas.exigirSesion(i,this.reloj.ahora(),tx);
   const s=await this.sesiones.bloquearSesion(i.sesionId,tx,{tipo:'acceso',digest:this.secretos.digest(token)});const ahora=this.reloj.ahora();exigirRecencia(s?.autenticadaConContrasenaEn??null,ahora);
   if(p.version!==datos.version)throw new ErrorAplicacion(409,'VERSION_DESACTUALIZADA','El perfil cambió. Consulte de nuevo.');
   const ocupada=await this.cuentas.buscarPorCorreo(datos.nuevoCorreo,tx);if(ocupada&&ocupada.id!==i.cuentaId)throw new ErrorAplicacion(409,'CORREO_EN_USO','Ese correo ya está registrado.');
   const secreto=this.secretos.secreto(),id=this.secretos.uuid(),venceEn=new Date(+ahora+1800000);
   await this.cambios.crear({id,usuarioId:i.cuentaId,sesionSolicitanteId:i.sesionId,nuevoCorreo:datos.nuevoCorreo,tokenDigest:this.secretos.digest(secreto),solicitadaEn:ahora,venceEn,autenticacionAcreditadaEn:s!.autenticadaConContrasenaEn!,confirmadaEn:null,invalidadaEn:null,version:1},tx);
   await this.correo.programar({tipo:'verificar_correo',destinatario:datos.nuevoCorreo,...this.plantillas.verificarCorreo(secreto,1),desafioId:id,venceEn,claveLogica:'verificar-correo:'+id},tx);
   return {http:202,cuerpo:{cambioId:id,venceEn:venceEn.toISOString(),mensaje:'Revise su nuevo correo. El correo anterior sigue vigente hasta completar la verificación.'}};
  });
 }
}
