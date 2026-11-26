import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';
import { caddyfileEsperado002, compararProxy002 } from '../../../scripts/proxy-002.js';
import { origen002, puertos002 } from '../../../scripts/entorno-002.js';

const plantilla = readFileSync(resolve(import.meta.dirname, '../../../../infra/Caddyfile'), 'utf8');
const esperado = caddyfileEsperado002(plantilla);

describe('comprobación del proxy Caddy de la 002 (solo lectura)', () => {
  test('el esperado sale de la plantilla de la 001 con el origen y los puertos de la 002, y sin los de la 001', () => {
    expect(esperado).toContain(`${origen002} {`);
    expect(esperado).toContain(`reverse_proxy host.docker.internal:${puertos002.api}`);
    expect(esperado).toContain(`reverse_proxy host.docker.internal:${puertos002.web}`);
    for (const ajeno of ['localhost:8443', 'host.docker.internal:3000', 'host.docker.internal:5173']) expect(esperado).not.toContain(ajeno);
  });

  test('generado y montado idénticos al esperado se aceptan, también con fin de línea CRLF', () => {
    expect(compararProxy002({ plantilla, generado: esperado, montado: esperado })).toMatchObject({ generado: { ok: true }, montado: { ok: true } });
    const crlf = esperado.replaceAll('\n', '\r\n');
    expect(compararProxy002({ plantilla, generado: crlf, montado: crlf })).toMatchObject({ generado: { ok: true }, montado: { ok: true } });
  });

  test('un puerto alterado en el archivo generado hace fallar la comprobación y se informa el destino real', () => {
    for (const [antes, despues] of [[`:${puertos002.api}`, ':3003'], [`:${puertos002.web}`, ':5176'], ['https://localhost:8444 {', 'https://localhost:8443 {']] as const) {
      const alterado = esperado.replace(antes, despues);
      const r = compararProxy002({ plantilla, generado: alterado, montado: esperado });
      expect(r.generado.ok).toBe(false);
      expect(r.generado.detalle).toContain(despues.replace(' {', ''));
      expect(r.montado.ok).toBe(true);
    }
  });

  test('un puerto alterado solo en el archivo montado en el contenedor también hace fallar la comprobación', () => {
    const r = compararProxy002({ plantilla, generado: esperado, montado: esperado.replace(`:${puertos002.api}`, ':3000') });
    expect(r.generado.ok).toBe(true);
    expect(r.montado.ok).toBe(false);
  });

  test('una plantilla que ya no contiene los valores que se sustituyen se rechaza', () => {
    expect(() => caddyfileEsperado002(plantilla.replace('host.docker.internal:5173', 'host.docker.internal:5199'))).toThrow('La plantilla de Caddy no coincide');
    expect(() => caddyfileEsperado002(plantilla + '\nreverse_proxy host.docker.internal:3000\n')).toThrow('La plantilla de Caddy no coincide');
  });
});
