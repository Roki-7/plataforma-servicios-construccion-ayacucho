import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración 1796000000002 · Cotizaciones (data-model.md §3). Segunda barrera de las reglas de negocio. Sin claves foráneas hacia otros módulos: `solicitud_id`,
 * `prestador_id` y las cuentas son identificadores que la aplicación valida mediante las APIs públicas. Es reversible.
 *
 * Los nombres `cotizaciones_unica_no_retirada`, `cotizaciones_aclaraciones_numero_unico` y `cotizaciones_aclaraciones_numero_rango` son contrato: el dominio
 * (`restriccionesDeCotizaciones`) los usa para traducir 23505 y 23514 a `COTIZACION_EXISTENTE`, `CONFLICTO_CONCURRENTE` y `LIMITE_ACLARACIONES`.
 */
export class Cotizaciones1796000000002 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
    CREATE TABLE cotizaciones (
      id uuid PRIMARY KEY,
      solicitud_id uuid NOT NULL,
      prestador_id uuid NOT NULL,
      prestador_cuenta_id uuid NOT NULL,
      estado text NOT NULL,
      version integer NOT NULL DEFAULT 1,
      version_actual integer NOT NULL DEFAULT 1,
      creada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      retirada_en timestamptz,
      CONSTRAINT cotizaciones_estado_dominio CHECK (estado IN ('ACTIVA','RETIRADA')),
      CONSTRAINT cotizaciones_versiones_minimas CHECK (version >= 1 AND version_actual >= 1),
      CONSTRAINT cotizaciones_retiro_coherente CHECK ((estado = 'RETIRADA') = (retirada_en IS NOT NULL))
    );
    CREATE UNIQUE INDEX cotizaciones_unica_no_retirada ON cotizaciones (solicitud_id, prestador_id) WHERE estado <> 'RETIRADA';
    CREATE INDEX cotizaciones_por_prestador ON cotizaciones (prestador_id, creada_en DESC, id);
    CREATE INDEX cotizaciones_por_solicitud ON cotizaciones (solicitud_id, estado, creada_en, id);
    CREATE INDEX cotizaciones_autoria ON cotizaciones (prestador_cuenta_id, solicitud_id) WHERE estado <> 'RETIRADA';

    CREATE FUNCTION cotizaciones_proteger_cambios() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF OLD.estado = 'RETIRADA' THEN
        RAISE EXCEPTION 'Una cotización retirada es de solo lectura' USING ERRCODE = '23514';
      END IF;
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.solicitud_id IS DISTINCT FROM OLD.solicitud_id OR NEW.prestador_id IS DISTINCT FROM OLD.prestador_id
         OR NEW.prestador_cuenta_id IS DISTINCT FROM OLD.prestador_cuenta_id OR NEW.creada_en IS DISTINCT FROM OLD.creada_en THEN
        RAISE EXCEPTION 'La identidad de una cotización no cambia' USING ERRCODE = '23514';
      END IF;
      IF NEW.version < OLD.version OR NEW.version_actual < OLD.version_actual THEN
        RAISE EXCEPTION 'Las versiones de una cotización no retroceden' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER cotizaciones_proteger BEFORE UPDATE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION cotizaciones_proteger_cambios();

    CREATE FUNCTION cotizaciones_conservadas() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN RAISE EXCEPTION 'Las cotizaciones y su historial no se eliminan ni se modifican' USING ERRCODE = '23514'; END;
    $fn$;
    CREATE TRIGGER cotizaciones_sin_borrado BEFORE DELETE ON cotizaciones FOR EACH ROW EXECUTE FUNCTION cotizaciones_conservadas();

    CREATE TABLE cotizaciones_versiones (
      cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id),
      numero integer NOT NULL,
      version_trabajo_solicitud integer NOT NULL,
      tipo text NOT NULL,
      alcance varchar(2000) NOT NULL,
      exclusiones varchar(2000), materiales varchar(2000), mano_de_obra varchar(2000),
      precio_centimos bigint,
      forma_calculo varchar(1000),
      plazo_dias integer,
      vigente_hasta timestamptz NOT NULL,
      condiciones_pago varchar(1000),
      creada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY (cotizacion_id, numero),
      CONSTRAINT cotizaciones_versiones_numero CHECK (numero >= 1),
      CONSTRAINT cotizaciones_versiones_trabajo CHECK (version_trabajo_solicitud >= 1),
      CONSTRAINT cotizaciones_versiones_tipo CHECK (tipo IN ('ESTIMADA','DEFINITIVA')),
      CONSTRAINT cotizaciones_versiones_alcance CHECK (btrim(alcance) <> ''),
      CONSTRAINT cotizaciones_versiones_precio CHECK (precio_centimos IS NULL OR (precio_centimos > 0 AND precio_centimos <= 9007199254740991)),
      CONSTRAINT cotizaciones_versiones_plazo CHECK (plazo_dias IS NULL OR plazo_dias > 0),
      CONSTRAINT cotizaciones_versiones_estimada CHECK (tipo <> 'ESTIMADA' OR precio_centimos IS NOT NULL OR forma_calculo IS NOT NULL),
      CONSTRAINT cotizaciones_versiones_definitiva CHECK (tipo <> 'DEFINITIVA' OR (precio_centimos IS NOT NULL AND plazo_dias IS NOT NULL AND condiciones_pago IS NOT NULL))
    );
    CREATE FUNCTION cotizaciones_versiones_consecutiva() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW.numero <> COALESCE((SELECT max(numero) FROM cotizaciones_versiones WHERE cotizacion_id = NEW.cotizacion_id), 0) + 1 THEN
        RAISE EXCEPTION 'Las versiones de una cotización son consecutivas desde 1' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER cotizaciones_versiones_orden BEFORE INSERT ON cotizaciones_versiones FOR EACH ROW EXECUTE FUNCTION cotizaciones_versiones_consecutiva();
    CREATE TRIGGER cotizaciones_versiones_inmutables BEFORE UPDATE OR DELETE ON cotizaciones_versiones FOR EACH ROW EXECUTE FUNCTION cotizaciones_conservadas();

    CREATE TABLE cotizaciones_aclaraciones (
      id uuid PRIMARY KEY,
      cotizacion_id uuid NOT NULL REFERENCES cotizaciones(id),
      numero smallint NOT NULL,
      autor_cuenta_id uuid NOT NULL,
      autor_rol text NOT NULL,
      texto varchar(1000) NOT NULL,
      version_cotizacion integer NOT NULL,
      creada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT cotizaciones_aclaraciones_numero_rango CHECK (numero BETWEEN 1 AND 20),
      CONSTRAINT cotizaciones_aclaraciones_numero_unico UNIQUE (cotizacion_id, numero),
      CONSTRAINT cotizaciones_aclaraciones_rol CHECK (autor_rol IN ('CLIENTE','PRESTADOR')),
      CONSTRAINT cotizaciones_aclaraciones_texto CHECK (btrim(texto) <> ''),
      CONSTRAINT cotizaciones_aclaraciones_version CHECK (version_cotizacion >= 1)
    );
    CREATE TRIGGER cotizaciones_aclaraciones_inmutables BEFORE UPDATE OR DELETE ON cotizaciones_aclaraciones FOR EACH ROW EXECUTE FUNCTION cotizaciones_conservadas();`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
    DROP TABLE cotizaciones_aclaraciones;
    DROP TABLE cotizaciones_versiones;
    DROP TABLE cotizaciones;
    DROP FUNCTION cotizaciones_versiones_consecutiva();
    DROP FUNCTION cotizaciones_conservadas();
    DROP FUNCTION cotizaciones_proteger_cambios();`);
  }
}
