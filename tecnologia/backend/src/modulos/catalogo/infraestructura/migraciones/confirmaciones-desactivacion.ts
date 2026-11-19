import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Vista previa de desactivación: vincula actor, clasificación, versión, revisión, recuento y vencimiento. Se consume una sola vez. */
export class ConfirmacionesDesactivacion1795000000008 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE catalogo_confirmaciones_desactivacion (
      id uuid PRIMARY KEY, actor_cuenta_id uuid NOT NULL, clasificacion_id uuid NOT NULL REFERENCES catalogo_clasificaciones(id),
      version integer NOT NULL CHECK (version > 0), revision bigint NOT NULL CHECK (revision > 0), afectados integer NOT NULL CHECK (afectados >= 0),
      creada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, vence_en timestamptz NOT NULL, consumida_en timestamptz,
      CHECK (vence_en > creada_en)
    );
    CREATE INDEX catalogo_confirmaciones_por_clasificacion ON catalogo_confirmaciones_desactivacion (clasificacion_id, vence_en);`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE catalogo_confirmaciones_desactivacion;'); }
}
