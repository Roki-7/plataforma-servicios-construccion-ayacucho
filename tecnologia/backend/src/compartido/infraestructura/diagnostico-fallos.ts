import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type EtapaFallo = 'http.respuesta' | 'db.disponibilidad' | 'db.conexion' | 'db.inicio' | 'db.configuracion' | 'db.trabajo' | 'db.commit' | 'db.rollback' | 'db.liberacion' | 'recuperacion.consulta' | 'contrasena.hash' | 'catalogo.inicializacion' | 'catalogo.disponibilidad' | 'catalogo.integridad' | 'idempotencia.clave' | 'outbox.cifrado';
type Condicion = 'excepcion' | 'no_inicializada' | 'modificado' | 'clave_no_disponible';
type Registrar = (linea: string) => void;
interface Contexto { peticionId: string; metodo: string; ruta: string; registrar: Registrar }
const contexto = new AsyncLocalStorage<Contexto>();
const clases = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'QueryFailedError', 'AggregateError', 'ErrorAplicacion']);
const codigos = new Set(['55P03', '40P01', '57014', '40001', '53300', '08000', '08001', '08003', '08006', '08007', '08P01', '23505', '23503', '23514', '23502', '25P02', '42P01', 'P0001', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ENOMEM', 'ENOENT', 'EACCES', 'EIO', 'EMFILE', 'ENOSPC']);
// Solo nombres estáticos de código propio, sin nombres de funciones ni rutas absolutas.
const archivos = ['unidad-de-trabajo.ts', 'unidad-de-trabajo.js', 'idempotencia.ts', 'idempotencia.js', 'consumir-recuperacion.ts', 'consumir-recuperacion.js', 'repositorio-recuperaciones.ts', 'repositorio-recuperaciones.js', 'argon2id.ts', 'argon2id.js', 'catalogo-contrasenas.ts', 'catalogo-contrasenas.js', 'outbox.ts', 'outbox.js', 'configurar-api.ts', 'configurar-api.js'];
function stderr(linea: string): void { process.stderr.write(linea + '\n'); }
/** patron procede exclusivamente de las rutas compiladas del contrato, nunca de req.url. */
export function conDiagnostico<T>(metodo: string, patron: string | undefined, registrar: Registrar | undefined, trabajo: () => T): T {
  return contexto.run({ peticionId: randomUUID(), metodo: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(metodo) ? metodo : 'OTRO', ruta: patron?.replace(/\{[^}]+\}/g, ':redactado') ?? 'ruta_no_catalogada', registrar: registrar ?? stderr }, trabajo);
}
function resumen(error: unknown) {
  try {
    const e = error as { name?: unknown; code?: unknown; driverError?: { code?: unknown }; stack?: unknown } | undefined;
    const codigo = e?.driverError?.code ?? e?.code;
    const origenes: { archivo: string; linea: number; columna: number }[] = [];
    if (error instanceof Error && typeof e?.stack === 'string') {
      for (const linea of e.stack.split('\n').slice(1)) {
        const normal = linea.replaceAll('\\', '/');
        for (const archivo of archivos) {
          const indice = normal.lastIndexOf('/' + archivo + ':');
          if (indice < 0) continue;
          const posicion = /^(\d{1,6}):(\d{1,6})(?:\)|$)/.exec(normal.slice(indice + archivo.length + 2));
          if (posicion && origenes.length < 5) origenes.push({ archivo, linea: Number(posicion[1]), columna: Number(posicion[2]) });
        }
      }
    }
    return { clase: typeof e?.name === 'string' && clases.has(e.name) ? e.name : 'otra', codigo: typeof codigo === 'string' && codigos.has(codigo) ? codigo : 'no_disponible', origenes };
  } catch { return { clase: 'otra', codigo: 'no_disponible', origenes: [] }; }
}
/** Nunca serializar Error, message, stack, SQL, parámetros, credenciales ni objetos HTTP. */
export function registrarFallo(etapa: EtapaFallo, error?: unknown, condicion: Condicion = 'excepcion'): void {
  const actual = contexto.getStore();
  const linea = JSON.stringify({ evento: 'fallo_interno', fecha: new Date().toISOString(), peticionId: actual?.peticionId ?? randomUUID(), metodo: actual?.metodo ?? 'INTERNO', ruta: actual?.ruta ?? 'operacion_interna', etapa, condicion, excepcion: resumen(error) });
  try { (actual?.registrar ?? stderr)(linea); }
  catch { try { stderr(linea); } catch { /* Un colector caído no cambia la transacción ni la respuesta. */ } }
}
