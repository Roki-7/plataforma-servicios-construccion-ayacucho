import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { IdempotenciaRecuperacion, SolicitudIdempotente, ResultadoIdempotente } from '../aplicacion/idempotencia.js';
import type { ContextoTransaccion, ValorJson } from '../aplicacion/transaccion.js';
import type { UnidadDeTrabajoPostgres } from './postgres/unidad-de-trabajo.js';
import { datosInvalidos, dependenciaNoDisponible, ErrorAplicacion } from '../dominio/errores.js';

export function jsonCanonico(valor: ValorJson): string {
  if (valor === null || typeof valor === 'boolean') return JSON.stringify(valor);
  if (typeof valor === 'number') { if (!Number.isFinite(valor)) throw datosInvalidos(); return JSON.stringify(valor); }
  if (typeof valor === 'string') { if (!valor.isWellFormed()) throw datosInvalidos(); return JSON.stringify(valor); }
  if (Array.isArray(valor)) return '[' + valor.map(jsonCanonico).join(',') + ']';
  if (typeof valor !== 'object' || (Object.getPrototypeOf(valor) !== Object.prototype && Object.getPrototypeOf(valor) !== null)) throw datosInvalidos();
  return '{' + Object.keys(valor).sort().map((key) => {
    const dato = (valor as Record<string, ValorJson>)[key];
    if (!key.isWellFormed() || dato === undefined) throw datosInvalidos();
    return JSON.stringify(key) + ':' + jsonCanonico(dato);
  }).join(',') + '}';
}
function exigirSinSecretos(valor: ValorJson): void {
  if (!valor || typeof valor !== 'object') return;
  if (Array.isArray(valor)) { valor.forEach(exigirSinSecretos); return; }
  for (const [nombre, dato] of Object.entries(valor)) {
    if (/contrasena|contraseña|password|token|csrf|cookie|digest|hash|secreto|objetoClave/i.test(nombre)) throw new Error('Un resultado idempotente no puede almacenar credenciales.');
    exigirSinSecretos(dato);
  }
}
interface FilaIdempotente { cuerpo_hmac: Buffer; hmac_key_id: string; http: number; resultado: ValorJson }
export class IdempotenciaPostgres implements IdempotenciaRecuperacion {
  constructor(private readonly uow: UnidadDeTrabajoPostgres, private readonly claves: ReadonlyMap<string, Buffer>, private readonly actual: string) {
    if (!claves.has(actual) || [...claves.values()].some((k) => k.length !== 32)) throw new Error('Claves HMAC no válidas.');
  }
  async consultarRecuperacion(s: SolicitudIdempotente): Promise<ResultadoIdempotente | null> {
    if (s.ambito.tipo !== 'recuperacion' || s.metodo !== 'POST' || s.rutaLogica !== '/recuperaciones/{token}' || !s.token || s.clave.length < 16 || s.clave.length > 128 || createHash('sha256').update(s.token).digest('hex') !== s.ambito.id) throw datosInvalidos();
    const entrada = jsonCanonico({ metodo: s.metodo, ruta: s.rutaLogica, token: s.token, cuerpo: s.cuerpo });
    return this.uow.ejecutar(async (tx) => {
      const filas: FilaIdempotente[] = await this.uow.runner(tx).query('SELECT cuerpo_hmac,hmac_key_id,http,resultado FROM claves_idempotencia WHERE ambito=$1 AND operacion=$2 AND clave=$3', [`recuperacion:${s.ambito.id}`, `${s.metodo} ${s.rutaLogica}`, s.clave]);
      const anterior = filas[0]; if (!anterior) return null;
      const clave = this.claves.get(anterior.hmac_key_id); if (!clave) throw dependenciaNoDisponible();
      const hmac = createHmac('sha256', clave).update(entrada).digest();
      if (anterior.cuerpo_hmac.length !== hmac.length || !timingSafeEqual(anterior.cuerpo_hmac, hmac)) throw new ErrorAplicacion(409, 'CLAVE_IDEMPOTENCIA_REUTILIZADA', 'La clave ya corresponde a otros datos.');
      return { http: anterior.http, cuerpo: anterior.resultado };
    });
  }
  async ejecutar(s: SolicitudIdempotente, trabajo: (tx: ContextoTransaccion) => Promise<ResultadoIdempotente>): Promise<ResultadoIdempotente> {
    if (s.clave.length < 16 || s.clave.length > 128 || !s.rutaLogica.startsWith('/') || s.rutaLogica.includes('?')) throw datosInvalidos();
    if ((s.rutaLogica.includes('{token}') && !s.token) || (s.token && s.rutaLogica.includes(s.token))) throw datosInvalidos();
    if (s.ambito.tipo === 'usuario' && (!s.autorizar || await s.autorizar() !== s.ambito.id)) throw new ErrorAplicacion(401, 'NO_AUTENTICADO', 'Debe autenticarse.');
    if (s.ambito.tipo === 'recuperacion' && (!s.token || createHash('sha256').update(s.token).digest('hex') !== s.ambito.id)) throw datosInvalidos();
    const entrada = jsonCanonico({ metodo: s.metodo, ruta: s.rutaLogica, token: s.token ?? null, cuerpo: s.cuerpo });
    return this.uow.ejecutar(async (tx) => {
      const q = this.uow.runner(tx);
      let id = s.ambito.id;
      if (s.ambito.tipo === 'registro') { const filas: { correo: string }[] = await q.query('SELECT lower($1::text COLLATE correo_001) AS correo', [id]); id = filas[0]?.correo ?? ''; }
      const ambito = `${s.ambito.tipo}:${id}`; const operacion = `${s.metodo} ${s.rutaLogica}`;
      await q.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [JSON.stringify([ambito, operacion, s.clave])]);
      const filas: FilaIdempotente[] = await q.query('SELECT cuerpo_hmac,hmac_key_id,http,resultado FROM claves_idempotencia WHERE ambito=$1 AND operacion=$2 AND clave=$3', [ambito, operacion, s.clave]);
      const anterior = filas[0];
      const claveId = anterior?.hmac_key_id ?? this.actual; const clave = this.claves.get(claveId);
      if (!clave) throw dependenciaNoDisponible();
      const hmac = createHmac('sha256', clave).update(entrada).digest();
      if (anterior) {
        if (anterior.cuerpo_hmac.length !== hmac.length || !timingSafeEqual(anterior.cuerpo_hmac, hmac)) throw new ErrorAplicacion(409, 'CLAVE_IDEMPOTENCIA_REUTILIZADA', 'La clave ya corresponde a otros datos.');
        return { http: anterior.http, cuerpo: anterior.resultado };
      }
      const resultado = await trabajo(tx);
      if (!Number.isInteger(resultado.http) || resultado.http < 200 || resultado.http > 299) throw new Error('Solo se persisten resultados confirmados.');
      exigirSinSecretos(resultado.cuerpo);
      const cuerpo = JSON.parse(jsonCanonico(resultado.cuerpo)) as ValorJson;
      await q.query(`INSERT INTO claves_idempotencia(ambito,operacion,clave,cuerpo_hmac,hmac_key_id,estado,http,resultado) VALUES($1,$2,$3,$4,$5,'confirmada',$6,$7::jsonb)`, [ambito, operacion, s.clave, hmac, claveId, resultado.http, JSON.stringify(cuerpo)]);
      return { http: resultado.http, cuerpo };
    });
  }
}
