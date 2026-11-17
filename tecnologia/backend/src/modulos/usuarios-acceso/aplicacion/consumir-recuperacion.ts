import type { IdempotenciaRecuperacion, SolicitudIdempotente, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import type { RepositorioCuentas, RepositorioSesiones, Reloj, GeneradorSecretos, HashContrasena, CatalogoContrasenasRechazadas, ProgramarCorreoSeguridad } from './puertos/puertos.js';
import type { PlantillasRecuperacion, RepositorioRecuperaciones } from './puertos/recuperacion.js';
import { validarRecuperacion, recuperacionNoValida, type Recuperacion } from '../dominio/recuperacion.js';
import { politicaNuevaContrasena } from '../dominio/politica-contrasena.js';
import { datosInvalidos } from '../dominio/errores.js';
export interface DatosRecuperacion { nuevaContrasena: string; confirmacionContrasena: string; version: number }
export class ConsumirRecuperacion {
  constructor(private readonly cuentas: RepositorioCuentas, private readonly recuperaciones: RepositorioRecuperaciones, private readonly sesiones: RepositorioSesiones, private readonly idempotencia: IdempotenciaRecuperacion, private readonly reloj: Reloj, private readonly secretos: GeneradorSecretos, private readonly hash: HashContrasena, private readonly catalogo: CatalogoContrasenasRechazadas, private readonly correo: ProgramarCorreoSeguridad, private readonly plantillas: PlantillasRecuperacion) {}
  async ejecutar(token: string, datos: DatosRecuperacion, clave: string): Promise<ResultadoIdempotente> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !Number.isSafeInteger(datos.version) || datos.version < 1) throw datosInvalidos();
    const digest = this.secretos.digest(token); const ambito = Array.from(digest, (v) => v.toString(16).padStart(2, '0')).join('');
    const solicitud: SolicitudIdempotente = { ambito: { tipo: 'recuperacion', id: ambito }, metodo: 'POST', rutaLogica: '/recuperaciones/{token}', clave, token, cuerpo: { nuevaContrasena: datos.nuevaContrasena, confirmacionContrasena: datos.confirmacionContrasena, version: datos.version } };
    const replay = await this.idempotencia.consultarRecuperacion(solicitud); if (replay) return replay;
    let referencia: Recuperacion; let phc: string;
    try {
      const candidata = await this.recuperaciones.buscarPorDigest(digest); if (!candidata) throw recuperacionNoValida();
      validarRecuperacion(candidata, candidata.usuarioId, datos.version, this.reloj.ahora()); referencia = candidata;
      await politicaNuevaContrasena(datos.nuevaContrasena, datos.confirmacionContrasena, this.catalogo);
      phc = await this.hash.crear(datos.nuevaContrasena);
    } catch (error) {
      // Si otra ejecución de esta clave confirma mientras preparamos, esperar su
      // resultado antes de propagar un fallo de preparación. Nunca recalcular bajo locks.
      return this.idempotencia.ejecutar(solicitud, async () => { throw error; });
    }
    return this.idempotencia.ejecutar(solicitud, async (tx) => {
      const cuenta = await this.cuentas.bloquear(referencia.usuarioId, tx); if (!cuenta) throw recuperacionNoValida();
      const desafio = await this.recuperaciones.bloquear(referencia.id, tx); const ahora = this.reloj.ahora();
      validarRecuperacion(desafio, cuenta.id, datos.version, ahora);
      await this.recuperaciones.establecerContrasena(cuenta.id, phc, ahora, tx);
      await this.recuperaciones.consumir(desafio, ahora, tx);
      await this.sesiones.revocarTodas(cuenta.id, tx);
      await this.correo.programar({ tipo: 'contraseña_recuperada', destinatario: cuenta.correo, ...this.plantillas.avisoRecuperacion(), claveLogica: `recuperacion-completada:${desafio.id}`, desafioId: desafio.id }, tx);
      return { http: 200, cuerpo: { codigo: 'CONTRASENA_RECUPERADA', mensaje: 'Contraseña actualizada. Inicie sesión con su nueva contraseña.' } };
    });
  }
}
