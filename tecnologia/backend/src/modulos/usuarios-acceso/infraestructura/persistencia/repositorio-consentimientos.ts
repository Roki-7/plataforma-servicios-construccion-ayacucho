import { randomUUID } from 'node:crypto';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ContextoTransaccion } from '../../aplicacion/puertos/puertos.js';
import type { RepositorioConsentimientos, HuellasTelefono } from '../../aplicacion/puertos/perfil.js';
import type { IdCuenta } from '../../dominio/identificadores.js';
import { consentimientoEfectivo } from '../../dominio/consentimiento-telefono.js';
export class RepositorioConsentimientosPostgres implements RepositorioConsentimientos {
  constructor(private readonly uow: UnidadDeTrabajoPostgres, private readonly huellas: HuellasTelefono) {}
  async efectivo(id: IdCuenta, telefono: string | null, tx: ContextoTransaccion): Promise<boolean> {
    if (!telefono) return false;
    const filas: { telefono_hmac: Buffer; autorizada_en: Date | null; revocada_en: Date | null }[] = await this.uow.runner(tx).query('SELECT telefono_hmac,autorizada_en,revocada_en FROM consentimientos_telefono WHERE usuario_id=$1',[id]);
    const c=filas[0]; return consentimientoEfectivo(c ? {telefonoHmac:c.telefono_hmac,autorizadaEn:c.autorizada_en,revocadaEn:c.revocada_en} : null,this.huellas.vigentes(id,telefono));
  }
  async decidir(id: IdCuenta, telefono: string | null, autorizar: boolean, ahora: Date, tx: ContextoTransaccion): Promise<void> {
    const q=this.uow.runner(tx);
    if (autorizar && telefono) await q.query(`INSERT INTO consentimientos_telefono(id,usuario_id,telefono_hmac,autorizada_en) VALUES($1,$2,$3,$4)
      ON CONFLICT(usuario_id) DO UPDATE SET telefono_hmac=EXCLUDED.telefono_hmac,autorizada_en=EXCLUDED.autorizada_en,revocada_en=NULL,version=consentimientos_telefono.version+1`,[randomUUID(),id,Buffer.from(this.huellas.actual(id,telefono)),ahora]);
    else await q.query('UPDATE consentimientos_telefono SET revocada_en=$2,version=version+1 WHERE usuario_id=$1 AND revocada_en IS NULL',[id,ahora]);
  }
}
