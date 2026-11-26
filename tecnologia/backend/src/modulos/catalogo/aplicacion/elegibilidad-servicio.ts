import type { ContextoTransaccion } from '../../../compartido/aplicacion/transaccion.js';
import type { ElegibilidadServicio, EvaluacionElegibilidad, RegistroServicio, RevisionDeOferta } from '../api-publica.js';
import { esElegible } from '../dominio/servicio.js';
import type { RepositorioServicios } from './puertos/servicios.js';

/**
 * Elegibilidad para nuevas solicitudes sobre el estado vigente de PostgreSQL. Con contexto transaccional toma el bloqueo compartido de la
 * revisión de Catálogo, que la mantiene hasta el commit: las mutaciones que cambian la elegibilidad exigen el bloqueo exclusivo de la misma fila.
 */
export class ElegibilidadServicioPostgres implements ElegibilidadServicio {
  constructor(private readonly repositorio: RepositorioServicios, private readonly revision: RevisionDeOferta) {}

  async evaluar(servicioId: string, tx?: ContextoTransaccion): Promise<EvaluacionElegibilidad> {
    if (tx) await this.revision.bloquear(tx, 'compartido');
    const servicio = await this.repositorio.porId(servicioId, tx);
    if (!servicio) return { servicioId, elegible: false, motivo: 'NO_EXISTE' };
    const activa = await this.repositorio.clasificacionActiva(servicioId, tx);
    const elegible = esElegible(servicio, activa);
    return { servicioId, elegible, ...(elegible ? {} : { motivo: servicio.estado !== 'PUBLICADO' ? 'ESTADO_NO_PUBLICADO' as const : 'CLASIFICACION_INACTIVA' as const }) };
  }

  /** Registro histórico de cualquier estado, también RETIRADO, para procesos internos autorizados. No es una consulta pública. */
  async registro(servicioId: string, tx?: ContextoTransaccion): Promise<RegistroServicio | null> {
    const s = await this.repositorio.porId(servicioId, tx);
    return s ? { servicioId: s.id, prestadorId: s.prestadorId, categoriaId: s.categoriaId, titulo: s.titulo, descripcion: s.descripcion, estado: s.estado, version: s.version } : null;
  }
}
