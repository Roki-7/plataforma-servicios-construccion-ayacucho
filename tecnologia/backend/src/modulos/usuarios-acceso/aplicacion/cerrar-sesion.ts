import type { GeneradorSecretos, UnidadDeTrabajo, Reloj, LectorSesion } from './puertos/puertos.js';
import type { RepositorioAutenticacion } from './puertos/sesiones.js';
import { accesoVigente } from '../dominio/sesion.js';
import { ErrorAplicacion } from '../dominio/errores.js';
export class CerrarSesion {
  constructor(private readonly sesiones: RepositorioAutenticacion, private readonly uow: UnidadDeTrabajo, private readonly reloj: Reloj, private readonly secretos: GeneradorSecretos, private readonly lector: LectorSesion) {}
  async ejecutar(token: string): Promise<void> {
    const i = await this.lector.leer(token); if (!i) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.');
    await this.uow.ejecutar(async (tx) => { await this.sesiones.bloquearCuenta(i.cuentaId, tx); const s = await this.sesiones.bloquearSesion(i.sesionId, tx, { tipo: 'acceso', digest: this.secretos.digest(token) }); const ahora = this.reloj.ahora(); if (!s || !accesoVigente(s, ahora)) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.'); await this.sesiones.revocar(s.id, ahora, tx); });
  }
}
