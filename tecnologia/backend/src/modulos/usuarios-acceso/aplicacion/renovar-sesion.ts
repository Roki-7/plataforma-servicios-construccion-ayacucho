import type { GeneradorSecretos, UnidadDeTrabajo, Reloj } from './puertos/puertos.js';
import type { EmisionSesion, RepositorioAutenticacion, ProteccionCsrf } from './puertos/sesiones.js';
import { renovacionVigente } from '../dominio/sesion.js';
import { ErrorAplicacion } from '../dominio/errores.js';
export function exigirRenovacion(token: string | undefined): asserts token is string { if (!token) throw new ErrorAplicacion(401, 'NO_AUTENTICADO', 'Debe autenticarse.'); if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.'); }
export class RenovarSesion {
  constructor(private readonly sesiones: RepositorioAutenticacion, private readonly uow: UnidadDeTrabajo, private readonly reloj: Reloj, private readonly secretos: GeneradorSecretos, private readonly csrf: ProteccionCsrf) {}
  async ejecutar(token: string | undefined, csrf: string | undefined): Promise<EmisionSesion> {
    exigirRenovacion(token); if (!this.csrf.verificar(csrf, token)) throw new ErrorAplicacion(403, 'CSRF_NO_VALIDO', 'Protección CSRF no válida.');
    const digest = this.secretos.digest(token); const referencia = await this.sesiones.localizarRenovacion(digest); if (!referencia) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.');
    return this.uow.ejecutar(async (tx) => {
      await this.sesiones.bloquearCuenta(referencia.usuarioId, tx);
      const s = await this.sesiones.bloquearSesion(referencia.id, tx, { tipo: 'renovacion', digest }); const ahora = this.reloj.ahora();
      if (!s || !renovacionVigente(s, ahora) || !s.autenticadaConContrasenaEn) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.');
      const tokenAcceso = this.secretos.secreto(); const renovacion = this.secretos.secreto();
      await this.sesiones.rotar({ ...s, accesoDigest: this.secretos.digest(tokenAcceso), renovacionDigest: this.secretos.digest(renovacion), accesoVenceEn: new Date(+ahora + 900000), renovadaEn: ahora }, tx);
      return { renovacion, venceEn: s.renovacionVenceEn, respuesta: { tokenAcceso, tipo: 'Bearer', expiraEnSegundos: 900, renovacionVenceEn: s.renovacionVenceEn.toISOString(), autenticacionConContrasenaEn: s.autenticadaConContrasenaEn.toISOString(), csrfToken: this.csrf.emitir(renovacion) } };
    });
  }
}
