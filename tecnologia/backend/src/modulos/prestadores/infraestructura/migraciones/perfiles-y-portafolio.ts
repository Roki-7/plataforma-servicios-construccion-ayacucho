import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PerfilesYPortafolio1795000000004 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE prestadores_perfiles (
      id uuid PRIMARY KEY, cuenta_id uuid NOT NULL UNIQUE,
      nombre_publico varchar(120) NOT NULL CHECK (btrim(nombre_publico) <> ''),
      tipo text NOT NULL CHECK (tipo IN ('TRABAJADOR_DE_OFICIO','TECNICO','PROFESIONAL','EMPRESA')),
      experiencia varchar(3000) NOT NULL CHECK (btrim(experiencia) <> ''),
      disponibilidad_declarada boolean NOT NULL, publicable boolean NOT NULL DEFAULT true,
      version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (id <> cuenta_id)
    );
    CREATE TABLE prestadores_especialidades (
      prestador_id uuid NOT NULL REFERENCES prestadores_perfiles(id) ON DELETE CASCADE,
      categoria_id uuid NOT NULL, PRIMARY KEY (prestador_id, categoria_id)
    );
    CREATE TABLE prestadores_zonas (
      prestador_id uuid NOT NULL REFERENCES prestadores_perfiles(id) ON DELETE CASCADE,
      distrito_codigo text NOT NULL CHECK (distrito_codigo IN ('ayacucho','carmen-alto','san-juan-bautista','jesus-nazareno','andres-avelino-caceres-dorregaray')),
      PRIMARY KEY (prestador_id, distrito_codigo)
    );
    CREATE TABLE prestadores_trabajos (
      id uuid PRIMARY KEY, prestador_id uuid NOT NULL REFERENCES prestadores_perfiles(id) ON DELETE CASCADE,
      titulo varchar(120) NOT NULL CHECK (btrim(titulo) <> ''), descripcion varchar(2000) NOT NULL CHECK (btrim(descripcion) <> ''),
      version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX prestadores_trabajos_por_prestador ON prestadores_trabajos (prestador_id, creado_en, id);
    CREATE TABLE prestadores_fotografias (
      id uuid PRIMARY KEY, trabajo_id uuid NOT NULL REFERENCES prestadores_trabajos(id) ON DELETE CASCADE,
      objeto_clave text NOT NULL UNIQUE CHECK (objeto_clave ~ '^(?:pruebas/[0-9a-f-]{36}/)?portafolio/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
      mime text NOT NULL CHECK (mime = 'image/webp'), bytes integer NOT NULL CHECK (bytes > 0),
      ancho smallint NOT NULL CHECK (ancho BETWEEN 1 AND 1600), alto smallint NOT NULL CHECK (alto BETWEEN 1 AND 1600),
      checksum bytea NOT NULL CHECK (octet_length(checksum) = 32), creada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX prestadores_fotografias_por_trabajo ON prestadores_fotografias (trabajo_id, creada_en, id);
    CREATE TABLE prestadores_objetos_pendientes (
      clave text PRIMARY KEY, tipo text NOT NULL CHECK (tipo IN ('PREPARACION','PURGA')), prestador_id uuid NOT NULL,
      proxima_ejecucion timestamptz NOT NULL, arrendado_hasta timestamptz, intentos integer NOT NULL DEFAULT 0 CHECK (intentos >= 0),
      creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX prestadores_objetos_pendientes_proxima ON prestadores_objetos_pendientes (proxima_ejecucion);`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE prestadores_objetos_pendientes; DROP TABLE prestadores_fotografias; DROP TABLE prestadores_trabajos;
      DROP TABLE prestadores_zonas; DROP TABLE prestadores_especialidades; DROP TABLE prestadores_perfiles;`);
  }
}
