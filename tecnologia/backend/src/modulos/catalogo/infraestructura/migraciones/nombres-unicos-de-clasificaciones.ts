import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * INC-002-01: unicidad del nombre de una clasificación entre hermanas, incluidas las inactivas.
 *
 * - `catalogo_clave_nombre(text)` es la definición autoritativa de «nombre normalizado»: NFD, ñ distinta de n, sin marcas combinantes U+0300 a U+036F,
 *   espacios equivalentes (conjunto explícito) reducidos a uno, recortado y en minúsculas. Cuerpo SQL estándar (RETURN): se analiza al crearla, de modo que
 *   no depende de `search_path` ni de `standard_conforming_strings` al ejecutarse. Solo usa funciones de pg_catalog con volatilidad IMMUTABLE.
 * - `nombre_clave` es una columna GENERADA: ningún escritor (API, semilla, SQL directo) puede dejarla inconsistente.
 * - El índice único usa NULLS NOT DISTINCT para que las raíces (sin padre) compitan entre sí. Requiere PostgreSQL 15 o superior.
 * - Si ya existen duplicados, la migración se detiene SIN modificar datos y lista los identificadores. Nunca renombra ni borra filas.
 * - `nombre_normalizado` se conserva como dato heredado sin garantía de unicidad.
 */
const FUNCION = String.raw`CREATE FUNCTION catalogo_clave_nombre(nombre text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
RETURN pg_catalog.lower(pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.regexp_replace(pg_catalog.regexp_replace(
  normalize(nombre, NFD), '[Nn]\u0303', U&'\00F1', 'g'),
  '[\u0300-\u036f]', '', 'g'),
  '[\u0009-\u000d\u0020\u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+', ' ', 'g')) COLLATE "default");`;

const AUTOPRUEBA = String.raw`DO $autoprueba$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION 'INC-002-01 requiere PostgreSQL 15 o superior (NULLS NOT DISTINCT).';
  END IF;
  IF catalogo_clave_nombre(U&'  \00C1\00D1O  \00D1and\00FA ') IS DISTINCT FROM U&'a\00F1o \00F1andu' THEN
    RAISE EXCEPTION 'catalogo_clave_nombre no produce el resultado esperado en esta base (codificación o configuración regional).';
  END IF;
  IF catalogo_clave_nombre(U&'a\00F1o') = catalogo_clave_nombre('ano') THEN RAISE EXCEPTION 'La ñ debe distinguirse de la n.'; END IF;
  IF catalogo_clave_nombre(U&'A\00A0\2003B') IS DISTINCT FROM 'a b' THEN RAISE EXCEPTION 'Los espacios equivalentes no se reducen.'; END IF;
  IF catalogo_clave_nombre(U&'X\005E\0060\00A8\00B7') IS DISTINCT FROM U&'x\005E\0060\00A8\00B7' THEN RAISE EXCEPTION 'Los signos de espaciado (circunflejo, acento grave, diéresis y punto medio) deben conservarse.'; END IF;
END
$autoprueba$;`;

const COMPROBAR_DUPLICADOS = String.raw`DO $duplicados$
DECLARE detalle text;
BEGIN
  SELECT string_agg(format('padre=%s clave=%s ids=%s', coalesce(padre::text, 'raíz'), clave, ids), E'\n' ORDER BY clave)
    INTO detalle
  FROM (SELECT categoria_padre_id AS padre, catalogo_clave_nombre(nombre) AS clave, string_agg(id::text, ',' ORDER BY id) AS ids
        FROM catalogo_clasificaciones GROUP BY 1, 2 HAVING count(*) > 1) d;
  IF detalle IS NOT NULL THEN
    RAISE EXCEPTION 'INC-002-01: existen clasificaciones hermanas con el mismo nombre normalizado. La migración no modifica datos; renombre las filas por la API y repita.'
      USING DETAIL = detalle;
  END IF;
END
$duplicados$;`;

export class NombresUnicosDeClasificaciones1795000000009 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(FUNCION);
    await q.query(AUTOPRUEBA);
    await q.query(COMPROBAR_DUPLICADOS);
    await q.query(`ALTER TABLE catalogo_clasificaciones ADD COLUMN nombre_clave text GENERATED ALWAYS AS (catalogo_clave_nombre(nombre)) STORED NOT NULL;
      CREATE UNIQUE INDEX catalogo_clasificaciones_hermanas_clave ON catalogo_clasificaciones (categoria_padre_id, nombre_clave) NULLS NOT DISTINCT;
      COMMENT ON COLUMN catalogo_clasificaciones.nombre_clave IS 'Clave de unicidad entre hermanas (INC-002-01). Generada por catalogo_clave_nombre(nombre); no se escribe.';
      COMMENT ON COLUMN catalogo_clasificaciones.nombre_normalizado IS 'Dato heredado sin garantía de unicidad ni de criterio único de normalización. La unicidad usa nombre_clave.';`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX catalogo_clasificaciones_hermanas_clave; ALTER TABLE catalogo_clasificaciones DROP COLUMN nombre_clave; DROP FUNCTION catalogo_clave_nombre(text);');
  }
}
