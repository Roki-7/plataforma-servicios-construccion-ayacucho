import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { crc32, deflateSync } from 'node:zlib';
import type { APIRequestContext, TestInfo } from '@playwright/test';
import { cabecerasEscritura, criterios, crearCuenta, expect, origenWeb, registrarEvidencia, test, type CuentaE2E } from './soporte.js';

/**
 * T079 · Gestión de RF39 por el canal interno real (API HTTPS autenticada del monolito, sin interfaz web propia) y matriz EQ-04/PR04 contra el monolito completo, con la CA 002,
 * una base descartable por corrida y el operador ficticio de esa base (E2E_OPERADOR_002). Se ejecuta en Chromium, Firefox y WebKit a 360, 768 y 1366 px; el navegador solo aporta el
 * cliente HTTP y la visibilidad pública (búsqueda, perfil y enlace directo). Cada operación del operador deja su registro en `administracion_auditoria`; el ejecutor exporta esa tabla por
 * corrida y `scripts/verificar-auditoria-002.mjs` la contrasta con los hechos `evidencia-ca-cat-*` que esta serie adjunta. Los casos que exigen la concesión o revocación firmadas del
 * permiso (comando interno del host) se verifican en `seguridad-end-to-end.spec.ts` y `autorizacion-y-categorias.spec.ts` (backend). Todos los datos son ficticios.
 */
interface Cat { categoriaId: string; categoriaPadreId: string | null; nombre: string; version: number; activaPropia: boolean; activaEfectiva: boolean }
interface Servicio { servicioId: string; prestadorId: string; titulo: string; estado: string; version: number }
interface ErrorApi { codigo: string; mensaje: string; detalles: unknown[] }
const sufijo = (): string => randomUUID().slice(0, 6);
const auth = (token: string) => ({ authorization: `Bearer ${token}` });
const admin = '/api/v1/admin/categorias';
/** Operaciones registradas por la prueba para el contraste con la auditoría exportada. */
interface Esperada { accion: string; recursoId: string; motivo: string }

async function sesionOperador(request: APIRequestContext): Promise<{ token: string }> {
  const { correo, contrasena } = JSON.parse(await readFile(process.env['E2E_OPERADOR_002']!, 'utf8')) as { correo: string; contrasena: string };
  const r = await request.post('/api/v1/sesiones', { headers: { origin: origenWeb }, data: { correo, contrasena } }); expect(r.status()).toBe(200);
  return { token: ((await r.json()) as { tokenAcceso: string }).tokenAcceso };
}
const escribir = (request: APIRequestContext, metodo: 'post' | 'patch', ruta: string, token: string, cuerpo: object) =>
  request[metodo](ruta, { headers: cabecerasEscritura(token), data: cuerpo });
async function listarAdmin(request: APIRequestContext, token: string): Promise<Cat[]> {
  const r = await request.get(admin, { headers: auth(token) }); expect(r.status()).toBe(200); return ((await r.json()) as { categorias: Cat[] }).categorias;
}
const publicas = async (request: APIRequestContext): Promise<string[]> => ((await (await request.get('/api/v1/categorias')).json()) as { categorias: { categoriaId: string }[] }).categorias.map((c) => c.categoriaId);
const titulosBusqueda = async (request: APIRequestContext, categoriaId: string): Promise<string[]> =>
  ((await (await request.get(`/api/v1/servicios?categoria=${categoriaId}&tamano=50`)).json()) as { elementos: { titulo: string }[] }).elementos.map((s) => s.titulo).sort();
