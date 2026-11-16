import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Idempotencia1794830400003 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`CREATE TABLE claves_idempotencia (
    ambito text NOT NULL, operacion text NOT NULL, clave text NOT NULL CHECK (char_length(clave) BETWEEN 16 AND 128),
    cuerpo_hmac bytea NOT NULL CHECK (octet_length(cuerpo_hmac)=32), hmac_key_id text NOT NULL,
    estado text NOT NULL CHECK (estado='confirmada'), http smallint NOT NULL CHECK (http BETWEEN 200 AND 299), resultado jsonb NOT NULL,
    creado_en timestamptz NOT NULL DEFAULT clock_timestamp(), PRIMARY KEY(ambito,operacion,clave)
  )`); }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE claves_idempotencia'); }
}
