import type { Idempotencia, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import type { ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import type { RepositorioRegistro, HashContrasena, CatalogoContrasenasRechazadas, Reloj, GeneradorSecretos, AlmacenamientoFotografias, FotografiaAlmacenada } from './puertos/puertos.js';
import { validarCuentaNueva, normalizarRegistro, type RegistroCuenta } from '../dominio/cuenta.js';
import { perfilesIniciales } from '../dominio/perfiles-habilitados.js';
import { politicaNuevaContrasena } from '../dominio/politica-contrasena.js';
import { idCuenta } from '../dominio/identificadores.js';
export class RegistrarCuenta {
  constructor(private readonly repositorio: RepositorioRegistro, private readonly idempotencia: Idempotencia, private readonly hash: HashContrasena, private readonly catalogo: CatalogoContrasenasRechazadas, private readonly reloj: Reloj, private readonly secretos: GeneradorSecretos, private readonly fotos: AlmacenamientoFotografias) {}
  async ejecutar(entrada: RegistroCuenta, clave: string): Promise<ResultadoIdempotente> {
    validarCuentaNueva(entrada); const d = normalizarRegistro(entrada);
    let foto: FotografiaAlmacenada | undefined;
    try {
      return await this.idempotencia.ejecutar({ ambito: { tipo: 'registro', id: d.correo }, metodo: 'POST', rutaLogica: '/cuentas', clave, cuerpo: entrada as unknown as ValorJson }, async (tx) => {
        await politicaNuevaContrasena(d.contrasena, d.confirmacionContrasena, this.catalogo);
        const phc = await this.hash.crear(d.contrasena); const id = idCuenta(this.secretos.uuid());
        if (d.fotografia) foto = await this.fotos.almacenar(id, d.fotografia.contenidoBase64, d.fotografia.tipoContenido);
        await this.repositorio.crear(id, { ...d, perfiles: perfilesIniciales(d.perfiles) }, phc, this.reloj.ahora(), foto, tx);
        return { http: 201, cuerpo: { cuentaId: id, perfiles: perfilesIniciales(d.perfiles), version: 1 } };
      });
    } catch (error) { if (foto) await this.fotos.eliminarObjeto(foto.objetoClave).catch(() => undefined); throw error; }
  }
}
