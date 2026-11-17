import type { EvaluarAcceso, SolicitudAcceso } from './aplicacion/evaluar-acceso.js';
import type { ConsultarPerfil } from './aplicacion/consultar-perfil.js';
import { proyectarPerfilCompartible } from './aplicacion/proyectar-perfil-compartible.js';
export type PerfilHabilitado = 'cliente' | 'prestador';
export interface IdentidadAcceso { readonly cuentaId: string; readonly sesionId: string; readonly perfiles: readonly PerfilHabilitado[] }
export interface UsuariosAcceso {
  identificar(token: string): Promise<IdentidadAcceso | null>;
  exigir(token: string, solicitud?: SolicitudAcceso): Promise<IdentidadAcceso>;
  perfilCompartible(token: string): Promise<{nombreMostrar:string;distrito:string|null;perfiles:PerfilHabilitado[];telefono?:string}>;
}
const identidadPublica=(i:IdentidadAcceso):IdentidadAcceso=>({cuentaId:i.cuentaId,sesionId:i.sesionId,perfiles:[...i.perfiles]});
/** API interna entre módulos: no registra rutas HTTP ni expone repositorios. */
export class ApiUsuariosAcceso implements UsuariosAcceso {
  constructor(private readonly evaluar: EvaluarAcceso, private readonly consultar: ConsultarPerfil){}
  async identificar(token:string){const i=await this.evaluar.identificar(token);return i?identidadPublica(i):null;}
  async exigir(token:string,solicitud:SolicitudAcceso={}){return identidadPublica(await this.evaluar.ejecutar(token,solicitud));}
  async perfilCompartible(token:string){return proyectarPerfilCompartible(await this.consultar.ejecutar(token));}
}
