import type { ContextoTransaccion } from '../../../compartido/aplicacion/transaccion.js';
import type { ResumenDeSolicitud, SolicitudesApi, ValidacionDeClienteYDisponibilidad } from '../api-publica.js';
import type { RepositorioSolicitudes } from './puertos/repositorios.js';

/** Implementación de las lecturas para otros módulos. No registra rutas ni expone el repositorio. */
export class ApiSolicitudes implements SolicitudesApi {
  constructor(private readonly repositorio: Pick<RepositorioSolicitudes, 'obtener' | 'resumenes' | 'clienteDe'>) {}
  async resumenes(solicitudIds: readonly string[], tx?: ContextoTransaccion): Promise<ReadonlyMap<string, ResumenDeSolicitud>> {
    const filas = await this.repositorio.resumenes(solicitudIds, tx);
    return new Map(filas.map(f => [f.solicitudId, f]));
  }
  async bloquearCompartido(solicitudId: string, tx: ContextoTransaccion): Promise<ResumenDeSolicitud | null> {
    const s = await this.repositorio.obtener(solicitudId, tx, 'compartido');
    return s ? { solicitudId: s.id, tipo: s.tipo, estado: s.estado, versionTrabajo: s.versionTrabajo, categoriaId: s.categoriaId, distritoCodigo: s.distrito, prestadorId: s.prestadorId } : null;
  }
  async esClienteDe(solicitudId: string, cuentaId: string, tx?: ContextoTransaccion): Promise<boolean> {
    return (await this.repositorio.clienteDe(solicitudId, tx)) === cuentaId;
  }
  async validarClienteYDisponibilidad(solicitudId: string, actorCuentaId: string, tx?: ContextoTransaccion): Promise<ValidacionDeClienteYDisponibilidad> {
    const s = await this.repositorio.obtener(solicitudId, tx);
    if (!s) return { esCliente: false, disponible: false, versionTrabajo: null, motivos: ['SOLICITUD_INEXISTENTE'] };
    if (s.clienteCuentaId !== actorCuentaId) return { esCliente: false, disponible: false, versionTrabajo: null, motivos: ['NO_ES_EL_CLIENTE'] };
    const abierta = s.estado === 'ABIERTA';
    return { esCliente: true, disponible: abierta, versionTrabajo: s.versionTrabajo, motivos: abierta ? [] : ['SOLICITUD_NO_ABIERTA'] };
  }
}
