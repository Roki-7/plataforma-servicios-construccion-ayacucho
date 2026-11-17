import type {IdCuenta} from './identificadores.js';
import {ErrorAplicacion} from './errores.js';
export interface CambioCorreo {id:string;usuarioId:IdCuenta;sesionSolicitanteId:string;nuevoCorreo:string;tokenDigest:Uint8Array;solicitadaEn:Date;venceEn:Date;autenticacionAcreditadaEn:Date;confirmadaEn:Date|null;invalidadaEn:Date|null;version:number}
export function exigirRecencia(marca:Date|null,ahora:Date):void{if(!marca||!Number.isFinite(+marca)||+ahora-+marca<0||+ahora-+marca>300000)throw new ErrorAplicacion(403,'REAUTENTICACION_REQUERIDA','Introduzca su contraseña actual antes de solicitar el cambio.');}
export const verificacionCorreoNoValida=()=>new ErrorAplicacion(422,'VERIFICACION_CORREO_NO_VALIDA','El enlace no es válido. Solicite un cambio nuevo.');
export function validarCambioCorreo(c:CambioCorreo|null,titular:IdCuenta,version:number,ahora:Date):asserts c is CambioCorreo {
 if(!c)throw verificacionCorreoNoValida();
 if(c.usuarioId!==titular)throw new ErrorAplicacion(403,'SIN_PERMISO','No dispone de permiso para esta operación.');
 if(c.confirmadaEn||c.invalidadaEn||+ahora>=+c.venceEn)throw verificacionCorreoNoValida();
 if(c.version!==version)throw new ErrorAplicacion(409,'VERSION_DESACTUALIZADA','El desafío cambió. Consulte de nuevo.');
}
