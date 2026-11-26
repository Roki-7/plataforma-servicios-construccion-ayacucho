import pg from 'pg';

export interface PuertaRestauracion { readonly estado: 'CERRADO' | 'ABIERTO'; readonly espacioRedis: string | null }

/** Las bases creadas por una restauración tienen este nombre. Para ellas la puerta es OBLIGATORIA. */
export const esBaseDeRestauracion = (url: string): boolean => /^\/ayacucho_002_restauracion_/.test(new URL(url).pathname);

/** Lee la puerta que crea una restauración. `null` si la base no tiene la tabla. Un error de consulta se propaga. */
export async function leerPuerta(url: string): Promise<PuertaRestauracion | null> {
  const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 }); await c.connect();
  try {
    if (!(await c.query("SELECT to_regclass('public.restauracion_002') AS t")).rows[0].t) return null;
    const fila = (await c.query('SELECT estado, espacio_redis FROM restauracion_002 WHERE unica')).rows[0] as { estado: string; espacio_redis: string | null } | undefined;
    if (!fila || (fila.estado !== 'CERRADO' && fila.estado !== 'ABIERTO')) return { estado: 'CERRADO', espacioRedis: null };
    return { estado: fila.estado, espacioRedis: fila.espacio_redis };
  } finally { await c.end(); }
}

const cerrado = () => new Error('La base proviene de una restauración sin completar: el tráfico permanece cerrado.');

/**
 * Condiciona el arranque. Una base de restauración (ayacucho_002_restauracion_*) solo arranca si su puerta existe, puede consultarse y está ABIERTA con un espacio Redis nuevo:
 * la ausencia de la puerta, un error al consultarla o cualquier estado distinto de ABIERTO la rechazan. Para el resto de las bases, sin puerta el entorno no cambia, una puerta CERRADA
 * rechaza el arranque y una ABIERTA impone su espacio Redis en todas las réplicas.
 */
export async function entornoTrasRestauracion(url: string, env: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
  const obligatoria = esBaseDeRestauracion(url);
  let puerta: PuertaRestauracion | null;
  try { puerta = await leerPuerta(url); } catch { if (obligatoria) throw cerrado(); throw new Error('No se pudo consultar el estado de restauración de la base.'); }
  if (!puerta) { if (obligatoria) throw cerrado(); return env; }
  if (puerta.estado !== 'ABIERTO' || !puerta.espacioRedis || !/^ayacucho:002:[a-z0-9_:-]{1,100}$/.test(puerta.espacioRedis)) throw cerrado();
  return { ...env, REDIS_NAMESPACE: puerta.espacioRedis };
}
