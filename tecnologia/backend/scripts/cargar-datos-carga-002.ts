import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import pg from 'pg';
import { cargaNominal002, generarCarga002, type ConfiguracionCarga002 } from '../test/soporte/prestadores-catalogo/carga.js';
import { local } from './entorno.js';
import { exigirBase002, leerConfiguracion002 } from './entorno-002.js';

/**
 * T081 · Vuelca el conjunto ficticio de carga (1 000 prestadores y 5 000 servicios, determinista por semilla) en la base DESCARTABLE `ayacucho_002_test_<id>` de una corrida
 * y escribe el manifiesto con los resultados esperados que usa k6. Nunca escribe en `ayacucho_002_validacion`: el nombre de la base se exige con el patrón de las
 * descartables y la conexión usa el mismo servidor local de la 002. Los datos se insertan en una sola transacción; si algo falla no queda nada.
 *   cargar-datos-carga-002 <id de 32 hexadecimales> --salida=<manifiesto.json> [--semilla=N] [--prestadores=N] [--servicios=N]
 */
const id = process.argv[2] ?? '';
const opcion = (nombre: string) => process.argv.find((a) => a.startsWith(`--${nombre}=`))?.slice(nombre.length + 3);
const entero = (nombre: string, porDefecto: number): number => { const v = opcion(nombre); if (v === undefined) return porDefecto; const n = Number(v); if (!Number.isInteger(n) || n < 1) throw new Error(`--${nombre} debe ser un entero positivo.`); return n; };

