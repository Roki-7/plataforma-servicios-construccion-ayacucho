import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Permiso RF39 persistente, constancias de identidad, aprobaciones firmadas de un solo uso y auditoría de solo adición. */
export class PermisosYAuditoria1795000000007 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
    CREATE TABLE administracion_permisos (
      cuenta_id uuid NOT NULL, permiso text NOT NULL CHECK (permiso = 'RF39_CATEGORIAS'),
      estado text NOT NULL CHECK (estado IN ('VIGENTE','REVOCADO')), version integer NOT NULL DEFAULT 1 CHECK (version > 0),
      concedido_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, revocado_en timestamptz,
      PRIMARY KEY (cuenta_id, permiso),
      CHECK ((estado = 'REVOCADO') = (revocado_en IS NOT NULL))
    );
    CREATE TABLE administracion_constancias (
      id uuid PRIMARY KEY, cuenta_id uuid NOT NULL, entorno text NOT NULL CHECK (btrim(entorno) <> ''),
      creada_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, vence_en timestamptz NOT NULL, consumida_en timestamptz,
      CHECK (vence_en > creada_en)
    );
    CREATE TABLE administracion_aprobaciones (
      id uuid PRIMARY KEY, firmante text NOT NULL, ejecutor text NOT NULL, accion text NOT NULL CHECK (accion IN ('CONCEDER','REVOCAR')),
      cuenta_id uuid NOT NULL, entorno text NOT NULL, emitida_en timestamptz NOT NULL, vence_en timestamptz NOT NULL,
      motivo varchar(500) NOT NULL CHECK (btrim(motivo) <> ''), constancia_id uuid REFERENCES administracion_constancias(id),
      consumida_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK ((accion = 'CONCEDER') = (constancia_id IS NOT NULL)), CHECK (firmante <> ejecutor)
    );
    CREATE UNIQUE INDEX administracion_aprobaciones_constancia ON administracion_aprobaciones (constancia_id) WHERE constancia_id IS NOT NULL;
    CREATE TABLE administracion_auditoria (
      id uuid PRIMARY KEY, responsable text NOT NULL CHECK (btrim(responsable) <> ''), aprobacion_id uuid REFERENCES administracion_aprobaciones(id),
      ocurrio_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, accion text NOT NULL CHECK (btrim(accion) <> ''),
      recurso_tipo text NOT NULL CHECK (btrim(recurso_tipo) <> ''), recurso_id text NOT NULL CHECK (btrim(recurso_id) <> ''),
      motivo varchar(500) NOT NULL CHECK (btrim(motivo) <> '')
    );
    CREATE INDEX administracion_auditoria_recurso ON administracion_auditoria (recurso_tipo, recurso_id, ocurrio_en);
    CREATE FUNCTION administracion_auditoria_solo_adicion() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'La auditoría es de solo adición' USING ERRCODE = '23514'; END; $$;
    CREATE TRIGGER administracion_auditoria_inmutable BEFORE UPDATE OR DELETE ON administracion_auditoria
    FOR EACH ROW EXECUTE FUNCTION administracion_auditoria_solo_adicion();
    CREATE TRIGGER administracion_auditoria_sin_truncar BEFORE TRUNCATE ON administracion_auditoria
    FOR EACH STATEMENT EXECUTE FUNCTION administracion_auditoria_solo_adicion();`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE administracion_auditoria; DROP FUNCTION administracion_auditoria_solo_adicion();
      DROP TABLE administracion_aprobaciones; DROP TABLE administracion_constancias; DROP TABLE administracion_permisos;`);
  }
}
