import { describe, expect, it } from '@jest/globals';
import { DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { ContadorSentencias, exigirConteoConstante } from '../../soporte/solicitudes-cotizaciones/contador-sentencias.js';
import { patronPrefijoPrueba003, prefijoDePrueba003, retirarPrefijo003, type ClienteDeAlmacenamiento } from '../../soporte/solicitudes-cotizaciones/almacenamiento.js';
import { baseAislada003, nombreBaseTemporal003, patronBaseTemporal003 } from '../../soporte/solicitudes-cotizaciones/postgres.js';

// Pruebas del soporte de la 003 (T005). Usan dobles: no necesitan PostgreSQL ni almacenamiento. El comportamiento contra la
// infraestructura real (crear y retirar una base y un prefijo) se comprueba en la suite de integración del soporte.

function fuenteFalsa(falla = false) {
  const ejecutadas: string[] = [];
  const fuente = {
    createQueryRunner: () => ({ query: async (sql: string) => { ejecutadas.push(sql); if (falla && /FALLA/.test(sql)) throw new Error('fallo simulado'); return [{ ok: true }]; } }),
  };
  return { fuente, ejecutadas };
}

describe('ContadorSentencias', () => {
  it('cuenta las sentencias de negocio y separa las de control de transacción', async () => {
    const { fuente } = fuenteFalsa();
    const contador = new ContadorSentencias().instalar(fuente);
    const r = await contador.contar(async () => {
      const q = fuente.createQueryRunner();
      await q.query('BEGIN');
      await q.query("SELECT set_config('lock_timeout', '5000ms', true)");
      await q.query('SELECT   1\n  FROM  solicitudes');
      await q.query('SELECT 2');
      await q.query('COMMIT');
      return 'listo';
    });
    expect(r.resultado).toBe('listo');
    expect(r.total).toBe(2);
    expect(r.control).toBe(3);
    expect(r.sentencias).toEqual(['SELECT 1 FROM solicitudes', 'SELECT 2']);
    contador.liberar();
  });

  it('cada medición empieza en cero y no arrastra las anteriores', async () => {
    const { fuente } = fuenteFalsa();
    const contador = new ContadorSentencias().instalar(fuente);
    const a = await contador.contar(async () => { await fuente.createQueryRunner().query('SELECT 1'); });
    const b = await contador.contar(async () => { const q = fuente.createQueryRunner(); await q.query('SELECT 1'); await q.query('SELECT 2'); await q.query('SELECT 3'); });
    expect([a.total, b.total]).toEqual([1, 3]);
    contador.liberar();
  });

  it('propaga el error del trabajo y deja el contador utilizable', async () => {
    const { fuente } = fuenteFalsa(true);
    const contador = new ContadorSentencias().instalar(fuente);
    await expect(contador.contar(async () => { await fuente.createQueryRunner().query('SELECT FALLA'); })).rejects.toThrow('fallo simulado');
    expect(contador.total).toBe(1);
    contador.liberar();
  });

  it('liberar restaura la fuente original y no se puede instalar dos veces', async () => {
    const { fuente, ejecutadas } = fuenteFalsa();
    const original = fuente.createQueryRunner;
    const contador = new ContadorSentencias().instalar(fuente);
    expect(() => contador.instalar(fuente)).toThrow('ya está instalado');
    expect(fuente.createQueryRunner).not.toBe(original);
    contador.liberar();
    expect(fuente.createQueryRunner).toBe(original);
    await fuente.createQueryRunner().query('SELECT 9');
    expect(contador.total).toBe(0);
    expect(ejecutadas).toEqual(['SELECT 9']);
    contador.liberar();
  });

  it('exigirConteoConstante acepta mediciones iguales y rechaza las que varían o son insuficientes', () => {
    expect(() => exigirConteoConstante([3, 3, 3])).not.toThrow();
    expect(() => exigirConteoConstante([3, 4])).toThrow('varía con el tamaño de página');
    expect(() => exigirConteoConstante([3])).toThrow('al menos dos mediciones');
  });
});

function clienteFalso(paginas: string[][], extra: { claveAjena?: string } = {}) {
  const borradas: string[] = [];
  const listados: (string | undefined)[] = [];
  const existentes = paginas.map((p) => [...p]);
  const cliente: ClienteDeAlmacenamiento = {
    send: async (recibido: never) => {
      const comando: unknown = recibido;
      if (comando instanceof ListObjectsV2Command) {
        const token = comando.input.ContinuationToken;
        listados.push(token);
        const indice = token ? Number(token) : 0;
        const claves = existentes[indice] ?? [];
        return { Contents: [...claves, ...(extra.claveAjena && indice === 0 ? [extra.claveAjena] : [])].map((Key) => ({ Key })),
          IsTruncated: indice + 1 < existentes.length, NextContinuationToken: String(indice + 1) };
      }
      if (comando instanceof DeleteObjectCommand) { const k = comando.input.Key!; borradas.push(k); for (const p of existentes) { const i = p.indexOf(k); if (i >= 0) p.splice(i, 1); } return {}; }
      throw new Error('comando inesperado');
    },
  };
  return { cliente, borradas, listados };
}

describe('retirarPrefijo003', () => {
  it('pagina el listado, elimina solo lo listado y es idempotente', async () => {
    const prefijo = prefijoDePrueba003();
    const { cliente, borradas, listados } = clienteFalso([[`${prefijo}a/1`, `${prefijo}a/2`], [`${prefijo}b/1`]]);
    expect(await retirarPrefijo003(cliente, 'bucket', prefijo)).toBe(3);
    expect(borradas).toEqual([`${prefijo}a/1`, `${prefijo}a/2`, `${prefijo}b/1`]);
    expect(listados).toEqual([undefined, '1']);
    expect(await retirarPrefijo003(cliente, 'bucket', prefijo)).toBe(0);
  });

  it('solo acepta prefijos de prueba y nunca solicitudes/, usuarios/, portafolio/ ni el bucket entero', async () => {
    const { cliente, borradas } = clienteFalso([['solicitudes/x/y']]);
    const uuid = '123e4567-e89b-42d3-a456-426614174000';
    for (const prefijo of ['', '/', 'solicitudes/', 'usuarios/', 'portafolio/', `pruebas/${uuid}/`, `pruebas/${uuid}/portafolio/`, `pruebas/${uuid}/solicitudes`,
      'pruebas/no-uuid/solicitudes/', `x/pruebas/${uuid}/solicitudes/`]) {
      await expect(retirarPrefijo003(cliente, 'bucket', prefijo)).rejects.toThrow('prefijos de prueba');
    }
    expect(borradas).toEqual([]);
  });

  it('se detiene si el listado devuelve una clave fuera del prefijo', async () => {
    const prefijo = prefijoDePrueba003();
    const { cliente, borradas } = clienteFalso([[`${prefijo}a/1`]], { claveAjena: 'solicitudes/otra/clave' });
    await expect(retirarPrefijo003(cliente, 'bucket', prefijo)).rejects.toThrow('fuera del prefijo');
    expect(borradas).not.toContain('solicitudes/otra/clave');
  });

  it('cada prefijo generado es único y cumple el patrón', () => {
    const generados = new Set(Array.from({ length: 50 }, () => prefijoDePrueba003()));
    expect(generados.size).toBe(50);
    for (const p of generados) expect(p).toMatch(patronPrefijoPrueba003);
  });
});

describe('baseAislada003', () => {
  it('genera nombres temporales únicos con el patrón ayacucho_003_test_<32 hex>', () => {
    const nombres = new Set(Array.from({ length: 50 }, () => nombreBaseTemporal003()));
    expect(nombres.size).toBe(50);
    for (const n of nombres) expect(n).toMatch(patronBaseTemporal003);
  });

  it('rechaza cualquier instancia o base que no sea la de validación 003, sin conectarse', async () => {
    for (const origen of ['postgresql://ayacucho_validacion_002:x@127.0.0.1:54330/ayacucho_002_validacion',
      'postgresql://ayacucho_validacion:x@127.0.0.1:54329/ayacucho_001_validacion', 'no es una url']) {
      await expect(baseAislada003(origen)).rejects.toThrow('base PostgreSQL local dedicada de la 003');
    }
  });
});
