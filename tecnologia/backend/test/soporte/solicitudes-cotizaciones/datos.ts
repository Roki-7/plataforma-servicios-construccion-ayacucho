import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { crearAplicacion } from '../../../src/composicion/app.module.js';
import { PRIVACIDAD_VERSION } from '../../../src/modulos/usuarios-acceso/dominio/cuenta.js';

/**
 * Datos ficticios deterministas de la 003 (T042). Todo es ficticio: correos `*.example.invalid`, nombres inventados, sin teléfonos ni datos reales.
 * Los identificadores de categorías, prestadores y servicios son fijos para que las pruebas y la validación manual los citen. Las cuentas se crean con el registro
 * real de la 001 (HTTP), de modo que sus sesiones, perfiles y contraseñas son los de la aplicación.
 *
 * Mapa de cobertura (categoría → quién la cubre; un servicio en una subcategoría cubre la subcategoría y su categoría, uno en la categoría solo esta):
 *   A  : Ana (servicio en A), Beto (servicio en A1), Carla (servicio en A2), Gema (cuenta con ambos perfiles, servicio en A)
 *   A1 : Beto
 *   A2 : Carla
 *   B  : Dario (servicio en B)
 *   Elena tiene a A1 como especialidad pero ningún servicio PUBLICADO (uno PAUSADO), así que no cubre nada.
 */
type Aplicacion = Awaited<ReturnType<typeof crearAplicacion>>;
const uuid = (n: number) => `00000000-0000-4003-8000-${String(n).padStart(12, '0')}`;

export const categorias003 = { A: uuid(100), A1: uuid(101), A2: uuid(102), B: uuid(103), inactiva: uuid(104) } as const;
export const distritos003 = ['ayacucho', 'carmen-alto', 'san-juan-bautista', 'jesus-nazareno', 'andres-avelino-caceres-dorregaray'] as const;
export const contrasena003 = 'Frase privada ficticia de la tres';
export const marcadorDeSiembra003 = categorias003.A;

interface PerfilFicticio {
  readonly clave: string; readonly prestadorId: string; readonly nombre: string; readonly correo: string; readonly perfiles: readonly ('cliente' | 'prestador')[];
  readonly especialidades: readonly string[]; readonly distritos: readonly string[];
  readonly servicios: readonly { readonly id: string; readonly categoria: string; readonly titulo: string; readonly estado: 'PUBLICADO' | 'PAUSADO' }[];
}
const definiciones: readonly PerfilFicticio[] = [
  { clave: 'ana', prestadorId: uuid(200), nombre: 'Ana Albañil', correo: 'ana.prestadora@example.invalid', perfiles: ['prestador'], especialidades: [categorias003.A], distritos: ['ayacucho', 'carmen-alto'],
    servicios: [{ id: uuid(300), categoria: categorias003.A, titulo: 'Obra gruesa y muros', estado: 'PUBLICADO' }] },
  { clave: 'beto', prestadorId: uuid(201), nombre: 'Beto Gasfitero', correo: 'beto.prestador@example.invalid', perfiles: ['prestador'], especialidades: [categorias003.A1], distritos: ['ayacucho'],
    servicios: [{ id: uuid(301), categoria: categorias003.A1, titulo: 'Instalación sanitaria', estado: 'PUBLICADO' }] },
  { clave: 'carla', prestadorId: uuid(202), nombre: 'Carla Electricista', correo: 'carla.prestadora@example.invalid', perfiles: ['prestador'], especialidades: [categorias003.A2], distritos: ['san-juan-bautista'],
    servicios: [{ id: uuid(302), categoria: categorias003.A2, titulo: 'Instalación eléctrica', estado: 'PUBLICADO' }] },
  { clave: 'dario', prestadorId: uuid(203), nombre: 'Darío Pintor', correo: 'dario.prestador@example.invalid', perfiles: ['prestador'], especialidades: [categorias003.B], distritos: ['jesus-nazareno', 'andres-avelino-caceres-dorregaray'],
    servicios: [{ id: uuid(303), categoria: categorias003.B, titulo: 'Pintura de interiores', estado: 'PUBLICADO' }] },
  { clave: 'elena', prestadorId: uuid(204), nombre: 'Elena Sin Servicio', correo: 'elena.prestadora@example.invalid', perfiles: ['prestador'], especialidades: [categorias003.A1], distritos: ['ayacucho', 'jesus-nazareno'],
    servicios: [{ id: uuid(304), categoria: categorias003.A1, titulo: 'Servicio en pausa', estado: 'PAUSADO' }] },
  { clave: 'gema', prestadorId: uuid(205), nombre: 'Gema Constructora', correo: 'gema.ambos@example.invalid', perfiles: ['cliente', 'prestador'], especialidades: [categorias003.A], distritos: ['ayacucho', 'san-juan-bautista'],
    servicios: [{ id: uuid(305), categoria: categorias003.A, titulo: 'Construcción y remodelación', estado: 'PUBLICADO' }] },
];
const clientes = [
  { clave: 'clienteUno', correo: 'cliente.uno@example.invalid', nombre: 'Cliente Uno Ficticio' },
  { clave: 'clienteDos', correo: 'cliente.dos@example.invalid', nombre: 'Cliente Dos Ficticio' },
] as const;

