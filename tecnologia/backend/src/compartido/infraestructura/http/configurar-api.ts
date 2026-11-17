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

interface Operacion { requestBody?: { content: { 'application/json': { schema: AnySchemaObject } } }; parameters?: { $ref?: string }[]; 'x-limite-cuerpo-bytes': number }
type DocumentoContrato = AnySchemaObject & { paths: Record<string, Record<string, Operacion>> };
interface Ruta { patron: string; regex: RegExp; metodo: string; operacion: Operacion; validar?: ValidateFunction; parametros: { nombre: string; validar: ValidateFunction }[] }
function responder(res: Response, error: ErrorAplicacion): void {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
  if (error.http === 429 && error.reintentarEnSegundos !== undefined) res.setHeader('Retry-After', String(error.reintentarEnSegundos));
  res.status(error.http).json({ codigo: error.codigo, mensaje: error.message, detalles: error.detalles });
}
function unicodeValido(valor: unknown): boolean {
  if (typeof valor === 'string') return valor.isWellFormed();
  if (Array.isArray(valor)) return valor.every(unicodeValido);
  if (valor !== null && typeof valor === 'object') return Object.entries(valor).every(([k, v]) => k.isWellFormed() && unicodeValido(v));
  return typeof valor !== 'number' || Number.isFinite(valor);
}
export async function configurarApi(app: INestApplication, config: { origen: string; contrato: string; registrar?: (evento: string) => void }): Promise<void> {
  const contrato = JSON.parse(await readFile(config.contrato, 'utf8')) as DocumentoContrato;
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const aplicarFormatos = createRequire(import.meta.url)('ajv-formats') as (instance: Ajv2020) => void;
  aplicarFormatos(ajv); ajv.addSchema(contrato, 'contrato');
  const rutas: Ruta[] = [];
  for (const [patron, metodos] of Object.entries(contrato.paths)) {
    for (const [metodo, operacion] of Object.entries(metodos)) {
      if (!['get', 'post', 'patch', 'delete'].includes(metodo)) continue;
      const schema = operacion.requestBody?.content['application/json'].schema;
      const validar = schema ? ajv.compile({ ...schema, ...(schema['$ref'] ? { $ref: `contrato${String(schema['$ref'])}` } : {}) }) : undefined;
      const nombres = Array.from(patron.matchAll(/\{([^}]+)\}/g), (m) => m[1] ?? '');
      const parametros = nombres.map((nombre) => {
        const referencias = operacion.parameters ?? [];
        const componentes = contrato['components'] as { parameters: Record<string, { name: string; in: string; schema: AnySchemaObject }> };
        const p = referencias.map((r) => componentes.parameters[r.$ref?.split('/').at(-1) ?? '']).find((p) => p?.in === 'path' && p.name === nombre);
        if (!p) throw new Error('Parámetro contractual no definido.');
        return { nombre, validar: ajv.compile(p.schema) };
      });
      rutas.push({ patron, metodo: metodo.toUpperCase(), regex: new RegExp(`^/api/v1${patron.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '([^/]+)')}$`), operacion, parametros, ...(validar ? { validar } : {}) });
    }
  }
  app.setGlobalPrefix('api/v1');
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const ruta = rutas.find((r) => r.metodo === req.method && r.regex.test(req.path));
    if (config.registrar) res.on('finish', () => config.registrar?.(eventoPeticion(req.method, ruta?.patron, res.statusCode)));
    const limite = ruta?.operacion['x-limite-cuerpo-bytes'] ?? 65536;
    if (Number(req.headers['content-length'] ?? 0) > limite) { responder(res, new ErrorAplicacion(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo supera el límite permitido.')); req.resume(); return; }
    let bytes = 0;
    json({ limit: limite, strict: false, inflate: false, type: () => true, verify: (_req, _res, body) => { bytes = body.length; new TextDecoder('utf-8', { fatal: true }).decode(body); } })(req, res, (fallo?: unknown) => {
      try {
        if (fallo) {
          if (typeof fallo === 'object' && fallo !== null && 'type' in fallo && fallo.type === 'entity.too.large') throw new ErrorAplicacion(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo supera el límite permitido.');
          throw datosInvalidos();
        }
        if (ruta?.patron === '/cuentas' && !req.body?.fotografia && bytes > 65536) throw new ErrorAplicacion(413, 'CUERPO_DEMASIADO_GRANDE', 'El cuerpo supera el límite permitido.');
        if (bytes > 0 && (!ruta?.operacion.requestBody || !/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] ?? ''))) throw datosInvalidos();
        const valoresRuta = ruta?.regex.exec(req.path);
        if (ruta && valoresRuta) for (const [i, parametro] of ruta.parametros.entries()) {
          let valor: string; try { valor = decodeURIComponent(valoresRuta[i + 1] ?? ''); } catch { throw datosInvalidos(); }
          if (!parametro.validar(valor)) throw datosInvalidos('Parámetro de ruta no válido.');
        }
        if (ruta?.operacion.parameters?.some((p) => p.$ref === '#/components/parameters/Origin')) {
          const origen = req.headers.origin;
          if (!origen) throw new ErrorAplicacion(400, 'CABECERA_REQUERIDA', 'Falta la cabecera Origin.');
          try { new URL(origen); } catch { throw datosInvalidos('Origin no tiene formato válido.'); }
          if (origen !== config.origen) throw new ErrorAplicacion(403, 'ORIGEN_NO_ADMITIDO', 'Origen no admitido.');
        }
        if (ruta?.operacion.parameters?.some((p) => p.$ref === '#/components/parameters/IdempotencyKey')) {
          const clave = req.get('Idempotency-Key');
          if (!clave) throw new ErrorAplicacion(400, 'CABECERA_REQUERIDA', 'Falta Idempotency-Key.');
          if (clave.length < 16 || clave.length > 128) throw datosInvalidos();
        }
        if (ruta?.validar && (!unicodeValido(req.body) || !ruta.validar(req.body))) {
          if (ruta.validar.errors?.some((e) => e.keyword === 'additionalProperties')) throw new ErrorAplicacion(400, 'PROPIEDAD_NO_ADMITIDA', 'Se envió un campo no permitido.');
          throw datosInvalidos();
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
    responder(host.switchToHttp().getResponse<Response>(), seguro);
  }
}
