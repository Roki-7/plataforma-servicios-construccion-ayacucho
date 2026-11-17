import type { RepositorioCuentas, UnidadDeTrabajo, Reloj, GeneradorSecretos, ProgramarCorreoSeguridad } from './puertos/puertos.js';
import type { PlantillasRecuperacion, RepositorioRecuperaciones } from './puertos/recuperacion.js';
import { datosInvalidos } from '../dominio/errores.js';
export const MENSAJE_RECUPERACION = 'Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar el acceso';
export class SolicitarRecuperacion {
  constructor(private readonly cuentas: RepositorioCuentas, private readonly recuperaciones: RepositorioRecuperaciones, private readonly uow: UnidadDeTrabajo, private readonly reloj: Reloj, private readonly secretos: GeneradorSecretos, private readonly correo: ProgramarCorreoSeguridad, private readonly plantillas: PlantillasRecuperacion) {}
  async ejecutar(correo: string): Promise<{ mensaje: string }> {
    if (typeof correo !== 'string' || !correo.isWellFormed() || [...correo].length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw datosInvalidos();
    try {
      const candidata = await this.cuentas.buscarPorCorreo(correo);
      if (candidata) await this.uow.ejecutar(async (tx) => {
        const cuenta = await this.cuentas.bloquear(candidata.id, tx); if (!cuenta) return;
        const token = this.secretos.secreto(); const ahora = this.reloj.ahora(); const id = this.secretos.uuid(); const venceEn = new Date(+ahora + 1800000);
        await this.recuperaciones.crear({ id, usuarioId: cuenta.id, proposito: 'recuperacion', tokenDigest: this.secretos.digest(token), emitidaEn: ahora, venceEn, consumidaEn: null, invalidadaEn: null, version: 1 }, tx);
        await this.correo.programar({ tipo: 'recuperación', destinatario: cuenta.correo, ...this.plantillas.recuperacion(token, 1), claveLogica: `recuperacion:${id}`, desafioId: id, venceEn }, tx);
      });
    } catch { /* El 202 no garantiza entrega y nunca revela una falla específica de cuenta. */ }
    return { mensaje: MENSAJE_RECUPERACION };
  }
}