export interface CuentaFicticia { readonly clave: string; readonly correo: string; readonly contrasena: string; readonly cuentaId: string; readonly perfiles: readonly string[] }
export interface PrestadorFicticio extends CuentaFicticia { readonly prestadorId: string; readonly servicios: readonly { id: string; categoriaId: string; estado: string }[]; readonly distritos: readonly string[]; readonly especialidades: readonly string[] }
export interface Datos003 {
  readonly categorias: typeof categorias003;
  readonly clientes: Readonly<Record<'clienteUno' | 'clienteDos', CuentaFicticia>>;
  readonly prestadores: Readonly<Record<'ana' | 'beto' | 'carla' | 'dario' | 'elena' | 'gema', PrestadorFicticio>>;
  /** Cuenta con los perfiles de cliente y de prestador. */
  readonly ambosPerfiles: PrestadorFicticio;
}

/** La semilla solo actúa sobre bases de la 003. Nunca sobre la base de validación de la 002, la de la 001 ni otra. */
export function exigirBaseDeLa003(app: Pick<Aplicacion, 'db'>): void {
  const { url, database } = app.db.options as { url?: string; database?: string };
  const nombre = database ?? (url && URL.canParse(url) ? new URL(url).pathname.slice(1) : '');
  if (!/^ayacucho_003_(validacion|test_[a-z0-9_]+)$/.test(nombre)) throw new Error('La semilla 003 solo actúa sobre las bases dedicadas de la 003.');
}

async function registrar(app: Aplicacion, origen: string, c: { correo: string; nombre: string; perfiles: readonly string[] }): Promise<string> {
  const http = request(app.app.getHttpServer());
  await http.post('/api/v1/cuentas').set('Origin', origen).set('Idempotency-Key', randomUUID()).send({
    nombreMostrar: c.nombre, correo: c.correo, contrasena: contrasena003, confirmacionContrasena: contrasena003, perfiles: c.perfiles,
    politicaPrivacidadAceptada: true, politicaPrivacidadVersion: PRIVACIDAD_VERSION }).expect(201);
  const sesion = await http.post('/api/v1/sesiones').set('Origin', origen).send({ correo: c.correo, contrasena: contrasena003 }).expect(200);
  return (await app.usuariosAcceso.exigir(String(sesion.body.tokenAcceso))).cuentaId;
}

/** Inicia sesión con una cuenta ficticia y devuelve su token de acceso. Para pruebas y validación manual. */
export async function iniciarSesion003(app: Aplicacion, origen: string, cuenta: Pick<CuentaFicticia, 'correo' | 'contrasena'>): Promise<string> {
  const sesion = await request(app.app.getHttpServer()).post('/api/v1/sesiones').set('Origin', origen).send({ correo: cuenta.correo, contrasena: cuenta.contrasena }).expect(200);
  return String(sesion.body.tokenAcceso);
}

