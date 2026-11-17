import type { LectorSesion } from './puertos/puertos.js';
import type { PerfilHabilitado } from '../dominio/identificadores.js';
import { idCuenta } from '../dominio/identificadores.js';
import { exigirTitularidad, exigirRecursoVisible } from '../dominio/politica-acceso.js';
import { ErrorAplicacion } from '../dominio/errores.js';
export interface SolicitudAcceso { readonly titularId?: string; readonly perfilRequerido?: PerfilHabilitado; readonly recursoPrivado?: boolean }
/** Solo la identidad y los perfiles leídos del servidor conceden acceso. */
export async function evaluarAcceso(lector: LectorSesion, token: string, solicitud: SolicitudAcceso = {}) {
  const identidad=await lector.leer(token);
  if(!identidad)throw new ErrorAplicacion(401,'SESION_NO_VALIDA','Sesión no válida.');
  const titular=solicitud.titularId===undefined?identidad.cuentaId:idCuenta(solicitud.titularId);
  if(solicitud.recursoPrivado)exigirRecursoVisible(identidad.cuentaId,titular);
  exigirTitularidad(identidad.cuentaId,titular,identidad.perfiles,solicitud.perfilRequerido);
  return identidad;
}
export class EvaluarAcceso {
  constructor(private readonly lector: LectorSesion){}
  identificar(token: string){return this.lector.leer(token);}
  ejecutar(token: string, solicitud: SolicitudAcceso = {}){return evaluarAcceso(this.lector,token,solicitud);}
}
