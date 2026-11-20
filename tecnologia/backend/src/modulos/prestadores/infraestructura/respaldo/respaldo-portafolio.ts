import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AlmacenPortafolio } from '../../aplicacion/puertos/puertos.js';

/**
 * Respaldo y restauración coordinados del portafolio de 002 (PostgreSQL + objetos saneados). Este módulo es la lógica del procedimiento,
 * sin conocer Docker ni S3: las operaciones externas llegan por puertos. Las reglas siguen el protocolo de `plan.md`.
 */
export interface ObjetoInventario { readonly clave: string; readonly bytes: number; readonly mime: string; readonly sha256: string }
export interface Manifiesto {
  readonly version: 1; readonly backupId: string; readonly estado: 'COMPLETO' | 'INCOMPLETO'; readonly causa?: string; readonly corteUtc: string;
  readonly origen: { readonly baseLogica: string; readonly bucket: string; readonly prefijo: string; readonly espacioRedis: string };
  readonly versiones: { readonly postgresMayor: number; readonly aplicacion: string; readonly migraciones: readonly string[] };
  readonly volcado: { readonly archivo: string; readonly sha256: string; readonly bytes: number };
  readonly objetos: readonly ObjetoInventario[];
  readonly conteos: { readonly fotografiasVigentes: number; readonly preparacionesInconclusas: number; readonly purgasPendientes: number; readonly objetosCopiados: number };
  readonly firma?: string;
}

export class ErrorRespaldo extends Error {
  constructor(readonly codigo: string, mensaje: string) { super(mensaje); this.name = 'ErrorRespaldo'; }
}

/** Instantánea PostgreSQL con las escrituras de portafolio y la limpieza pausadas hasta `cerrar`. */
export interface InstantaneaPortafolio {
  readonly snapshotId: string; readonly corteUtc: string; readonly postgresMayor: number; readonly migraciones: readonly string[];
  readonly fotografias: readonly ObjetoInventario[]; readonly preparaciones: number; readonly purgas: number;
  cerrar(): Promise<void>;
}
export interface OrigenPostgres {
  abrirInstantanea(): Promise<InstantaneaPortafolio>;
  volcar(snapshotId: string): Promise<Uint8Array>;
}
export interface DestinoPostgres {
  readonly postgresMayor: number;
  crearBaseNueva(): Promise<void>;
  restaurar(volcado: Uint8Array): Promise<void>;
  /** Crea la puerta de restauración en estado CERRADO. Mientras no se abra, la API no debe aceptar tráfico. */
  cerrarPuerta(backupId: string): Promise<void>;
  /** Estado actual de la puerta en el destino (consulta real). `null` si no existe. */
  estadoPuerta(): Promise<{ readonly estado: 'CERRADO' | 'ABIERTO'; readonly backupId: string } | null>;
  remapearClaves(prefijoOrigen: string, prefijoDestino: string): Promise<void>;
  /** Descarta preparaciones inconclusas del corte y conserva las purgas para que el limpiador las reintente. */
  reconciliar(): Promise<{ preparacionesDescartadas: number; purgasConservadas: number }>;
  referencias(): Promise<readonly { clave: string; bytes: number; mime: string; sha256: string }[]>;
  abrirPuerta(espacioRedis: string): Promise<void>;
}
export interface ClavesRespaldo { readonly cifrado: Buffer; readonly firma: Buffer }

export function clavesDeRespaldo(base64: string | undefined): ClavesRespaldo {
  const maestra = Buffer.from(base64 ?? '', 'base64');
  if (maestra.length !== 32 || maestra.toString('base64') !== base64) throw new ErrorRespaldo('CLAVE_NO_VALIDA', 'Se requiere una clave de respaldo aleatoria de 32 bytes en base64.');
  const derivar = (uso: string) => createHmac('sha256', maestra).update(`respaldo-portafolio-002:${uso}`).digest();
  return { cifrado: derivar('cifrado'), firma: derivar('firma') };
}

