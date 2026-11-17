import type { DataSource } from 'typeorm';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { ContextoTransaccion, RepositorioCuentas, RepositorioRegistro, CuentaLectura, FotografiaAlmacenada, IdentidadAutenticada } from '../../aplicacion/puertos/puertos.js';
import type { RegistroCuenta, PerfilCuenta } from '../../dominio/cuenta.js';
import { idCuenta, type IdCuenta, type PerfilHabilitado } from '../../dominio/identificadores.js';
import { ErrorAplicacion } from '../../dominio/errores.js';
interface Fila { id: string; correo: string; nombre_mostrar: string; contrasena_hash: string; version: string; version_credencial: string; telefono: string | null; distrito: string | null; fotografia_id: string | null }
export class RepositorioCuentasPostgres implements RepositorioCuentas, RepositorioRegistro {
  constructor(private readonly db: DataSource, private readonly uow: UnidadDeTrabajoPostgres) {}
  private lectura(f: Fila): CuentaLectura { return { id: idCuenta(f.id), correo: f.correo, version: BigInt(f.version), versionCredencial: BigInt(f.version_credencial), contrasenaHash: f.contrasena_hash }; }
  async buscarPorCorreo(correo: string, tx?: ContextoTransaccion): Promise<CuentaLectura | null> { const filas: Fila[] = await (tx ? this.uow.runner(tx) : this.db).query('SELECT * FROM usuarios WHERE correo_canonico=lower($1::text COLLATE correo_001)', [correo]); return filas[0] ? this.lectura(filas[0]) : null; }
  async bloquear(id: IdCuenta, tx: ContextoTransaccion): Promise<CuentaLectura | null> { const filas: Fila[] = await this.uow.runner(tx).query('SELECT * FROM usuarios WHERE id=$1 FOR UPDATE', [id]); return filas[0] ? this.lectura(filas[0]) : null; }
  async crear(id: IdCuenta, d: RegistroCuenta, phc: string, ahora: Date, foto: FotografiaAlmacenada | undefined, tx: ContextoTransaccion): Promise<void> {
    const q = this.uow.runner(tx);
    try {
      await q.query('INSERT INTO usuarios(id,correo,nombre_mostrar,contrasena_hash,telefono,distrito,politica_privacidad_version,privacidad_aceptada_en,creada_en,actualizada_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$8)', [id, d.correo, d.nombreMostrar, phc, d.telefono ?? null, d.distrito ?? null, d.politicaPrivacidadVersion, ahora]);
    } catch (error) { if (error && typeof error === 'object' && 'driverError' in error) { const e = error.driverError as { code?: string; constraint?: string }; if (e.code === '23505' && e.constraint === 'uq_correo_canonico') throw new ErrorAplicacion(409, 'CORREO_EN_USO', 'Ese correo ya está registrado.'); } throw error; }
    for (const perfil of d.perfiles) await q.query('INSERT INTO perfiles_habilitados(usuario_id,perfil,habilitado_en,confirmado_por_titular_en) VALUES($1,$2,$3,$3)', [id, perfil, ahora]);
    if (foto) { await q.query("INSERT INTO fotografias_perfil(id,usuario_id,objeto_clave,mime,bytes,checksum,estado,creada_en,vinculada_en) VALUES($1,$2,$3,$4,$5,$6,'activa',$7,$7)", [foto.id, id, foto.objetoClave, foto.mime, foto.bytes, Buffer.from(foto.checksum), ahora]); await q.query('UPDATE usuarios SET fotografia_id=$1 WHERE id=$2', [foto.id, id]); }
  }
  async perfilBloqueado(id: IdCuenta, tx: ContextoTransaccion): Promise<PerfilCuenta> {
    const q = this.uow.runner(tx); const filas: Fila[] = await q.query('SELECT * FROM usuarios WHERE id=$1 FOR UPDATE', [id]); const f = filas[0]; if (!f) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.');
    const perfiles: { perfil: PerfilHabilitado }[] = await q.query('SELECT perfil FROM perfiles_habilitados WHERE usuario_id=$1 ORDER BY perfil', [id]);
    return { cuentaId: f.id, correo: f.correo, nombreMostrar: f.nombre_mostrar, telefono: f.telefono, distrito: f.distrito, fotografiaId: f.fotografia_id, perfiles: perfiles.map((p) => p.perfil), telefonoCompartible: false, version: Number(f.version) };
  }
  async exigirSesion(i: IdentidadAutenticada, ahora: Date, tx: ContextoTransaccion): Promise<void> { const filas: { id: string }[] = await this.uow.runner(tx).query('SELECT id FROM sesiones WHERE id=$1 AND usuario_id=$2 AND revocada_en IS NULL AND acceso_vence_en>$3 AND version=$4 FOR UPDATE', [i.sesionId, i.cuentaId, ahora, i.versionSesion.toString()]); if (!filas[0]) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.'); }
  async habilitar(id: IdCuenta, perfil: PerfilHabilitado, ahora: Date, tx: ContextoTransaccion): Promise<void> { const q = this.uow.runner(tx); await q.query('INSERT INTO perfiles_habilitados(usuario_id,perfil,habilitado_en,confirmado_por_titular_en) VALUES($1,$2,$3,$3)', [id, perfil, ahora]); await q.query('UPDATE usuarios SET version=version+1,actualizada_en=$2 WHERE id=$1', [id, ahora]); }
}
