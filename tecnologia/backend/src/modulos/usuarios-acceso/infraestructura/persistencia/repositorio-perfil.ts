import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ContextoTransaccion } from '../../aplicacion/puertos/puertos.js';
import type { RepositorioPerfil } from '../../aplicacion/puertos/perfil.js';
import type { PerfilCuenta } from '../../dominio/cuenta.js';
import type { IdCuenta } from '../../dominio/identificadores.js';
import { ErrorAplicacion } from '../../dominio/errores.js';
export class RepositorioPerfilPostgres implements RepositorioPerfil {
  constructor(private readonly uow: UnidadDeTrabajoPostgres) {}
  async comprobarFoto(id: IdCuenta, foto: string, tx: ContextoTransaccion): Promise<void> { const filas: {id:string}[]=await this.uow.runner(tx).query("SELECT id FROM fotografias_perfil WHERE id=$1 AND usuario_id=$2 AND estado IN ('temporal','activa') FOR UPDATE",[foto,id]); if(!filas[0]) throw new ErrorAplicacion(404,'RECURSO_NO_DISPONIBLE','Recurso no disponible.'); }
  async guardar(anterior: PerfilCuenta, nuevo: PerfilCuenta, ahora: Date, tx: ContextoTransaccion): Promise<void> {
    const q=this.uow.runner(tx);
    const filas: {id:string}[]=await q.query('UPDATE usuarios SET nombre_mostrar=$2,telefono=$3,distrito=$4,fotografia_id=$5,version=version+1,actualizada_en=$6 WHERE id=$1 AND version=$7 RETURNING id',[anterior.cuentaId,nuevo.nombreMostrar,nuevo.telefono,nuevo.distrito,nuevo.fotografiaId,ahora,anterior.version]);
    if(!filas[0]) throw new ErrorAplicacion(409,'VERSION_DESACTUALIZADA','El perfil cambió. Recargue su versión.');
    if(nuevo.fotografiaId !== anterior.fotografiaId) {
      if(nuevo.fotografiaId) await q.query("UPDATE fotografias_perfil SET estado='activa',vinculada_en=$2 WHERE id=$1",[nuevo.fotografiaId,ahora]);
      if(anterior.fotografiaId) await q.query("UPDATE fotografias_perfil SET estado='pendiente_eliminacion' WHERE id=$1",[anterior.fotografiaId]);
    }
  }
}
