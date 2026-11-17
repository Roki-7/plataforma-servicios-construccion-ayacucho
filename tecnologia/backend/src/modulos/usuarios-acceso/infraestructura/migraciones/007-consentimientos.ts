import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Consentimientos1794830400007 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`CREATE TABLE consentimientos_telefono (
    id uuid PRIMARY KEY, usuario_id uuid NOT NULL UNIQUE REFERENCES usuarios(id),
    telefono_hmac bytea NOT NULL CHECK(octet_length(telefono_hmac)=32),
    autorizada_en timestamptz, revocada_en timestamptz,
    version bigint NOT NULL DEFAULT 1 CHECK(version>0),
    CHECK(autorizada_en IS NOT NULL OR revocada_en IS NOT NULL)
  )`); }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE consentimientos_telefono'); }
}
