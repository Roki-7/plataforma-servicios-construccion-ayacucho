import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import type request from 'supertest';
import { clienteAlmacenamiento003 } from '../../soporte/solicitudes-cotizaciones/almacenamiento.js';
import { validarRespuesta003 } from '../../soporte/solicitudes-cotizaciones/contrato-003.js';
import { cuerpoDefinitiva, cuerpoEstimada, cuerpoPublicable, imagen, montarUs1, type EntornoUs1 } from '../../soporte/solicitudes-cotizaciones/entorno-http.js';

// T090 · Matriz de seguridad PR04 de punta a punta (CA-SEG-01, CP-303). Ocho identidades contra las 18 operaciones de la 003, sus listados y sus archivos, con la aplicación
// completa, PostgreSQL y Garage reales y cuentas ficticias. Cada celda declara su estado esperado ANTES de ejecutarse. Toda petición rechazada se comprueba con una
// instantánea de la base (todas las tablas de 003, fila a fila) y del almacén (claves de objetos) tomada antes y después: no puede cambiar nada. Las celdas autorizadas
// que mutan se ejecutan contra un escenario propio y SÍ deben cambiar algo (prueba de que la instantánea detecta modificaciones). No se modifica ninguna política.
//
// Identidades:  D dueño · DEST destinatario de una dirigida · COMP prestador compatible (sin cotización) · ACT autor de cotización no retirada · RET autor de cotización
//               retirada (ya sin cobertura) · AJC cliente ajeno · AJP prestador ajeno · SIN sin sesión.
const IDS = ['dueno', 'destinatario', 'compatible', 'autorActivo', 'autorRetirado', 'ajenoCliente', 'ajenoPrestador', 'sinSesion'] as const;
type Id = (typeof IDS)[number];
type Esperados = readonly [number, number, number, number, number, number, number, number];
const OK = 200; const CREADO = 201;

let e: EntornoUs1;
let tokens: Record<Id, string | undefined>;
let tGema: string;
let almacen: Awaited<ReturnType<typeof clienteAlmacenamiento003>>;
let principal: Escenario;

interface Solic { readonly solicitudId: string; readonly version: number; readonly versionTrabajo: number; readonly archivoId: string }
interface Escenario {
  readonly pub: Solic;        // publicada (ABIERTA), categoría A en Ayacucho, con una fotografía
  readonly borr: Solic;       // borrador con una fotografía preparada
  readonly dir: Solic;        // dirigida a Elena, con una fotografía
  readonly cB: { readonly cotizacionId: string; readonly version: number };   // cotización activa de Beto (ACT) sobre pub
  readonly cR: { readonly cotizacionId: string; readonly version: number };   // cotización retirada de Carla (RET) sobre pub
  readonly cE: { readonly cotizacionId: string; readonly version: number };   // cotización activa de Elena (DEST) sobre dir
}

interface Celda { readonly fila: string; readonly operationId: string; readonly identidad: Id; readonly esperado: number; readonly obtenido: number; readonly recurso: string; readonly mutante: boolean; readonly cambio: boolean }
const registro: Celda[] = [];
const noAplica: { operationId: string; identidad: Id; razon: string }[] = [];

// ─── Instantáneas ─────────────────────────────────────────────────────────────────────────────────────────────────────
const TABLAS = ['solicitudes', 'solicitudes_versiones', 'solicitudes_bitacora', 'solicitudes_archivos', 'solicitudes_objetos_pendientes', 'cotizaciones', 'cotizaciones_versiones',
  'cotizaciones_aclaraciones', 'avisos_negocio', 'claves_idempotencia'] as const;
async function huellaBase(): Promise<string> {
  const partes: string[] = [];
  for (const t of TABLAS) {
    const r = await e.db.query(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, ',' ORDER BY x::text), '')) AS h FROM ${t} x`) as { n: number; h: string }[];
    partes.push(`${t}:${r[0]!.n}:${r[0]!.h}`);
  }
  return partes.join('|');
}
async function claves(): Promise<string> {
  const salida: string[] = []; let token: string | undefined;
  do {
    const p = await almacen.cliente.send(new ListObjectsV2Command({ Bucket: almacen.bucket, Prefix: e.prefijo, ContinuationToken: token }) as never) as
      { Contents?: { Key?: string; Size?: number; ETag?: string }[]; IsTruncated?: boolean; NextContinuationToken?: string };
    for (const o of p.Contents ?? []) salida.push(`${o.Key}:${o.Size}:${o.ETag}`);
    token = p.IsTruncated ? p.NextContinuationToken : undefined;
  } while (token);
  return salida.sort().join('|');
}
const instantanea = async () => `${await huellaBase()}#${await claves()}`;

// ─── Escenarios ───────────────────────────────────────────────────────────────────────────────────────────────────────
const cuerpoDirigida = (extra: object = {}) => ({ tipo: 'DIRIGIDA', prestadorId: e.datos.prestadores.elena.prestadorId, descripcion: 'Reparación del muro de contención del huerto.',
  categoriaId: e.datos.categorias.A, distrito: 'ayacucho', fechaDesde: '2031-03-10', fechaHasta: '2031-03-20', ...extra });
async function solicitudConFoto(t: string, cuerpo: object, publicar: boolean, formato: 'jpeg' | 'png' = 'jpeg'): Promise<Solic> {
  const c = (await e.crear(t, cuerpo).expect(201)).body as { solicitudId: string; version: number };
  const archivoId = (await e.cargar(t, c.solicitudId, await imagen(80, 60, formato)).expect(201)).body.archivoId as string;
  if (!publicar) return { solicitudId: c.solicitudId, version: c.version, versionTrabajo: 0, archivoId };
  const p = (await e.publicar(t, c.solicitudId, { version: c.version, archivosIds: [archivoId] }).expect(200)).body as { version: number; versionTrabajo: number };
  return { solicitudId: c.solicitudId, version: p.version, versionTrabajo: p.versionTrabajo, archivoId };
}
/** Escenario completo y propio: ninguna celda autorizada que muta toca el escenario principal. Carla cotiza con cobertura temporal y la pierde al retirar. */
async function escenario(compartir = false): Promise<Escenario> {
  const d = e.datos; const tD = tokens.dueno!;
  const pub = await solicitudConFoto(tD, cuerpoPublicable(e, { categoriaId: d.categorias.A, ...(compartir ? { compartirFotografias: true } : {}) }), true);
  const borr = await solicitudConFoto(tD, cuerpoPublicable(e, { categoriaId: d.categorias.A }), false);
  const dir = await solicitudConFoto(tD, cuerpoDirigida(), true, 'png');
  const cB = (await e.cotizar(tokens.autorActivo, pub.solicitudId, cuerpoEstimada(pub.versionTrabajo)).expect(201)).body;
  const cE = (await e.cotizar(tokens.destinatario, dir.solicitudId, cuerpoEstimada(dir.versionTrabajo)).expect(201)).body;
  await e.db.query('INSERT INTO prestadores_zonas(prestador_id, distrito_codigo) VALUES ($1, $2) ON CONFLICT DO NOTHING', [d.prestadores.carla.prestadorId, 'ayacucho']);
  const tCarla = tokens.autorRetirado!;
  const cR = (await e.cotizar(tCarla, pub.solicitudId, cuerpoEstimada(pub.versionTrabajo)).expect(201)).body;
  await e.retirarCotizacion(tCarla, cR.cotizacionId, { versionCotizacion: cR.version }).expect(200);
  await e.db.query("DELETE FROM prestadores_zonas WHERE prestador_id=$1 AND distrito_codigo='ayacucho'", [d.prestadores.carla.prestadorId]);
  return { pub, borr, dir, cB: { cotizacionId: cB.cotizacionId, version: cB.version }, cR: { cotizacionId: cR.cotizacionId, version: cR.version + 1 }, cE: { cotizacionId: cE.cotizacionId, version: cE.version } };
}
/** Mismo escenario con todos los identificadores sustituidos por inexistentes: la referencia para «ajeno = inexistente». */
const fantasma = (r: Escenario): Escenario => {
  const s = (x: Solic): Solic => ({ ...x, solicitudId: randomUUID(), archivoId: randomUUID() });
  return { ...r, pub: s(r.pub), borr: s(r.borr), dir: s(r.dir), cB: { ...r.cB, cotizacionId: randomUUID() }, cR: { ...r.cR, cotizacionId: randomUUID() }, cE: { ...r.cE, cotizacionId: randomUUID() } };
};

