import { describe, expect, it } from '@jest/globals';
import { base002, origen002, proyecto002, puertos002, recursos002, usuario002 } from '../../../scripts/entorno-002.js';
import { base003, exigirBase003, origen003, proyecto003, puertos003, recursos003, usuario003 } from '../../../scripts/entorno-003.js';

// Referencia de la validación 001 (tecnologia/compose.yaml). Solo se compara; nunca se usa.
const ref001 = {
  proyecto: 'ayacucho-001-validacion', base: 'ayacucho_001_validacion', usuario: 'ayacucho_validacion', origen: 'https://localhost:8443',
  espacioRedis: 'ayacucho:001:validacion', bucket: 'usuarios-validacion',
  puertos: [3000, 5173, 54329, 63799, 1025, 8025, 3900],
};
// Otros puertos locales ya reservados por la 002: réplicas, proxy móvil retirado y entorno de ensayo de restauración.
const reservados002 = [3003, 5176, 8446, 54341, 63851, 3930];

describe('Entorno aislado de la 003 (T003)', () => {
  const puertos = Object.values(puertos003);

  it('ningún nombre ni identidad coincide con los de 001 ni de 002', () => {
    const valores003 = [proyecto003, base003, usuario003, origen003, recursos003.REDIS_NAMESPACE, recursos003.S3_BUCKET];
    const valores002 = [proyecto002, base002, usuario002, origen002, recursos002.REDIS_NAMESPACE, recursos002.S3_BUCKET];
    const valores001 = [ref001.proyecto, ref001.base, ref001.usuario, ref001.origen, ref001.espacioRedis, ref001.bucket];
    for (const v of valores003) {
      expect(valores002).not.toContain(v);
      expect(valores001).not.toContain(v);
    }
    expect(new Set(valores003).size).toBe(valores003.length);
  });

  it('ningún puerto coincide con los de 001, 002 ni los reservados', () => {
    const ocupados = new Set<number>([...ref001.puertos, ...Object.values(puertos002), ...reservados002]);
    for (const p of puertos) expect(ocupados.has(p)).toBe(false);
    expect(new Set(puertos).size).toBe(puertos.length);
    expect(origen003).toBe('https://localhost:8447');
  });

  it('los recursos derivan de la misma identidad (puertos y nombres coherentes)', () => {
    expect(recursos003.PORT).toBe(String(puertos003.api));
    expect(recursos003.REDIS_URL).toBe(`redis://127.0.0.1:${puertos003.redis}`);
    expect(recursos003.S3_ENDPOINT).toBe(`http://127.0.0.1:${puertos003.objetos}`);
    expect(recursos003.SMTP_PORT).toBe(String(puertos003.smtp));
    expect(recursos003.VALIDATION_PROJECT).toBe(proyecto003);
    expect(recursos003.PUBLIC_ORIGIN).toBe(origen003);
  });

  it('el bucket de validación es uno solo, equivalente al único bucket de la composición real', () => {
    expect(recursos003.S3_BUCKET).toBe('plataforma-003-validacion');
    expect(recursos003.S3_BUCKET).not.toMatch(/solicitudes/);
  });

  describe('exigirBase003', () => {
    const valida = `postgresql://${usuario003}:secreto@127.0.0.1:${puertos003.postgres}/${base003}`;
    it('acepta solo la base local dedicada', () => {
      expect(exigirBase003(valida).pathname).toBe(`/${base003}`);
    });
    it('rechaza otra base, otro puerto, otro usuario, otro host, sin credencial o con parámetros', () => {
      const casos = [
        undefined, 'no es una url',
        `postgresql://${usuario003}:x@127.0.0.1:${puertos003.postgres}/${base002}`,
        `postgresql://${usuario003}:x@127.0.0.1:${puertos002.postgres}/${base003}`,
        `postgresql://${usuario002}:x@127.0.0.1:${puertos003.postgres}/${base003}`,
        `postgresql://${usuario003}:x@localhost:${puertos003.postgres}/${base003}`,
        `postgresql://${usuario003}@127.0.0.1:${puertos003.postgres}/${base003}`,
        `${valida}?sslmode=disable`, `${valida}#x`,
        `mysql://${usuario003}:x@127.0.0.1:${puertos003.postgres}/${base003}`,
      ];
      for (const c of casos) expect(() => exigirBase003(c)).toThrow('base PostgreSQL local dedicada de la 003');
    });
    it('admite una base temporal explícita de pruebas', () => {
      const temporal = `ayacucho_003_test_${'a'.repeat(32)}`;
      expect(exigirBase003(`postgresql://${usuario003}:x@127.0.0.1:${puertos003.postgres}/${temporal}`, temporal).pathname).toBe(`/${temporal}`);
    });
  });
});
