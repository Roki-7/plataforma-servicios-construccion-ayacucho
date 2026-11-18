import type { CambioContrasena } from '../modelos/contratos.js';
import { ErrorApi, type ApiUsuarios } from './puertos.js';

export type CredencialesCambio = Omit<CambioContrasena, 'version'>;

interface Intento {
  datos: CambioContrasena;
  clave: string;
}

export class ContrasenaWeb {
  private intento: Intento | undefined;

  constructor(private readonly api: ApiUsuarios, private readonly nuevaClave: () => string) {}

  cambiar = async (credenciales: CredencialesCambio) => {
    const anterior = this.intento;
    const mismoCuerpo = anterior &&
      anterior.datos.contrasenaActual === credenciales.contrasenaActual &&
      anterior.datos.nuevaContrasena === credenciales.nuevaContrasena &&
      anterior.datos.confirmacionContrasena === credenciales.confirmacionContrasena;

    if (!mismoCuerpo) {
      this.intento = undefined;
      const { version } = await this.api.enviar('consultarPerfil', undefined);
      this.intento = { datos: { ...credenciales, version }, clave: this.nuevaClave() };
    }
    const intento = this.intento!;
    try {
      const resultado = await this.api.enviar('cambiarContrasena', intento.datos, { clave: intento.clave });
      if (this.intento === intento) this.intento = undefined;
      return resultado;
    } catch (error) {
      // Reutilizar únicamente ante una respuesta que no confirma el resultado.
      if (error instanceof ErrorApi && error.http < 500 && this.intento === intento) this.intento = undefined;
      throw error;
    }
  };
}
