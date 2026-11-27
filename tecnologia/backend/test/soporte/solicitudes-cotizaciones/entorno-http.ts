import { randomUUID } from 'node:crypto';
import request from 'supertest';
import sharp from 'sharp';
import { crearAplicacionConHistorias003 } from '../../../src/composicion/aplicacion-003.js';
import { aplicarMigraciones003 } from '../../../src/composicion/migraciones-003.js';
import type { AlmacenArchivosSolicitud, SaneadorImagenSolicitud } from '../../../src/modulos/solicitudes/aplicacion/puertos/archivos.js';
import { SolicitudesS3 } from '../../../src/modulos/solicitudes/infraestructura/archivos/solicitudes-s3.js';
import { almacenamientoAislado003 } from './almacenamiento.js';
import { baseAislada003 } from './postgres.js';
import { almacenEnMemoria003, configuracionDePrueba003 } from './entorno.js';
import { iniciarSesion003, sembrarDatos003, type CuentaFicticia, type Datos003 } from './datos.js';

export interface OpcionesUs1 {
  /** Reloj de la aplicación (para la fecha de hoy en Lima y la caducidad de 24 horas). */
  readonly ahora?: () => Date;
  /** Almacén alternativo (p. ej. uno que falla). Por omisión, Garage real con un prefijo `pruebas/<uuid>/solicitudes/` propio de la suite. */
  readonly almacen?: (real: SolicitudesS3) => AlmacenArchivosSolicitud;
  readonly saneador?: SaneadorImagenSolicitud;
}

/** Imagen ficticia en Base64 para las cargas. */
export async function imagen(ancho = 64, alto = 48, formato: 'jpeg' | 'png' | 'webp' = 'jpeg', color = { r: 200, g: 120, b: 40 }): Promise<{ tipoMime: string; contenidoBase64: string; bytes: Buffer }> {
  const lienzo = sharp({ create: { width: ancho, height: alto, channels: 3, background: color } });
  const bytes = await (formato === 'jpeg' ? lienzo.jpeg() : formato === 'png' ? lienzo.png() : lienzo.webp()).toBuffer();
  // `bytes` no es enumerable: el cuerpo que se envía contiene solo `tipoMime` y `contenidoBase64`, como exige el contrato.
  const cuerpo = { tipoMime: `image/${formato}`, contenidoBase64: bytes.toString('base64') };
  return Object.defineProperty(cuerpo, 'bytes', { value: bytes, enumerable: false }) as typeof cuerpo & { bytes: Buffer };
}

/**
 * Aplicación real (Nest + PostgreSQL + Garage) con las nueve operaciones de HU07 sobre una base descartable `ayacucho_003_test_*` y un prefijo propio de pruebas en el
 * bucket. Datos ficticios deterministas sembrados con el registro real de cuentas. Nada toca la base de validación.
 */
