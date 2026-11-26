import type { Idempotencia } from '../../../compartido/aplicacion/idempotencia.js';
import type { ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import type { RepositorioRegistro, LectorSesion, Reloj, AlmacenamientoFotografias } from './puertos/puertos.js';
import type { RepositorioPerfil, RepositorioConsentimientos } from './puertos/perfil.js';
import { validarEdicionPerfil, normalizarEdicionPerfil, decidirConsentimiento, type EdicionPerfil } from '../dominio/consentimiento-telefono.js';
import { ErrorAplicacion } from '../dominio/errores.js';
import { identidadVigente } from './consultar-perfil.js';
import { perfilResultado } from './perfil-resultado.js';
export class ActualizarPerfil {
  constructor(private readonly cuentas: RepositorioRegistro, private readonly perfiles: RepositorioPerfil, private readonly consentimientos: RepositorioConsentimientos, private readonly fotos: AlmacenamientoFotografias, private readonly idempotencia: Idempotencia, private readonly lector: LectorSesion, private readonly reloj: Reloj) {}
  async ejecutar(entrada: EdicionPerfil, clave: string, token: string) {
    validarEdicionPerfil(entrada); const d=normalizarEdicionPerfil(entrada); const i=await identidadVigente(this.lector,token);
    return this.idempotencia.ejecutar({ambito:{tipo:'usuario',id:i.cuentaId},autorizar:async()=>(await identidadVigente(this.lector,token)).cuentaId,metodo:'PATCH',rutaLogica:'/perfil',clave,cuerpo:entrada as unknown as ValorJson},async tx=>{
      const anterior=await this.cuentas.perfilBloqueado(i.cuentaId,tx);await this.cuentas.exigirSesion(i,this.reloj.ahora(),tx);
      if(anterior.version!==d.version) throw new ErrorAplicacion(409,'VERSION_DESACTUALIZADA','El perfil cambió. Recargue para revisar la versión guardada.');
      const nuevo={...anterior,nombreMostrar:d.nombreMostrar ?? anterior.nombreMostrar,telefono:d.telefono === undefined ? anterior.telefono : d.telefono,distrito:d.distrito === undefined ? anterior.distrito : d.distrito,fotografiaId:d.fotografiaId === undefined ? anterior.fotografiaId : d.fotografiaId};
      nuevo.telefonoCompartible=decidirConsentimiento(anterior.telefono,nuevo.telefono,anterior.telefonoCompartible,d.autorizarCompartirTelefono);
      if(nuevo.fotografiaId && nuevo.fotografiaId!==anterior.fotografiaId){await this.perfiles.comprobarFoto(i.cuentaId,nuevo.fotografiaId,tx);await this.fotos.leerPropia(i.cuentaId,nuevo.fotografiaId);}
      const cambioTelefono=nuevo.telefono!==anterior.telefono; const cambioConsentimiento=nuevo.telefonoCompartible!==anterior.telefonoCompartible;
      const efectivo=cambioTelefono || cambioConsentimiento || nuevo.nombreMostrar!==anterior.nombreMostrar || nuevo.distrito!==anterior.distrito || nuevo.fotografiaId!==anterior.fotografiaId;
      if(efectivo){const ahora=this.reloj.ahora();if(cambioTelefono || cambioConsentimiento)await this.consentimientos.decidir(i.cuentaId,nuevo.telefono,nuevo.telefonoCompartible,ahora,tx);await this.perfiles.guardar(anterior,nuevo,ahora,tx);nuevo.version++;}
      return {http:200,cuerpo:perfilResultado(nuevo) as unknown as ValorJson};
    });
  }
}
