import type { RepositorioCuentas, UnidadDeTrabajo, HashContrasena, Reloj, GeneradorSecretos } from './puertos/puertos.js';
import type { RepositorioAutenticacion, ProteccionCsrf, EmisionSesion } from './puertos/sesiones.js';
import { evaluarIntento } from '../dominio/control-intentos.js';
import { datosInvalidos, ErrorAplicacion } from '../dominio/errores.js';
const invalidas = () => new ErrorAplicacion(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
export class IniciarSesion {
  constructor(private readonly cuentas: RepositorioCuentas, private readonly sesiones: RepositorioAutenticacion, private readonly uow: UnidadDeTrabajo, private readonly hash: HashContrasena, private readonly reloj: Reloj, private readonly secretos: GeneradorSecretos, private readonly csrf: ProteccionCsrf) {}
  async ejecutar(datos: { correo: string; contrasena: string }): Promise<EmisionSesion> {
    if (typeof datos.correo !== 'string' || !datos.correo.isWellFormed() || typeof datos.contrasena !== 'string' || !datos.contrasena.isWellFormed() || [...datos.contrasena].length > 128) throw datosInvalidos();
    const cuenta = await this.cuentas.buscarPorCorreo(datos.correo); if (!cuenta) throw invalidas();
    const correcta = await this.hash.verificar(datos.contrasena, cuenta.contrasenaHash);
    const resultado = await this.uow.ejecutar(async (tx): Promise<EmisionSesion | ErrorAplicacion> => {
      const bloqueada = await this.sesiones.bloquearCuenta(cuenta.id, tx); const ahora = this.reloj.ahora();
      if (!bloqueada || bloqueada.versionCredencial !== cuenta.versionCredencial) return invalidas();
      const evaluacion = evaluarIntento(bloqueada, correcta, ahora);
      if (evaluacion.estado !== bloqueada) await this.sesiones.guardarIntentos(cuenta.id, evaluacion.estado, tx);
      if (evaluacion.espera) return new ErrorAplicacion(429, 'CUENTA_TEMPORALMENTE_BLOQUEADA', 'Espere antes de volver a intentarlo.', [], evaluacion.espera);
      if (!evaluacion.permitido) return invalidas();
      const tokenAcceso = this.secretos.secreto(); const renovacion = this.secretos.secreto(); const venceEn = new Date(+ahora + 604800000);
      await this.sesiones.crear({ id: this.secretos.uuid(), usuarioId: cuenta.id, accesoDigest: this.secretos.digest(tokenAcceso), renovacionDigest: this.secretos.digest(renovacion), accesoVenceEn: new Date(+ahora + 900000), renovacionVenceEn: venceEn, autenticadaConContrasenaEn: ahora, creadaEn: ahora, renovadaEn: ahora, revocadaEn: null, version: 1n }, tx);
      return { renovacion, venceEn, respuesta: { tokenAcceso, tipo: 'Bearer', expiraEnSegundos: 900, renovacionVenceEn: venceEn.toISOString(), autenticacionConContrasenaEn: ahora.toISOString(), csrfToken: this.csrf.emitir(renovacion) } };
    });
    // Los fallos de autenticación se devuelven DESPUÉS del commit de los intentos.
    if (resultado instanceof ErrorAplicacion) throw resultado; return resultado;
  }
}
