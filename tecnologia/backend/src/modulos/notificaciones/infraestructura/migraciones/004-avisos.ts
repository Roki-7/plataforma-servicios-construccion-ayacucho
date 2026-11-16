import type { MigrationInterface, QueryRunner } from 'typeorm';
export class Avisos1794830400004 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> { await q.query(`CREATE TABLE avisos_pendientes (
    id uuid PRIMARY KEY, tipo text NOT NULL CHECK(tipo IN ('recuperación','verificar_correo','contraseña_recuperada')),
    destinatario text NOT NULL, payload_cifrado bytea, key_id text NOT NULL, desafio_id uuid,
    creado_en timestamptz NOT NULL DEFAULT clock_timestamp(), vence_en timestamptz, proximo_intento_en timestamptz NOT NULL DEFAULT clock_timestamp(),
    intentos integer NOT NULL DEFAULT 0 CHECK(intentos>=0), estado text NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','enviando','enviado','vencido','fallido')),
    lease_hasta timestamptz, enviado_en timestamptz, error_sanitizado text, clave_logica text NOT NULL UNIQUE
  ); CREATE INDEX avisos_por_entregar ON avisos_pendientes(estado,proximo_intento_en);`); }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE avisos_pendientes'); }
}
