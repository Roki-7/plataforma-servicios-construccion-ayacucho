import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cat, prest, serv } from '../../soporte/prestadores-catalogo/fixtures-hu05.js';
import { montarHu25, type EntornoHu25 } from '../../soporte/prestadores-catalogo/fixtures-hu25.js';
import { origenWeb002, type CuentaPrueba } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';

/**
 * T079 · Matriz EQ-04/PR04 sobre el monolito 002 con PostgreSQL real y sus rutas HTTP reales: cada intento no autorizado debe rechazarse (100 %), sin modificar ningún dato
 * (huella del contenido de todas las tablas antes y después de cada actor) y sin divulgar nada (el cuerpo es solo el error, sin nombres, recuentos, confirmaciones ni claves
 * de almacenamiento). La concesión operativa del permiso, las aprobaciones, las constancias y las carreras ya se verifican en `autorizacion-y-categorias.spec.ts` (T060 a T065):
 * aquí se cruzan los actores y las operaciones de forma conjunta y se cuenta el resultado.
 */
let e: EntornoHu25;
beforeAll(async () => { e = await montarHu25(); }, 180000);
afterAll(async () => { await e?.cerrar(); });

const operador = async (): Promise<CuentaPrueba> => { const c = await e.cuenta(); await e.habilitar(c); return c; };

