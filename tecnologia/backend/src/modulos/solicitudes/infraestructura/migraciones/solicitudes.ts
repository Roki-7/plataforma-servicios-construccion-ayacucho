import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración 1796000000001 · Solicitudes (data-model.md §2). Segunda barrera de las reglas de negocio: la aplicación valida primero y estas restricciones
 * y disparadores garantizan que ninguna escritura incorrecta, ni siquiera concurrente, quede persistida. Todas las referencias entre módulos son
 * identificadores sin clave foránea; las claves foráneas solo existen entre tablas de Solicitudes. Es reversible.
 *
 * Los nombres de las restricciones de los contadores (`solicitudes_archivos_cantidad_rango` y `solicitudes_archivos_bytes_rango`) son contrato: el dominio
 * (`restriccionesDeContadores`) los usa para traducir el 23514 a `LIMITE_ARCHIVOS`.
 */
export class Solicitudes1796000000001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
    CREATE TABLE solicitudes (
      id uuid PRIMARY KEY,
      cliente_cuenta_id uuid NOT NULL,
      tipo text NOT NULL,
      estado text NOT NULL,
      prestador_id uuid, prestador_cuenta_id uuid,
      servicio_id uuid, servicio_titulo varchar(120), servicio_categoria_id uuid,
      descripcion varchar(2000), medidas varchar(500),
      categoria_id uuid, distrito_codigo text,
      fecha_desde date, fecha_hasta date,
      compartir_fotografias boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1,
      version_trabajo integer NOT NULL DEFAULT 0,
      archivos_cantidad smallint NOT NULL DEFAULT 0,
      archivos_bytes bigint NOT NULL DEFAULT 0,
      creada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      actualizada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      publicada_en timestamptz, cerrada_en timestamptz,
      CONSTRAINT solicitudes_tipo_dominio CHECK (tipo IN ('DIRIGIDA','PUBLICADA')),
      CONSTRAINT solicitudes_estado_dominio CHECK (estado IN ('BORRADOR','ABIERTA','CERRADA')),
      CONSTRAINT solicitudes_distrito_dominio CHECK (distrito_codigo IS NULL OR distrito_codigo IN ('ayacucho','carmen-alto','san-juan-bautista','jesus-nazareno','andres-avelino-caceres-dorregaray')),
      CONSTRAINT solicitudes_version_minima CHECK (version >= 1 AND version_trabajo >= 0),
      CONSTRAINT solicitudes_publicacion_y_version_trabajo CHECK ((publicada_en IS NOT NULL) = (version_trabajo >= 1)),
      CONSTRAINT solicitudes_abierta_publicada CHECK (estado <> 'ABIERTA' OR publicada_en IS NOT NULL),
      CONSTRAINT solicitudes_publicada_completa CHECK (publicada_en IS NULL OR (descripcion IS NOT NULL AND categoria_id IS NOT NULL AND distrito_codigo IS NOT NULL AND fecha_desde IS NOT NULL)),
      CONSTRAINT solicitudes_fechas_coherentes CHECK (fecha_hasta IS NULL OR (fecha_desde IS NOT NULL AND fecha_hasta >= fecha_desde)),
      CONSTRAINT solicitudes_publicada_sin_destinatario CHECK (tipo <> 'PUBLICADA' OR (prestador_id IS NULL AND prestador_cuenta_id IS NULL AND servicio_id IS NULL)),
      CONSTRAINT solicitudes_dirigida_con_destinatario CHECK (tipo <> 'DIRIGIDA' OR publicada_en IS NULL OR (prestador_id IS NOT NULL AND prestador_cuenta_id IS NOT NULL)),
      CONSTRAINT solicitudes_sin_autodireccion CHECK (prestador_cuenta_id IS NULL OR prestador_cuenta_id <> cliente_cuenta_id),
      CONSTRAINT solicitudes_servicio_completo CHECK (servicio_id IS NULL OR (tipo = 'DIRIGIDA' AND prestador_id IS NOT NULL AND servicio_titulo IS NOT NULL
        AND servicio_categoria_id IS NOT NULL AND categoria_id = servicio_categoria_id)),
      CONSTRAINT solicitudes_cierre_coherente CHECK ((estado = 'CERRADA') = (cerrada_en IS NOT NULL)),
      CONSTRAINT solicitudes_archivos_cantidad_rango CHECK (archivos_cantidad BETWEEN 0 AND 5),
      CONSTRAINT solicitudes_archivos_bytes_rango CHECK (archivos_bytes BETWEEN 0 AND 30000000)
    );
    CREATE INDEX solicitudes_por_cliente ON solicitudes (cliente_cuenta_id, estado, actualizada_en DESC, id);
    CREATE INDEX solicitudes_oportunidades ON solicitudes (categoria_id, distrito_codigo, publicada_en DESC, id) WHERE tipo = 'PUBLICADA' AND estado = 'ABIERTA';
    CREATE INDEX solicitudes_dirigidas_abiertas ON solicitudes (prestador_id, publicada_en DESC, id) WHERE tipo = 'DIRIGIDA' AND estado = 'ABIERTA';
    CREATE INDEX solicitudes_dirigidas_del_prestador ON solicitudes (prestador_cuenta_id, actualizada_en DESC, id) WHERE tipo = 'DIRIGIDA' AND estado <> 'BORRADOR';

    -- 1. Inmutabilidad tras publicar, no retroceso de versiones y transiciones de estado. 2. Terminalidad de CERRADA salvo los contadores.
    CREATE FUNCTION solicitudes_proteger_cambios() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.cliente_cuenta_id IS DISTINCT FROM OLD.cliente_cuenta_id OR NEW.creada_en IS DISTINCT FROM OLD.creada_en THEN
        RAISE EXCEPTION 'La identidad de una solicitud no cambia' USING ERRCODE = '23514';
      END IF;
      IF OLD.estado = 'CERRADA' THEN
        IF (to_jsonb(NEW) - 'archivos_cantidad' - 'archivos_bytes') IS DISTINCT FROM (to_jsonb(OLD) - 'archivos_cantidad' - 'archivos_bytes') THEN
          RAISE EXCEPTION 'Una solicitud cerrada es de solo lectura' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END IF;
      IF OLD.estado = 'ABIERTA' AND NEW.estado = 'BORRADOR' THEN
        RAISE EXCEPTION 'Una solicitud publicada no vuelve a borrador' USING ERRCODE = '23514';
      END IF;
      IF NEW.version < OLD.version OR NEW.version_trabajo < OLD.version_trabajo THEN
        RAISE EXCEPTION 'Las versiones de una solicitud no retroceden' USING ERRCODE = '23514';
      END IF;
      IF OLD.publicada_en IS NOT NULL AND (NEW.publicada_en IS DISTINCT FROM OLD.publicada_en OR NEW.tipo IS DISTINCT FROM OLD.tipo
          OR NEW.prestador_id IS DISTINCT FROM OLD.prestador_id OR NEW.prestador_cuenta_id IS DISTINCT FROM OLD.prestador_cuenta_id
          OR NEW.servicio_id IS DISTINCT FROM OLD.servicio_id OR NEW.servicio_titulo IS DISTINCT FROM OLD.servicio_titulo
          OR NEW.servicio_categoria_id IS DISTINCT FROM OLD.servicio_categoria_id) THEN
        RAISE EXCEPTION 'Estos datos no cambian después de publicar' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER solicitudes_proteger BEFORE UPDATE ON solicitudes FOR EACH ROW EXECUTE FUNCTION solicitudes_proteger_cambios();

    -- 3. Sin borrado.
    CREATE FUNCTION solicitudes_sin_borrado() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN RAISE EXCEPTION 'Las solicitudes y su historial no se eliminan ni se modifican' USING ERRCODE = '23514'; END;
    $fn$;
    CREATE TRIGGER solicitudes_conservadas BEFORE DELETE ON solicitudes FOR EACH ROW EXECUTE FUNCTION solicitudes_sin_borrado();

    CREATE TABLE solicitudes_versiones (
      solicitud_id uuid NOT NULL REFERENCES solicitudes(id),
      numero integer NOT NULL,
      descripcion varchar(2000) NOT NULL, medidas varchar(500),
      categoria_id uuid NOT NULL,
      distrito_codigo text NOT NULL,
      fecha_desde date NOT NULL, fecha_hasta date,
      archivos jsonb NOT NULL DEFAULT '[]'::jsonb,
      creada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      creada_por_cuenta_id uuid NOT NULL,
      PRIMARY KEY (solicitud_id, numero),
      CONSTRAINT solicitudes_versiones_numero CHECK (numero >= 1),
      CONSTRAINT solicitudes_versiones_distrito CHECK (distrito_codigo IN ('ayacucho','carmen-alto','san-juan-bautista','jesus-nazareno','andres-avelino-caceres-dorregaray')),
      CONSTRAINT solicitudes_versiones_fechas CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde),
      CONSTRAINT solicitudes_versiones_archivos CHECK (jsonb_typeof(archivos) = 'array')
    );
    CREATE FUNCTION solicitudes_versiones_consecutiva() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW.numero <> COALESCE((SELECT max(numero) FROM solicitudes_versiones WHERE solicitud_id = NEW.solicitud_id), 0) + 1 THEN
        RAISE EXCEPTION 'Las versiones de trabajo son consecutivas desde 1' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER solicitudes_versiones_orden BEFORE INSERT ON solicitudes_versiones FOR EACH ROW EXECUTE FUNCTION solicitudes_versiones_consecutiva();
    CREATE TRIGGER solicitudes_versiones_inmutables BEFORE UPDATE OR DELETE ON solicitudes_versiones FOR EACH ROW EXECUTE FUNCTION solicitudes_sin_borrado();

    CREATE TABLE solicitudes_bitacora (
      id uuid PRIMARY KEY,
      solicitud_id uuid NOT NULL REFERENCES solicitudes(id),
      ocurrida_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      actor_cuenta_id uuid NOT NULL,
      tipo text NOT NULL,
      version integer NOT NULL, version_trabajo integer NOT NULL,
      campos_cambiados text[] NOT NULL DEFAULT '{}',
      CONSTRAINT solicitudes_bitacora_tipo CHECK (tipo IN ('CREADA','BORRADOR_EDITADO','PUBLICADA','EDITADA','PRIVACIDAD_CAMBIADA','CERRADA'))
    );
    CREATE INDEX solicitudes_bitacora_por_solicitud ON solicitudes_bitacora (solicitud_id, ocurrida_en, id);
    CREATE TRIGGER solicitudes_bitacora_inmutable BEFORE UPDATE OR DELETE ON solicitudes_bitacora FOR EACH ROW EXECUTE FUNCTION solicitudes_sin_borrado();

    CREATE TABLE solicitudes_archivos (
      id uuid PRIMARY KEY,
      solicitud_id uuid NOT NULL REFERENCES solicitudes(id),
      estado text NOT NULL,
      objeto_clave text NOT NULL,
      mime text NOT NULL, bytes integer NOT NULL, ancho smallint NOT NULL, alto smallint NOT NULL, checksum bytea NOT NULL,
      creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      caduca_en timestamptz, confirmado_en timestamptz, retirado_en timestamptz,
      CONSTRAINT solicitudes_archivos_estado CHECK (estado IN ('PREPARANDO','PREPARADO','CONFIRMADO','DESCARTADO','ELIMINADO')),
      CONSTRAINT solicitudes_archivos_clave_unica UNIQUE (objeto_clave),
      CONSTRAINT solicitudes_archivos_clave_forma CHECK (
        objeto_clave = 'solicitudes/' || solicitud_id::text || '/' || id::text
        OR (objeto_clave ~ '^pruebas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/solicitudes/[0-9a-f-]{36}/[0-9a-f-]{36}$'
            AND right(objeto_clave, 73) = solicitud_id::text || '/' || id::text)),
      CONSTRAINT solicitudes_archivos_imagen CHECK (mime = 'image/webp' AND bytes > 0 AND bytes <= 10000000 AND ancho BETWEEN 1 AND 1600 AND alto BETWEEN 1 AND 1600 AND octet_length(checksum) = 32),
      CONSTRAINT solicitudes_archivos_caducidad CHECK (estado NOT IN ('PREPARANDO','PREPARADO') OR caduca_en IS NOT NULL),
      CONSTRAINT solicitudes_archivos_confirmacion CHECK (estado <> 'CONFIRMADO' OR confirmado_en IS NOT NULL),
      CONSTRAINT solicitudes_archivos_retiro CHECK (estado NOT IN ('DESCARTADO','ELIMINADO') OR retirado_en IS NOT NULL)
    );
    CREATE INDEX solicitudes_archivos_por_solicitud ON solicitudes_archivos (solicitud_id, estado, id);
    CREATE INDEX solicitudes_archivos_por_caducar ON solicitudes_archivos (caduca_en) WHERE estado IN ('PREPARANDO','PREPARADO');

    CREATE FUNCTION solicitudes_archivos_proteger() RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.solicitud_id IS DISTINCT FROM OLD.solicitud_id OR NEW.objeto_clave IS DISTINCT FROM OLD.objeto_clave
         OR NEW.mime IS DISTINCT FROM OLD.mime OR NEW.checksum IS DISTINCT FROM OLD.checksum THEN
        RAISE EXCEPTION 'La identidad y el contenido de un archivo no cambian' USING ERRCODE = '23514';
      END IF;
      IF NEW.estado <> OLD.estado AND NOT ((OLD.estado, NEW.estado) IN (('PREPARANDO','PREPARADO'),('PREPARANDO','DESCARTADO'),('PREPARADO','CONFIRMADO'),
          ('PREPARADO','DESCARTADO'),('CONFIRMADO','ELIMINADO'))) THEN
        RAISE EXCEPTION 'Transición de archivo no válida' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $fn$;
    CREATE TRIGGER solicitudes_archivos_proteger BEFORE UPDATE ON solicitudes_archivos FOR EACH ROW EXECUTE FUNCTION solicitudes_archivos_proteger();

    -- Único escritor de los contadores de la solicitud. Suma al entrar en un estado que cuenta para el cupo y resta al salir. La fila de la solicitud queda
    -- bloqueada por el UPDATE, así que las cargas simultáneas se serializan y el CHECK de los contadores rechaza el exceso (23514) aun si la aplicación fallara.
    CREATE FUNCTION solicitudes_archivos_contadores() RETURNS trigger LANGUAGE plpgsql AS $fn$
    DECLARE
      dc integer := 0; db bigint := 0; destino uuid;
    BEGIN
      IF TG_OP IN ('INSERT','UPDATE') AND NEW.estado IN ('PREPARANDO','PREPARADO','CONFIRMADO') THEN dc := dc + 1; db := db + NEW.bytes; END IF;
      IF TG_OP IN ('UPDATE','DELETE') AND OLD.estado IN ('PREPARANDO','PREPARADO','CONFIRMADO') THEN dc := dc - 1; db := db - OLD.bytes; END IF;
      destino := CASE WHEN TG_OP = 'DELETE' THEN OLD.solicitud_id ELSE NEW.solicitud_id END;
      IF dc <> 0 OR db <> 0 THEN
        UPDATE solicitudes SET archivos_cantidad = archivos_cantidad + dc, archivos_bytes = archivos_bytes + db WHERE id = destino;
      END IF;
      RETURN NULL;
    END;
    $fn$;
    CREATE TRIGGER solicitudes_archivos_contadores AFTER INSERT OR UPDATE OR DELETE ON solicitudes_archivos FOR EACH ROW EXECUTE FUNCTION solicitudes_archivos_contadores();

    CREATE TABLE solicitudes_objetos_pendientes (
      clave text PRIMARY KEY,
      tipo text NOT NULL,
      solicitud_id uuid NOT NULL,
      proxima_ejecucion timestamptz NOT NULL,
      arrendado_hasta timestamptz,
      intentos integer NOT NULL DEFAULT 0,
      ultimo_intento_en timestamptz,
      ultimo_error text,
      creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT solicitudes_objetos_pendientes_tipo CHECK (tipo IN ('PREPARACION','PURGA')),
      CONSTRAINT solicitudes_objetos_pendientes_clave CHECK (clave ~ '^(?:pruebas/[0-9a-f-]{36}/)?solicitudes/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
      CONSTRAINT solicitudes_objetos_pendientes_intentos CHECK (intentos >= 0),
      CONSTRAINT solicitudes_objetos_pendientes_error CHECK (ultimo_error IS NULL OR ultimo_error ~ '^[A-Z0-9_]{1,60}$')
    );
    CREATE INDEX solicitudes_objetos_pendientes_proxima ON solicitudes_objetos_pendientes (proxima_ejecucion);`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
    DROP TABLE solicitudes_objetos_pendientes;
    DROP TABLE solicitudes_archivos;
    DROP TABLE solicitudes_bitacora;
    DROP TABLE solicitudes_versiones;
    DROP TABLE solicitudes;
    DROP FUNCTION solicitudes_archivos_contadores();
    DROP FUNCTION solicitudes_archivos_proteger();
    DROP FUNCTION solicitudes_versiones_consecutiva();
    DROP FUNCTION solicitudes_sin_borrado();
    DROP FUNCTION solicitudes_proteger_cambios();`);
  }
}