export const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** AES-256-GCM. El identificador del respaldo y el nombre del artefacto van como datos autenticados: un artefacto de otro conjunto no se descifra. */
export function cifrar(claves: ClavesRespaldo, backupId: string, nombre: string, claro: Uint8Array): Buffer {
  const iv = randomBytes(12); const c = createCipheriv('aes-256-gcm', claves.cifrado, iv); c.setAAD(Buffer.from(`${backupId}:${nombre}`));
  return Buffer.concat([iv, c.update(claro), c.final(), c.getAuthTag()]);
}
export function descifrar(claves: ClavesRespaldo, backupId: string, nombre: string, cifrado: Uint8Array): Buffer {
  if (cifrado.length < 28) throw new ErrorRespaldo('ARTEFACTO_ALTERADO', `El artefacto ${nombre} está truncado.`);
  const b = Buffer.from(cifrado); const d = createDecipheriv('aes-256-gcm', claves.cifrado, b.subarray(0, 12)); d.setAAD(Buffer.from(`${backupId}:${nombre}`)); d.setAuthTag(b.subarray(b.length - 16));
  try { return Buffer.concat([d.update(b.subarray(12, b.length - 16)), d.final()]); } catch { throw new ErrorRespaldo('ARTEFACTO_ALTERADO', `El artefacto ${nombre} está alterado o no pertenece a este respaldo.`); }
}

const cuerpoFirmado = (m: Manifiesto) => JSON.stringify({ ...m, firma: undefined });
export const firmarManifiesto = (claves: ClavesRespaldo, m: Manifiesto): Manifiesto => ({ ...m, firma: createHmac('sha256', claves.firma).update(cuerpoFirmado(m)).digest('hex') });
export function verificarFirma(claves: ClavesRespaldo, m: Manifiesto): boolean {
  if (!m.firma || !/^[0-9a-f]{64}$/.test(m.firma)) return false;
  return timingSafeEqual(Buffer.from(m.firma, 'hex'), createHmac('sha256', claves.firma).update(cuerpoFirmado(m)).digest());
}

const nombreObjeto = (clave: string) => `objetos/${createHash('sha256').update(clave).digest('hex')}.enc`;
const escribirPrivado = async (ruta: string, datos: Uint8Array | string) => { await writeFile(ruta, datos, { mode: 0o600 }); await chmod(ruta, 0o600).catch(() => undefined); };

export interface OpcionesRespaldo {
  readonly origen: OrigenPostgres; readonly almacen: AlmacenPortafolio; readonly claves: ClavesRespaldo; readonly directorio: string;
  readonly origenLogico: { baseLogica: string; bucket: string; prefijo: string; espacioRedis: string }; readonly aplicacion: string;
  readonly intervencion?: (etapa: 'tras-instantanea' | 'tras-volcado' | 'tras-copia') => Promise<void> | void;
}

/**
 * Corte: bloquea y drena las escrituras de portafolio y la limpieza al abrir la instantánea, lee el inventario y el volcado de esa instantánea, copia los objetos
 * antes de reanudar y solo declara COMPLETO tras cotejar ambos lados. Un fallo deja un manifiesto INCOMPLETO con la causa y reanuda siempre al origen.
 */
