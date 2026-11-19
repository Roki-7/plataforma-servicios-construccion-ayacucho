import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ClasificacionesYDistritos1795000000001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE catalogo_distritos (
      codigo text PRIMARY KEY CHECK (codigo IN ('ayacucho','carmen-alto','san-juan-bautista','jesus-nazareno','andres-avelino-caceres-dorregaray')),
      etiqueta text NOT NULL, orden smallint NOT NULL UNIQUE CHECK (orden BETWEEN 1 AND 5)
    );
    INSERT INTO catalogo_distritos (codigo,etiqueta,orden) VALUES
      ('ayacucho','Ayacucho',1),('carmen-alto','Carmen Alto',2),('san-juan-bautista','San Juan Bautista',3),
      ('jesus-nazareno','Jesús Nazareno',4),('andres-avelino-caceres-dorregaray','Andrés Avelino Cáceres Dorregaray',5);
    CREATE TABLE catalogo_clasificaciones (
      id uuid PRIMARY KEY, nombre varchar(120) NOT NULL CHECK (btrim(nombre) <> ''), nombre_normalizado text NOT NULL CHECK (btrim(nombre_normalizado) <> ''),
      categoria_padre_id uuid, nivel smallint NOT NULL, nivel_padre smallint GENERATED ALWAYS AS (1::smallint) STORED,
      activa boolean DEFAULT false NOT NULL, version integer DEFAULT 1 NOT NULL CHECK (version > 0),
      creada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, actualizada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (id,nivel),
      CHECK ((nivel=1 AND categoria_padre_id IS NULL) OR (nivel=2 AND categoria_padre_id IS NOT NULL AND categoria_padre_id<>id)),
      FOREIGN KEY (categoria_padre_id,nivel_padre) REFERENCES catalogo_clasificaciones(id,nivel)
    );
    CREATE INDEX catalogo_clasificaciones_jerarquia ON catalogo_clasificaciones (categoria_padre_id,activa);
    CREATE FUNCTION catalogo_impedir_cambio_de_padre() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.categoria_padre_id IS DISTINCT FROM OLD.categoria_padre_id OR NEW.nivel IS DISTINCT FROM OLD.nivel THEN
        RAISE EXCEPTION 'La jerarquía de una clasificación es inmutable' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER catalogo_padre_inmutable BEFORE UPDATE OF categoria_padre_id, nivel ON catalogo_clasificaciones
    FOR EACH ROW EXECUTE FUNCTION catalogo_impedir_cambio_de_padre();`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE catalogo_clasificaciones; DROP FUNCTION catalogo_impedir_cambio_de_padre(); DROP TABLE catalogo_distritos;');
  }
}