// ─── Matriz declarativa ───────────────────────────────────────────────────────────────────────────────────────────────
type Llamada = (t: string | undefined, r: Escenario) => request.Test;
interface Fila {
  readonly nombre: string; readonly operationId: string; readonly metodo: string; readonly ruta: string; readonly recurso: string; readonly campoPrivado: string;
  readonly mutante: boolean; readonly condicion: string; readonly esperados: Esperados; readonly llamar: Llamada; readonly sinInexistente?: boolean;
}
const f = (nombre: string, operationId: string, metodo: string, ruta: string, recurso: string, mutante: boolean, condicion: string, campoPrivado: string, esperados: Esperados, llamar: Llamada, sinInexistente = false): Fila =>
  ({ nombre, operationId, metodo, ruta, recurso, mutante, condicion, campoPrivado, esperados, llamar, sinInexistente });
//                                        D    DEST  COMP  ACT   RET   AJC   AJP   SIN
const LEE_PUB: Esperados = [200, 404, 200, 200, 404, 404, 404, 401];
const LEE_DIR: Esperados = [200, 200, 404, 404, 404, 404, 404, 401];
const SOLO_DUENO: Esperados = [200, 404, 404, 404, 404, 404, 404, 401];
const ESCRIBE_CLIENTE: Esperados = [200, 403, 403, 403, 403, 404, 403, 401];
const v = (x: Solic) => x.version;

