import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Cuentas1794830400001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE COLLATION correo_001 (provider = icu, locale = 'und', deterministic = true);
      CREATE TABLE usuarios (
        id uuid PRIMARY KEY,
        correo text NOT NULL CHECK (char_length(correo) BETWEEN 1 AND 320 AND correo ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
        correo_canonico text COLLATE correo_001 GENERATED ALWAYS AS (lower(correo COLLATE correo_001)) STORED NOT NULL,
        nombre_mostrar text NOT NULL CHECK (char_length(nombre_mostrar) BETWEEN 1 AND 200),
        contrasena_hash text NOT NULL CHECK (contrasena_hash LIKE '$argon2id$%'),
        version_credencial bigint NOT NULL DEFAULT 1 CHECK (version_credencial > 0),
        telefono text CHECK (char_length(telefono) <= 32), distrito text CHECK (char_length(distrito) <= 100), fotografia_id uuid,
        politica_privacidad_version text NOT NULL CHECK (char_length(politica_privacidad_version) > 0), privacidad_aceptada_en timestamptz NOT NULL,
        fallos_consecutivos integer NOT NULL DEFAULT 0 CHECK (fallos_consecutivos >= 0), bloqueada_hasta timestamptz,
        version bigint NOT NULL DEFAULT 1 CHECK (version > 0), creada_en timestamptz NOT NULL DEFAULT clock_timestamp(), actualizada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
        CONSTRAINT uq_correo_canonico UNIQUE (correo_canonico)
      );
      CREATE TABLE perfiles_habilitados (
        usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        perfil text NOT NULL CHECK (perfil IN ('cliente','prestador')),
        habilitado_en timestamptz NOT NULL DEFAULT clock_timestamp(), confirmado_por_titular_en timestamptz NOT NULL,
        PRIMARY KEY (usuario_id,perfil)
      );
      CREATE FUNCTION verificar_perfiles_001() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE propietario uuid; cantidad integer;
      BEGIN
        IF TG_TABLE_NAME = 'usuarios' THEN propietario := NEW.id;
        ELSIF TG_OP = 'DELETE' THEN propietario := OLD.usuario_id;
        ELSE propietario := NEW.usuario_id; END IF;
        IF EXISTS(SELECT 1 FROM usuarios WHERE id=propietario) THEN
          SELECT count(*) INTO cantidad FROM perfiles_habilitados WHERE usuario_id=propietario;
          IF cantidad NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'Cantidad de perfiles inválida' USING ERRCODE='23514'; END IF;
        END IF;
        IF TG_TABLE_NAME = 'perfiles_habilitados' THEN
          IF TG_OP = 'UPDATE' THEN
            IF OLD.usuario_id <> NEW.usuario_id AND EXISTS(SELECT 1 FROM usuarios WHERE id=OLD.usuario_id) THEN
              SELECT count(*) INTO cantidad FROM perfiles_habilitados WHERE usuario_id=OLD.usuario_id;
              IF cantidad NOT BETWEEN 1 AND 2 THEN RAISE EXCEPTION 'Cantidad de perfiles inválida' USING ERRCODE='23514'; END IF;
            END IF;
          END IF;
        END IF;
        RETURN NULL;
      END $$;
      CREATE CONSTRAINT TRIGGER cuenta_perfiles_001 AFTER INSERT OR UPDATE ON usuarios DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_perfiles_001();
      CREATE CONSTRAINT TRIGGER perfiles_cuenta_001 AFTER INSERT OR UPDATE OR DELETE ON perfiles_habilitados DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verificar_perfiles_001();
      CREATE FUNCTION impedir_cambio_id_001() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.id <> OLD.id THEN RAISE EXCEPTION 'Identificador inmutable' USING ERRCODE='23514'; END IF; RETURN NEW;
      END $$;
      CREATE TRIGGER usuario_id_inmutable_001 BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION impedir_cambio_id_001();
    `);
  }
  async down(q: QueryRunner): Promise<void> { await q.query('DROP TABLE perfiles_habilitados; DROP TABLE usuarios; DROP FUNCTION verificar_perfiles_001(); DROP FUNCTION impedir_cambio_id_001(); DROP COLLATION correo_001'); }
}
