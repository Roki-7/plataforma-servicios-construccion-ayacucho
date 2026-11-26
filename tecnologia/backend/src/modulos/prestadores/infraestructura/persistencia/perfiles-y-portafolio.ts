import type { QueryRunner } from 'typeorm';
import { filasDe } from './filas.js';
import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from '../../../../compartido/infraestructura/postgres/unidad-de-trabajo.js';
import type { NuevaFotografia, RepositorioPrestadores } from '../../aplicacion/puertos/puertos.js';
import type { DatosPerfil, PerfilProfesional } from '../../dominio/perfil-profesional.js';
import type { DatosTrabajo, FotografiaPortafolio, TrabajoAnterior } from '../../dominio/portafolio.js';

interface FilaPerfil { id: string; cuenta_id: string; nombre_publico: string; tipo: DatosPerfil['tipo']; experiencia: string; disponibilidad_declarada: boolean; version: number }
interface FilaTrabajo { id: string; prestador_id: string; titulo: string; descripcion: string; version: number }
interface FilaFoto { id: string; trabajo_id: string; objeto_clave: string; ancho: number; alto: number; bytes: number; checksum: Buffer }
type Ejecutor = Pick<QueryRunner, 'query'> | { query(sql: string, parametros?: unknown[]): Promise<unknown> };

const aFoto = (f: FilaFoto): FotografiaPortafolio => ({ id: f.id, trabajoId: f.trabajo_id, objetoClave: f.objeto_clave, ancho: f.ancho, alto: f.alto, bytes: f.bytes, checksum: new Uint8Array(f.checksum) });

export class RepositorioPrestadoresPostgres implements RepositorioPrestadores {
  /** `retrasoPurgaSegundos` mantiene el objeto anterior disponible para lecturas en curso tras revocar su vínculo. */
  constructor(private readonly uow: UnidadDeTrabajoPostgres, private readonly opciones: { retrasoPurgaSegundos: number } = { retrasoPurgaSegundos: 60 }) {}

  private ejecutor(tx?: ContextoTransaccion): Ejecutor { return tx ? this.uow.runner(tx) : this.uow.db; }
  private async consultar<T>(tx: ContextoTransaccion | undefined, sql: string, parametros: unknown[] = []): Promise<T[]> {
    return await this.ejecutor(tx).query(sql, parametros) as T[];
  }

  async perfilPorCuenta(cuentaId: string, tx?: ContextoTransaccion, bloquear = false): Promise<PerfilProfesional | null> {
    const filas = await this.consultar<FilaPerfil>(tx, `SELECT id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada,version
      FROM prestadores_perfiles WHERE cuenta_id=$1${bloquear && tx ? ' FOR UPDATE' : ''}`, [cuentaId]);
    return filas[0] ? this.completar(filas[0], tx) : null;
  }

  /** Perfil visible al público: solo un perfil publicable. Los trabajos se piden aparte con `trabajos`. */
  async perfilPublicoPorId(prestadorId: string): Promise<PerfilProfesional | null> {
    const filas = await this.consultar<FilaPerfil>(undefined, 'SELECT id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada,version FROM prestadores_perfiles WHERE id=$1::uuid AND publicable', [prestadorId]);
    return filas[0] ? this.completar(filas[0]) : null;
  }

  private async completar(p: FilaPerfil, tx?: ContextoTransaccion): Promise<PerfilProfesional> {
    const especialidades = await this.consultar<{ categoria_id: string }>(tx, 'SELECT categoria_id FROM prestadores_especialidades WHERE prestador_id=$1 ORDER BY categoria_id', [p.id]);
    const zonas = await this.consultar<{ distrito_codigo: string }>(tx, 'SELECT distrito_codigo FROM prestadores_zonas WHERE prestador_id=$1 ORDER BY distrito_codigo', [p.id]);
    return { id: p.id, cuentaId: p.cuenta_id, nombrePublico: p.nombre_publico, tipo: p.tipo, experiencia: p.experiencia,
      disponibilidadDeclarada: p.disponibilidad_declarada, version: p.version,
      especialidadesIds: especialidades.map(e => e.categoria_id), distritos: zonas.map(z => z.distrito_codigo) };
  }

  private async fotografiasDe(tx: ContextoTransaccion | undefined, trabajoIds: readonly string[]): Promise<Map<string, FotografiaPortafolio[]>> {
    const mapa = new Map<string, FotografiaPortafolio[]>(trabajoIds.map(id => [id, []]));
    if (trabajoIds.length === 0) return mapa;
    const filas = await this.consultar<FilaFoto>(tx, `SELECT id,trabajo_id,objeto_clave,ancho,alto,bytes,checksum FROM prestadores_fotografias
      WHERE trabajo_id = ANY($1::uuid[]) ORDER BY creada_en, id`, [[...trabajoIds]]);
    for (const f of filas) mapa.get(f.trabajo_id)?.push(aFoto(f));
    return mapa;
  }
  private ensamblar(filas: FilaTrabajo[], fotos: Map<string, FotografiaPortafolio[]>): TrabajoAnterior[] {
    return filas.map(t => ({ id: t.id, prestadorId: t.prestador_id, titulo: t.titulo, descripcion: t.descripcion, version: t.version, fotografias: fotos.get(t.id) ?? [] }));
  }