const MATRIZ: readonly Fila[] = [
  f('crear', 'crearSolicitud003', 'POST', '/solicitudes', 'colección', true, 'perfil cliente', 'cuentaId del dueño', [CREADO, 403, 403, 403, 403, CREADO, 403, 401], (t) => e.crear(t, cuerpoPublicable(e)), true),
  f('listar mis solicitudes (rol cliente)', 'listarMisSolicitudes003', 'GET', '/solicitudes', 'colección propia', false, 'perfil cliente', 'solicitudes ajenas', [OK, 403, 403, 403, 403, OK, 403, 401], (t) => e.listar(t), true),
  f('listar mis solicitudes (rol prestador)', 'listarMisSolicitudes003', 'GET', '/solicitudes?rol=prestador', 'colección propia', false, 'perfil prestador', 'solicitudes ajenas', [403, OK, OK, OK, OK, 403, OK, 401], (t) => e.listar(t, '?rol=prestador'), true),
  f('listar oportunidades', 'listarOportunidades003', 'GET', '/solicitudes/oportunidades', 'colección con título', false, 'perfil prestador y título', 'borradores, dirigidas ajenas, datos del cliente', [403, OK, OK, OK, OK, 403, OK, 401], (t) => e.oportunidades(t), true),
  f('obtener publicada', 'obtenerSolicitud003', 'GET', '/solicitudes/{id}', 'solicitud publicada', false, 'dueño o título (compatible, autor activo)', 'cliente, bitácora, fotos no compartidas', LEE_PUB, (t, r) => e.obtener(t, r.pub.solicitudId)),
  f('obtener dirigida', 'obtenerSolicitud003', 'GET', '/solicitudes/{id}', 'solicitud dirigida', false, 'dueño o destinatario; compatible NO basta', 'cliente, bitácora', LEE_DIR, (t, r) => e.obtener(t, r.dir.solicitudId)),
  f('obtener borrador', 'obtenerSolicitud003', 'GET', '/solicitudes/{id}', 'solicitud en borrador', false, 'solo el dueño', 'todo', SOLO_DUENO, (t, r) => e.obtener(t, r.borr.solicitudId)),
  f('editar publicada', 'editarSolicitud003', 'PATCH', '/solicitudes/{id}', 'solicitud publicada', true, 'perfil cliente y titularidad', 'versión', ESCRIBE_CLIENTE, (t, r) => e.editar(t, r.pub.solicitudId, { version: v(r.pub), medidas: 'intento de edición' })),
  f('editar dirigida', 'editarSolicitud003', 'PATCH', '/solicitudes/{id}', 'solicitud dirigida', true, 'perfil cliente y titularidad', 'versión', ESCRIBE_CLIENTE, (t, r) => e.editar(t, r.dir.solicitudId, { version: v(r.dir), medidas: 'intento de edición' })),
  f('publicar borrador', 'publicarSolicitud003', 'POST', '/solicitudes/{id}/publicacion', 'borrador', true, 'perfil cliente y titularidad', 'versión', ESCRIBE_CLIENTE, (t, r) => e.publicar(t, r.borr.solicitudId, { version: v(r.borr), archivosIds: [r.borr.archivoId] })),
  f('cerrar publicada', 'cerrarSolicitud003', 'POST', '/solicitudes/{id}/cierre', 'solicitud publicada', true, 'perfil cliente y titularidad', 'versión', ESCRIBE_CLIENTE, (t, r) => e.cerrarSolicitud(t, r.pub.solicitudId, { version: v(r.pub) })),
  f('cerrar dirigida', 'cerrarSolicitud003', 'POST', '/solicitudes/{id}/cierre', 'solicitud dirigida', true, 'perfil cliente y titularidad', 'versión', ESCRIBE_CLIENTE, (t, r) => e.cerrarSolicitud(t, r.dir.solicitudId, { version: v(r.dir) })),
  f('historial versiones publicada', 'consultarHistorialSolicitud003', 'GET', '/solicitudes/{id}/historial?tipo=versiones', 'versiones', false, 'dueño o autor no retirado (CA-HIS-01); el compatible solo ve la vigente', 'actor, privacidad, bitácora', [200, 404, 404, 200, 404, 404, 404, 401], (t, r) => e.historial(t, r.pub.solicitudId, '?tipo=versiones')),
  f('historial versiones dirigida', 'consultarHistorialSolicitud003', 'GET', '/solicitudes/{id}/historial?tipo=versiones', 'versiones', false, 'dueño o destinatario', 'actor, privacidad', LEE_DIR, (t, r) => e.historial(t, r.dir.solicitudId, '?tipo=versiones')),
  f('historial bitácora publicada', 'consultarHistorialSolicitud003', 'GET', '/solicitudes/{id}/historial?tipo=bitacora', 'bitácora', false, 'solo el dueño (CA-HIS-03)', 'toda la bitácora', SOLO_DUENO, (t, r) => e.historial(t, r.pub.solicitudId, '?tipo=bitacora')),
  f('historial bitácora dirigida', 'consultarHistorialSolicitud003', 'GET', '/solicitudes/{id}/historial?tipo=bitacora', 'bitácora', false, 'solo el dueño (CA-HIS-03)', 'toda la bitácora', SOLO_DUENO, (t, r) => e.historial(t, r.dir.solicitudId, '?tipo=bitacora')),
  f('cargar archivo en borrador', 'cargarArchivoSolicitud003', 'POST', '/solicitudes/{id}/archivos', 'borrador', true, 'perfil cliente y titularidad', 'objeto y clave', [CREADO, 403, 403, 403, 403, 404, 403, 401], (t, r) => e.cargar(t, r.borr.solicitudId, { tipoMime: 'image/jpeg', contenidoBase64: IMAGEN_B64 })),
  f('cargar archivo en publicada', 'cargarArchivoSolicitud003', 'POST', '/solicitudes/{id}/archivos', 'solicitud publicada', true, 'perfil cliente y titularidad', 'objeto y clave', [CREADO, 403, 403, 403, 403, 404, 403, 401], (t, r) => e.cargar(t, r.pub.solicitudId, { tipoMime: 'image/jpeg', contenidoBase64: IMAGEN_B64 })),
  f('archivo de publicada (no compartida)', 'obtenerArchivoSolicitud003', 'GET', '/solicitudes/{id}/archivos/{archivoId}', 'fotografía no compartida', false, 'dueño; los prestadores solo con permiso (CA-ARC-04)', 'bytes, clave interna', SOLO_DUENO, (t, r) => e.archivo(t, r.pub.solicitudId, r.pub.archivoId)),
  f('archivo de dirigida', 'obtenerArchivoSolicitud003', 'GET', '/solicitudes/{id}/archivos/{archivoId}', 'fotografía de dirigida', false, 'dueño o destinatario', 'bytes, clave interna', LEE_DIR, (t, r) => e.archivo(t, r.dir.solicitudId, r.dir.archivoId)),
  f('archivo de borrador', 'obtenerArchivoSolicitud003', 'GET', '/solicitudes/{id}/archivos/{archivoId}', 'fotografía preparada', false, 'solo el dueño antes de publicar', 'bytes, clave interna', SOLO_DUENO, (t, r) => e.archivo(t, r.borr.solicitudId, r.borr.archivoId)),
  f('enviar cotización a publicada', 'enviarCotizacion003', 'POST', '/solicitudes/{id}/cotizaciones', 'solicitud publicada', true, 'perfil prestador y título (b) con solicitud abierta', 'cotizaciones de otros', [403, 404, CREADO, 409, 404, 403, 404, 401], (t, r) => e.cotizar(t, r.pub.solicitudId, cuerpoEstimada(r.pub.versionTrabajo))),
  f('enviar cotización a dirigida', 'enviarCotizacion003', 'POST', '/solicitudes/{id}/cotizaciones', 'solicitud dirigida', true, 'perfil prestador y título (a)', 'cotizaciones de otros', [403, 409, 404, 404, 404, 403, 404, 401], (t, r) => e.cotizar(t, r.dir.solicitudId, cuerpoEstimada(r.dir.versionTrabajo))),
  f('cotizaciones de mi solicitud publicada', 'listarCotizacionesDeSolicitud003', 'GET', '/solicitudes/{id}/cotizaciones', 'cotizaciones de la solicitud', false, 'solo el cliente dueño', 'nombres, cotizaciones de competidores', SOLO_DUENO, (t, r) => e.cotizacionesDe(t, r.pub.solicitudId)),
  f('cotizaciones de mi solicitud dirigida', 'listarCotizacionesDeSolicitud003', 'GET', '/solicitudes/{id}/cotizaciones', 'cotizaciones de la solicitud', false, 'solo el cliente dueño', 'nombres', SOLO_DUENO, (t, r) => e.cotizacionesDe(t, r.dir.solicitudId)),
  f('comparar cotizaciones propias', 'listarCotizacionesDeSolicitud003', 'GET', '/solicitudes/{id}/cotizaciones?ids=', 'comparación', false, 'solo el cliente dueño, ids de la misma solicitud', 'nombres, cotizaciones de competidores', SOLO_DUENO, (t, r) => e.cotizacionesDe(t, r.pub.solicitudId, `?ids=${r.cB.cotizacionId},${r.cR.cotizacionId}`)),
  f('mis cotizaciones', 'listarMisCotizaciones003', 'GET', '/cotizaciones', 'colección propia', false, 'perfil prestador', 'cotizaciones de otros', [403, OK, OK, OK, OK, 403, OK, 401], (t) => e.misCotizaciones(t), true),
  f('cotización activa', 'obtenerCotizacion003', 'GET', '/cotizaciones/{id}', 'cotización activa de Beto', false, 'autor o cliente dueño de la solicitud', 'competidores, cuentaId', [200, 404, 404, 200, 404, 404, 404, 401], (t, r) => e.cotizacion(t, r.cB.cotizacionId)),
  f('cotización retirada', 'obtenerCotizacion003', 'GET', '/cotizaciones/{id}', 'cotización retirada de Carla', false, 'autor (conserva lectura) o cliente dueño', 'competidores', [200, 404, 404, 404, 200, 404, 404, 401], (t, r) => e.cotizacion(t, r.cR.cotizacionId)),
  f('cotización de dirigida', 'obtenerCotizacion003', 'GET', '/cotizaciones/{id}', 'cotización de Elena', false, 'autor o cliente dueño', 'competidores', [200, 200, 404, 404, 404, 404, 404, 401], (t, r) => e.cotizacion(t, r.cE.cotizacionId)),
  f('actualizar cotización activa', 'actualizarCotizacion003', 'POST', '/cotizaciones/{id}/versiones', 'cotización activa', true, 'perfil prestador y autoría', 'versiones', [403, 404, 404, CREADO, 404, 403, 404, 401], (t, r) => e.actualizarCotizacion(t, r.cB.cotizacionId, { ...cuerpoDefinitiva(r.pub.versionTrabajo), versionCotizacion: r.cB.version })),
  f('actualizar cotización retirada', 'actualizarCotizacion003', 'POST', '/cotizaciones/{id}/versiones', 'cotización retirada', true, 'retirada: solo lectura', 'versiones', [403, 404, 404, 404, 409, 403, 404, 401], (t, r) => e.actualizarCotizacion(t, r.cR.cotizacionId, { ...cuerpoDefinitiva(r.pub.versionTrabajo), versionCotizacion: r.cR.version })),
  f('retirar cotización activa', 'retirarCotizacion003', 'POST', '/cotizaciones/{id}/retiro', 'cotización activa', true, 'perfil prestador y autoría', 'estado', [403, 404, 404, OK, 404, 403, 404, 401], (t, r) => e.retirarCotizacion(t, r.cB.cotizacionId, { versionCotizacion: r.cB.version })),
  f('retirar cotización retirada', 'retirarCotizacion003', 'POST', '/cotizaciones/{id}/retiro', 'cotización retirada', true, 'retirada: solo lectura', 'estado', [403, 404, 404, 404, 409, 403, 404, 401], (t, r) => e.retirarCotizacion(t, r.cR.cotizacionId, { versionCotizacion: r.cR.version })),
  f('aclaración en cotización activa', 'enviarAclaracion003', 'POST', '/cotizaciones/{id}/aclaraciones', 'hilo de cotización activa', true, 'solo cliente dueño y autor', 'hilo ajeno', [CREADO, 404, 404, CREADO, 404, 404, 404, 401], (t, r) => e.aclarar(t, r.cB.cotizacionId, { texto: 'Pregunta de seguridad ficticia.' })),
  f('aclaración en cotización retirada', 'enviarAclaracion003', 'POST', '/cotizaciones/{id}/aclaraciones', 'hilo de cotización retirada', true, 'retirada: hilo de solo lectura', 'hilo ajeno', [409, 404, 404, 404, 409, 404, 404, 401], (t, r) => e.aclarar(t, r.cR.cotizacionId, { texto: 'Pregunta de seguridad ficticia.' })),
  f('aclaración en cotización de dirigida', 'enviarAclaracion003', 'POST', '/cotizaciones/{id}/aclaraciones', 'hilo de cotización de dirigida', true, 'solo cliente dueño y autor', 'hilo ajeno', [CREADO, CREADO, 404, 404, 404, 404, 404, 401], (t, r) => e.aclarar(t, r.cE.cotizacionId, { texto: 'Pregunta de seguridad ficticia.' })),
  f('aclaraciones de cotización activa', 'listarAclaraciones003', 'GET', '/cotizaciones/{id}/aclaraciones', 'hilo de cotización activa', false, 'solo cliente dueño y autor', 'hilo ajeno', [200, 404, 404, 200, 404, 404, 404, 401], (t, r) => e.aclaraciones(t, r.cB.cotizacionId)),
  f('aclaraciones de cotización retirada', 'listarAclaraciones003', 'GET', '/cotizaciones/{id}/aclaraciones', 'hilo de cotización retirada', false, 'autor retirado conserva lectura (CA-ACL-03)', 'hilo ajeno', [200, 404, 404, 404, 200, 404, 404, 401], (t, r) => e.aclaraciones(t, r.cR.cotizacionId)),
  f('aclaraciones de cotización de dirigida', 'listarAclaraciones003', 'GET', '/cotizaciones/{id}/aclaraciones', 'hilo de cotización de dirigida', false, 'solo cliente dueño y destinatario autor', 'hilo ajeno', [200, 200, 404, 404, 404, 404, 404, 401], (t, r) => e.aclaraciones(t, r.cE.cotizacionId)),
];
let IMAGEN_B64 = '';

