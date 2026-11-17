import type {RepositorioCuentas,RepositorioRegistro,LectorSesion,Reloj,HashContrasena,UnidadDeTrabajo} from './puertos/puertos.js';
import type {RepositorioAutenticacion} from './puertos/sesiones.js';
import type {RepositorioCambiosCorreo} from './puertos/correo.js';
import {identidadVigente} from './consultar-perfil.js';
import {evaluarIntento} from '../dominio/control-intentos.js';
import {datosInvalidos,ErrorAplicacion} from '../dominio/errores.js';
export class ReautenticarSesion {
 constructor(private readonly cuentas:RepositorioCuentas&RepositorioRegistro,private readonly sesiones:RepositorioAutenticacion,private readonly cambios:RepositorioCambiosCorreo,private readonly lector:LectorSesion,private readonly uow:UnidadDeTrabajo,private readonly hash:HashContrasena,private readonly reloj:Reloj){}
 async ejecutar(token:string,contrasenaActual:string){
  if(typeof contrasenaActual!=='string'||!contrasenaActual.isWellFormed()||[...contrasenaActual].length>128)throw datosInvalidos();
  const i=await identidadVigente(this.lector,token),cuenta=await this.cambios.leerCredencial(i.cuentaId);if(!cuenta)throw new ErrorAplicacion(401,'SESION_NO_VALIDA','Sesión no válida.');
  const correcta=await this.hash.verificar(contrasenaActual,cuenta.contrasenaHash);
  const resultado=await this.uow.ejecutar(async tx=>{
   const actual=await this.sesiones.bloquearCuenta(i.cuentaId,tx);const ahora=this.reloj.ahora();
   if(!actual||actual.versionCredencial!==cuenta.versionCredencial)throw new ErrorAplicacion(401,'SESION_NO_VALIDA','Sesión no válida.');
   await this.cuentas.exigirSesion(i,ahora,tx);
   const intento=evaluarIntento(actual,correcta,ahora);if(intento.estado!==actual)await this.sesiones.guardarIntentos(i.cuentaId,intento.estado,tx);
   if(intento.espera)return new ErrorAplicacion(429,'CUENTA_TEMPORALMENTE_BLOQUEADA','Espere antes de volver a intentarlo.',[],intento.espera);
   if(!intento.permitido)return new ErrorAplicacion(422,'CONTRASENA_ACTUAL_INVALIDA','Contraseña actual incorrecta.');
   await this.cambios.acreditar(i.sesionId,ahora,tx);return {autenticacionConContrasenaEn:ahora.toISOString()};
  });if(resultado instanceof ErrorAplicacion)throw resultado;return resultado;
 }
}
