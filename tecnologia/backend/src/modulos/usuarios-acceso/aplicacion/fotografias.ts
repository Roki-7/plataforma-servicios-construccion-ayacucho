import type { Idempotencia } from '../../../compartido/aplicacion/idempotencia.js';
import type { RepositorioRegistro, LectorSesion, Reloj, FotografiaAlmacenada } from './puertos/puertos.js';
import type { FotografiasPerfil } from './puertos/perfil.js';
import { identidadVigente } from './consultar-perfil.js';
export class Fotografias {
  constructor(private readonly cuentas: RepositorioRegistro, private readonly fotos: FotografiasPerfil, private readonly idempotencia: Idempotencia, private readonly lector: LectorSesion, private readonly reloj: Reloj) {}
  async subir(d: {tipoContenido:string;contenidoBase64:string}, clave: string, token: string) {
    const i=await identidadVigente(this.lector,token); let foto:FotografiaAlmacenada|undefined;
    try {return await this.idempotencia.ejecutar({ambito:{tipo:'usuario',id:i.cuentaId},autorizar:async()=>(await identidadVigente(this.lector,token)).cuentaId,metodo:'POST',rutaLogica:'/perfil/fotografias',clave,cuerpo:d},async tx=>{
      await this.cuentas.perfilBloqueado(i.cuentaId,tx);await this.cuentas.exigirSesion(i,this.reloj.ahora(),tx);
      foto=await this.fotos.almacenar(i.cuentaId,d.contenidoBase64,d.tipoContenido);await this.fotos.registrarTemporal(i.cuentaId,foto,tx);
      return {http:201,cuerpo:{fotografiaId:foto.id,tipoContenido:foto.mime,bytes:foto.bytes}};
    });}catch(error){if(foto)await this.fotos.eliminarObjeto(foto.objetoClave).catch(()=>undefined);throw error;}
  }
  async leer(id: string, token: string) { const i=await identidadVigente(this.lector,token);return {fotografiaId:id,...await this.fotos.leerPropia(i.cuentaId,id)}; }
}