/**
 * Siembra el catálogo (A, A1, A2, B y una categoría inactiva), las cuentas, los perfiles de prestador con sus zonas y especialidades, la proyección pública y los
 * servicios. No es idempotente por sí sola: el comando `test:seed:003` comprueba `marcadorDeSiembra003` antes de llamarla.
 */
export async function sembrarDatos003(app: Aplicacion, origen: string): Promise<Datos003> {
  exigirBaseDeLa003(app);
  const q = (sql: string, p: unknown[] = []) => app.db.query(sql, p);
  const clasificacion = (id: string, nombre: string, nivel: 1 | 2, padre: string | null, activa: boolean) => q(
    'INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id,activa) VALUES($1,$2::varchar,$2::text,$3,$4,$5)', [id, nombre, nivel, padre, activa]);
  await clasificacion(categorias003.A, 'Construcción y obra', 1, null, true);
  await clasificacion(categorias003.A1, 'Instalaciones sanitarias', 2, categorias003.A, true);
  await clasificacion(categorias003.A2, 'Instalaciones eléctricas', 2, categorias003.A, true);
  await clasificacion(categorias003.B, 'Acabados y pintura', 1, null, true);
  await clasificacion(categorias003.inactiva, 'Categoría retirada', 1, null, false);

  const cuentaClientes: Record<string, CuentaFicticia> = {};
  for (const c of clientes) {
    const cuentaId = await registrar(app, origen, { correo: c.correo, nombre: c.nombre, perfiles: ['cliente'] });
    cuentaClientes[c.clave] = { clave: c.clave, correo: c.correo, contrasena: contrasena003, cuentaId, perfiles: ['cliente'] };
  }
  const prestadores: Record<string, PrestadorFicticio> = {};
  for (const d of definiciones) {
    const cuentaId = await registrar(app, origen, { correo: d.correo, nombre: d.nombre, perfiles: d.perfiles });
    await q(`INSERT INTO prestadores_perfiles(id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada,publicable) VALUES($1,$2,$3,'TECNICO',$4,true,true)`,
      [d.prestadorId, cuentaId, d.nombre, `Experiencia ficticia de ${d.nombre}.`]);
    for (const e of d.especialidades) await q('INSERT INTO prestadores_especialidades(prestador_id,categoria_id) VALUES($1,$2)', [d.prestadorId, e]);
    for (const z of d.distritos) await q('INSERT INTO prestadores_zonas(prestador_id,distrito_codigo) VALUES($1,$2)', [d.prestadorId, z]);
    await q(`INSERT INTO catalogo_proyeccion_prestadores(prestador_id,nombre_publico,tipo,disponibilidad_declarada,especialidades,distritos,publicable) VALUES($1,$2,'TECNICO',true,$3::uuid[],$4::text[],true)`,
      [d.prestadorId, d.nombre, [...d.especialidades], [...d.distritos]]);
    for (const s of d.servicios) await q('INSERT INTO catalogo_servicios(id,prestador_id,categoria_id,titulo,descripcion,estado) VALUES($1,$2,$3,$4,$5,$6)',
      [s.id, d.prestadorId, s.categoria, s.titulo, `Descripción ficticia de ${s.titulo}.`, s.estado]);
    prestadores[d.clave] = { clave: d.clave, correo: d.correo, contrasena: contrasena003, cuentaId, perfiles: d.perfiles, prestadorId: d.prestadorId,
      servicios: d.servicios.map(s => ({ id: s.id, categoriaId: s.categoria, estado: s.estado })), distritos: d.distritos, especialidades: d.especialidades };
  }
  return { categorias: categorias003, clientes: cuentaClientes as Datos003['clientes'], prestadores: prestadores as Datos003['prestadores'], ambosPerfiles: prestadores['gema']! };
}
