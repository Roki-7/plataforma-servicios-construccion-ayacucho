import { execFile } from 'node:child_process';
import pg from 'pg';
import type { DestinoPostgres, InstantaneaPortafolio, OrigenPostgres } from '../modulos/prestadores/infraestructura/respaldo/respaldo-portafolio.js';
import { ErrorRespaldo } from '../modulos/prestadores/infraestructura/respaldo/respaldo-portafolio.js';

const maxBuffer = 512 * 1024 * 1024;
/** Punto de sustitución para las pruebas: permite observar los argumentos y el entorno de cada proceso externo. */
export const lanzador: { execFile: typeof execFile } = { execFile };

interface Conexion { readonly usuario: string; readonly clave: string; readonly base: string }
const conexion = (url: string): Conexion => { const u = new URL(url); return { usuario: decodeURIComponent(u.username), clave: decodeURIComponent(u.password), base: u.pathname.slice(1) }; };
const mayor = async (c: pg.Client) => Math.floor(Number((await c.query('SHOW server_version_num')).rows[0].server_version_num) / 10000);

/**
 * pg_dump y psql se ejecutan dentro del contenedor de PostgreSQL indicado. La clave viaja por el entorno del proceso (`-e PGPASSWORD`), nunca por argumentos.
 * El contenedor es el del propio servidor: los clientes y el servidor tienen la misma versión mayor.
 */
async function docker(contenedor: string, c: Conexion, programa: string, args: string[], entrada?: Uint8Array): Promise<Buffer> {
  const hijo = lanzador.execFile('docker', ['exec', '-i', '-e', 'PGPASSWORD', contenedor, programa, '-h', '127.0.0.1', '-p', '5432', '-U', c.usuario, ...args],
    { env: { ...process.env, PGPASSWORD: c.clave }, maxBuffer, encoding: 'buffer' });
  const terminado = new Promise<Buffer>((ok, fallo) => {
    const partes: Buffer[] = []; hijo.stdout?.on('data', (d: Buffer) => partes.push(d));
    hijo.on('error', fallo); hijo.on('close', codigo => codigo === 0 ? ok(Buffer.concat(partes)) : fallo(new ErrorRespaldo('PROCESO_EXTERNO_FALLIDO', `${programa} terminó con código ${codigo}.`)));
  });
  hijo.stdin?.end(entrada === undefined ? undefined : Buffer.from(entrada));
  return terminado;
}

/** Origen: instantánea con las escrituras de portafolio y la limpieza pausadas (SHARE sobre fotografías y objetos pendientes) y volcado de esa instantánea. */
export class OrigenPostgresDocker implements OrigenPostgres {
  constructor(private readonly url: string, private readonly contenedor: string, private readonly esperaMaximaMs = 15000) {}

  async abrirInstantanea(): Promise<InstantaneaPortafolio> {
    const cliente = new pg.Client({ connectionString: this.url, connectionTimeoutMillis: 5000 }); const verificador = new pg.Client({ connectionString: this.url, connectionTimeoutMillis: 5000 });
    await cliente.connect(); await verificador.connect();
    const liberar = async () => { try { await cliente.query('ROLLBACK'); } catch { /* ya cerrada */ } await cliente.end().catch(() => undefined); await verificador.end().catch(() => undefined); };
    try {
      await cliente.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
      await cliente.query(`SET LOCAL lock_timeout = '${Math.trunc(this.esperaMaximaMs)}ms'`);
      // SHARE bloquea INSERT, UPDATE y DELETE sobre ambas tablas: pausa a los escritores y a la limpieza de todas las réplicas y espera a que terminen las operaciones en curso.
      try { await cliente.query('LOCK TABLE prestadores_fotografias, prestadores_objetos_pendientes IN SHARE MODE'); }
      catch { throw new ErrorRespaldo('DRENAJE_NO_CONFIRMADO', 'No se confirmó el drenaje de las escrituras de portafolio.'); }
      const snapshotId = (await cliente.query('SELECT pg_export_snapshot() AS id')).rows[0].id as string;
      const corteUtc = (await cliente.query("SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS t")).rows[0].t as string;
      const fotos = (await cliente.query("SELECT objeto_clave AS clave, bytes, mime, encode(checksum,'hex') AS sha256 FROM prestadores_fotografias ORDER BY objeto_clave")).rows as { clave: string; bytes: number; mime: string; sha256: string }[];
      // La instantánea debe ser posterior al bloqueo: otra conexión, sin escrituras posibles, ve exactamente el mismo número de referencias.
      const vistas = Number((await verificador.query('SELECT count(*)::int AS n FROM prestadores_fotografias')).rows[0].n);
      if (vistas !== fotos.length) throw new ErrorRespaldo('INSTANTANEA_ANTERIOR_AL_BLOQUEO', 'La instantánea no coincide con el estado bloqueado.');
      const pendientes = (await cliente.query("SELECT tipo, count(*)::int AS n FROM prestadores_objetos_pendientes GROUP BY tipo")).rows as { tipo: string; n: number }[];
      const migraciones = (await cliente.query('SELECT name FROM migrations ORDER BY id')).rows.map((r: { name: string }) => r.name);
      return { snapshotId, corteUtc, postgresMayor: await mayor(cliente), migraciones, fotografias: fotos, preparaciones: pendientes.find(p => p.tipo === 'PREPARACION')?.n ?? 0,
        purgas: pendientes.find(p => p.tipo === 'PURGA')?.n ?? 0, cerrar: liberar };
    } catch (error) { await liberar(); throw error; }
  }

