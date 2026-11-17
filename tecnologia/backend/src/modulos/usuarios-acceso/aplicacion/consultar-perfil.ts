import type { RepositorioRegistro, LectorSesion, Reloj, UnidadDeTrabajo } from './puertos/puertos.js';
import { ErrorAplicacion } from '../dominio/errores.js';
import { perfilResultado } from './perfil-resultado.js';
export async function identidadVigente(lector: LectorSesion, token: string) { const i=await lector.leer(token); if(!i) throw new ErrorAplicacion(401,'SESION_NO_VALIDA','Sesión no válida.'); return i; }
export class ConsultarPerfil {
  constructor(private readonly cuentas: RepositorioRegistro, private readonly lector: LectorSesion, private readonly uow: UnidadDeTrabajo, private readonly reloj: Reloj) {}
  async ejecutar(token: string) { const i=await identidadVigente(this.lector,token); return this.uow.ejecutar(async tx=>{const p=await this.cuentas.perfilBloqueado(i.cuentaId,tx);await this.cuentas.exigirSesion(i,this.reloj.ahora(),tx);return perfilResultado(p)}); }
}