async function ejecutar(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') throw new Error('No disponible en producción.');
  if (!/^[0-9a-f]{32}$/.test(id)) throw new Error('Uso: cargar-datos-carga-002 <id de 32 hexadecimales> --salida=<manifiesto.json>');
  const salida = opcion('salida'); if (!salida) throw new Error('Falta --salida=<manifiesto.json>.');
  const destino = resolve(salida); const d = relative(resolve(local, 'evidencia/002'), destino);
  if (isAbsolute(d) || d === '..' || d.startsWith(`..${sep}`)) throw new Error('El manifiesto debe escribirse dentro de tecnologia/.local/evidencia/002.');
  const configuracion: ConfiguracionCarga002 = { semilla: entero('semilla', cargaNominal002.semilla), prestadores: entero('prestadores', cargaNominal002.prestadores), servicios: entero('servicios', cargaNominal002.servicios), tamanoPagina: cargaNominal002.tamanoPagina };

  const base = await leerConfiguracion002(); const admin = exigirBase002(base['DATABASE_URL']);
  const nombreBase = `ayacucho_002_test_${id}`;
  if (!/^ayacucho_002_test_[0-9a-f]{32}$/.test(nombreBase) || nombreBase === 'ayacucho_002_validacion') throw new Error('Solo se carga en una base descartable de 002.');
  const url = new URL(admin.href); url.pathname = `/${nombreBase}`;
  const carga = generarCarga002(configuracion);
  const cliente = new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 10_000 }); await cliente.connect();
  try {
    await cliente.query('BEGIN');
    const raices = carga.categorias.filter((c) => c.nivel === 1); const hijas = carga.categorias.filter((c) => c.nivel === 2);
    for (const grupo of [raices, hijas]) {
      await cliente.query(`INSERT INTO catalogo_clasificaciones(id, nombre, nombre_normalizado, nivel, categoria_padre_id, activa)
        SELECT * FROM unnest($1::uuid[], $2::varchar[], $3::text[], $4::smallint[], $5::uuid[], $6::boolean[])`,
      [grupo.map((c) => c.id), grupo.map((c) => c.nombre), grupo.map((c) => c.nombre.toLowerCase()), grupo.map((c) => c.nivel), grupo.map((c) => c.padreId), grupo.map((c) => c.activa)]);
    }
    const p = carga.prestadores;
    await cliente.query(`INSERT INTO prestadores_perfiles(id, cuenta_id, nombre_publico, tipo, experiencia, disponibilidad_declarada, publicable)
      SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::varchar[], $4::text[], $5::varchar[], $6::boolean[], $7::boolean[])`,
    [p.map((x) => x.id), p.map((x) => x.cuentaId), p.map((x) => x.nombre), p.map((x) => x.tipo), p.map((x) => x.experiencia), p.map((x) => x.disponible), p.map((x) => x.publicable)]);
    const esp = p.flatMap((x) => x.especialidades.map((e) => [x.id, e] as const)); const zon = p.flatMap((x) => x.distritos.map((z) => [x.id, z] as const));
    await cliente.query('INSERT INTO prestadores_especialidades(prestador_id, categoria_id) SELECT * FROM unnest($1::uuid[], $2::uuid[])', [esp.map((e) => e[0]), esp.map((e) => e[1])]);
    await cliente.query('INSERT INTO prestadores_zonas(prestador_id, distrito_codigo) SELECT * FROM unnest($1::uuid[], $2::text[])', [zon.map((z) => z[0]), zon.map((z) => z[1])]);
    // Proyección de búsqueda: una fila por prestador (los arreglos se enlazan como texto con formato de arreglo PostgreSQL, sin concatenar valores en el SQL).
    const literalUuid = (l: readonly string[]) => `{${l.join(',')}}`; const literalTexto = (l: readonly string[]) => `{${l.map((v) => `"${v}"`).join(',')}}`;
    await cliente.query(`INSERT INTO catalogo_proyeccion_prestadores(prestador_id, nombre_publico, tipo, disponibilidad_declarada, especialidades, distritos, publicable)
      SELECT a, b, c, d, e::uuid[], f::text[], g FROM unnest($1::uuid[], $2::varchar[], $3::text[], $4::boolean[], $5::text[], $6::text[], $7::boolean[]) AS t(a, b, c, d, e, f, g)`,
    [p.map((x) => x.id), p.map((x) => x.nombre), p.map((x) => x.tipo), p.map((x) => x.disponible), p.map((x) => literalUuid(x.especialidades)), p.map((x) => literalTexto(x.distritos)), p.map((x) => x.publicable)]);
    const s = carga.servicios;
    await cliente.query(`INSERT INTO catalogo_servicios(id, prestador_id, categoria_id, titulo, descripcion, estado)
      SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::varchar[], $5::varchar[], $6::text[])`,
    [s.map((x) => x.id), s.map((x) => x.prestadorId), s.map((x) => x.categoriaId), s.map((x) => x.titulo), s.map((x) => x.descripcion), s.map((x) => x.estado)]);
    const t = carga.trabajos;
    await cliente.query('INSERT INTO prestadores_trabajos(id, prestador_id, titulo, descripcion) SELECT * FROM unnest($1::uuid[], $2::uuid[], $3::varchar[], $4::varchar[])', [t.map((x) => x.id), t.map((x) => x.prestadorId), t.map((x) => x.titulo), t.map((x) => x.descripcion)]);
    const cuenta = async (tabla: string): Promise<number> => Number(((await cliente.query(`SELECT count(*)::int AS n FROM ${tabla}`)).rows[0] as { n: number }).n);
    const conteos = { prestadores: await cuenta('prestadores_perfiles'), proyeccion: await cuenta('catalogo_proyeccion_prestadores'), servicios: await cuenta('catalogo_servicios'), trabajos: await cuenta('prestadores_trabajos') };
    if (conteos.prestadores !== configuracion.prestadores || conteos.proyeccion !== configuracion.prestadores || conteos.servicios !== configuracion.servicios) throw new Error(`Los conteos cargados no son los previstos: ${JSON.stringify(conteos)}.`);
    await cliente.query('COMMIT');
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, JSON.stringify(carga.manifiesto), 'utf8');
    process.stdout.write(`${JSON.stringify({ base: nombreBase, semilla: configuracion.semilla, ...conteos, categoriasDeCarga: carga.categorias.length, serviciosVisibles: carga.manifiesto.conteos.serviciosVisibles })}\n`);
  } catch (error) { await cliente.query('ROLLBACK').catch(() => undefined); throw error; } finally { await cliente.end(); }
}
ejecutar().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : 'No se pudo cargar el conjunto de carga.'}\n`); process.exitCode = 1; });
