import type { Idempotencia, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import type { ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import type { RepositorioRegistro, Reloj, LectorSesion } from './puertos/puertos.js';
import { agregarPerfil } from '../dominio/perfiles-habilitados.js';
import { datosInvalidos, ErrorAplicacion } from '../dominio/errores.js';
import type { PerfilHabilitado } from '../dominio/identificadores.js';
export class HabilitarPerfil {
  constructor(private readonly repositorio: RepositorioRegistro, private readonly idempotencia: Idempotencia, private readonly lector: LectorSesion, private readonly reloj: Reloj) {}
  async ejecutar(d: { version: number; perfil: PerfilHabilitado; confirmacionExplicita: true }, clave: string, token: string): Promise<ResultadoIdempotente> {
    if (!Number.isSafeInteger(d.version) || d.version < 1) throw datosInvalidos(); agregarPerfil(['cliente'], d.perfil, d.confirmacionExplicita);
    const identidad = await this.lector.leer(token); if (!identidad) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.');
    return this.idempotencia.ejecutar({ ambito: { tipo: 'usuario', id: identidad.cuentaId }, autorizar: async () => { const vigente = await this.lector.leer(token); if (!vigente) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.'); return vigente.cuentaId; }, metodo: 'POST', rutaLogica: '/perfil/perfiles', clave, cuerpo: d }, async (tx) => {
      const perfil = await this.repositorio.perfilBloqueado(identidad.cuentaId, tx);
      await this.repositorio.exigirSesion(identidad, this.reloj.ahora(), tx);
      if (perfil.version !== d.version) throw new ErrorAplicacion(409, 'VERSION_DESACTUALIZADA', 'La cuenta cambió. Actualice su versión.');
      const nuevos = agregarPerfil(perfil.perfiles, d.perfil, d.confirmacionExplicita);
      if (nuevos.length !== perfil.perfiles.length) { await this.repositorio.habilitar(identidad.cuentaId, d.perfil, this.reloj.ahora(), tx); perfil.perfiles = nuevos; perfil.version++; }
      return { http: 200, cuerpo: perfil as unknown as ValorJson };
    });
  }
}