  async volcar(snapshotId: string): Promise<Uint8Array> {
    if (!/^[0-9A-F]{8}-[0-9A-F]{8}-\d$/.test(snapshotId)) throw new ErrorRespaldo('INSTANTANEA_NO_VALIDA', 'Identificador de instantánea no válido.');
    const c = conexion(this.url);
    return docker(this.contenedor, c, 'pg_dump', ['-d', c.base, `--snapshot=${snapshotId}`, '--no-owner', '--no-privileges', '--exclude-table=restauracion_002']);
  }
}

/** Destino: base nueva (CREATE DATABASE falla si existe), restauración con psql como el usuario de la aplicación y puerta de restauración. */
export class DestinoPostgresDocker implements DestinoPostgres {
  constructor(private readonly urlDestino: string, private readonly contenedor: string, readonly postgresMayor: number) {}
  private cliente(base?: string) { const u = new URL(this.urlDestino); if (base) u.pathname = `/${base}`; return new pg.Client({ connectionString: u.href, connectionTimeoutMillis: 5000 }); }
  private async consulta<T>(sql: string, params: unknown[] = []): Promise<T[]> { const c = this.cliente(); await c.connect(); try { return (await c.query(sql, params)).rows as T[]; } finally { await c.end(); } }

  static async mayorDe(url: string): Promise<number> { const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 }); await c.connect(); try { return await mayor(c); } finally { await c.end(); } }

  async crearBaseNueva(): Promise<void> {
    const nombre = conexion(this.urlDestino).base;
    if (!/^ayacucho_002_[a-z0-9_]+$/.test(nombre)) throw new ErrorRespaldo('DESTINO_NO_PERMITIDO', 'Nombre de base no válido.');
    // Se conecta a la base de mantenimiento del mismo servidor. CREATE DATABASE falla si ya existe: nunca se reutiliza ni se sobrescribe un destino.
    const u = new URL(this.urlDestino); u.pathname = '/postgres';
    const admin = new pg.Client({ connectionString: u.href, connectionTimeoutMillis: 5000 }); await admin.connect();
    try { await admin.query(`CREATE DATABASE "${nombre}"`); } catch { throw new ErrorRespaldo('DESTINO_EXISTENTE', 'La base de destino no se pudo crear (¿ya existe?).'); } finally { await admin.end(); }
  }
  async restaurar(volcado: Uint8Array): Promise<void> { const c = conexion(this.urlDestino); await docker(this.contenedor, c, 'psql', ['-d', c.base, '-v', 'ON_ERROR_STOP=1', '-q'], volcado); }
  async cerrarPuerta(backupId: string): Promise<void> {
    await this.consulta(`CREATE TABLE restauracion_002 (unica boolean PRIMARY KEY DEFAULT true CHECK (unica), estado text NOT NULL CHECK (estado IN ('CERRADO','ABIERTO')),
      backup_id uuid NOT NULL, espacio_redis text, actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await this.consulta("INSERT INTO restauracion_002(estado, backup_id) VALUES('CERRADO', $1)", [backupId]);
  }
  async estadoPuerta() {
    const f = await this.consulta<{ estado: 'CERRADO' | 'ABIERTO'; backup_id: string }>('SELECT estado, backup_id FROM restauracion_002 WHERE unica').catch(() => []);
    return f[0] ? { estado: f[0].estado, backupId: f[0].backup_id } : null;
  }
  async remapearClaves(origen: string, destino: string): Promise<void> {
    if (origen === destino) return;
    await this.consulta('UPDATE prestadores_fotografias SET objeto_clave = $2 || substr(objeto_clave, length($1) + 1) WHERE starts_with(objeto_clave, $1)', [origen, destino]);
    await this.consulta('UPDATE prestadores_objetos_pendientes SET clave = $2 || substr(clave, length($1) + 1) WHERE starts_with(clave, $1)', [origen, destino]);
  }
  async reconciliar() {
    const d = await this.consulta<{ clave: string }>("DELETE FROM prestadores_objetos_pendientes WHERE tipo = 'PREPARACION' RETURNING clave");
    const p = await this.consulta<{ n: number }>("SELECT count(*)::int AS n FROM prestadores_objetos_pendientes WHERE tipo = 'PURGA'");
    return { preparacionesDescartadas: d.length, purgasConservadas: Number(p[0]!.n) };
  }
  async referencias() { return this.consulta<{ clave: string; bytes: number; mime: string; sha256: string }>("SELECT objeto_clave AS clave, bytes, mime, encode(checksum,'hex') AS sha256 FROM prestadores_fotografias ORDER BY objeto_clave"); }
  async abrirPuerta(espacioRedis: string): Promise<void> {
    await this.consulta("UPDATE restauracion_002 SET estado = 'ABIERTO', espacio_redis = $1, actualizado_en = CURRENT_TIMESTAMP WHERE unica", [espacioRedis]);
  }
}

/** Nombres de las migraciones que debe haber aplicado una base completa de 002, en orden. Un respaldo solo es compatible con esta lista exacta. */
export async function migracionesEsperadas002(): Promise<readonly string[]> {
  const { persistencia002 } = await import('./persistencia.js'); const { persistenciaOferta002 } = await import('./oferta-002.js');
  const lista = persistencia002('postgresql://x:y@127.0.0.1:5432/x', persistenciaOferta002).options.migrations as unknown as { name: string }[];
  return lista.map(m => m.name);
}
