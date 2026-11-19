import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ProyeccionPrestador, ProyeccionPublica } from '../../aplicacion/puertos/proyeccion-publica.js';

export class ProyeccionPublicaPostgres implements ProyeccionPublica {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}

  async actualizar(tx: ContextoTransaccion, p: ProyeccionPrestador): Promise<void> {
    await this.uow.runner(tx).query(`INSERT INTO catalogo_proyeccion_prestadores
      (prestador_id,nombre_publico,tipo,disponibilidad_declarada,especialidades,distritos,publicable)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (prestador_id) DO UPDATE SET
      nombre_publico=EXCLUDED.nombre_publico, tipo=EXCLUDED.tipo, disponibilidad_declarada=EXCLUDED.disponibilidad_declarada,
      especialidades=EXCLUDED.especialidades, distritos=EXCLUDED.distritos, publicable=EXCLUDED.publicable`,
    [p.prestadorId, p.nombrePublico, p.tipo, p.disponibilidadDeclarada, p.especialidades, p.distritos, p.publicable]);
  }
}
