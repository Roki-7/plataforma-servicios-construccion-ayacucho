import { afterEach, describe, expect, test } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DestinoPostgresDocker, lanzador, OrigenPostgresDocker } from '../../../src/composicion/respaldo-002.js';

/**
 * Seguridad de los procesos externos del respaldo y la restauración: sin shell, programa y subcomando fijos, argumentos validados y credenciales solo por entorno.
 * No ejecuta Docker: sustituye el lanzador por un proceso simulado.
 */
const clave = 'clave-de-prueba-que-no-debe-aparecer-en-argumentos';
const url = (base: string) => `postgresql://usuario_prueba:${clave}@127.0.0.1:54330/${base}`;
const original = lanzador.execFile;
afterEach(() => { lanzador.execFile = original; });

interface Lanzamiento { programa: string; args: string[]; opciones: { env?: NodeJS.ProcessEnv; shell?: unknown }; entrada: Buffer[] }
function simular(codigo = 0, salida = 'SALIDA'): Lanzamiento[] {
  const lanzados: Lanzamiento[] = [];
  lanzador.execFile = ((programa: string, args: string[], opciones: Lanzamiento['opciones']) => {
    const hijo = new EventEmitter() as EventEmitter & { stdout: EventEmitter; stdin: { end(b?: Buffer): void } };
    const entrada: Buffer[] = []; hijo.stdout = new EventEmitter(); hijo.stdin = { end: (b?: Buffer) => { if (b) entrada.push(b); } };
    lanzados.push({ programa, args, opciones, entrada });
    setImmediate(() => { hijo.stdout.emit('data', Buffer.from(salida)); hijo.emit('close', codigo); });
    return hijo;
  }) as unknown as typeof lanzador.execFile;
  return lanzados;
}

describe('procesos externos de respaldo y restauración', () => {
  test('pg_dump y psql se lanzan sin shell, con docker exec fijo, la clave solo en el entorno y argumentos acotados', async () => {
    const lanzados = simular();
    await new OrigenPostgresDocker(url('ayacucho_002_test_abcd1234'), 'ayacucho-002-validacion-postgres-1').volcar('00000003-0000002A-1');
    await new DestinoPostgresDocker(url('ayacucho_002_restauracion_abcd1234'), 'ayacucho-002-validacion-postgres-1', 18).restaurar(Buffer.from('SELECT 1;'));
    expect(lanzados).toHaveLength(2);
    for (const l of lanzados) {
      expect(l.programa).toBe('docker'); expect(l.args.slice(0, 5)).toEqual(['exec', '-i', '-e', 'PGPASSWORD', 'ayacucho-002-validacion-postgres-1']);
      expect(['pg_dump', 'psql']).toContain(l.args[5]); expect(l.opciones.shell).toBeUndefined();
      expect(l.args.join(' ').includes(clave)).toBe(false);
      expect(l.opciones.env?.['PGPASSWORD']).toBe(clave);
      expect(l.args.slice(6, 12)).toEqual(['-h', '127.0.0.1', '-p', '5432', '-U', 'usuario_prueba']);
    }
    expect(lanzados[0]!.args).toEqual(expect.arrayContaining(['-d', 'ayacucho_002_test_abcd1234', '--snapshot=00000003-0000002A-1', '--no-owner', '--no-privileges']));
    expect(lanzados[1]!.args).toEqual(expect.arrayContaining(['-d', 'ayacucho_002_restauracion_abcd1234', '-v', 'ON_ERROR_STOP=1']));
    expect(Buffer.concat(lanzados[1]!.entrada).toString()).toBe('SELECT 1;');
  });

  test('un identificador de instantánea con caracteres no previstos se rechaza antes de lanzar ningún proceso', async () => {
    const lanzados = simular();
    for (const malo of ['', '1; rm -rf /', '$(id)', '00000003-0000002A-1 --file=/etc/passwd', '--help', '00000003-0000002a-1', '../../x']) {
      await expect(new OrigenPostgresDocker(url('ayacucho_002_test_abcd1234'), 'c').volcar(malo)).rejects.toMatchObject({ codigo: 'INSTANTANEA_NO_VALIDA' });
    }
    expect(lanzados).toHaveLength(0);
  });

  test('una base de destino con nombre no previsto no llega a crearse ni a restaurarse', async () => {
    const lanzados = simular();
    for (const malo of ['postgres', 'ayacucho_002_x; DROP', 'AYACUCHO_002_X', 'ayacucho_001_x', 'ayacucho_002_']) {
      await expect(new DestinoPostgresDocker(url(malo), 'c', 18).crearBaseNueva()).rejects.toMatchObject({ codigo: 'DESTINO_NO_PERMITIDO' });
    }
    expect(lanzados).toHaveLength(0);
  });

  test('un fallo del proceso externo informa solo el programa y el código, sin argumentos, entorno ni salida', async () => {
    simular(2, `salida con ${clave}`);
    const e = await new DestinoPostgresDocker(url('ayacucho_002_test_abcd1234'), 'c', 18).restaurar(Buffer.from('x')).then(() => undefined, (x: Error & { codigo?: string }) => x);
    expect(e?.codigo).toBe('PROCESO_EXTERNO_FALLIDO');
    expect(e?.message).toBe('psql terminó con código 2.');
    expect(`${e?.message}${e?.stack}`.includes(clave)).toBe(false);
  });
});

describe('alcance del código que lanza procesos', () => {
  const archivos = async (dir: string): Promise<string[]> => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async d => d.isDirectory() ? archivos(join(dir, d.name)) : [join(dir, d.name)]))).flat();
  test('solo respaldo-002.ts lanza procesos y nada de src (HTTP, módulos ni arranque) lo importa: solo scripts y pruebas', async () => {
    const fuentes = (await archivos(resolve('src'))).filter(f => f.endsWith('.ts'));
    const conProcesos: string[] = []; const importadores: string[] = [];
    for (const f of fuentes) {
      const t = await readFile(f, 'utf8');
      if (/node:child_process|from 'child_process'/.test(t)) conProcesos.push(f.replaceAll('\\', '/').split('/src/')[1]!);
      if (/respaldo-002/.test(t)) importadores.push(f);
    }
    expect(conProcesos).toEqual(['composicion/respaldo-002.ts']);
    expect(importadores).toEqual([]);
    for (const s of await readdir(resolve('scripts'))) {
      if (/^(respaldar|restaurar)-portafolio-002\.ts$/.test(s)) expect(await readFile(resolve('scripts', s), 'utf8')).toContain('respaldo-002');
    }
  });
});
