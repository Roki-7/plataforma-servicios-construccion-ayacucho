import type { IdempotenciaUsuario, SolicitudIdempotente, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import type { IdCuenta } from '../dominio/identificadores.js';
import { validarCambioContrasena, versionDesactualizada, type DatosCambioContrasena } from '../dominio/cambio-contrasena.js';
import { ErrorAplicacion } from '../dominio/errores.js';
import { politicaNuevaContrasena } from '../dominio/politica-contrasena.js';
import type { CatalogoContrasenasRechazadas, ContextoTransaccion, CuentaLectura, HashContrasena, LectorSesion, RepositorioCuentas, RepositorioRegistro, Reloj } from './puertos/puertos.js';
import { identidadVigente } from './consultar-perfil.js';

interface RepositorioCredenciales extends Pick<RepositorioCuentas, 'bloquear'>, Pick<RepositorioRegistro, 'exigirSesion'> {
  leerCredencial(id: IdCuenta): Promise<CuentaLectura | null>;
  establecerContrasena(id: IdCuenta, phc: string, ahora: Date, tx: ContextoTransaccion): Promise<void>;
}

export class CambiarContrasena {
  constructor(
    private readonly cuentas: RepositorioCredenciales,
    private readonly lector: LectorSesion,
    private readonly idempotencia: IdempotenciaUsuario,
    private readonly hash: HashContrasena,
    private readonly catalogo: CatalogoContrasenasRechazadas,
    private readonly reloj: Reloj,
  ) {}

  async ejecutar(datos: DatosCambioContrasena, clave: string, acceso: string): Promise<ResultadoIdempotente> {
    const identidad = await identidadVigente(this.lector, acceso);
    const solicitud: SolicitudIdempotente = {
      ambito: { tipo: 'usuario', id: identidad.cuentaId },
      autorizar: async () => (await identidadVigente(this.lector, acceso)).cuentaId,
      metodo: 'POST',
      rutaLogica: '/perfil/cambios-contrasena',
      clave,
      cuerpo: { ...datos },
    };
    const replay = await this.idempotencia.consultarUsuario(solicitud);
    if (replay) return replay;

    let observada: CuentaLectura;
    let phc: string;
    try {
      validarCambioContrasena(datos);
      const cuenta = await this.cuentas.leerCredencial(identidad.cuentaId);
      if (!cuenta) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.');
      if (cuenta.version !== BigInt(datos.version)) throw versionDesactualizada();
      if (!await this.hash.verificar(datos.contrasenaActual, cuenta.contrasenaHash)) {
        throw new ErrorAplicacion(422, 'CONTRASENA_ACTUAL_INVALIDA', 'Contraseña actual incorrecta.');
      }
      await politicaNuevaContrasena(datos.nuevaContrasena, datos.confirmacionContrasena, this.catalogo);
      phc = await this.hash.crear(datos.nuevaContrasena);
      observada = cuenta;
    } catch (error) {
      // La misma clave pudo confirmarse mientras se preparaba la credencial.
      return this.idempotencia.ejecutar(solicitud, async () => { throw error; });
    }

    return this.idempotencia.ejecutar(solicitud, async tx => {
      const actual = await this.cuentas.bloquear(identidad.cuentaId, tx);
      if (!actual) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.');
      const ahora = this.reloj.ahora();
      await this.cuentas.exigirSesion(identidad, ahora, tx);
      if (actual.version !== BigInt(datos.version) || actual.versionCredencial !== observada.versionCredencial) {
        throw versionDesactualizada();
      }

      await this.cuentas.establecerContrasena(actual.id, phc, ahora, tx);
      return { http: 200, cuerpo: { codigo: 'CONTRASENA_CAMBIADA', mensaje: 'Contraseña actualizada.' } };
    });
  }
}
