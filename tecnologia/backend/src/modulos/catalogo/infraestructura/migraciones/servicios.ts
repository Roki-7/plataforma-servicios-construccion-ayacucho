import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ServiciosCatalogo1795000000005 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // `prestador_id` es una referencia lógica a Prestadores. Las claves foráneas solo se usan dentro de Catálogo.
    await q.query(`CREATE TABLE catalogo_servicios (
      id uuid PRIMARY KEY, prestador_id uuid NOT NULL,
      categoria_id uuid NOT NULL REFERENCES catalogo_clasificaciones(id),
      titulo varchar(120) NOT NULL CHECK (btrim(titulo) <> ''), descripcion varchar(2000) NOT NULL CHECK (btrim(descripcion) <> ''),
      estado text NOT NULL CHECK (estado IN ('PUBLICADO','PAUSADO','RETIRADO')),
      version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, actualizado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX catalogo_servicios_por_titular ON catalogo_servicios (prestador_id, creado_en, id);
    CREATE INDEX catalogo_servicios_publicados_por_categoria ON catalogo_servicios (categoria_id, id) WHERE estado = 'PUBLICADO';
    -- RETIRADO es terminal: PostgreSQL impide reabrir o modificar el registro histórico.
    CREATE FUNCTION catalogo_servicio_retirado_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.estado = 'RETIRADO' THEN RAISE EXCEPTION 'Un servicio retirado es de solo lectura' USING ERRCODE = '23514'; END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER catalogo_servicio_retirado BEFORE UPDATE ON catalogo_servicios FOR EACH ROW EXECUTE FUNCTION catalogo_servicio_retirado_inmutable();
    CREATE FUNCTION catalogo_servicio_sin_borrado() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'Los servicios no se eliminan: se conservan sus referencias históricas' USING ERRCODE = '23514'; END;
    $$;
    CREATE TRIGGER catalogo_servicio_conservado BEFORE DELETE ON catalogo_servicios FOR EACH ROW EXECUTE FUNCTION catalogo_servicio_sin_borrado();`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE catalogo_servicios; DROP FUNCTION catalogo_servicio_retirado_inmutable(); DROP FUNCTION catalogo_servicio_sin_borrado();`);
  }
}