async function prestador(request: APIRequestContext, especialidad: string, distritos = ['ayacucho']): Promise<CuentaE2E & { prestadorId: string }> {
  const cuenta = await crearCuenta(request, 'prestador', `Titular ficticio ${sufijo()}`);
  const r = await request.put('/api/v1/prestadores/perfil', { headers: cabecerasEscritura(cuenta.token), data: { version: 0, nombrePublico: `Maestro ficticio ${sufijo()}`, tipo: 'TECNICO', experiencia: 'Experiencia ficticia.', especialidadesIds: [especialidad], distritos, disponibilidadDeclarada: true } });
  expect(r.status()).toBe(201); return { ...cuenta, prestadorId: ((await r.json()) as { prestadorId: string }).prestadorId };
}
async function publicar(request: APIRequestContext, token: string, titulo: string, categoriaId: string): Promise<Servicio> {
  const r = await request.post('/api/v1/servicios', { headers: cabecerasEscritura(token), data: { titulo, descripcion: `Descripción ficticia de ${titulo}.`, categoriaId } }); expect(r.status()).toBe(201); return (await r.json()) as Servicio;
}
const error = async (r: { status(): number; json(): Promise<unknown> }, http: number, codigo: string): Promise<ErrorApi> => {
  const e = (await r.json()) as ErrorApi; expect([r.status(), e.codigo]).toEqual([http, codigo]); return e;
};
/** PNG ficticio de color liso (sin dependencias): suficiente para una fotografía de portafolio. */
function png(ancho: number, alto: number): Buffer {
  const trozo = (tipo: string, datos: Buffer) => { const t = Buffer.from(tipo, 'latin1'); const l = Buffer.alloc(4); l.writeUInt32BE(datos.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, datos])) >>> 0); return Buffer.concat([l, t, datos, c]); };
  const cab = Buffer.alloc(13); cab.writeUInt32BE(ancho, 0); cab.writeUInt32BE(alto, 4); cab[8] = 8; cab[9] = 2;
  const fila = Buffer.concat([Buffer.from([0]), Buffer.alloc(ancho * 3, 0x7a)]);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), trozo('IHDR', cab), trozo('IDAT', deflateSync(Buffer.concat(Array.from({ length: alto }, () => fila)))), trozo('IEND', Buffer.alloc(0))]);
}
const hechos = (testInfo: TestInfo, nombre: string, datos: object): Promise<void> => registrarEvidencia(testInfo, nombre, datos);

