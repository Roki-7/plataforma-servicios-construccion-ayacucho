import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { LectorSesion, IdentidadAutenticada, Reloj } from '../../aplicacion/puertos/puertos.js';
import { idCuenta, type PerfilHabilitado } from '../../dominio/identificadores.js';
import { dependenciaNoDisponible } from '../../dominio/errores.js';

interface FilaSesion { id: string; usuario_id: string; autenticada_con_contrasena_en: Date | null; version: string; perfiles: PerfilHabilitado[] }
export class LectorSesionPostgres implements LectorSesion {
  constructor(private readonly db: DataSource, private readonly reloj: Reloj) {}
  async leer(token: string): Promise<IdentidadAutenticada | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    if (!this.db.isInitialized) throw dependenciaNoDisponible();
    try {
      const filas: FilaSesion[] = await this.db.query(`SELECT s.id,s.usuario_id,s.autenticada_con_contrasena_en,s.version,array_agg(p.perfil ORDER BY p.perfil) AS perfiles
        FROM sesiones s JOIN perfiles_habilitados p ON p.usuario_id=s.usuario_id
        WHERE s.acceso_digest=$1 AND s.revocada_en IS NULL AND s.acceso_vence_en>$2
        GROUP BY s.id`, [createHash('sha256').update(token).digest(), this.reloj.ahora()]);
      const fila = filas[0];
      if (!fila || fila.perfiles.some((p) => p !== 'cliente' && p !== 'prestador')) return null;
      return { cuentaId: idCuenta(fila.usuario_id), sesionId: fila.id, perfiles: Object.freeze(fila.perfiles), autenticadaConContrasenaEn: fila.autenticada_con_contrasena_en, versionSesion: BigInt(fila.version) };
    } catch { throw dependenciaNoDisponible(); }
  }
}