export async function montarUs1(opciones: OpcionesUs1 = {}) {
  const base = await baseAislada003(); await aplicarMigraciones003(base.url);
  const garage = await almacenamientoAislado003();
  const real = new SolicitudesS3(garage.cliente, garage.bucket, garage.prefijo);
  const almacen = opciones.almacen ? opciones.almacen(real) : real;
  const config = await configuracionDePrueba003(base.url);
  let app: Awaited<ReturnType<typeof crearAplicacionConHistorias003>> | undefined;
  const cerrar = async () => {
    try { await app?.app.close(); } finally { try { await garage.cerrar(); } finally { await base.cerrar(); } }
  };
  try {
    app = await crearAplicacionConHistorias003(config, { prestadores: { almacen: almacenEnMemoria003() }, solicitudes: { almacen, ...(opciones.saneador ? { saneador: opciones.saneador } : {}), ...(opciones.ahora ? { ahora: opciones.ahora } : {}) }, worker: false });
    const datos: Datos003 = await sembrarDatos003(app, config.origen);
    const http = request(app.app.getHttpServer());
    const tokens = new Map<string, string>();
    const token = async (c: CuentaFicticia) => { let t = tokens.get(c.correo); if (!t) { t = await iniciarSesion003(app!, config.origen, c); tokens.set(c.correo, t); } return t; };
    const escritura = (t: request.Test, tk?: string, clave?: string) => { if (tk) t.set('Authorization', `Bearer ${tk}`); return t.set('Origin', config.origen).set('Idempotency-Key', clave ?? randomUUID()); };
    const lectura = (t: request.Test, tk?: string) => { if (tk) t.set('Authorization', `Bearer ${tk}`); return t; };
    const api = '/api/v1/solicitudes';
    return {
      app, db: app.db, http, datos, config, base, almacen, real, prefijo: garage.prefijo, cerrar, token, tipoMime: 'image/webp',
      crear: (tk: string | undefined, cuerpo: object, clave?: string) => escritura(http.post(api), tk, clave).send(cuerpo),
      listar: (tk: string | undefined, consulta = '') => lectura(http.get(`${api}${consulta}`), tk),
      oportunidades: (tk: string | undefined, consulta = '') => lectura(http.get(`${api}/oportunidades${consulta}`), tk),
      obtener: (tk: string | undefined, id: string) => lectura(http.get(`${api}/${id}`), tk),
      editar: (tk: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(http.patch(`${api}/${id}`), tk, clave).send(cuerpo),
      publicar: (tk: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(http.post(`${api}/${id}/publicacion`), tk, clave).send(cuerpo),
      cerrarSolicitud: (tk: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(http.post(`${api}/${id}/cierre`), tk, clave).send(cuerpo),
      historial: (tk: string | undefined, id: string, consulta: string) => lectura(http.get(`${api}/${id}/historial${consulta}`), tk),
      cargar: (tk: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(http.post(`${api}/${id}/archivos`), tk, clave).send(cuerpo),
      cotizar: (tk: string | undefined, solicitudId: string, cuerpo: object, clave?: string) => escritura(http.post(`${api}/${solicitudId}/cotizaciones`), tk, clave).send(cuerpo),
      actualizarCotizacion: (tk: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(http.post(`/api/v1/cotizaciones/${id}/versiones`), tk, clave).send(cuerpo),
      retirarCotizacion: (tk: string | undefined, id: string, cuerpo: object, clave?: string) => escritura(http.post(`/api/v1/cotizaciones/${id}/retiro`), tk, clave).send(cuerpo),
      misCotizaciones: (tk: string | undefined, consulta = '') => lectura(http.get(`/api/v1/cotizaciones${consulta}`), tk),
      cotizacionesDe: (tk: string | undefined, solicitudId: string, consulta = '') => lectura(http.get(`${api}/${solicitudId}/cotizaciones${consulta}`), tk),
      aclarar: (tk: string | undefined, cotizacionId: string, cuerpo: object, clave?: string) => escritura(http.post(`/api/v1/cotizaciones/${cotizacionId}/aclaraciones`), tk, clave).send(cuerpo),
      aclaraciones: (tk: string | undefined, cotizacionId: string, consulta = '') => lectura(http.get(`/api/v1/cotizaciones/${cotizacionId}/aclaraciones${consulta}`), tk),
      cotizacion: (tk: string | undefined, id: string) => lectura(http.get(`/api/v1/cotizaciones/${id}`), tk),
      archivo: (tk: string | undefined, id: string, archivoId: string) => lectura(http.get(`${api}/${id}/archivos/${archivoId}`), tk).buffer(true).parse((res, cb) => { const trozos: Buffer[] = []; res.on('data', (t: Buffer) => trozos.push(t)); res.on('end', () => { const bytes = Buffer.concat(trozos); cb(null, /json/.test(String(res.headers['content-type'] ?? '')) ? JSON.parse(bytes.toString('utf8')) : bytes); }); }),
    };
  } catch (error) { await cerrar(); throw error; }
}
export type EntornoUs1 = Awaited<ReturnType<typeof montarUs1>>;

/** Una solicitud publicada completa, lista para usar en las pruebas. Fecha lejana para no depender del reloj. */
export const cuerpoPublicable = (e: EntornoUs1, extra: object = {}) => ({
  tipo: 'PUBLICADA', descripcion: 'Necesito levantar un muro de ladrillo de 3 x 2 m en el patio.', categoriaId: e.datos.categorias.A1, distrito: 'ayacucho',
  fechaDesde: '2031-03-10', fechaHasta: '2031-03-20', ...extra,
});

/** Crea y publica una solicitud del cliente indicado. Devuelve el cuerpo de la publicación. */
export async function crearYPublicar(e: EntornoUs1, tk: string, extra: object = {}, publicacion: object = {}) {
  const creada = await e.crear(tk, cuerpoPublicable(e, extra)).expect(201);
  const publicada = await e.publicar(tk, creada.body.solicitudId, { version: creada.body.version, ...publicacion }).expect(200);
  return publicada.body as { solicitudId: string; version: number; versionTrabajo: number; estado: string; [k: string]: unknown };
}

/** JPEG válido de exactamente `bytes` bytes (se rellena con segmentos de comentario, que todo decodificador ignora). */
export async function jpegDeTamano(bytes: number): Promise<{ tipoMime: string; contenidoBase64: string }> {
  const base = (await imagen()).bytes; let falta = bytes - base.length; const partes: Buffer[] = [];
  while (falta > 0) {
    let segmento = Math.min(falta, 65537);
    if (falta - segmento > 0 && falta - segmento < 4) segmento = falta - 4;
    const cabecera = Buffer.alloc(4); cabecera.writeUInt16BE(0xfffe, 0); cabecera.writeUInt16BE(segmento - 2, 2);
    partes.push(cabecera, Buffer.alloc(segmento - 4, 0x20)); falta -= segmento;
  }
  const salida = Buffer.concat([base.subarray(0, 2), ...partes, base.subarray(2)]);
  if (salida.length !== bytes) throw new Error('No se pudo construir la imagen del tamaño pedido.');
  return { tipoMime: 'image/jpeg', contenidoBase64: salida.toString('base64') };
}

/** Cuerpo válido de una cotización estimada. La vigencia es lejana para no depender del reloj. */
export const cuerpoEstimada = (versionTrabajoSolicitud: number, extra: object = {}) => ({
  versionTrabajoSolicitud, tipo: 'ESTIMADA', alcance: 'Levantar el muro de ladrillo con acabado en cemento pulido.', formaCalculo: 'S/ 85 por metro cuadrado',
  vigenteHasta: '2031-12-31T00:00:00.000Z', ...extra,
});
/** Cuerpo válido de una cotización definitiva. */
export const cuerpoDefinitiva = (versionTrabajoSolicitud: number, extra: object = {}) => ({
  versionTrabajoSolicitud, tipo: 'DEFINITIVA', alcance: 'Levantar el muro de ladrillo con acabado en cemento pulido.', precioCentimos: 250000, plazoDias: 6,
  condicionesPago: '50 % al iniciar y 50 % al entregar.', vigenteHasta: '2031-12-31T00:00:00.000Z', ...extra,
});
