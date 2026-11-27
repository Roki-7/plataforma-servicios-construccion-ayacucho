import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter, INestApplication } from '@nestjs/common';
import { json } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { AnySchemaObject, ValidateFunction } from 'ajv';
import { createRequire } from 'node:module';
import { ErrorAplicacion, datosInvalidos } from '../../dominio/errores.js';
import { eventoPeticion } from './logs-seguros.js';
import { conDiagnostico, registrarFallo } from '../diagnostico-fallos.js';

interface Parametro { name: string; in: string; required?: boolean; schema: AnySchemaObject }
interface Operacion { operationId: string; requestBody?: { content: { 'application/json': { schema: AnySchemaObject } } }; parameters?: ({ $ref: string } | Parametro)[]; security?: Record<string, string[]>[]; 'x-limite-cuerpo-bytes': number }
type DocumentoContrato = { paths: Record<string, Record<string, unknown>> };
interface Consulta { tipo: unknown; requerido: boolean; predeterminado: unknown; validar: ValidateFunction }
interface Ruta { patron: string; regex: RegExp; metodo: string; operacion: Operacion; validar?: ValidateFunction; parametros: { nombre: string; validar: ValidateFunction }[]; consultas?: ReadonlyMap<string, Consulta> }

function validarConsulta(url: string, definiciones: ReadonlyMap<string, Consulta>): Record<string, unknown> {
  const indice = url.indexOf('?');
  const query = indice === -1 ? '' : url.slice(indice + 1);
  const entrada = new Map<string, unknown>();
  const decodificar = (s: string) => decodeURIComponent(s.replaceAll('+', ' '));
  for (const par of query ? query.split('&') : []) {
    const igual = par.indexOf('=');
    if (igual === -1) throw datosInvalidos('Parámetro de consulta no válido.');
    const clave = decodificar(par.slice(0, igual));
    const texto = decodificar(par.slice(igual + 1));
    const parametro = definiciones.get(clave);
    if (!parametro || entrada.has(clave)) throw datosInvalidos('Parámetro de consulta desconocido o duplicado.');
    let valor: string | number | boolean = texto;
    if (parametro.tipo === 'integer') {
      if (!/^(?:0|[1-9][0-9]*)$/.test(texto) || !Number.isSafeInteger(Number(texto))) throw datosInvalidos('Entero de consulta no válido.');
      valor = Number(texto);
    } else if (parametro.tipo === 'boolean') {
      if (texto !== 'true' && texto !== 'false') throw datosInvalidos('Booleano de consulta no válido.');
      valor = texto === 'true';
    }
    if (!parametro.validar(valor)) throw datosInvalidos('Parámetro de consulta no válido.');
    entrada.set(clave, valor);
  }
  for (const [clave, parametro] of definiciones) {
    if (entrada.has(clave)) continue;
    if (parametro.requerido) throw datosInvalidos('Falta un parámetro de consulta.');
    if (parametro.predeterminado !== undefined) entrada.set(clave, parametro.predeterminado);
  }
  return Object.fromEntries(entrada);
}
/** Convierte errores de esquema en detalles sin reflejar los valores del cliente. */
function detallesDeEsquema(errores: ValidateFunction['errors']): { campo?: string; motivo: string }[] {
  const motivos: Record<string, string> = { enum: 'Valor no admitido.', type: 'Tipo no válido.', required: 'Campo obligatorio.', minLength: 'Es demasiado corto.', maxLength: 'Supera la longitud máxima.',
    minItems: 'Faltan elementos.', maxItems: 'Hay demasiados elementos.', uniqueItems: 'Hay elementos repetidos.', minimum: 'Es menor que el mínimo.', maximum: 'Supera el máximo.', format: 'Formato no válido.', pattern: 'Formato no válido.', minProperties: 'Faltan campos.' };
  return (errores ?? []).slice(0, 20).map((e) => {
    const ruta = e.instancePath.split('/').filter(Boolean).map((p) => (/^\d+$/.test(p) ? '[' + p + ']' : p)).join('.').replaceAll('.[', '[');
    const campo = e.keyword === 'required' ? [ruta, String(e.params['missingProperty'])].filter(Boolean).join('.') : ruta;
    return { ...(campo ? { campo } : {}), motivo: motivos[e.keyword] ?? 'Valor no válido.' };
  });
}
function responder(res: Response, error: ErrorAplicacion): void {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
  if (error.http === 429 && error.reintentarEnSegundos !== undefined) res.setHeader('Retry-After', String(error.reintentarEnSegundos));
  res.status(error.http).json({ codigo: error.codigo, mensaje: error.message, detalles: error.detalles });
}
/** Hasta este tamaño declarado se descarta el cuerpo antes de responder; por encima se corta la conexión tras la respuesta. */
const DRENAJE_MAXIMO_BYTES = 1_048_576;
/**
 * 413 anticipado por `Content-Length`. El cuerpo nunca se almacena ni se interpreta. Si la respuesta se enviara con el cuerpo sin leer, Node cerraría el socket
 * con un reinicio (RST) y el cliente perdería el 413 (`ECONNRESET`). Por eso, dentro de un tope acotado, se descarta primero el cuerpo y luego se responde; un
 * `Content-Length` mayor al tope se responde de inmediato con `Connection: close`, sin leer nada, de modo que no se puede forzar a leer cantidades arbitrarias.
 */