// Texto que NUNCA puede aparecer en una respuesta de rechazo.
const prohibido = () => {
  const d = e.datos;
  const cuentas = [...Object.values(d.clientes), ...Object.values(d.prestadores)];
  return [...cuentas.flatMap(c => [c.correo, c.cuentaId]), ...Object.values(d.prestadores).map(p => p.prestadorId), 'Ana Albañil', 'Beto Gasfitero', 'Carla Electricista', 'Darío Pintor', 'Elena Sin Servicio',
    'Gema Constructora', e.prefijo, 'pruebas/', 'SELECT ', 'INSERT ', ' at ', 'node_modules', 'stack', 'password', 'contrasena', 'Bearer ', 'solicitudes_archivos', 'objetoClave', 'objeto_clave'];
};
const sinFiltracion = (cuerpo: unknown) => {
  const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo ?? '');
  for (const p of prohibido()) expect([p, texto.includes(p)]).toEqual([p, false]);
};
const esBinario = (res: { type?: string; body?: unknown }) => (res.type ?? '').startsWith('image/') || Buffer.isBuffer(res.body) && (res.body as Buffer).length > 0;

beforeAll(async () => {
  e = await montarUs1();
  almacen = await clienteAlmacenamiento003();
  const d = e.datos;
  IMAGEN_B64 = (await imagen(32, 24)).contenidoBase64;
  const t = (c: Parameters<EntornoUs1['token']>[0]) => e.token(c);
  tokens = {
    dueno: await t(d.clientes.clienteUno), destinatario: await t(d.prestadores.elena), compatible: await t(d.prestadores.ana), autorActivo: await t(d.prestadores.beto),
    autorRetirado: await t(d.prestadores.carla), ajenoCliente: await t(d.clientes.clienteDos), ajenoPrestador: await t(d.prestadores.dario), sinSesion: undefined,
  };
  tGema = await t(d.prestadores.gema);
  principal = await escenario();
}, 600000);
afterAll(async () => {
  try {
    const carpeta = resolve(process.cwd(), '..', '.local', 'evidencia', '003', 't090');
    mkdirSync(carpeta, { recursive: true });
    writeFileSync(resolve(carpeta, 'matriz-pr04.json'), JSON.stringify({ celdas: registro, noAplica }, null, 1));
  } catch { /* la evidencia local es opcional: nunca debe romper la suite */ }
  almacen?.cliente.destroy();
  await e?.cerrar();
}, 180000);