  async trabajos(prestadorId: string, tx?: ContextoTransaccion): Promise<TrabajoAnterior[]> {
    const filas = await this.consultar<FilaTrabajo>(tx, 'SELECT id,prestador_id,titulo,descripcion,version FROM prestadores_trabajos WHERE prestador_id=$1 ORDER BY creado_en, id', [prestadorId]);
    return this.ensamblar(filas, await this.fotografiasDe(tx, filas.map(f => f.id)));
  }
  async trabajoDe(prestadorId: string, trabajoId: string, tx?: ContextoTransaccion, bloquear = false): Promise<TrabajoAnterior | null> {
    const filas = await this.consultar<FilaTrabajo>(tx, `SELECT id,prestador_id,titulo,descripcion,version FROM prestadores_trabajos WHERE id=$1 AND prestador_id=$2${bloquear && tx ? ' FOR UPDATE' : ''}`, [trabajoId, prestadorId]);
    return filas.length ? this.ensamblar(filas, await this.fotografiasDe(tx, [trabajoId]))[0]! : null;
  }
  async contarTrabajos(prestadorId: string, tx?: ContextoTransaccion): Promise<number> {
    return Number((await this.consultar<{ n: string }>(tx, 'SELECT count(*)::text AS n FROM prestadores_trabajos WHERE prestador_id=$1', [prestadorId]))[0]!.n);
  }
  async contarFotografias(prestadorId: string, tx?: ContextoTransaccion): Promise<number> {
    return Number((await this.consultar<{ n: string }>(tx, `SELECT count(*)::text AS n FROM prestadores_fotografias f
      JOIN prestadores_trabajos t ON t.id=f.trabajo_id WHERE t.prestador_id=$1`, [prestadorId]))[0]!.n);
  }

