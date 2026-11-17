import type {CambioCorreo} from '../../dominio/cambio-correo.js';
import type {IdCuenta} from '../../dominio/identificadores.js';
import type {ContextoTransaccion,CuentaLectura} from './puertos.js';
export interface RepositorioCambiosCorreo {
 leerCredencial(id:IdCuenta):Promise<CuentaLectura|null>;
 crear(c:CambioCorreo,tx:ContextoTransaccion):Promise<void>;
 bloquear(digest:Uint8Array,tx:ContextoTransaccion):Promise<CambioCorreo|null>;
 confirmar(c:CambioCorreo,ahora:Date,tx:ContextoTransaccion):Promise<void>;
 acreditar(sesionId:string,ahora:Date,tx:ContextoTransaccion):Promise<void>;
}
export interface PlantillasCorreo {verificarCorreo(token:string,version:number):{asunto:string;texto:string}}