// ─── 1 · La matriz celda a celda ──────────────────────────────────────────────────────────────────────────────────────
describe('matriz PR04: ocho identidades contra las 18 operaciones (CA-SEG-01, CP-303)', () => {
  for (const fila of MATRIZ) {
    describe(`${fila.operationId} · ${fila.nombre}`, () => {
      for (const [i, id] of IDS.entries()) {
        const esperado = fila.esperados[i]!;
        const exito = esperado >= 200 && esperado < 300;
        test(`${id} → ${esperado}${exito && fila.mutante ? ' (muta, escenario propio)' : exito ? '' : ' (sin efectos)'}`, async () => {
          const r = exito && fila.mutante ? await escenario() : principal;
          const antes = await instantanea();
          const res = await fila.llamar(tokens[id], r);
          const despues = await instantanea();
          expect([fila.operationId, id, res.status]).toEqual([fila.operationId, id, esperado]);
          const cambio = antes !== despues;
          if (!exito) {
            // Rechazo: ni una fila ni un objeto cambia, la respuesta cumple el contrato de error y no contiene nada interno ni ajeno.
            expect(cambio).toBe(false);
            await validarRespuesta003(`C003Error${esperado}` as 'C003Error404', res.body);
            sinFiltracion(res.body);
            expect(esBinario(res)).toBe(false);
            expect(res.headers['content-type'] ?? '').not.toMatch(/^image\//);
          } else if (fila.mutante) {
            expect(cambio).toBe(true);
          } else {
            expect(cambio).toBe(false);
          }
          // Lo ajeno es indistinguible de lo inexistente: mismo estado y mismo cuerpo, con la misma identidad.
          if (esperado === 404 && !fila.sinInexistente) {
            const falso = await fila.llamar(tokens[id], fantasma(r));
            expect({ status: res.status, body: res.body }).toEqual({ status: falso.status, body: falso.body });
          }
          registro.push({ fila: fila.nombre, operationId: fila.operationId, identidad: id, esperado, obtenido: res.status, recurso: fila.recurso, mutante: fila.mutante, cambio });
        }, 120000);
      }
    });
  }
});

// ─── 2 · Completitud: cada operación contra cada identidad ────────────────────────────────────────────────────────────
describe('completitud de la matriz', () => {
  test('las 18 operaciones del contrato aprobado figuran en la matriz y cada una se ejecuta con las ocho identidades', () => {
    const contrato = JSON.parse(readFileSync(resolve(process.cwd(), 'contracts', 'solicitudes-cotizaciones.openapi.json'), 'utf8')) as { paths: Record<string, Record<string, { operationId?: string }>> };
    const del003 = Object.values(contrato.paths).flatMap(p => Object.values(p).map(o => o.operationId!)).filter(Boolean).sort();
    expect(del003).toHaveLength(18);
    expect([...new Set(MATRIZ.map(m => m.operationId))].sort()).toEqual(del003);
    for (const op of del003) {
      const celdas = registro.filter(c => c.operationId === op);
      for (const id of IDS) expect([op, id, celdas.some(c => c.identidad === id)]).toEqual([op, id, true]);
    }
  });
  test('todas las celdas ejecutadas coinciden con su estado declarado; ningún rechazo cambió datos y todo éxito que muta sí los cambió', () => {
    expect(registro.length).toBe(MATRIZ.length * IDS.length);
    for (const c of registro) {
      expect([c.fila, c.identidad, c.obtenido]).toEqual([c.fila, c.identidad, c.esperado]);
      const exito = c.esperado >= 200 && c.esperado < 300;
      expect([c.fila, c.identidad, c.cambio]).toEqual([c.fila, c.identidad, exito && c.mutante]);
    }
    const sinSesion = registro.filter(c => c.identidad === 'sinSesion');
    expect(sinSesion.every(c => c.obtenido === 401)).toBe(true);
    expect(sinSesion).toHaveLength(MATRIZ.length);
  });
});

// ─── 3 · Listados, paginación y parámetros manipulados ────────────────────────────────────────────────────────────────
const contiene = (cuerpo: unknown, id: string) => JSON.stringify(cuerpo).includes(id);
/** Recorre todas las páginas de «mis solicitudes»: el dueño acumula más de una página con los escenarios de la matriz. */
async function todasLasPaginas(tk: string | undefined, consulta: string): Promise<unknown[]> {
  const salida: unknown[] = [];
  for (let pagina = 1; pagina < 40; pagina += 1) {
    const r = (await e.listar(tk, `?${consulta}&tamano=50&pagina=${pagina}`).expect(200)).body as { elementos: unknown[]; total: number };
    salida.push(...r.elementos);
    if (salida.length >= r.total || r.elementos.length === 0) break;
  }
  return salida;
}
describe('listados: solo lo autorizado, sin filtraciones por paginación, filtros ni orden', () => {
  test('oportunidades: cada prestador ve exactamente lo que su título permite', async () => {
    const r = principal;
    const lista = async (id: Id) => (await e.oportunidades(tokens[id], '?tamano=50').expect(200)).body;
    const comp = await lista('compatible'); const act = await lista('autorActivo'); const dest = await lista('destinatario'); const ret = await lista('autorRetirado'); const ajeno = await lista('ajenoPrestador');
    for (const cuerpo of [comp, act]) { expect(contiene(cuerpo, r.pub.solicitudId)).toBe(true); expect(contiene(cuerpo, r.dir.solicitudId)).toBe(false); expect(contiene(cuerpo, r.borr.solicitudId)).toBe(false); }
    expect(contiene(dest, r.dir.solicitudId)).toBe(true);
    for (const cuerpo of [dest, ret, ajeno]) { expect(contiene(cuerpo, r.pub.solicitudId)).toBe(false); expect(contiene(cuerpo, r.borr.solicitudId)).toBe(false); }
    expect(contiene(ret, r.dir.solicitudId)).toBe(false); expect(contiene(ajeno, r.dir.solicitudId)).toBe(false);
    for (const cuerpo of [comp, act, dest, ret, ajeno]) sinFiltracion(cuerpo);
  });
  test('«mis solicitudes»: el dueño ve las suyas y otro cliente no ve ninguna de ellas', async () => {
    const r = principal;
    const duenio = await todasLasPaginas(tokens.dueno, 'rol=cliente');
    for (const s of [r.pub, r.borr, r.dir]) expect(contiene(duenio, s.solicitudId)).toBe(true);
    const ajeno = await todasLasPaginas(tokens.ajenoCliente, 'rol=cliente');
    for (const s of [r.pub, r.borr, r.dir]) expect(contiene(ajeno, s.solicitudId)).toBe(false);
    const elena = (await e.listar(tokens.destinatario, '?rol=prestador&tamano=50').expect(200)).body;
    expect(contiene(elena, r.dir.solicitudId)).toBe(true); expect(contiene(elena, r.pub.solicitudId)).toBe(false);
    const ana = (await e.listar(tokens.compatible, '?rol=prestador&tamano=50').expect(200)).body;
    expect(contiene(ana, r.dir.solicitudId)).toBe(false); expect(contiene(ana, r.borr.solicitudId)).toBe(false);
  });
  test('«mis cotizaciones»: cada autor ve solo las suyas, también la retirada', async () => {
    const r = principal;
    const beto = (await e.misCotizaciones(tokens.autorActivo, '?tamano=50').expect(200)).body;
    expect(contiene(beto, r.cB.cotizacionId)).toBe(true); expect(contiene(beto, r.cR.cotizacionId)).toBe(false); expect(contiene(beto, r.cE.cotizacionId)).toBe(false);
    const carla = (await e.misCotizaciones(tokens.autorRetirado, '?tamano=50').expect(200)).body;
    expect(contiene(carla, r.cR.cotizacionId)).toBe(true); expect(contiene(carla, r.cB.cotizacionId)).toBe(false);
    const ana = (await e.misCotizaciones(tokens.compatible, '?tamano=50').expect(200)).body;
    expect(contiene(ana, r.cB.cotizacionId)).toBe(false); expect(contiene(ana, r.cR.cotizacionId)).toBe(false);
  });
  test('paginación, filtros y orden manipulados no revelan nada ni modifican datos', async () => {
    const antes = await instantanea(); const r = principal;
    for (const id of ['ajenoPrestador', 'autorRetirado'] as const) {
      for (const q of ['?pagina=1&tamano=100', '?pagina=2&tamano=1', '?pagina=999', `?categoriaId=${e.datos.categorias.A}`, '?distrito=ayacucho', `?cuentaId=${e.datos.clientes.clienteUno.cuentaId}`,
        '?estado=BORRADOR', '?orden=-creada', '?orden=cuentaId', `?solicitudId=${r.pub.solicitudId}`, '?tipo=DIRIGIDA']) {
        const res = await e.oportunidades(tokens[id], q);
        expect([id, q, [200, 400].includes(res.status)]).toEqual([id, q, true]);
        for (const s of [r.pub, r.borr, r.dir]) expect([id, q, contiene(res.body, s.solicitudId)]).toEqual([id, q, false]);
        sinFiltracion(res.body);
      }
    }
    for (const q of ['?pagina=1&tamano=100', '?estado=BORRADOR', `?clienteId=${e.datos.clientes.clienteUno.cuentaId}`, '?orden=creada']) {
      const res = await e.listar(tokens.ajenoCliente, q);
      expect([q, [200, 400].includes(res.status)]).toEqual([q, true]);
      for (const s of [r.pub, r.borr, r.dir]) expect([q, contiene(res.body, s.solicitudId)]).toEqual([q, false]);
    }
    expect(await instantanea()).toBe(antes);
  });
});

// ─── 4 · Comparación y relaciones entre solicitudes ───────────────────────────────────────────────────────────────────
async function solicitudPublicadaDe(tk: string): Promise<{ solicitudId: string; version: number; versionTrabajo: number }> {
  const c = (await e.crear(tk, cuerpoPublicable(e, { categoriaId: e.datos.categorias.A })).expect(201)).body;
  return (await e.publicar(tk, c.solicitudId, { version: c.version }).expect(200)).body;
}
describe('comparación: ningún identificador de otra solicitud', () => {
  test('mezclar cotizaciones de otra solicitud del mismo cliente, de otro cliente o inexistentes responde como inexistente y no modifica nada', async () => {
    const r = principal;
    const ajenaPublicada = await solicitudPublicadaDe(tokens.ajenoCliente!);
    const cAjena = (await e.cotizar(tokens.compatible, ajenaPublicada.solicitudId, cuerpoEstimada(ajenaPublicada.versionTrabajo)).expect(201)).body;
    const base = await instantanea();
    const inexistente = await e.cotizacionesDe(tokens.dueno, r.pub.solicitudId, `?ids=${r.cB.cotizacionId},${randomUUID()}`);
    expect(inexistente.status).toBe(404);
    const mezcla = [
      await e.cotizacionesDe(tokens.dueno, r.pub.solicitudId, `?ids=${r.cB.cotizacionId},${r.cE.cotizacionId}`),               // de otra solicitud del mismo cliente
      await e.cotizacionesDe(tokens.dueno, r.pub.solicitudId, `?ids=${r.cB.cotizacionId},${cAjena.cotizacionId}`),             // de la solicitud de otro cliente
      await e.cotizacionesDe(tokens.dueno, r.dir.solicitudId, `?ids=${r.cB.cotizacionId}`),                                    // de pub, pedida desde dir
      await e.cotizacionesDe(tokens.dueno, ajenaPublicada.solicitudId, `?ids=${cAjena.cotizacionId}`),                         // solicitud ajena completa
      await e.cotizacionesDe(tokens.ajenoCliente, r.pub.solicitudId, `?ids=${r.cB.cotizacionId}`),                              // el ajeno pide las del dueño
    ];
    for (const res of mezcla) { expect(res.status).toBe(404); expect(res.body).toEqual(inexistente.body); sinFiltracion(res.body); }
    expect(await instantanea()).toBe(base);
    expect((await e.cotizacionesDe(tokens.ajenoCliente, ajenaPublicada.solicitudId, `?ids=${cAjena.cotizacionId}`).expect(200)).body.elementos).toHaveLength(1);
  });
  test('el dueño ve los nombres públicos solo dentro de su propia solicitud', async () => {
    const r = principal;
    const duenio = (await e.cotizacionesDe(tokens.dueno, r.pub.solicitudId, '?tamano=50').expect(200)).body;
    expect(contiene(duenio, 'Beto Gasfitero')).toBe(true); expect(contiene(duenio, 'Carla Electricista')).toBe(true);
    const pub = await solicitudPublicadaDe(tokens.ajenoCliente!);
    await e.cotizar(tokens.compatible, pub.solicitudId, cuerpoEstimada(pub.versionTrabajo)).expect(201);
    const ajeno = (await e.cotizacionesDe(tokens.ajenoCliente, pub.solicitudId, '?tamano=50').expect(200)).body;
    expect(contiene(ajeno, 'Ana Albañil')).toBe(true);
    for (const x of ['Beto Gasfitero', 'Carla Electricista', r.cB.cotizacionId, r.cR.cotizacionId]) expect(contiene(ajeno, x)).toBe(false);
  });
});

// ─── 5 · Fotografías en Garage real ───────────────────────────────────────────────────────────────────────────────────
describe('fotografías: visibilidad por título y permiso, sin rutas ni claves', () => {
  test('sin compartir, solo el dueño descarga; al compartir se abre al compatible y al autor; al revocar se cierra; nada interno se expone', async () => {
    const r = await escenario(); const o = (id: Id) => e.archivo(tokens[id], r.pub.solicitudId, r.pub.archivoId);
    const sinAcceso = ['compatible', 'autorActivo', 'destinatario', 'autorRetirado', 'ajenoCliente', 'ajenoPrestador'] as const;
    // 1 · sin compartir
    let antes = await instantanea();
    expect((await o('dueno')).status).toBe(200);
    for (const id of sinAcceso) { const res = await o(id); expect([id, res.status]).toEqual([id, 404]); expect(esBinario(res)).toBe(false); sinFiltracion(res.body); }
    expect((await o('sinSesion')).status).toBe(401);
    const vista = (await e.obtener(tokens.compatible, r.pub.solicitudId).expect(200)).body;
    expect(vista.fotografias).toEqual({ hay: true, compartidas: false, archivos: [] });
    sinFiltracion(vista);
    expect(await instantanea()).toBe(antes);
    // 2 · compartir
    const actual = (await e.obtener(tokens.dueno, r.pub.solicitudId).expect(200)).body as { version: number };
    const on = (await e.editar(tokens.dueno, r.pub.solicitudId, { version: actual.version, compartirFotografias: true }).expect(200)).body as { version: number };
    antes = await instantanea();
    for (const id of ['compatible', 'autorActivo'] as const) {
      const res = await o(id); expect([id, res.status]).toEqual([id, 200]);
      expect(res.headers['content-type']).toBe('image/webp'); expect((res.body as Buffer).length).toBeGreaterThan(0);
      expect(JSON.stringify(res.headers)).not.toMatch(/pruebas|solicitudes\/|x-amz|location|\.s3\.|garage/i);
    }
    for (const id of ['destinatario', 'autorRetirado', 'ajenoCliente', 'ajenoPrestador'] as const) { const res = await o(id); expect([id, res.status]).toEqual([id, 404]); expect(esBinario(res)).toBe(false); }
    expect(await instantanea()).toBe(antes);
    // 3 · revocar: la siguiente petición ya no accede
    await e.editar(tokens.dueno, r.pub.solicitudId, { version: on.version, compartirFotografias: false }).expect(200);
    antes = await instantanea();
    for (const id of ['compatible', 'autorActivo'] as const) expect([id, (await o(id)).status]).toEqual([id, 404]);
    expect(await instantanea()).toBe(antes);
  }, 240000);
  test('la fotografía de una dirigida es del destinatario y del dueño aunque no se comparta; el compatible y los demás no la reciben', async () => {
    const r = principal; const antes = await instantanea();
    const o = (id: Id) => e.archivo(tokens[id], r.dir.solicitudId, r.dir.archivoId);
    for (const id of ['dueno', 'destinatario'] as const) { const res = await o(id); expect([id, res.status]).toEqual([id, 200]); expect(res.headers['content-type']).toBe('image/webp'); }
    for (const id of ['compatible', 'autorActivo', 'autorRetirado', 'ajenoCliente', 'ajenoPrestador'] as const) { const res = await o(id); expect([id, res.status]).toEqual([id, 404]); expect(esBinario(res)).toBe(false); }
    expect(await instantanea()).toBe(antes);
  });
  test('identificadores manipulados, inexistentes o con rutas internas responden 400/404 sin contenido ni claves', async () => {
    const r = principal; const antes = await instantanea();
    const raros = ['../x', '..%2F..%2Fetc%2Fpasswd', '%00', 'a'.repeat(300), `${r.pub.archivoId}%2F..`, encodeURIComponent(`${e.prefijo}${r.pub.archivoId}`), randomUUID(), r.dir.archivoId, r.borr.archivoId.toUpperCase()];
    for (const id of ['ajenoCliente', 'ajenoPrestador', 'compatible', 'sinSesion'] as const) {
      for (const raro of raros) {
        const llamada = e.http.get(`/api/v1/solicitudes/${r.pub.solicitudId}/archivos/${raro}`);
        if (tokens[id]) llamada.set('Authorization', `Bearer ${tokens[id]}`);
        const res = await llamada.buffer(true);
        expect([id, raro, [400, 401, 404].includes(res.status)]).toEqual([id, raro, true]);
        expect(esBinario(res)).toBe(false); sinFiltracion(res.text ?? res.body);
      }
    }
    // El dueño tampoco recibe el archivo de otra solicitud ni uno inexistente, con la misma respuesta.
    const cruce = await e.archivo(tokens.dueno, r.pub.solicitudId, r.dir.archivoId); const falso = await e.archivo(tokens.dueno, r.pub.solicitudId, randomUUID());
    expect({ s: cruce.status, b: cruce.body }).toEqual({ s: falso.status, b: falso.body }); expect(cruce.status).toBe(404);
    expect(await instantanea()).toBe(antes);
  });
  test('cargar archivos sin autorización no deja objetos ni filas: ni el prestador, ni el ajeno, ni sin sesión', async () => {
    const r = principal; const antes = await instantanea();
    for (const id of ['destinatario', 'compatible', 'autorActivo', 'autorRetirado', 'ajenoCliente', 'ajenoPrestador', 'sinSesion'] as const) {
      const res = await e.cargar(tokens[id], r.borr.solicitudId, await imagen(30, 20));
      expect([id, [401, 403, 404].includes(res.status)]).toEqual([id, true]);
    }
    expect(await instantanea()).toBe(antes);
  });
});

// ─── 6 · Sesión, perfiles y claves de idempotencia ────────────────────────────────────────────────────────────────────
describe('sesión y perfiles: tener sesión no es tener autorización', () => {
  test('tokens inválidos, ajenos al esquema o manipulados dan 401 en lecturas y escrituras, sin modificar datos', async () => {
    const r = principal; const antes = await instantanea(); const valido = tokens.dueno!;
    const manipulado = `${valido.slice(0, -2)}${valido.endsWith('AA') ? 'BB' : 'AA'}`;
    for (const cabecera of ['Bearer abc.def.ghi', 'Bearer', 'Basic dXN1YXJpbzpjbGF2ZQ==', `Bearer ${manipulado}`, `Token ${valido}`]) {
      for (const llamada of [e.http.get(`/api/v1/solicitudes/${r.pub.solicitudId}`), e.http.get('/api/v1/cotizaciones'), e.http.get(`/api/v1/solicitudes/${r.pub.solicitudId}/archivos/${r.pub.archivoId}`)]) {
        const res = await llamada.set('Authorization', cabecera);
        expect([cabecera.slice(0, 12), res.status]).toEqual([cabecera.slice(0, 12), 401]); sinFiltracion(res.body);
      }
      const esc = await e.http.post(`/api/v1/solicitudes/${r.pub.solicitudId}/cierre`).set('Authorization', cabecera).set('Origin', e.config.origen).set('Idempotency-Key', randomUUID()).send({ version: r.pub.version });
      expect([cabecera.slice(0, 12), esc.status]).toEqual([cabecera.slice(0, 12), 401]);
    }
    expect(await instantanea()).toBe(antes);
  });
  test('cuenta con los dos perfiles: actúa como cliente sobre lo suyo y como prestador según su título, y nada más', async () => {
    const r = principal; const antes = await instantanea();
    expect((await e.obtener(tGema, r.pub.solicitudId)).status).toBe(200);              // compatible (título b)
    for (const s of [r.borr, r.dir]) expect((await e.obtener(tGema, s.solicitudId)).status).toBe(404);
    expect((await e.cotizacionesDe(tGema, r.pub.solicitudId)).status).toBe(404);
    expect((await e.cotizacion(tGema, r.cB.cotizacionId)).status).toBe(404);
    const edicion = await e.editar(tGema, r.pub.solicitudId, { version: r.pub.version, medidas: 'intento' });
    const falsa = await e.editar(tGema, randomUUID(), { version: 1, medidas: 'intento' });
    expect(edicion.status).toBe(404); expect({ s: edicion.status, b: edicion.body }).toEqual({ s: falsa.status, b: falsa.body });
    expect((await e.cerrarSolicitud(tGema, r.pub.solicitudId, { version: r.pub.version })).status).toBe(404);
    expect((await e.aclarar(tGema, r.cB.cotizacionId, { texto: 'Intento ficticio.' })).status).toBe(404);
    expect(await instantanea()).toBe(antes);
    // Sobre lo suyo sí puede, y no puede cotizar su propia solicitud.
    const pub = await solicitudPublicadaDe(tGema);
    const propio = await e.cotizar(tGema, pub.solicitudId, cuerpoEstimada(pub.versionTrabajo));
    expect([propio.status, propio.body.codigo]).toEqual([422, 'COTIZACION_PROPIA']);
    expect((await e.obtener(tokens.dueno, pub.solicitudId)).status).toBe(404);
    expect((await e.cerrarSolicitud(tokens.dueno, pub.solicitudId, { version: pub.version })).status).toBe(404);
  });
  test('una clave de idempotencia de otra cuenta no reproduce su respuesta ni la bloquea', async () => {
    const clave = randomUUID(); const cuerpo = cuerpoPublicable(e, { categoriaId: e.datos.categorias.A });
    const a = (await e.crear(tokens.dueno, cuerpo, clave).expect(201)).body; const b = (await e.crear(tokens.ajenoCliente, cuerpo, clave).expect(201)).body;
    expect(b.solicitudId).not.toBe(a.solicitudId);
    expect((await e.obtener(tokens.ajenoCliente, a.solicitudId)).status).toBe(404);
    expect((await e.obtener(tokens.dueno, b.solicitudId)).status).toBe(404);
    const repetida = await e.crear(tokens.dueno, cuerpo, clave);
    expect(repetida.body.solicitudId).toBe(a.solicitudId);
  });
});

// ─── 7 · Estados que no abren puertas ─────────────────────────────────────────────────────────────────────────────────
describe('estados: cerrar la solicitud no concede permisos a quien no los tenía', () => {
  test('en una solicitud cerrada los ajenos siguen en 404, las escrituras de participantes se rechazan sin cambios y las lecturas legítimas se conservan', async () => {
    const r = await escenario();
    await e.cerrarSolicitud(tokens.dueno, r.pub.solicitudId, { version: r.pub.version }).expect(200);
    const antes = await instantanea();
    for (const id of ['ajenoCliente', 'ajenoPrestador', 'autorRetirado', 'destinatario'] as const) {
      for (const res of [await e.obtener(tokens[id], r.pub.solicitudId), await e.archivo(tokens[id], r.pub.solicitudId, r.pub.archivoId), await e.cotizacion(tokens[id], r.cB.cotizacionId),
        await e.aclaraciones(tokens[id], r.cB.cotizacionId)]) expect([id, res.status]).toEqual([id, 404]);
    }
    expect((await e.cotizacionesDe(tokens.ajenoCliente, r.pub.solicitudId)).status).toBe(404);
    const rechazos = [await e.actualizarCotizacion(tokens.autorActivo, r.cB.cotizacionId, { ...cuerpoDefinitiva(r.pub.versionTrabajo), versionCotizacion: r.cB.version }),
      await e.retirarCotizacion(tokens.autorActivo, r.cB.cotizacionId, { versionCotizacion: r.cB.version }), await e.aclarar(tokens.autorActivo, r.cB.cotizacionId, { texto: 'Intento ficticio.' }),
      await e.aclarar(tokens.dueno, r.cB.cotizacionId, { texto: 'Intento ficticio.' }), await e.cotizar(tokens.compatible, r.pub.solicitudId, cuerpoEstimada(r.pub.versionTrabajo))];
    for (const res of rechazos) { expect([404, 409]).toContain(res.status); sinFiltracion(res.body); }
    expect(await instantanea()).toBe(antes);
    expect((await e.obtener(tokens.autorActivo, r.pub.solicitudId)).status).toBe(200);
    expect((await e.cotizacion(tokens.autorActivo, r.cB.cotizacionId)).status).toBe(200);
    expect((await e.aclaraciones(tokens.dueno, r.cB.cotizacionId)).status).toBe(200);
    expect((await e.cotizacionesDe(tokens.dueno, r.pub.solicitudId)).status).toBe(200);
  }, 240000);
});

// ─── 8 · Los diez controles de aislamiento, demostrados con la matriz ejecutada ───────────────────────────────────────
describe('controles de aislamiento (resumen verificable sobre las celdas ejecutadas)', () => {
  const celdas = (op: string, ...ids: Id[]) => registro.filter(c => c.operationId === op && ids.includes(c.identidad));
  const sinCambio = (xs: Celda[], estado: number) => xs.length > 0 && xs.every(c => c.obtenido === estado && !c.cambio);
  const filas = (id: Id, nombres: string[]) => registro.filter(c => c.identidad === id && nombres.includes(c.fila));
  const MUTAN = ['editarSolicitud003', 'publicarSolicitud003', 'cerrarSolicitud003', 'cargarArchivoSolicitud003'];
  const PRESTADORES: Id[] = ['destinatario', 'compatible', 'autorActivo', 'autorRetirado', 'ajenoPrestador'];
  test.each([
    ['1 · el cliente solo modifica sus solicitudes: otro cliente recibe 404 sin cambios', () => sinCambio(MUTAN.flatMap(o => celdas(o, 'ajenoCliente')), 404)],
    ['2 · el prestador no modifica solicitudes del cliente: 403 sin cambios', () => sinCambio(MUTAN.flatMap(o => celdas(o, ...PRESTADORES)), 403)],
    ['3 · un ajeno no lee lo privado: 404 en detalle, versiones, bitácora, archivo, cotización e hilo', () => sinCambio(['obtenerSolicitud003', 'consultarHistorialSolicitud003', 'obtenerArchivoSolicitud003', 'obtenerCotizacion003', 'listarAclaraciones003', 'listarCotizacionesDeSolicitud003'].flatMap(o => celdas(o, 'ajenoCliente', 'ajenoPrestador')), 404)],
    ['4 · ser compatible no da acceso a una dirigida', () => sinCambio(filas('compatible', ['obtener dirigida', 'historial versiones dirigida', 'historial bitácora dirigida', 'archivo de dirigida', 'cotizaciones de mi solicitud dirigida', 'cotización de dirigida', 'aclaraciones de cotización de dirigida', 'enviar cotización a dirigida']), 404)],
    ['5 · el destinatario solo tiene sus permisos: lee y cotiza su dirigida; no edita, cierra, ve bitácora ni cotizaciones de otros', () => filas('destinatario', ['obtener dirigida', 'archivo de dirigida', 'historial versiones dirigida']).every(c => c.obtenido === 200)
      && sinCambio(filas('destinatario', ['editar dirigida', 'cerrar dirigida']), 403) && sinCambio(filas('destinatario', ['historial bitácora dirigida', 'cotizaciones de mi solicitud dirigida']), 404)],
    ['6 · un autor no lee las cotizaciones ni los hilos de otros', () => sinCambio(filas('autorActivo', ['cotización retirada', 'cotización de dirigida', 'aclaraciones de cotización retirada', 'aclaraciones de cotización de dirigida', 'actualizar cotización retirada', 'retirar cotización retirada']), 404)],
    ['7 · el autor retirado conserva solo la lectura de su cotización y su hilo; ya no escribe ni lee la solicitud', () => filas('autorRetirado', ['cotización retirada', 'aclaraciones de cotización retirada']).every(c => c.obtenido === 200 && !c.cambio)
      && sinCambio(filas('autorRetirado', ['actualizar cotización retirada', 'retirar cotización retirada', 'aclaración en cotización retirada']), 409)
      && sinCambio(filas('autorRetirado', ['obtener publicada', 'historial versiones publicada', 'archivo de publicada (no compartida)']), 404)],
    ['8 · sin sesión no hay operación protegida: 401 en las 18 y sin cambios', () => registro.filter(c => c.identidad === 'sinSesion').every(c => c.obtenido === 401 && !c.cambio) && new Set(registro.filter(c => c.identidad === 'sinSesion').map(c => c.operationId)).size === 18],
    ['9 · solo el dueño lista las cotizaciones de su solicitud', () => registro.filter(c => c.operationId === 'listarCotizacionesDeSolicitud003' && c.identidad !== 'dueno' && c.identidad !== 'sinSesion').every(c => c.obtenido === 404)],
    ['10 · la comparación del dueño con ids propios funciona y con ids ajenos es 404 (bloque de comparación)', () => filas('dueno', ['comparar cotizaciones propias']).every(c => c.obtenido === 200)],
  ])('%s', (_nombre, comprobar) => { expect(comprobar()).toBe(true); });
});
