import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RevisionDeOferta1795000000002 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE catalogo_revision_oferta (
      unica boolean PRIMARY KEY DEFAULT true CHECK (unica), revision bigint NOT NULL CHECK (revision>0)
    ); INSERT INTO catalogo_revision_oferta (revision) VALUES (1);`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE catalogo_revision_oferta'); }
}
