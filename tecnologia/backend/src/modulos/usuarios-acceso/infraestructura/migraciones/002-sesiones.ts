import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Sesiones1794830400002 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`CREATE TABLE sesiones (
    id uuid PRIMARY KEY, usuario_id uuid NOT NULL REFERENCES usuarios(id), acceso_digest bytea NOT NULL UNIQUE CHECK (octet_length(acceso_digest)=32), acceso_vence_en timestamptz NOT NULL,
    renovacion_digest bytea NOT NULL UNIQUE CHECK (octet_length(renovacion_digest)=32), renovacion_vence_en timestamptz NOT NULL,
    autenticada_con_contrasena_en timestamptz, creada_en timestamptz NOT NULL DEFAULT clock_timestamp(), renovada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    revocada_en timestamptz, version bigint NOT NULL DEFAULT 1 CHECK (version>0),
    CHECK (acceso_vence_en>creada_en), CHECK (renovacion_vence_en>creada_en AND renovacion_vence_en<=creada_en+interval '7 days')
  ); CREATE INDEX sesiones_usuario_estado ON sesiones(usuario_id,revocada_en);`); }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE sesiones'); }
}