function rechazarCuerpoGrande(req: Request, res: Response): void {
  const error = new ErrorAplicacion(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo supera el límite permitido.');
  if (Number(req.headers['content-length']) > DRENAJE_MAXIMO_BYTES) { res.setHeader('Connection', 'close'); responder(res, error); req.resume(); return; }
  req.once('end', () => { if (!res.headersSent) responder(res, error); });
  req.resume();
}
function unicodeValido(valor: unknown): boolean {
  if (typeof valor === 'string') return valor.isWellFormed();
  if (Array.isArray(valor)) return valor.every(unicodeValido);
  if (valor !== null && typeof valor === 'object') return Object.entries(valor).every(([k, v]) => k.isWellFormed() && unicodeValido(v));
  return typeof valor !== 'number' || Number.isFinite(valor);
}
export async function configurarApi(app: INestApplication, config: { origen: string; contrato: string | DocumentoContrato; operaciones002?: ReadonlySet<string>; registrar?: (evento: string) => void; registrarDiagnostico?: (evento: string) => void }): Promise<void> {
  const contrato: DocumentoContrato = typeof config.contrato === 'string' ? JSON.parse(await readFile(config.contrato, 'utf8')) : config.contrato;
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const aplicarFormatos = createRequire(import.meta.url)('ajv-formats') as (instance: Ajv2020) => void;
  aplicarFormatos(ajv);
  // El formato byte del proveedor usa repetición agrupada y desborda la pila
  // con imágenes admitidas de varios MB. Validar base64 canónico sin esa regex.
  ajv.addFormat('byte', { type: 'string', validate: (s: string) => s.length <= 13333336 && s.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(s) && Buffer.from(s,'base64').toString('base64') === s });
  ajv.addSchema(contrato, 'contrato');
  const rutas: Ruta[] = [];
  for (const [patron, metodos] of Object.entries(contrato.paths)) {
    for (const [metodo, dato] of Object.entries(metodos)) {
      if (!['get', 'post', 'patch', 'delete', 'put'].includes(metodo)) continue;
      const operacion = dato as Operacion;
      const es002 = config.operaciones002?.has(operacion.operationId) === true;
      const schema = operacion.requestBody?.content['application/json']?.schema;
      const validar = schema ? ajv.compile({ ...schema, ...(schema['$ref'] ? { $ref: `contrato${String(schema['$ref'])}` } : {}) }) : undefined;
      const nombres = Array.from(patron.matchAll(/\{([^}]+)\}/g), (m) => m[1] ?? '');
      const referencias = (operacion.parameters ?? []).map(p => 'name' in p ? { parametro: p, ref: undefined } : {
        parametro: (contrato as { components?: { parameters?: Record<string, Parametro> } }).components?.parameters?.[p.$ref.split('/').at(-1) ?? ''], ref: p.$ref,
      });
      const compilar = (p: Parametro, ref: string | undefined) => ajv.compile(ref ? { $ref: `contrato${ref}/schema` } : p.schema);
      const parametros = nombres.map((nombre) => {
        const dato = referencias.find(p => p.parametro?.in === 'path' && p.parametro.name === nombre);
        if (!dato?.parametro) throw new Error('Parámetro contractual no definido.');
        return { nombre, validar: compilar(dato.parametro, dato.ref) };
      });
      const consultas = new Map<string, Consulta>();
      if (es002) for (const { parametro: p, ref } of referencias) {
        if (p?.in === 'query') consultas.set(p.name, { tipo: p.schema['type'], requerido: p.required === true, predeterminado: p.schema['default'], validar: compilar(p, ref) });
      }
      const patronRegex = patron.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '([^/]+)');
      rutas.push({ patron, metodo: metodo.toUpperCase(), regex: new RegExp(`^/api/v1${patronRegex}${es002 ? '/?' : ''}$`, es002 ? 'i' : ''), operacion, parametros, ...(es002 ? { consultas } : {}), ...(validar ? { validar } : {}) });
    }
  }
  if (config.operaciones002?.size) rutas.sort((a, b) => a.parametros.length - b.parametros.length);
  const buscar = (req: Request) => rutas.find(r => (r.metodo === req.method || (r.consultas && req.method === 'HEAD' && r.metodo === 'GET')) && r.regex.test(req.path));
  app.setGlobalPrefix('api/v1');
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const ruta = buscar(req);
    conDiagnostico(req.method, ruta?.patron, config.registrarDiagnostico, next);
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const ruta = buscar(req);
    // Marca del servidor, nunca tomada de body/headers. El guard también aplica
    // Bearer contractual si un controlador omite accidentalmente el decorador.
    res.locals['requiereBearer']=ruta?.operacion.security?.some(s=>Object.hasOwn(s,'bearerAuth'))??false;
    res.locals['ruta002'] = ruta?.consultas !== undefined;
    if (config.registrar) res.on('finish', () => config.registrar?.(eventoPeticion(req.method, ruta?.patron, res.statusCode)));
    const limite = ruta?.operacion['x-limite-cuerpo-bytes'] ?? 65536;
    if (Number(req.headers['content-length'] ?? 0) > limite) { rechazarCuerpoGrande(req, res); return; }
    let bytes = 0;
    json({ limit: limite, strict: false, inflate: false, type: () => true, verify: (_req, _res, body) => { bytes = body.length; new TextDecoder('utf-8', { fatal: true }).decode(body); } })(req, res, (fallo?: unknown) => {
      try {
        if (fallo) {
          if (typeof fallo === 'object' && fallo !== null && 'type' in fallo && fallo.type === 'entity.too.large') throw new ErrorAplicacion(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo supera el límite permitido.');
          throw datosInvalidos();
        }
        if (ruta?.patron === '/cuentas' && !req.body?.fotografia && bytes > 65536) throw new ErrorAplicacion(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo supera el límite permitido.');
        if (bytes > 0 && (!ruta?.operacion.requestBody || !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? ''))) throw datosInvalidos();
        if (ruta?.consultas) res.locals['consulta002'] = validarConsulta(req.originalUrl, ruta.consultas);
        const valoresRuta = ruta?.regex.exec(req.path);
        if (ruta && valoresRuta) for (const [i, parametro] of ruta.parametros.entries()) {
          let valor: string; try { valor = decodeURIComponent(valoresRuta[i + 1] ?? ''); } catch { throw datosInvalidos(); }
          if (!parametro.validar(valor)) throw datosInvalidos('Parámetro de ruta no válido.');
        }
        if (ruta?.operacion.parameters?.some((p) => '$ref' in p && p.$ref === '#/components/parameters/Origin')) {
          const origen = req.headers.origin;
          if (!origen) throw new ErrorAplicacion(400, 'CABECERA_REQUERIDA', 'Falta la cabecera Origin.');
          try { new URL(origen); } catch { throw datosInvalidos('Origin no tiene formato válido.'); }
          if (origen !== config.origen) throw new ErrorAplicacion(403, 'ORIGEN_NO_ADMITIDO', 'Origen no admitido.');
        }
        if (ruta?.operacion.parameters?.some((p) => '$ref' in p && p.$ref === '#/components/parameters/IdempotencyKey')) {
          const clave = req.get('Idempotency-Key');
          if (!clave) throw new ErrorAplicacion(400, 'CABECERA_REQUERIDA', 'Falta Idempotency-Key.');
          if (clave.length < 16 || clave.length > 128) throw datosInvalidos();
        }
        const foto002 = ruta?.consultas !== undefined && ruta.operacion['x-limite-cuerpo-bytes'] === 14000000;
        const imagen = foto002 || (ruta?.patron === '/perfil/fotografias' && req.method === 'POST') ? req.body : ruta?.patron === '/cuentas' ? req.body?.fotografia : undefined;
        const contenido = imagen?.contenidoBase64;
        if (typeof contenido === 'string' && (contenido.length > 13333336 || Buffer.byteLength(contenido,'base64') > 10000000)) throw new ErrorAplicacion(413,'ARCHIVO_DEMASIADO_GRANDE','La imagen supera 10 MB.');
        if (ruta?.validar && (!unicodeValido(req.body) || !ruta.validar(req.body))) {
          if (ruta.validar.errors?.some((e) => e.keyword === 'additionalProperties')) throw new ErrorAplicacion(400, 'PROPIEDAD_NO_ADMITIDA', 'Se envió un campo no permitido.');
          // Solo 002 informa el campo rechazado. Los motivos no reproducen los valores recibidos. 001 conserva su respuesta.
          throw ruta.consultas ? datosInvalidos('Revise los datos enviados.', detallesDeEsquema(ruta.validar.errors)) : datosInvalidos();
        }
        next();
      } catch (error) { responder(res, error instanceof ErrorAplicacion ? error : datosInvalidos()); }
    });
  });
  app.useGlobalFilters(new FiltroErrores());
}
@Catch()
export class FiltroErrores implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    let seguro: ErrorAplicacion;
    if (error instanceof ErrorAplicacion) seguro = error;
    else if (error instanceof HttpException && error.getStatus() === 404) seguro = new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.');
    else seguro = new ErrorAplicacion(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio temporalmente no disponible.');
    if (seguro.http >= 500) registrarFallo('http.respuesta', error);
    responder(host.switchToHttp().getResponse<Response>(), seguro);
  }
}
