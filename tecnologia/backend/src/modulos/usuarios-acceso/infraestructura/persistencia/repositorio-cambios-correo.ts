import type {DataSource} from 'typeorm';
import type {UnidadDeTrabajoPostgres} from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type {RepositorioCambiosCorreo} from '../../aplicacion/puertos/correo.js';
import type {ContextoTransaccion,CuentaLectura} from '../../aplicacion/puertos/puertos.js';
import type {CambioCorreo} from '../../dominio/cambio-correo.js';
import {idCuenta,type IdCuenta} from '../../dominio/identificadores.js';
import {ErrorAplicacion,dependenciaNoDisponible} from '../../dominio/errores.js';
interface Fila {id:string;usuario_id:string;sesion_solicitante_id:string;nuevo_correo:string;token_digest:Buffer;solicitada_en:Date;vence_en:Date;autenticacion_acreditada_en:Date;confirmada_en:Date|null;invalidada_en:Date|null;version:string}
export class RepositorioCambiosCorreoPostgres implements RepositorioCambiosCorreo {
 constructor(private readonly db:DataSource,private readonly uow:UnidadDeTrabajoPostgres){}
 async leerCredencial(id:IdCuenta):Promise<CuentaLectura|null>{try{const [f]=await this.db.query('SELECT id,correo,contrasena_hash,version,version_credencial FROM usuarios WHERE id=$1',[id]);return f?{id:idCuenta(f.id),correo:f.correo,contrasenaHash:f.contrasena_hash,version:BigInt(f.version),versionCredencial:BigInt(f.version_credencial)}:null}catch{throw dependenciaNoDisponible()}}
 async crear(c:CambioCorreo,tx:ContextoTransaccion){await this.uow.runner(tx).query('INSERT INTO cambios_correo(id,usuario_id,sesion_solicitante_id,nuevo_correo,token_digest,solicitada_en,vence_en,autenticacion_acreditada_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[c.id,c.usuarioId,c.sesionSolicitanteId,c.nuevoCorreo,Buffer.from(c.tokenDigest),c.solicitadaEn,c.venceEn,c.autenticacionAcreditadaEn]);}
 async bloquear(digest:Uint8Array,tx:ContextoTransaccion):Promise<CambioCorreo|null>{const filas:Fila[]=await this.uow.runner(tx).query('SELECT * FROM cambios_correo WHERE token_digest=$1 FOR UPDATE',[Buffer.from(digest)]);const f=filas[0];return f?{id:f.id,usuarioId:idCuenta(f.usuario_id),sesionSolicitanteId:f.sesion_solicitante_id,nuevoCorreo:f.nuevo_correo,tokenDigest:f.token_digest,solicitadaEn:f.solicitada_en,venceEn:f.vence_en,autenticacionAcreditadaEn:f.autenticacion_acreditada_en,confirmadaEn:f.confirmada_en,invalidadaEn:f.invalidada_en,version:Number(f.version)}:null;}
 async confirmar(c:CambioCorreo,ahora:Date,tx:ContextoTransaccion){const q=this.uow.runner(tx);try{await q.query('UPDATE usuarios SET correo=$2,version=version+1,actualizada_en=$3 WHERE id=$1',[c.usuarioId,c.nuevoCorreo,ahora]);}catch(error){const e=error as {driverError?:{code?:string;constraint?:string}};if(e.driverError?.code==='23505'&&e.driverError.constraint==='uq_correo_canonico')throw new ErrorAplicacion(409,'CORREO_EN_USO','Ese correo ya está registrado.');throw error;}await q.query('UPDATE cambios_correo SET confirmada_en=$2,version=version+1 WHERE id=$1',[c.id,ahora]);}
 async acreditar(sesionId:string,ahora:Date,tx:ContextoTransaccion){await this.uow.runner(tx).query('UPDATE sesiones SET autenticada_con_contrasena_en=$2 WHERE id=$1',[sesionId,ahora]);}
}
