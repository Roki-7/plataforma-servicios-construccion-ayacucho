import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProyeccionPublica1795000000003 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE catalogo_proyeccion_prestadores (
      prestador_id uuid PRIMARY KEY, nombre_publico varchar(120) NOT NULL CHECK (btrim(nombre_publico) <> ''),
      tipo text NOT NULL CHECK (tipo IN ('TRABAJADOR_DE_OFICIO','TECNICO','PROFESIONAL','EMPRESA')),
      disponibilidad_declarada boolean NOT NULL, especialidades uuid[] NOT NULL CHECK (cardinality(especialidades)>0 AND array_position(especialidades,NULL) IS NULL),
      distritos text[] NOT NULL CHECK (cardinality(distritos) BETWEEN 1 AND 5 AND array_position(distritos,NULL) IS NULL), publicable boolean NOT NULL
    );
    CREATE INDEX catalogo_proyeccion_especialidades ON catalogo_proyeccion_prestadores USING gin (especialidades) WHERE publicable;
    CREATE INDEX catalogo_proyeccion_distritos ON catalogo_proyeccion_prestadores USING gin (distritos) WHERE publicable;`);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE catalogo_proyeccion_prestadores'); }
}
