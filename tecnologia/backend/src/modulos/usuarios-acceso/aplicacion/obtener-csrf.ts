import type { GeneradorSecretos, UnidadDeTrabajo, Reloj } from './puertos/puertos.js';
import type { RepositorioAutenticacion, ProteccionCsrf } from './puertos/sesiones.js';
import { renovacionVigente } from '../dominio/sesion.js';
import { ErrorAplicacion } from '../dominio/errores.js';
import { exigirRenovacion } from './renovar-sesion.js';
export class ObtenerCsrf {
  constructor(private readonly sesiones: RepositorioAutenticacion, private readonly uow: UnidadDeTrabajo, private readonly reloj: Reloj, private readonly secretos: GeneradorSecretos, private readonly csrf: ProteccionCsrf) {}
  async ejecutar(token: string | undefined): Promise<{ csrfToken: string }> {
    exigirRenovacion(token); const digest = this.secretos.digest(token); const referencia = await this.sesiones.localizarRenovacion(digest); if (!referencia) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.');
    return this.uow.ejecutar(async (tx) => { await this.sesiones.bloquearCuenta(referencia.usuarioId, tx); const s = await this.sesiones.bloquearSesion(referencia.id, tx, { tipo: 'renovacion', digest }); if (!s || !renovacionVigente(s, this.reloj.ahora())) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.'); return { csrfToken: this.csrf.emitir(token) }; });
  }
}