test.describe('HU25 · gestión de RF39 por el canal interno y matriz EQ-04/PR04', () => {
  test.describe.configure({ timeout: 240_000 });

  test('CA-CAT-01, CA-CAT-02, CA-CAT-06, CA-CAT-07, CA-CAT-08, CA-CAT-09 y CA-CAT-10: el operador crea, edita, activa y desactiva; la desactivación exige confirmación y todo queda auditado', async ({ request }, testInfo) => {
    criterios(testInfo, 'CA-CAT-01', 'CA-CAT-02', 'CA-CAT-06', 'CA-CAT-07', 'CA-CAT-08', 'CA-CAT-09', 'CA-CAT-10');
    const { token } = await sesionOperador(request); const esperadas: Esperada[] = []; const id = sufijo();

    // CA-CAT-01: una raíz y una subcategoría nacen inactivas; solo al activarlas aparecen en la consulta pública.
    const r1 = await escribir(request, 'post', admin, token, { nombre: `Raíz ficticia ${id}`, motivo: 'Alta de la raíz' }); expect(r1.status()).toBe(201);
    const raiz = (await r1.json()) as Cat; expect(raiz).toMatchObject({ categoriaPadreId: null, activaPropia: false, activaEfectiva: false, version: 1 }); esperadas.push({ accion: 'CATEGORIA_CREADA', recursoId: raiz.categoriaId, motivo: 'Alta de la raíz' });
    const r2 = await escribir(request, 'post', admin, token, { nombre: `Hija ficticia ${id}`, categoriaPadreId: raiz.categoriaId, motivo: 'Alta de la subcategoría' }); expect(r2.status()).toBe(201);
    const hija = (await r2.json()) as Cat; esperadas.push({ accion: 'CATEGORIA_CREADA', recursoId: hija.categoriaId, motivo: 'Alta de la subcategoría' });
    expect(await publicas(request)).not.toContain(raiz.categoriaId);
    const ed = await escribir(request, 'patch', `${admin}/${raiz.categoriaId}`, token, { version: 1, nombre: `Raíz ficticia ${id} (editada)`, motivo: 'Corrección del nombre' }); expect(ed.status()).toBe(200);
    expect(await ed.json()).toMatchObject({ nombre: `Raíz ficticia ${id} (editada)`, version: 2 }); esperadas.push({ accion: 'CATEGORIA_EDITADA', recursoId: raiz.categoriaId, motivo: 'Corrección del nombre' });
    const a1 = await escribir(request, 'post', `${admin}/${raiz.categoriaId}/activaciones`, token, { version: 2, motivo: 'Activación de la raíz' }); expect(a1.status()).toBe(200); const vRaiz = ((await a1.json()) as Cat).version; expect(vRaiz).toBe(3); esperadas.push({ accion: 'CATEGORIA_ACTIVADA', recursoId: raiz.categoriaId, motivo: 'Activación de la raíz' });
    const a2 = await escribir(request, 'post', `${admin}/${hija.categoriaId}/activaciones`, token, { version: 1, motivo: 'Activación de la subcategoría' }); expect(a2.status()).toBe(200); esperadas.push({ accion: 'CATEGORIA_ACTIVADA', recursoId: hija.categoriaId, motivo: 'Activación de la subcategoría' });
    expect(await publicas(request)).toEqual(expect.arrayContaining([raiz.categoriaId, hija.categoriaId]));

    // Oferta: un servicio publicado directo en la raíz, otro en la subcategoría y un tercero pausado.
    const titular = await prestador(request, raiz.categoriaId);
    const directo = await publicar(request, titular.token, `Servicio directo ${id}`, raiz.categoriaId); const enHija = await publicar(request, titular.token, `Servicio en subcategoría ${id}`, hija.categoriaId);
    const pausado = await publicar(request, titular.token, `Servicio pausado ${id}`, hija.categoriaId);
    expect((await request.post(`/api/v1/servicios/${pausado.servicioId}/transiciones`, { headers: cabecerasEscritura(titular.token), data: { version: 1, destino: 'PAUSADO' } })).status()).toBe(200);
    const visibles = [directo.titulo, enHija.titulo].sort();
    expect(await titulosBusqueda(request, raiz.categoriaId)).toEqual(visibles); // calienta la caché de búsqueda

    // CA-CAT-07: la vista previa informa el recuento (2 servicios que perderían visibilidad; el pausado no cuenta) y no cambia nada.
    const antesDeLaVista = JSON.stringify(await listarAdmin(request, token));
    const vista = await escribir(request, 'post', `${admin}/${raiz.categoriaId}/previsualizaciones-desactivacion`, token, { version: vRaiz }); expect(vista.status()).toBe(201);
    const v = (await vista.json()) as { afectados: number; confirmacionId: string; venceEn: string }; expect(v.afectados).toBe(2); expect(Date.parse(v.venceEn)).toBeGreaterThan(Date.now());
    expect(JSON.stringify(await listarAdmin(request, token))).toBe(antesDeLaVista);
    // Sin confirmación válida no se desactiva: falta de confirmación o de motivo (400), confirmación inexistente (409), versión vieja (409). Todo se conserva.
    const rechazos: Record<string, { http: number; codigo: string }> = {};
    const intentos: [string, object, number, string][] = [
      ['sinConfirmacion', { version: vRaiz, motivo: 'Sin confirmar' }, 400, 'DATOS_INVALIDOS'], ['sinMotivo', { confirmacionId: v.confirmacionId, version: vRaiz }, 400, 'DATOS_INVALIDOS'],
      ['confirmacionInexistente', { confirmacionId: randomUUID(), version: vRaiz, motivo: 'Inventada' }, 409, 'CONFIRMACION_NO_VALIDA'], ['versionVieja', { confirmacionId: v.confirmacionId, version: vRaiz - 1, motivo: 'Versión vieja' }, 409, 'VERSION_DESACTUALIZADA'],
    ];
    for (const [nombre, cuerpo, http, codigo] of intentos) { const r = await escribir(request, 'post', `${admin}/${raiz.categoriaId}/desactivaciones`, token, cuerpo); await error(r, http, codigo); rechazos[nombre] = { http, codigo }; }
    expect(JSON.stringify(await listarAdmin(request, token))).toBe(antesDeLaVista); expect(await titulosBusqueda(request, raiz.categoriaId)).toEqual(visibles); expect(await publicas(request)).toContain(raiz.categoriaId);

    // Confirmación: la clasificación y su oferta salen de lo público de inmediato (con la búsqueda ya calentada); los servicios conservan su estado.
    const des = await escribir(request, 'post', `${admin}/${raiz.categoriaId}/desactivaciones`, token, { confirmacionId: v.confirmacionId, version: vRaiz, motivo: 'Baja confirmada' }); expect(des.status()).toBe(200);
    expect(await des.json()).toMatchObject({ activaPropia: false, activaEfectiva: false, version: vRaiz + 1 }); esperadas.push({ accion: 'CATEGORIA_DESACTIVADA', recursoId: raiz.categoriaId, motivo: 'Baja confirmada' });
    expect(await publicas(request)).not.toContain(raiz.categoriaId); expect(await publicas(request)).not.toContain(hija.categoriaId);
    expect(await titulosBusqueda(request, raiz.categoriaId)).toEqual([]); expect(await titulosBusqueda(request, hija.categoriaId)).toEqual([]);
    for (const s of [directo, enHija]) expect((await request.get(`/api/v1/servicios/${s.servicioId}`)).status()).toBe(404);
    // CA-CAT-08: la subcategoría conserva su estado propio activo, pero queda efectivamente inactiva; sus servicios conservan sus estados.
    const trasBaja = await listarAdmin(request, token); expect(trasBaja.find((c) => c.categoriaId === hija.categoriaId)).toMatchObject({ activaPropia: true, activaEfectiva: false });
    const propios = ((await (await request.get('/api/v1/servicios/mios', { headers: auth(titular.token) })).json()) as { elementos: Servicio[] }).elementos;
    expect(propios.map((s) => [s.titulo, s.estado, s.version]).sort()).toEqual([[directo.titulo, 'PUBLICADO', 1], [enHija.titulo, 'PUBLICADO', 1], [pausado.titulo, 'PAUSADO', 2]].sort());
    // La confirmación ya consumida no sirve de nuevo.
    const repetida = await escribir(request, 'post', `${admin}/${raiz.categoriaId}/desactivaciones`, token, { confirmacionId: v.confirmacionId, version: vRaiz + 1, motivo: 'Repetida' }); const errRepetida = (await repetida.json()) as ErrorApi;
    expect(repetida.status(), JSON.stringify(errRepetida)).toBeGreaterThanOrEqual(400); expect(repetida.status()).toBeLessThan(500); rechazos['confirmacionYaConsumida'] = { http: repetida.status(), codigo: errRepetida.codigo };

    // CA-CAT-09: al reactivar la raíz, vuelven los publicados cuya clasificación efectiva está activa; el pausado conserva su exclusión.
    const re = await escribir(request, 'post', `${admin}/${raiz.categoriaId}/activaciones`, token, { version: vRaiz + 1, motivo: 'Reactivación' }); expect(re.status()).toBe(200); esperadas.push({ accion: 'CATEGORIA_ACTIVADA', recursoId: raiz.categoriaId, motivo: 'Reactivación' });
    expect(await titulosBusqueda(request, raiz.categoriaId)).toEqual(visibles); expect(await publicas(request)).toEqual(expect.arrayContaining([raiz.categoriaId, hija.categoriaId]));
    expect((await request.get(`/api/v1/servicios/${pausado.servicioId}`)).status()).toBe(404);
    await hechos(testInfo, 'ca-cat-01-02-06-07-08-09-10', {
      creacion: { raiz: 201, subcategoria: 201, nacenInactivas: true, publicasAntesDeActivar: false }, edicion: { version: 2 }, vistaPrevia: { afectados: v.afectados, venceEnElFuturo: true, sinCambios: true },
      desactivacionSinConfirmacionValida: rechazos, desactivacionConfirmada: { http: 200, version: vRaiz + 1, busquedaCalentadaOcultaDeInmediato: true, detalleDeLosServicios: 404, estadosConservados: ['PUBLICADO', 'PUBLICADO', 'PAUSADO'], subcategoria: { activaPropia: true, activaEfectiva: false } },
      reactivacion: { visibles: visibles.length, pausadoSigueExcluido: true }, auditoriaEsperada: esperadas,
    });
  });

  test('EQ-04/PR04: visitante, sesión inválida o cerrada, cuentas sin permiso y origen ajeno no gestionan categorías; ninguna petición muta ni divulga', async ({ request }, testInfo) => {
    criterios(testInfo, 'CA-CAT-03', 'CA-CAT-05');
    const { token } = await sesionOperador(request); const id = sufijo();
    const c = await (await escribir(request, 'post', admin, token, { nombre: `Protegida ${id}`, motivo: 'Alta protegida' })).json() as Cat;
    const act = await (await escribir(request, 'post', `${admin}/${c.categoriaId}/activaciones`, token, { version: 1, motivo: 'Activación protegida' })).json() as Cat;
    const cliente = await crearCuenta(request, 'cliente', 'Cliente ficticio'); const titular = await prestador(request, c.categoriaId); const ajeno = await prestador(request, c.categoriaId);
    const servicio = await publicar(request, titular.token, `Servicio protegido ${id}`, c.categoriaId);
    // La vista previa se toma con la oferta ya publicada: es la confirmación que un actor ajeno intentará usar.
    const vista = await (await escribir(request, 'post', `${admin}/${c.categoriaId}/previsualizaciones-desactivacion`, token, { version: act.version })).json() as { confirmacionId: string };
    // Un segundo inicio de sesión del operador, cerrado de inmediato: su token ya no debe servir.
    const segunda = await sesionOperador(request);
    const cierre = await request.delete('/api/v1/sesiones/actual', { headers: { ...auth(segunda.token), origin: origenWeb } }); expect(cierre.status()).toBe(204);

    const instantanea = async () => JSON.stringify({ admin: await listarAdmin(request, token), publicas: await publicas(request), busqueda: await titulosBusqueda(request, c.categoriaId), mios: ((await (await request.get('/api/v1/servicios/mios', { headers: auth(titular.token) })).json()) as { elementos: unknown[] }).elementos });
    const antes = await instantanea();
    const ops: { nombre: string; metodo: 'get' | 'post' | 'patch'; ruta: string; cuerpo?: object; escritura: boolean }[] = [
      { nombre: 'listar', metodo: 'get', ruta: admin, escritura: false },
      { nombre: 'crear', metodo: 'post', ruta: admin, cuerpo: { nombre: 'Intrusa', motivo: 'Intento no autorizado' }, escritura: true },
      { nombre: 'editar', metodo: 'patch', ruta: `${admin}/${c.categoriaId}`, cuerpo: { version: act.version, nombre: 'Editada ajena', motivo: 'Intento no autorizado' }, escritura: true },
      { nombre: 'previsualizar', metodo: 'post', ruta: `${admin}/${c.categoriaId}/previsualizaciones-desactivacion`, cuerpo: { version: act.version }, escritura: true },
      { nombre: 'desactivar', metodo: 'post', ruta: `${admin}/${c.categoriaId}/desactivaciones`, cuerpo: { confirmacionId: vista.confirmacionId, version: act.version, motivo: 'Intento no autorizado' }, escritura: true },
      { nombre: 'activar', metodo: 'post', ruta: `${admin}/${c.categoriaId}/activaciones`, cuerpo: { version: act.version, motivo: 'Intento no autorizado' }, escritura: true },
    ];
    const prohibidos = [vista.confirmacionId, c.nombre, 'Intrusa', 'Editada ajena', 'afectados', 'confirmacionId', 'venceEn', 'activaPropia', 'categoriaPadreId'];
    const actores: { nombre: string; token?: string; origen?: string | null; http: number; codigos: string[]; soloEscrituras?: boolean }[] = [
      { nombre: 'visitante', http: 401, codigos: ['NO_AUTENTICADO'] }, { nombre: 'token-malformado', token: 'no.es.un-token', http: 401, codigos: ['NO_AUTENTICADO', 'SESION_NO_VALIDA'] },
      { nombre: 'cliente-sin-permiso', token: cliente.token, http: 403, codigos: ['SIN_PERMISO'] }, { nombre: 'prestador-titular', token: titular.token, http: 403, codigos: ['SIN_PERMISO'] },
      { nombre: 'prestador-ajeno', token: ajeno.token, http: 403, codigos: ['SIN_PERMISO'] }, { nombre: 'sesion-cerrada-del-operador', token: segunda.token, http: 401, codigos: ['SESION_NO_VALIDA', 'NO_AUTENTICADO'] },
      { nombre: 'operador-con-origen-ajeno', token, origen: 'https://ajeno.example.invalid', http: 403, codigos: ['ORIGEN_NO_ADMITIDO'], soloEscrituras: true },
      { nombre: 'operador-sin-origen', token, origen: null, http: 400, codigos: ['CABECERA_REQUERIDA'], soloEscrituras: true },
    ];
    const resultados: { actor: string; operacion: string; http: number; codigo: string }[] = []; const fallos: string[] = [];
    for (const a of actores) {
      for (const op of ops.filter((o) => !a.soloEscrituras || o.escritura)) {
        const cab: Record<string, string> = {}; if (a.token) cab['authorization'] = `Bearer ${a.token}`;
        if (op.escritura) { if (a.origen !== null) cab['origin'] = a.origen ?? origenWeb; cab['idempotency-key'] = randomUUID(); }
        const r = await request.fetch(op.ruta, { method: op.metodo.toUpperCase(), headers: cab, ...(op.cuerpo ? { data: op.cuerpo } : {}) });
        const texto = await r.text(); let cuerpo: { codigo?: string } = {}; try { cuerpo = JSON.parse(texto) as { codigo?: string }; } catch { /* cuerpo no JSON */ }
        const forma = Object.keys(cuerpo).sort().join(',') === 'codigo,detalles,mensaje'; const fuga = prohibidos.filter((p) => texto.includes(p));
        resultados.push({ actor: a.nombre, operacion: op.nombre, http: r.status(), codigo: cuerpo.codigo ?? '' });
        if (r.status() !== a.http || !a.codigos.includes(cuerpo.codigo ?? '') || !forma || fuga.length) fallos.push(`${a.nombre} · ${op.nombre}: ${r.status()} ${texto.slice(0, 140)} fuga=${fuga.join('|')}`);
      }
    }
    expect(fallos).toEqual([]);
    // Cero mutaciones: el catálogo, la búsqueda y los servicios son idénticos y la confirmación del operador sigue siendo suya y vigente.
    expect(await instantanea()).toBe(antes);
    const ok = await escribir(request, 'post', `${admin}/${c.categoriaId}/desactivaciones`, token, { confirmacionId: vista.confirmacionId, version: act.version, motivo: 'Baja protegida' }); expect(ok.status(), await ok.text() + JSON.stringify({ vista, act })).toBe(200);
    const total = resultados.length; const rechazados = resultados.filter((r) => r.http >= 400 && r.http < 500).length; expect(rechazados).toBe(total);
    await hechos(testInfo, 'ca-cat-03-05-pr04-canal-interno', {
      intentos: total, rechazados, porcentajeRechazado: (100 * rechazados) / total, mutaciones: 0, divulgaciones: 0, servicioProtegido: { servicioId: servicio.servicioId, conservado: true },
      porActor: Object.fromEntries(actores.map((a) => [a.nombre, [...new Set(resultados.filter((r) => r.actor === a.nombre).map((r) => `${r.http} ${r.codigo}`))]])),
      auditoriaEsperada: [{ accion: 'CATEGORIA_CREADA', recursoId: c.categoriaId, motivo: 'Alta protegida' }, { accion: 'CATEGORIA_ACTIVADA', recursoId: c.categoriaId, motivo: 'Activación protegida' }, { accion: 'CATEGORIA_DESACTIVADA', recursoId: c.categoriaId, motivo: 'Baja protegida' }],
      noSeAuditaLoRechazado: 'Los intentos rechazados no generan registros: se comprueba en el contraste con la auditoría exportada.',
    });
  });

  test('EQ-04/PR04: URLs de recursos privados y operaciones sobre perfiles, trabajos, fotografías y servicios ajenos se rechazan sin mutar ni divulgar', async ({ request }, testInfo) => {
    criterios(testInfo, 'CA-CAT-03', 'CA-PRE-03', 'CA-SER-03');
    const { token } = await sesionOperador(request); const id = sufijo();
    const c = await (await escribir(request, 'post', admin, token, { nombre: `Privada ${id}`, motivo: 'Alta privada' })).json() as Cat;
    await escribir(request, 'post', `${admin}/${c.categoriaId}/activaciones`, token, { version: 1, motivo: 'Activación privada' });
    const titular = await prestador(request, c.categoriaId); const ajeno = await prestador(request, c.categoriaId); const cliente = await crearCuenta(request, 'cliente', 'Cliente ficticio');
    const servicio = await publicar(request, titular.token, `Servicio privado ${id}`, c.categoriaId);
    const t = await request.post('/api/v1/prestadores/perfil/trabajos', { headers: cabecerasEscritura(titular.token), data: { versionPerfil: 1, titulo: `Trabajo privado ${id}`, descripcion: 'Trabajo ficticio.' } }); expect(t.status()).toBe(201);
    const trabajo = (await t.json()) as { trabajo: { trabajoId: string; version: number } };
    const f = await request.post(`/api/v1/prestadores/perfil/trabajos/${trabajo.trabajo.trabajoId}/fotografias`, { headers: cabecerasEscritura(titular.token), data: { versionTrabajo: trabajo.trabajo.version, tipoMime: 'image/png', contenidoBase64: png(64, 48).toString('base64') } });
    expect(f.status(), await f.text()).toBe(201); const foto = (await f.json()) as { fotografia: { fotografiaId: string }; versionTrabajo?: number };
    const trabajoId = trabajo.trabajo.trabajoId; const fotoId = foto.fotografia.fotografiaId;
    const miPerfil = async () => (await request.get('/api/v1/prestadores/perfil', { headers: auth(titular.token) })).text();
    const estado = async () => JSON.stringify({ perfil: await miPerfil(), mios: await (await request.get('/api/v1/servicios/mios', { headers: auth(titular.token) })).text(), publico: await (await request.get(`/api/v1/prestadores/${titular.prestadorId}`)).text() });
    const antes = await estado();
    const prohibidos = [servicio.titulo, `Trabajo privado ${id}`, titular.correo, titular.correo.split('@')[0]!, titular.cuentaId, 'portafolio/', 'objeto', 'bucket', 'contenidoBase64'];
    const ops: { nombre: string; metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; ruta: string; cuerpo?: object; escritura: boolean; esperados: Record<string, number[]> }[] = [
      { nombre: 'perfil-privado', metodo: 'GET', ruta: '/api/v1/prestadores/perfil', escritura: false, esperados: { visitante: [401], cliente: [403, 404] } },
      { nombre: 'servicios-propios', metodo: 'GET', ruta: '/api/v1/servicios/mios', escritura: false, esperados: { visitante: [401], cliente: [403] } },
      { nombre: 'editar-servicio-ajeno', metodo: 'PATCH', ruta: `/api/v1/servicios/${servicio.servicioId}`, cuerpo: { version: 1, titulo: 'Título ajeno' }, escritura: true, esperados: { visitante: [401], cliente: [403], ajeno: [404] } },
      { nombre: 'retirar-servicio-ajeno', metodo: 'POST', ruta: `/api/v1/servicios/${servicio.servicioId}/transiciones`, cuerpo: { version: 1, destino: 'RETIRADO' }, escritura: true, esperados: { visitante: [401], cliente: [403], ajeno: [404] } },
      { nombre: 'editar-trabajo-ajeno', metodo: 'PATCH', ruta: `/api/v1/prestadores/perfil/trabajos/${trabajoId}`, cuerpo: { version: trabajo.trabajo.version, titulo: 'Trabajo ajeno' }, escritura: true, esperados: { visitante: [401], cliente: [403, 404], ajeno: [403, 404] } },
      { nombre: 'agregar-foto-a-trabajo-ajeno', metodo: 'POST', ruta: `/api/v1/prestadores/perfil/trabajos/${trabajoId}/fotografias`, cuerpo: { versionTrabajo: trabajo.trabajo.version, tipoMime: 'image/png', contenidoBase64: png(32, 32).toString('base64') }, escritura: true, esperados: { visitante: [401], cliente: [403, 404], ajeno: [403, 404] } },
      { nombre: 'eliminar-foto-ajena', metodo: 'DELETE', ruta: `/api/v1/prestadores/perfil/trabajos/${trabajoId}/fotografias/${fotoId}?version=${trabajo.trabajo.version}`, escritura: true, esperados: { visitante: [401], cliente: [403, 404], ajeno: [403, 404] } },
      { nombre: 'reemplazar-foto-ajena', metodo: 'PUT', ruta: `/api/v1/prestadores/perfil/trabajos/${trabajoId}/fotografias/${fotoId}`, cuerpo: { versionTrabajo: trabajo.trabajo.version, tipoMime: 'image/png', contenidoBase64: png(32, 32).toString('base64') }, escritura: true, esperados: { visitante: [401], cliente: [403, 404], ajeno: [403, 404] } },
    ];
    const fallos: string[] = []; const resultados: { actor: string; operacion: string; http: number; carcasa?: boolean }[] = [];
    for (const [actor, tk] of [['visitante', undefined], ['cliente', cliente.token], ['ajeno', ajeno.token]] as const) {
      for (const op of ops) {
        const esperados = op.esperados[actor]; if (!esperados) continue;
        const cab: Record<string, string> = {}; if (tk) cab['authorization'] = `Bearer ${tk}`; if (op.escritura) { cab['origin'] = origenWeb; cab['idempotency-key'] = randomUUID(); }
        const r = await request.fetch(op.ruta, { method: op.metodo, headers: cab, ...(op.cuerpo ? { data: op.cuerpo } : {}) }); const texto = await r.text();
        const fuga = prohibidos.filter((p) => texto.includes(p)); resultados.push({ actor, operacion: op.nombre, http: r.status() });
        if (!esperados.includes(r.status()) || fuga.length) fallos.push(`${actor} · ${op.nombre}: ${r.status()} (esperado ${esperados.join('/')}) fuga=${fuga.join('|')} ${texto.slice(0, 120)}`);
      }
    }
    // URLs de recursos privados pedidas por cualquiera: no existe una ruta pública que los entregue ni se confirma su existencia.
    const urls: [string, string][] = [
      ['foto-con-trabajo-de-otro-prestador', `/api/v1/prestadores/${ajeno.prestadorId}/trabajos/${trabajoId}/fotografias/${fotoId}`], ['foto-inexistente', `/api/v1/prestadores/${titular.prestadorId}/trabajos/${trabajoId}/fotografias/${randomUUID()}`],
      ['documento-privado', `/api/v1/prestadores/${titular.prestadorId}/documentos/${randomUUID()}`], ['archivos-privados', `/api/v1/prestadores/${titular.prestadorId}/archivos-privados/${randomUUID()}`],
      ['perfil-por-cuenta', `/api/v1/prestadores/${titular.cuentaId}`], ['almacenamiento-directo', `/portafolio/${titular.prestadorId}/${randomUUID()}`], ['bucket-directo', `/${(await leerBucket())}/portafolio/${titular.prestadorId}/${randomUUID()}`],
      ['clave-con-recorrido', `/api/v1/prestadores/${titular.prestadorId}/trabajos/${trabajoId}/fotografias/..%2F..%2Fperfil`],
    ];
    for (const [nombre, ruta] of urls) for (const [actor, tk] of [['visitante', undefined], ['cliente', cliente.token], ['ajeno', ajeno.token]] as const) {
      const r = await request.get(ruta, tk ? { headers: auth(tk) } : {}); const texto = await r.text(); const fuga = prohibidos.filter((p) => texto.includes(p));
      // Fuera de /api/v1 la aplicación web responde con su carcasa HTML (rutas del cliente): no es el recurso y se cuenta aparte; nunca bytes ni claves.
      const carcasa = !ruta.startsWith('/api/v1') && r.status() === 200 && (r.headers()['content-type'] ?? '').includes('text/html') && /<!doctype html>/i.test(texto) && !/RIFF|PNG/.test(texto);
      resultados.push({ actor: `${actor}-url`, operacion: nombre, http: r.status(), ...(carcasa ? { carcasa: true } : {}) }); if (!(carcasa || [400, 404].includes(r.status())) || fuga.length) fallos.push(`${actor} · ${nombre}: ${r.status()} fuga=${fuga.join('|')} ${texto.slice(0, 120)}`);
    }
    // La fotografía confirmada se entrega al público solo por su ruta de API y la respuesta pública no contiene claves de almacenamiento.
    const publico = await (await request.get(`/api/v1/prestadores/${titular.prestadorId}`)).text(); expect(publico).not.toMatch(/portafolio\/|objeto|bucket|contenidoBase64|correo|cuentaId/i);
    expect(fallos).toEqual([]); expect(await estado()).toBe(antes);
    const total = resultados.length; const carcasas = resultados.filter((r) => r.carcasa).length; const rechazados = resultados.filter((r) => r.http >= 400 && r.http < 500).length; expect(rechazados + carcasas).toBe(total);
    await hechos(testInfo, 'ca-cat-03-pr04-recursos-privados', { intentos: total, rechazados, respuestasCarcasaWebSinElRecurso: carcasas, porcentajeSinEntregarElRecurso: (100 * (rechazados + carcasas)) / total, mutaciones: 0, divulgaciones: 0, urlsPrivadas: urls.map(([n]) => n), porActor: Object.fromEntries(['visitante', 'cliente', 'ajeno', 'visitante-url', 'cliente-url', 'ajeno-url'].map((a) => [a, [...new Set(resultados.filter((r) => r.actor === a).map((r) => `${r.operacion}:${r.http}`))].length])), auditoriaEsperada: [{ accion: 'CATEGORIA_CREADA', recursoId: c.categoriaId, motivo: 'Alta privada' }, { accion: 'CATEGORIA_ACTIVADA', recursoId: c.categoriaId, motivo: 'Activación privada' }] });
  });
});

async function leerBucket(): Promise<string> {
  const ruta = process.env['E2E_PREPARACION_002']; return ruta ? ((JSON.parse(await readFile(ruta, 'utf8')) as { recursos: { bucket: string } }).recursos.bucket) : 'e2e-sin-preparacion';
}
