import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Recuperaciones1794830400006 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`CREATE TABLE recuperaciones_acceso (
    id uuid PRIMARY KEY, usuario_id uuid NOT NULL REFERENCES usuarios(id),
    token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),
    emitida_en timestamptz NOT NULL, vence_en timestamptz NOT NULL,
    consumida_en timestamptz, invalidada_en timestamptz,
    version bigint NOT NULL DEFAULT 1 CHECK(version>0),
    CHECK(vence_en=emitida_en+interval '1800 seconds'),
    CHECK(consumida_en IS NULL OR invalidada_en IS NULL)
  ); CREATE INDEX recuperaciones_usuario_estado ON recuperaciones_acceso(usuario_id,consumida_en,invalidada_en);`); }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE recuperaciones_acceso'); }
}
