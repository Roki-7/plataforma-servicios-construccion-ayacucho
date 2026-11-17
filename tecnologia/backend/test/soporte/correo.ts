import {randomUUID} from 'node:crypto';
import {entornoPerfil} from './perfil.js';
import {cuentaFicticia} from './fixtures.js';
import type {DataSource} from 'typeorm';
/** Igual que login productivo: la marca de contraseña usa el reloj Node, no otro reloj DB. */
export async function cuentaCorreoFicticia(db:DataSource,perfiles:readonly string[]=['cliente'],correo?:string){const c=await cuentaFicticia(db,perfiles,correo);await db.query('UPDATE sesiones SET autenticada_con_contrasena_en=$2 WHERE id=$1',[c.sesionId,new Date()]);return c;}
export type EntornoCorreo=Awaited<ReturnType<typeof entornoPerfil>>;
export const destinoCorreo=()=>`${randomUUID()}@example.invalid`;
export async function solicitarCorreo(e:EntornoCorreo,acceso:string,nuevoCorreo=destinoCorreo(),version=1,clave=randomUUID()){
 const r=await e.post('/perfil/cambios-correo',{nuevoCorreo,version},clave,acceso).expect(202);
 const [f]=await e.db.query('SELECT * FROM avisos_pendientes WHERE desafio_id=$1',[r.body.cambioId]);
 const texto=e.cifrado.descifrar(f.id,f.destinatario,f.key_id,f.payload_cifrado).texto;
 const token=/#token=([A-Za-z0-9_-]{43})&version=1/.exec(texto)?.[1];if(!token)throw new Error('Falta enlace de correo ficticio');
 return {token,id:r.body.cambioId as string,nuevoCorreo,resultado:r.body,clave};
}
export const confirmarCorreo=(e:EntornoCorreo,acceso:string,token:string,version=1,versionDesafio=1,clave=randomUUID())=>e.post('/perfil/cambios-correo/'+token+'/confirmacion',{version,versionDesafio},clave,acceso);