  private async escribirRelaciones(tx: ContextoTransaccion, id: string, datos: DatosPerfil): Promise<void> {
    const q = this.uow.runner(tx);
    await q.query('DELETE FROM prestadores_especialidades WHERE prestador_id=$1', [id]);
    await q.query('DELETE FROM prestadores_zonas WHERE prestador_id=$1', [id]);
    await q.query('INSERT INTO prestadores_especialidades(prestador_id,categoria_id) SELECT $1, unnest($2::uuid[])', [id, [...datos.especialidadesIds]]);
    await q.query('INSERT INTO prestadores_zonas(prestador_id,distrito_codigo) SELECT $1, unnest($2::text[])', [id, [...datos.distritos]]);
  }
  async crearPerfil(tx: ContextoTransaccion, p: PerfilProfesional): Promise<void> {
    await this.uow.runner(tx).query(`INSERT INTO prestadores_perfiles(id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada,version)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [p.id, p.cuentaId, p.nombrePublico, p.tipo, p.experiencia, p.disponibilidadDeclarada, p.version]);
    await this.escribirRelaciones(tx, p.id, p);
  }
  async actualizarPerfil(tx: ContextoTransaccion, id: string, d: DatosPerfil, version: number): Promise<void> {
    await this.uow.runner(tx).query(`UPDATE prestadores_perfiles SET nombre_publico=$2,tipo=$3,experiencia=$4,disponibilidad_declarada=$5,version=$6,actualizado_en=CURRENT_TIMESTAMP WHERE id=$1`,
      [id, d.nombrePublico, d.tipo, d.experiencia, d.disponibilidadDeclarada, version]);
    await this.escribirRelaciones(tx, id, d);
  }
  async avanzarVersionPerfil(tx: ContextoTransaccion, id: string): Promise<number> {
    const filas = filasDe<{ version: number }>(await this.uow.runner(tx).query('UPDATE prestadores_perfiles SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=$1 RETURNING version', [id]));
    return filas[0]!.version;
  }

  async crearTrabajo(tx: ContextoTransaccion, t: Omit<TrabajoAnterior, 'fotografias'>): Promise<void> {
    await this.uow.runner(tx).query('INSERT INTO prestadores_trabajos(id,prestador_id,titulo,descripcion,version) VALUES($1,$2,$3,$4,$5)', [t.id, t.prestadorId, t.titulo, t.descripcion, t.version]);
  }
  async actualizarTrabajo(tx: ContextoTransaccion, id: string, cambios: Partial<DatosTrabajo>): Promise<number> {
    const filas = filasDe<{ version: number }>(await this.uow.runner(tx).query(`UPDATE prestadores_trabajos SET titulo=COALESCE($2,titulo),descripcion=COALESCE($3,descripcion),
      version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=$1 RETURNING version`, [id, cambios.titulo ?? null, cambios.descripcion ?? null]));
    return filas[0]!.version;
  }
  private async avanzarTrabajo(tx: ContextoTransaccion, trabajoId: string): Promise<number> {
    const filas = filasDe<{ version: number }>(await this.uow.runner(tx).query('UPDATE prestadores_trabajos SET version=version+1,actualizado_en=CURRENT_TIMESTAMP WHERE id=$1 RETURNING version', [trabajoId]));
    return filas[0]!.version;
  }

  async registrarPreparacion(clave: string, prestadorId: string, venceEn: Date): Promise<void> {
    await this.uow.ejecutar(async tx => {
      await this.uow.runner(tx).query(`INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion) VALUES($1,'PREPARACION',$2,$3) ON CONFLICT (clave) DO NOTHING`, [clave, prestadorId, venceEn]);
    });
  }
  private async programarPurga(tx: ContextoTransaccion, clave: string, prestadorId: string): Promise<void> {
    await this.uow.runner(tx).query(`INSERT INTO prestadores_objetos_pendientes(clave,tipo,prestador_id,proxima_ejecucion)
      VALUES($1,'PURGA',$2,CURRENT_TIMESTAMP + make_interval(secs => $3)) ON CONFLICT (clave) DO UPDATE SET tipo='PURGA'`, [clave, prestadorId, this.opciones.retrasoPurgaSegundos]);
  }
  private async consumirPreparacion(tx: ContextoTransaccion, clave: string): Promise<void> {
    await this.uow.runner(tx).query("DELETE FROM prestadores_objetos_pendientes WHERE clave=$1 AND tipo='PREPARACION'", [clave]);
  }

  async agregarFotografia(tx: ContextoTransaccion, trabajoId: string, f: NuevaFotografia): Promise<number> {
    await this.uow.runner(tx).query(`INSERT INTO prestadores_fotografias(id,trabajo_id,objeto_clave,mime,bytes,ancho,alto,checksum) VALUES($1,$2,$3,'image/webp',$4,$5,$6,$7)`,
      [f.id, trabajoId, f.objetoClave, f.bytes, f.ancho, f.alto, Buffer.from(f.checksum)]);
    await this.consumirPreparacion(tx, f.objetoClave);
    return this.avanzarTrabajo(tx, trabajoId);
  }
  async reemplazarFotografia(tx: ContextoTransaccion, trabajoId: string, f: NuevaFotografia, prestadorId: string): Promise<number> {
    const q = this.uow.runner(tx);
    const anterior: { objeto_clave: string }[] = await q.query('SELECT objeto_clave FROM prestadores_fotografias WHERE id=$1 AND trabajo_id=$2 FOR UPDATE', [f.id, trabajoId]);
    if (!anterior[0]) throw new Error('La fotografía a reemplazar no existe.');
    await q.query('UPDATE prestadores_fotografias SET objeto_clave=$3,bytes=$4,ancho=$5,alto=$6,checksum=$7 WHERE id=$1 AND trabajo_id=$2',
      [f.id, trabajoId, f.objetoClave, f.bytes, f.ancho, f.alto, Buffer.from(f.checksum)]);
    await this.programarPurga(tx, anterior[0].objeto_clave, prestadorId);
    await this.consumirPreparacion(tx, f.objetoClave);
    return this.avanzarTrabajo(tx, trabajoId);
  }
  async eliminarFotografia(tx: ContextoTransaccion, trabajoId: string, fotografiaId: string, prestadorId: string): Promise<number> {
    const q = this.uow.runner(tx);
    const filas = filasDe<{ objeto_clave: string }>(await q.query('DELETE FROM prestadores_fotografias WHERE id=$1 AND trabajo_id=$2 RETURNING objeto_clave', [fotografiaId, trabajoId]));
    if (!filas[0]) throw new Error('La fotografía a eliminar no existe.');
    await this.programarPurga(tx, filas[0].objeto_clave, prestadorId);
    return this.avanzarTrabajo(tx, trabajoId);
  }

  async fotografiaPublica(prestadorId: string, trabajoId: string, fotografiaId: string): Promise<FotografiaPortafolio | null> {
    const filas = await this.consultar<FilaFoto>(undefined, `SELECT f.id,f.trabajo_id,f.objeto_clave,f.ancho,f.alto,f.bytes,f.checksum
      FROM prestadores_fotografias f JOIN prestadores_trabajos t ON t.id=f.trabajo_id JOIN prestadores_perfiles p ON p.id=t.prestador_id
      WHERE f.id=$3 AND t.id=$2 AND p.id=$1 AND p.publicable`, [prestadorId, trabajoId, fotografiaId]);
    return filas[0] ? aFoto(filas[0]) : null;
  }
}
