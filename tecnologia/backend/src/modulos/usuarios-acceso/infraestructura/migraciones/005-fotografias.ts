import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Fotografias1794830400005 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`CREATE TABLE fotografias_perfil (
    id uuid PRIMARY KEY, usuario_id uuid NOT NULL REFERENCES usuarios(id) DEFERRABLE INITIALLY DEFERRED,
    objeto_clave text NOT NULL UNIQUE, mime text NOT NULL CHECK(mime IN ('image/jpeg','image/png','image/webp')),
    bytes bigint NOT NULL CHECK(bytes BETWEEN 1 AND 10000000), checksum bytea NOT NULL CHECK(octet_length(checksum)=32),
    estado text NOT NULL CHECK(estado IN ('temporal','activa','pendiente_eliminacion')),
    creada_en timestamptz NOT NULL DEFAULT clock_timestamp(), vinculada_en timestamptz,
    UNIQUE(usuario_id,id), CHECK(estado<>'activa' OR vinculada_en IS NOT NULL)
  );
  ALTER TABLE usuarios ADD CONSTRAINT foto_propia_001 FOREIGN KEY(id,fotografia_id) REFERENCES fotografias_perfil(usuario_id,id) DEFERRABLE INITIALLY DEFERRED;
  CREATE INDEX fotos_temporales_001 ON fotografias_perfil(estado,creada_en);`); }
  async down(q: QueryRunner): Promise<void> { await q.query('ALTER TABLE usuarios DROP CONSTRAINT foto_propia_001; DROP TABLE fotografias_perfil'); }
}