export async function respaldarPortafolio(o: OpcionesRespaldo): Promise<Manifiesto> {
  const backupId = randomUUID(); const dir = join(o.directorio, backupId);
  await mkdir(join(dir, 'objetos'), { recursive: true, mode: 0o700 });
  let instantanea: InstantaneaPortafolio | undefined;
  let parcial: Partial<Manifiesto> = {};
  const base = (estado: 'COMPLETO' | 'INCOMPLETO', causa?: string): Manifiesto => firmarManifiesto(o.claves, {
    version: 1, backupId, estado, ...(causa ? { causa } : {}), corteUtc: parcial.corteUtc ?? new Date().toISOString(), origen: o.origenLogico,
    versiones: parcial.versiones ?? { postgresMayor: 0, aplicacion: o.aplicacion, migraciones: [] }, volcado: parcial.volcado ?? { archivo: '', sha256: '', bytes: 0 },
    objetos: parcial.objetos ?? [], conteos: parcial.conteos ?? { fotografiasVigentes: 0, preparacionesInconclusas: 0, purgasPendientes: 0, objetosCopiados: 0 } });
  try {
    instantanea = await o.origen.abrirInstantanea();
    parcial = { corteUtc: instantanea.corteUtc, versiones: { postgresMayor: instantanea.postgresMayor, aplicacion: o.aplicacion, migraciones: instantanea.migraciones } };
    await o.intervencion?.('tras-instantanea');
    const volcado = await o.origen.volcar(instantanea.snapshotId);
    const archivoVolcado = 'volcado.sql.enc';
    await escribirPrivado(join(dir, archivoVolcado), cifrar(o.claves, backupId, archivoVolcado, volcado));
    parcial = { ...parcial, volcado: { archivo: archivoVolcado, sha256: sha256(volcado), bytes: volcado.length } };
    await o.intervencion?.('tras-volcado');
    const copiados: ObjetoInventario[] = [];
    for (const ref of instantanea.fotografias) {
      let bytes: Uint8Array;
      try { bytes = await o.almacen.leer(ref.clave); } catch { throw new ErrorRespaldo('OBJETO_AUSENTE', 'Una referencia vigente no tiene su objeto en el almacén.'); }
      if (bytes.length !== ref.bytes || sha256(bytes) !== ref.sha256) throw new ErrorRespaldo('OBJETO_ALTERADO', 'Un objeto no coincide con el tamaño o el checksum de su referencia.');
      await escribirPrivado(join(dir, nombreObjeto(ref.clave)), cifrar(o.claves, backupId, nombreObjeto(ref.clave), bytes));
      copiados.push({ clave: ref.clave, bytes: bytes.length, mime: ref.mime, sha256: ref.sha256 });
    }
    parcial = { ...parcial, objetos: copiados, conteos: { fotografiasVigentes: instantanea.fotografias.length, preparacionesInconclusas: instantanea.preparaciones,
      purgasPendientes: instantanea.purgas, objetosCopiados: copiados.length } };
    await o.intervencion?.('tras-copia');
    if (copiados.length !== instantanea.fotografias.length) throw new ErrorRespaldo('INVENTARIO_INCOMPLETO', 'El inventario copiado no cubre todas las referencias vigentes.');
    const manifiesto = base('COMPLETO');
    await escribirPrivado(join(dir, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
    return manifiesto;
  } catch (error) {
    const causa = error instanceof ErrorRespaldo ? error.codigo : 'FALLO_NO_CLASIFICADO';
    const manifiesto = base('INCOMPLETO', causa);
    await escribirPrivado(join(dir, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
    throw Object.assign(new ErrorRespaldo(causa, `Respaldo ${backupId} INCOMPLETO: ${causa}.`), { manifiesto });
  } finally { await instantanea?.cerrar().catch(() => undefined); }
}

/**
 * Una base y un bucket o prefijo nuevos, locales y distintos del origen. Nunca la base de validación 002, ni 001, ni producción. Los destinos de restauración reales son
 * ayacucho_002_restauracion_*: los nombres ayacucho_002_test_* solo se admiten si el llamador (las pruebas) lo pide de forma explícita.
 */
export function validarDestino(d: { urlBase: string; urlOrigen: string; bucket: string; prefijo: string; bucketOrigen: string; prefijoOrigen: string; confirmo: string; permitirBasesDePrueba?: boolean }): void {
  const destino = URL.canParse(d.urlBase) ? new URL(d.urlBase) : undefined; const origen = URL.canParse(d.urlOrigen) ? new URL(d.urlOrigen) : undefined;
  const nombre = destino?.pathname.slice(1) ?? '';
  if (!destino || !origen || !['postgres:', 'postgresql:'].includes(destino.protocol) || destino.hostname !== '127.0.0.1') throw new ErrorRespaldo('DESTINO_NO_PERMITIDO', 'El destino debe ser PostgreSQL local.');
  if (!(d.permitirBasesDePrueba ? /^ayacucho_002_(restauracion|test)_[a-z0-9_]{4,60}$/ : /^ayacucho_002_restauracion_[a-z0-9_]{4,60}$/).test(nombre) || nombre === origen.pathname.slice(1) || /validacion|ayacucho_001|prod/i.test(nombre)) {
    throw new ErrorRespaldo('DESTINO_NO_PERMITIDO', 'La base de destino debe ser nueva (ayacucho_002_restauracion_*) y distinta del origen.');
  }
  if (d.confirmo !== nombre) throw new ErrorRespaldo('CONFIRMACION_REQUERIDA', 'Confirme el nombre exacto de la base de destino.');
  const prefijoPermitido = d.prefijo === 'portafolio/' ? d.bucket !== d.bucketOrigen : /^pruebas\/[0-9a-f-]{36}\/portafolio\/$/.test(d.prefijo);
  if (!prefijoPermitido || (d.bucket === d.bucketOrigen && d.prefijo === d.prefijoOrigen)) throw new ErrorRespaldo('DESTINO_NO_PERMITIDO', 'El bucket o prefijo de destino debe ser nuevo y distinto del origen.');
}

export type EtapaRestauracion = 'tras-crear' | 'tras-puerta' | 'tras-restaurar' | 'tras-objetos' | 'tras-reconciliar';
export interface OpcionesRestauracion {
  readonly directorio: string; readonly backupId: string; readonly claves: ClavesRespaldo; readonly destinoPostgres: DestinoPostgres; readonly almacenDestino: AlmacenPortafolio;
  readonly prefijoDestino: string; readonly postgresMayorOrigen: number; readonly migracionesEsperadas: readonly string[];
  readonly intervencion?: (etapa: EtapaRestauracion, copiados: number) => Promise<void> | void;
}
export interface ResultadoRestauracion { readonly backupId: string; readonly espacioRedis: string; readonly objetosRestaurados: number; readonly preparacionesDescartadas: number; readonly purgasConservadas: number }

/** Lee y verifica el manifiesto y las sumas de TODOS los artefactos antes de tocar ningún destino. */
export async function verificarConjunto(o: Pick<OpcionesRestauracion, 'directorio' | 'backupId' | 'claves' | 'postgresMayorOrigen' | 'migracionesEsperadas'>): Promise<{ manifiesto: Manifiesto; volcado: Buffer; objetos: Map<string, Buffer> }> {
  const dir = join(o.directorio, o.backupId);
  let manifiesto: Manifiesto;
  try { manifiesto = JSON.parse(await readFile(join(dir, 'manifiesto.json'), 'utf8')) as Manifiesto; } catch { throw new ErrorRespaldo('MANIFIESTO_AUSENTE', 'No se pudo leer el manifiesto del respaldo.'); }
  if (!verificarFirma(o.claves, manifiesto)) throw new ErrorRespaldo('MANIFIESTO_ALTERADO', 'La firma del manifiesto no es válida.');
  if (manifiesto.backupId !== o.backupId) throw new ErrorRespaldo('PAREJA_INCOMPATIBLE', 'El manifiesto pertenece a otro respaldo.');
  if (manifiesto.estado !== 'COMPLETO') throw new ErrorRespaldo('RESPALDO_INCOMPLETO', 'Un respaldo INCOMPLETO no se puede restaurar.');
  if (manifiesto.versiones.postgresMayor !== o.postgresMayorOrigen) throw new ErrorRespaldo('VERSION_INCOMPATIBLE', 'La versión mayor de PostgreSQL del respaldo no coincide con la del destino.');
  const migraciones = manifiesto.versiones.migraciones;
  if (migraciones.length !== o.migracionesEsperadas.length || migraciones.some((m, i) => m !== o.migracionesEsperadas[i])) throw new ErrorRespaldo('VERSION_INCOMPATIBLE', 'Las migraciones del respaldo no coinciden con las de esta aplicación.');
  let cifradoVolcado: Buffer;
  try { cifradoVolcado = await readFile(join(dir, manifiesto.volcado.archivo)); } catch { throw new ErrorRespaldo('ARTEFACTO_AUSENTE', 'Falta el volcado del respaldo.'); }
  const volcado = descifrar(o.claves, o.backupId, manifiesto.volcado.archivo, cifradoVolcado);
  if (sha256(volcado) !== manifiesto.volcado.sha256 || volcado.length !== manifiesto.volcado.bytes) throw new ErrorRespaldo('ARTEFACTO_ALTERADO', 'El volcado no coincide con el manifiesto.');
  const objetos = new Map<string, Buffer>();
  for (const ref of manifiesto.objetos) {
    let cifradoObjeto: Buffer;
    try { cifradoObjeto = await readFile(join(dir, nombreObjeto(ref.clave))); } catch { throw new ErrorRespaldo('OBJETO_AUSENTE', 'Falta un objeto del respaldo.'); }
    const claro = descifrar(o.claves, o.backupId, nombreObjeto(ref.clave), cifradoObjeto);
    if (claro.length !== ref.bytes || sha256(claro) !== ref.sha256) throw new ErrorRespaldo('OBJETO_ALTERADO', 'Un objeto del respaldo no coincide con el manifiesto.');
    objetos.set(ref.clave, claro);
  }
  return { manifiesto, volcado, objetos };
}

/**
 * Restaura en destinos nuevos con el tráfico cerrado. La puerta se crea CERRADA inmediatamente después de crear la base y ANTES de restaurar ningún dato, y solo se abre al final,
 * con un espacio Redis nuevo, tras cotejar todas las referencias contra sus objetos. Así, un fallo en cualquier punto (incluida una restauración parcial) deja una base que no arranca.
 * El volcado no puede contener ni tocar la puerta, y se comprueba que siga CERRADA con el mismo respaldo después de restaurarlo.
 */
export async function restaurarPortafolio(o: OpcionesRestauracion): Promise<ResultadoRestauracion> {
  const { manifiesto, volcado, objetos } = await verificarConjunto(o);
  const espacioRedis = `ayacucho:002:restaurada-${o.backupId.slice(0, 8)}-${randomBytes(4).toString('hex')}`;
  if (espacioRedis === manifiesto.origen.espacioRedis) throw new ErrorRespaldo('ESPACIO_REDIS_REPETIDO', 'El espacio Redis nuevo debe ser distinto del origen.');
  if (o.destinoPostgres.postgresMayor !== manifiesto.versiones.postgresMayor) throw new ErrorRespaldo('VERSION_INCOMPATIBLE', 'El servidor de destino usa otra versión mayor de PostgreSQL.');
  const existentes = o.almacenDestino.listar()[Symbol.asyncIterator]();
  if (!(await existentes.next()).done) throw new ErrorRespaldo('DESTINO_NO_VACIO', 'El bucket o prefijo de destino ya contiene objetos.');
  // El volcado de origen no debe referirse a la puerta: un volcado así podría eliminarla o sobrescribirla.
  if (volcado.toString('utf8').toLowerCase().includes('restauracion_002')) throw new ErrorRespaldo('VOLCADO_CONTIENE_PUERTA', 'El volcado hace referencia a la puerta de restauración y no se restaura.');
  await o.destinoPostgres.crearBaseNueva();
  await o.intervencion?.('tras-crear', 0);
  await o.destinoPostgres.cerrarPuerta(o.backupId);
  await o.intervencion?.('tras-puerta', 0);
  await o.destinoPostgres.restaurar(volcado);
  const puerta = await o.destinoPostgres.estadoPuerta();
  if (!puerta || puerta.estado !== 'CERRADO' || puerta.backupId !== o.backupId) throw new ErrorRespaldo('PUERTA_ALTERADA', 'La puerta de restauración no está cerrada tras restaurar el volcado.');
  await o.intervencion?.('tras-restaurar', 0);
  await o.destinoPostgres.remapearClaves(manifiesto.origen.prefijo, o.prefijoDestino);
  let copiados = 0;
  for (const ref of manifiesto.objetos) {
    const clave = o.prefijoDestino + ref.clave.slice(manifiesto.origen.prefijo.length);
    await o.almacenDestino.guardar(clave, objetos.get(ref.clave) as Buffer);
    copiados++;
    await o.intervencion?.('tras-objetos', copiados);
  }
  const reconciliacion = await o.destinoPostgres.reconciliar();
  await o.intervencion?.('tras-reconciliar', copiados);
  // Cotejo final de todas las referencias vigentes del destino contra su objeto, tamaño y checksum.
  const esperadas = new Map(manifiesto.objetos.map(x => [o.prefijoDestino + x.clave.slice(manifiesto.origen.prefijo.length), x]));
  const referencias = await o.destinoPostgres.referencias();
  if (referencias.length !== esperadas.size) throw new ErrorRespaldo('REFERENCIAS_INCONSISTENTES', 'Las referencias restauradas no coinciden con el inventario del respaldo.');
  for (const r of referencias) {
    const esperada = esperadas.get(r.clave);
    if (!esperada || esperada.sha256 !== r.sha256 || esperada.bytes !== r.bytes || esperada.mime !== r.mime) throw new ErrorRespaldo('REFERENCIAS_INCONSISTENTES', 'Una referencia restaurada no coincide con el manifiesto.');
    let bytes: Uint8Array;
    try { bytes = await o.almacenDestino.leer(r.clave); } catch { throw new ErrorRespaldo('OBJETO_AUSENTE', 'Una referencia restaurada no tiene su objeto.'); }
    if (bytes.length !== r.bytes || sha256(bytes) !== r.sha256) throw new ErrorRespaldo('OBJETO_ALTERADO', 'Un objeto restaurado no coincide con su referencia.');
  }
  await o.destinoPostgres.abrirPuerta(espacioRedis);
  return { backupId: o.backupId, espacioRedis, objetosRestaurados: copiados, ...reconciliacion };
}
