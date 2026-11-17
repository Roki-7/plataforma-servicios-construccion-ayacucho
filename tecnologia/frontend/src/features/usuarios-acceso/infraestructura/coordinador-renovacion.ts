import type { CoordinadorRenovacion } from '../aplicacion/sesion.js';
import { ErrorApi } from '../aplicacion/puertos.js';
export class CoordinadorRenovacionNavegador implements CoordinadorRenovacion {
  constructor(private readonly bloqueos: Pick<LockManager, 'request'> | undefined = navigator.locks) {}
  async exclusiva<T>(trabajo: () => Promise<T>): Promise<T> {
    if (!this.bloqueos) throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Este navegador no permite coordinar la renovación. Inicie sesión de nuevo.');
    return this.bloqueos.request('ayacucho:sesiones:renovacion', { mode: 'exclusive' }, trabajo);
  }
}