/** Huella de contenido de todas las tablas públicas: cualquier fila alterada, añadida o borrada cambia el valor. */
async function huella(): Promise<Record<string, string>> {
  const tablas = ((await e.db.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1")) as { t: string }[]).map((x) => x.t);
  const salida: Record<string, string> = {};
  for (const t of tablas) {
    const f = ((await e.db.query(`SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text, ',' ORDER BY x::text), '')) AS h FROM "${t}" x`)) as { n: number; h: string }[])[0]!;
    salida[t] = `${f.n}|${f.h}`;
  }
  return salida;
}
const diferencias = (a: Record<string, string>, b: Record<string, string>): string[] => Object.keys({ ...a, ...b }).filter((t) => a[t] !== b[t]);

type Metodo = 'get' | 'post' | 'patch' | 'delete';
interface Intento { readonly nombre: string; readonly metodo: Metodo; readonly ruta: string; readonly cuerpo?: object; readonly escritura: boolean }
interface Resultado { actor: string; operacion: string; http: number; codigo: string; rechazado: boolean; sinDivulgacion: boolean }
const resultados: Resultado[] = []; const huellasPorActor: Record<string, { tablasAlteradas: string[] }> = {};

/** Ejecuta un intento con la identidad y el origen indicados (`origen: null` = sin cabecera Origin). */
async function lanzar(i: Intento, token: string | undefined, origen: string | null = origenWeb002) {
  const t = e.http[i.metodo](`/api/v1${i.ruta}`);
  if (token) t.set('Authorization', `Bearer ${token}`);
  if (i.escritura) { if (origen) t.set('Origin', origen); t.set('Idempotency-Key', randomUUID()); }
  return i.cuerpo ? t.send(i.cuerpo) : t;
}
/** Un rechazo no divulga: el cuerpo solo trae la forma del error, sin ningún dato protegido. */
function sinDivulgar(cuerpo: unknown, prohibidos: readonly string[]): boolean {
  const c = cuerpo as { codigo?: unknown; mensaje?: unknown; detalles?: unknown };
  const forma = Object.keys(c ?? {}).sort().join(',') === 'codigo,detalles,mensaje';
  const texto = JSON.stringify(cuerpo);
  return forma && !prohibidos.some((p) => texto.includes(p));
}

describe('EQ-04/PR04 · matriz de accesos no autorizados al canal interno de categorías', () => {
  test('visitante, sesión inválida, cuentas sin permiso, permiso revocado con sesión abierta, sesión cerrada y origen ajeno: 100 % rechazado, sin mutar ni divulgar', async () => {
    const autorizado = await operador();
    // Una confirmación vigente del operador: es el dato más sensible que un actor ajeno podría intentar usar.
    const vista = (await e.previsualizar(autorizado.token, cat.H1a, { version: 1 }).expect(201)).body as { confirmacionId: string; afectados: number };
    const nombres = ['Muros', 'Albañilería', 'Instalación', 'Acabados', 'Pintura', 'Obsoleta', 'Intrusa', 'Editada ajena'];
    const prohibidos = [vista.confirmacionId, 'confirmacionId', 'afectados', 'venceEn', 'activaPropia', 'activaEfectiva', 'categoriaPadreId', 'categorias', ...nombres, autorizado.cuentaId];
    const operaciones: Intento[] = [
      { nombre: 'listar', metodo: 'get', ruta: '/admin/categorias', escritura: false },
      { nombre: 'crear', metodo: 'post', ruta: '/admin/categorias', cuerpo: { nombre: 'Intrusa', motivo: 'Intento no autorizado' }, escritura: true },
      { nombre: 'editar', metodo: 'patch', ruta: `/admin/categorias/${cat.H1a}`, cuerpo: { version: 1, nombre: 'Editada ajena', motivo: 'Intento no autorizado' }, escritura: true },
      { nombre: 'previsualizar', metodo: 'post', ruta: `/admin/categorias/${cat.H1a}/previsualizaciones-desactivacion`, cuerpo: { version: 1 }, escritura: true },
      { nombre: 'desactivar', metodo: 'post', ruta: `/admin/categorias/${cat.H1a}/desactivaciones`, cuerpo: { confirmacionId: vista.confirmacionId, version: 1, motivo: 'Intento no autorizado' }, escritura: true },
      { nombre: 'activar', metodo: 'post', ruta: `/admin/categorias/${cat.R3}/activaciones`, cuerpo: { version: 1, motivo: 'Intento no autorizado' }, escritura: true },
    ];
    const cliente = await e.cuenta(); const revocado = await operador(); const cerrada = await operador();
    // Preparación del actor revocado: usó el canal con éxito, se le revoca el permiso y su sesión sigue abierta.
    await e.listar(revocado.token).expect(200); await e.revocar(revocado);
    // Preparación de la sesión cerrada: el operador autorizado cierra su sesión y reutiliza el token.
    await e.listar(cerrada.token).expect(200);
    await e.http.delete('/api/v1/sesiones/actual').set('Authorization', `Bearer ${cerrada.token}`).set('Origin', origenWeb002).expect(204);
    await expect(e.usuariosAcceso.exigir(cerrada.token)).rejects.toBeDefined();

    const actores: { nombre: string; token: string | undefined; origen?: string | null; http: number; codigo: string; soloEscrituras?: boolean }[] = [
      { nombre: 'visitante', token: undefined, http: 401, codigo: 'NO_AUTENTICADO' },
      { nombre: 'token-malformado', token: 'no.es.un-token', http: 401, codigo: 'NO_AUTENTICADO' },
      { nombre: 'cliente-sin-permiso', token: cliente.token, http: 403, codigo: 'SIN_PERMISO' },
      { nombre: 'prestador-titular', token: e.datos.titular.token, http: 403, codigo: 'SIN_PERMISO' },
      { nombre: 'prestador-ajeno', token: e.datos.otro.token, http: 403, codigo: 'SIN_PERMISO' },
      { nombre: 'permiso-revocado-con-sesion-abierta', token: revocado.token, http: 403, codigo: 'SIN_PERMISO' },
      { nombre: 'sesion-cerrada-del-operador', token: cerrada.token, http: 401, codigo: 'SESION_NO_VALIDA' },
      { nombre: 'operador-autorizado-con-origen-ajeno', token: autorizado.token, origen: 'https://ajeno.example.invalid', http: 403, codigo: 'ORIGEN_NO_PERMITIDO', soloEscrituras: true },
      { nombre: 'operador-autorizado-sin-origen', token: autorizado.token, origen: null, http: 400, codigo: 'DATOS_INVALIDOS', soloEscrituras: true },
    ];
    const fallos: string[] = [];
    for (const a of actores) {
      const antes = await huella();
      for (const op of operaciones.filter((o) => !a.soloEscrituras || o.escritura)) {
        const r = await lanzar(op, a.token, a.origen === undefined ? origenWeb002 : a.origen);
        const codigo = String((r.body as { codigo?: unknown }).codigo ?? '');
        const rechazado = r.status === a.http && (a.codigo === '' || codigo === a.codigo || a.nombre.startsWith('operador-autorizado'));
        const limpio = sinDivulgar(r.body, prohibidos);
        resultados.push({ actor: a.nombre, operacion: op.nombre, http: r.status, codigo, rechazado, sinDivulgacion: limpio });
        if (!rechazado || !limpio) fallos.push(`${a.nombre} · ${op.nombre}: ${r.status} ${codigo} ${JSON.stringify(r.body).slice(0, 160)}`);
      }
      // Cero mutaciones: ninguna tabla cambió con los intentos de este actor.
      const alteradas = diferencias(antes, await huella()); huellasPorActor[a.nombre] = { tablasAlteradas: alteradas };
      if (alteradas.length) fallos.push(`${a.nombre} alteró: ${alteradas.join(', ')}`);
    }
    expect(fallos).toEqual([]);
    // La confirmación del operador sigue siendo suya y utilizable: nada de lo anterior la consumió ni la divulgó.
    expect((await e.desactivar(autorizado.token, cat.H1a, { confirmacionId: vista.confirmacionId, version: 1, motivo: 'Confirmación propia' }).expect(200)).body).toMatchObject({ activaPropia: false });
    // Y el catálogo solo cambió por esa operación autorizada.
    expect(await e.filaCategoria(cat.H1a)).toMatchObject({ activa: false, version: 2 });
    expect(await e.filaCategoria(cat.R3)).toMatchObject({ activa: false, version: 1 });
  }, 240000);

  test('la revocación del permiso entre la vista previa y la confirmación rechaza la confirmación con la misma sesión y sin mutar; restituido, la confirmación se consume una sola vez', async () => {
    const o = await operador(); const vista = (await e.previsualizar(o.token, cat.H2a, { version: 1 }).expect(201)).body as { confirmacionId: string };
    await e.revocar(o);
    const antes = await huella();
    const r = await e.desactivar(o.token, cat.H2a, { confirmacionId: vista.confirmacionId, version: 1, motivo: 'Tras revocar' }).expect(403);
    expect(sinDivulgar(r.body, [vista.confirmacionId, 'Pintura'])).toBe(true); expect(r.body.codigo).toBe('SIN_PERMISO');
    expect(diferencias(antes, await huella())).toEqual([]); resultados.push({ actor: 'revocado-entre-vista-previa-y-confirmacion', operacion: 'desactivar', http: 403, codigo: 'SIN_PERMISO', rechazado: true, sinDivulgacion: true });
    // Con el permiso restituido, la misma sesión vuelve a operar. La confirmación anterior (misma cuenta, clasificación, versión y vigencia) se consume una sola vez.
    await e.habilitar(o);
    expect(await e.filaCategoria(cat.H2a)).toMatchObject({ activa: true });
    await e.desactivar(o.token, cat.H2a, { confirmacionId: vista.confirmacionId, version: 1, motivo: 'Con confirmación vigente' }).expect(200);
    expect((await e.desactivar(o.token, cat.H2a, { confirmacionId: vista.confirmacionId, version: 1, motivo: 'Reutilizada' }).expect(409)).body.codigo).toMatch(/CONFIRMACION_NO_VALIDA|VERSION_DESACTUALIZADA/);
  }, 120000);
});

describe('EQ-04/PR04 · servicios ajenos y recursos del catálogo', () => {
  test('visitante, cliente y prestador ajeno no leen ni modifican servicios del titular, y sus listados propios no incluyen los ajenos', async () => {
    const cliente = await e.cuenta(); const otro = e.datos.otro.token;
    const prohibidos = ['Ana Albañil', 'Muros de albañilería', 'Instalación eléctrica de Ana', 'Servicio pausado', e.datos.cuentaA];
    const ajenos: (Intento & { esperados: Record<string, number> })[] = [
      { nombre: 'servicios-propios', metodo: 'get', ruta: '/servicios/mios', escritura: false, esperados: { visitante: 401, cliente: 403 } },
      { nombre: 'editar-servicio-ajeno', metodo: 'patch', ruta: `/servicios/${serv.s1}`, cuerpo: { version: 1, titulo: 'Título ajeno' }, escritura: true, esperados: { visitante: 401, cliente: 403, ajeno: 404 } },
      { nombre: 'pausar-servicio-ajeno', metodo: 'post', ruta: `/servicios/${serv.s1}/transiciones`, cuerpo: { version: 1, destino: 'PAUSADO' }, escritura: true, esperados: { visitante: 401, cliente: 403, ajeno: 404 } },
      { nombre: 'retirar-servicio-ajeno', metodo: 'post', ruta: `/servicios/${serv.s3}/transiciones`, cuerpo: { version: 1, destino: 'RETIRADO' }, escritura: true, esperados: { visitante: 401, cliente: 403, ajeno: 404 } },
      { nombre: 'reactivar-servicio-ajeno-pausado', metodo: 'post', ruta: `/servicios/${serv.s2}/transiciones`, cuerpo: { version: 1, destino: 'PUBLICADO' }, escritura: true, esperados: { visitante: 401, cliente: 403, ajeno: 404 } },
    ];
    const antes = await huella(); const fallos: string[] = [];
    for (const [actor, token] of [['visitante', undefined], ['cliente', cliente.token], ['ajeno', otro]] as const) {
      for (const i of ajenos) {
        const r = await lanzar(i, token); const esperado = i.esperados[actor];
        if (esperado === undefined) { // el prestador ajeno consulta SU listado: nunca contiene servicios del titular
          const propios = (r.body as { elementos: { servicioId: string; prestadorId: string }[] }).elementos;
          if (r.status !== 200 || propios.some((x) => x.prestadorId !== prest.B)) fallos.push(`${actor} · ${i.nombre}: ${r.status} con servicios ajenos`);
          continue;
        }
        const limpio = sinDivulgar(r.body, prohibidos); const rechazado = r.status === esperado;
        resultados.push({ actor: `${actor}-servicios-ajenos`, operacion: i.nombre, http: r.status, codigo: String((r.body as { codigo?: unknown }).codigo ?? ''), rechazado, sinDivulgacion: limpio });
        if (!rechazado || !limpio) fallos.push(`${actor} · ${i.nombre}: ${r.status} (esperado ${esperado}) ${JSON.stringify(r.body).slice(0, 160)}`);
      }
    }
    expect(fallos).toEqual([]);
    expect(diferencias(antes, await huella())).toEqual([]);
    // El titular conserva sus servicios en los mismos estados y versiones.
    const mios = (await e.http.get('/api/v1/servicios/mios').set('Authorization', `Bearer ${e.datos.titular.token}`).expect(200)).body.elementos as { servicioId: string; estado: string; version: number }[];
    expect(mios.find((x) => x.servicioId === serv.s1)).toMatchObject({ estado: 'PUBLICADO', version: 1 }); expect(mios.find((x) => x.servicioId === serv.s2)).toMatchObject({ estado: 'PAUSADO', version: 1 });
  }, 120000);
});

afterAll(() => {
  const total = resultados.length; const rechazados = resultados.filter((r) => r.rechazado).length; const limpios = resultados.filter((r) => r.sinDivulgacion).length;
  const resumen = { intentos: total, rechazados, sinDivulgacion: limpios, porcentajeRechazado: total ? (100 * rechazados) / total : 0, tablasAlteradasPorActor: huellasPorActor, resultados };
  console.info(`PR04 · intentos no autorizados: ${total}, rechazados: ${rechazados}, sin divulgación: ${limpios}`);
  const destino = process.env['EVIDENCIA_JEST'];
  if (destino && total) { mkdirSync(destino, { recursive: true }); writeFileSync(resolve(destino, 'matriz-pr04-002.json'), JSON.stringify(resumen, null, 2), 'utf8'); }
});
