import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PerfilesYPortafolio1795000000004 } from '../../../src/modulos/prestadores/infraestructura/migraciones/perfiles-y-portafolio.js';
import { registroBusqueda002, type OpcionesBusqueda002 } from '../../../src/composicion/busqueda-002.js';
import { registroServicios002 } from '../../../src/composicion/servicios-002.js';
import { aplicacionPorHistoria } from './aplicacion-por-historia.js';
import { origenWeb002, registrarCuenta, type CuentaPrueba } from './fixtures-hu03.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
/** Jerarquía: R1 con H1a y H1b, R2 con H2a, y R3 inactiva con H3a (hija con estado propio activo). */
export const cat = { R1: uuid(400), H1a: uuid(401), H1b: uuid(402), R2: uuid(403), H2a: uuid(404), R3: uuid(405), H3a: uuid(406) } as const;
export const prest = { A: uuid(410), B: uuid(411), C: uuid(412), D: uuid(413), E: uuid(414), F: uuid(415), G: uuid(416) } as const;
export const serv = { s1: uuid(420), s2: uuid(421), s3: uuid(422), s4: uuid(423), s5: uuid(424), s6: uuid(425), s7: uuid(426), s8: uuid(427) } as const;
export const trabajo = { A: uuid(430) } as const;
export const foto = { A: uuid(431) } as const;
/** Servicios visibles de los datos de prueba: s1, s3, s4, s6 y los 25 de G. */
export const visibles = [serv.s1, serv.s3, serv.s4, serv.s6];
export const total = 4 + 25;

export interface Hu05Datos { readonly titular: CuentaPrueba; readonly otro: CuentaPrueba; readonly cuentaA: string }

/** Monta US3 con US2 (ciclo de servicios) y sus rutas reales, migraciones y un catálogo ficticio con perfiles, proyección, servicios y trabajos. */
export async function montarHu05(opciones: OpcionesBusqueda002 = {}, registrar?: (linea: string) => void) {
  const propios = registroServicios002();
  const busqueda = registroBusqueda002(opciones);
  const registro = { controladores: [...propios.controladores, ...busqueda.controladores], proveedores: [...propios.proveedores, ...busqueda.proveedores],
    operaciones: [...propios.operaciones, ...busqueda.operaciones],
    persistencia: [{ migraciones: [PerfilesYPortafolio1795000000004] }, ...propios.persistencia, ...busqueda.persistencia] };
  const e = await aplicacionPorHistoria('HU05', registro, {
    cargar: async (app) => {
      const http = request(app.app.getHttpServer());
      const q = (sql: string, p: unknown[] = []) => app.db.query(sql, p);
      const clasificacion = (id: string, nombre: string, nivel: 1 | 2, padre: string | null, activa: boolean) => q(
        'INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id,activa) VALUES($1,$2::varchar,$2::text,$3,$4,$5)', [id, nombre, nivel, padre, activa]);
      await clasificacion(cat.R1, 'Construcción', 1, null, true); await clasificacion(cat.H1a, 'Albañilería', 2, cat.R1, true); await clasificacion(cat.H1b, 'Electricidad', 2, cat.R1, true);
      await clasificacion(cat.R2, 'Acabados', 1, null, true); await clasificacion(cat.H2a, 'Pintura', 2, cat.R2, true);
      await clasificacion(cat.R3, 'Obsoleta', 1, null, false); await clasificacion(cat.H3a, 'Hija de obsoleta', 2, cat.R3, true);
      const titular = await registrarCuenta(app, http, 'prestador');
      const otro = await registrarCuenta(app, http, 'prestador');
      const perfil = async (id: string, cuentaId: string, nombre: string, esp: string[], distritos: string[], disponible: boolean, publicable = true) => {
        await q(`INSERT INTO prestadores_perfiles(id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada,publicable) VALUES($1,$2,$3,'TECNICO',$4,$5,$6)`,
          [id, cuentaId, nombre, `Experiencia ficticia de ${nombre}`, disponible, publicable]);
        for (const c of esp) await q('INSERT INTO prestadores_especialidades(prestador_id,categoria_id) VALUES($1,$2)', [id, c]);
        for (const d of distritos) await q('INSERT INTO prestadores_zonas(prestador_id,distrito_codigo) VALUES($1,$2)', [id, d]);
        await q(`INSERT INTO catalogo_proyeccion_prestadores(prestador_id,nombre_publico,tipo,disponibilidad_declarada,especialidades,distritos,publicable) VALUES($1,$2,'TECNICO',$3,$4::uuid[],$5::text[],$6)`,
          [id, nombre, disponible, esp, distritos, publicable]);
      };
      await perfil(prest.A, titular.cuentaId, 'Ana Albañil', [cat.H1a], ['ayacucho', 'carmen-alto'], true);
      await perfil(prest.B, otro.cuentaId, 'Beto Electricista', [cat.H1b], ['ayacucho'], false);
      await perfil(prest.C, randomUUID(), 'Carla Pintora', [cat.H2a], ['san-juan-bautista'], true);
      await perfil(prest.D, randomUUID(), 'Daniel Inactivo', [cat.H3a], ['ayacucho'], true);
      await perfil(prest.E, randomUUID(), 'Elena Sin Servicios', [cat.H1a], ['jesus-nazareno'], true);
      await perfil(prest.F, randomUUID(), 'Fabio No Publicable', [cat.H1a], ['ayacucho'], true, false);
      await perfil(prest.G, randomUUID(), 'Gabriela Paginada', [cat.H1b], ['ayacucho'], true);
      const servicio = (id: string, prestador: string, categoria: string, titulo: string, estado: string) => q(
        'INSERT INTO catalogo_servicios(id,prestador_id,categoria_id,titulo,descripcion,estado) VALUES($1,$2,$3,$4,$5,$6)', [id, prestador, categoria, titulo, `Descripción de ${titulo}`, estado]);
      await servicio(serv.s1, prest.A, cat.H1a, 'Muros de albañilería', 'PUBLICADO'); await servicio(serv.s2, prest.A, cat.H1a, 'Servicio pausado', 'PAUSADO');
      await servicio(serv.s3, prest.A, cat.H1b, 'Instalación eléctrica de Ana', 'PUBLICADO'); await servicio(serv.s4, prest.B, cat.H1b, 'Cableado de Beto', 'PUBLICADO');
      await servicio(serv.s5, prest.B, cat.H1b, 'Servicio retirado', 'RETIRADO'); await servicio(serv.s6, prest.C, cat.H2a, 'Pintura de interiores', 'PUBLICADO');
      await servicio(serv.s7, prest.D, cat.H3a, 'Servicio en clasificación inactiva', 'PUBLICADO'); await servicio(serv.s8, prest.F, cat.H1a, 'Servicio de perfil no publicable', 'PUBLICADO');
      await q(`INSERT INTO catalogo_servicios(id,prestador_id,categoria_id,titulo,descripcion,estado)
        SELECT ('00000000-0000-4000-8000-' || lpad((1000 + n)::text, 12, '0'))::uuid, $1, $2, 'Servicio paginado ' || lpad(n::text, 2, '0'), 'Descripción paginada', 'PUBLICADO' FROM generate_series(1, 25) n`, [prest.G, cat.H1b]);
      // Trabajo anterior con una fotografía del perfil A (referencia técnica: no se solicita su objeto en estas pruebas).
      await q(`INSERT INTO prestadores_trabajos(id,prestador_id,titulo,descripcion) VALUES($1,$2,'Fachada pública','Trabajo anterior publicable')`, [trabajo.A, prest.A]);
      await q(`INSERT INTO prestadores_fotografias(id,trabajo_id,objeto_clave,mime,bytes,ancho,alto,checksum) VALUES($1,$2,$3,'image/webp',10,800,600,decode(repeat('ab',32),'hex'))`,
        [foto.A, trabajo.A, `portafolio/${prest.A}/${uuid(432)}`]);
      await q(`INSERT INTO prestadores_trabajos(id,prestador_id,titulo,descripcion) VALUES($1,$2,'Trabajo de perfil no publicable','x')`, [uuid(433), prest.F]);
      return { titular, otro, cuentaA: titular.cuentaId } satisfies Hu05Datos;
    },
    verificar: async (app) => {
      const filas = (await app.db.query("SELECT count(*)::int AS n FROM catalogo_servicios WHERE estado='PUBLICADO'")) as { n: number }[];
      // PUBLICADOS: s1, s3, s4, s6, s7 (clasificación inactiva), s8 (perfil no publicable) y 25 paginados.
      return Number(filas[0]!.n) === 6 + 25;
    },
  }, registrar ? { registrar } : {});
  const http = request(e.app.getHttpServer());
  const get = (ruta: string) => http.get(`/api/v1${ruta}`);
  const escritura = <T extends request.Test>(t: T, token: string, clave?: string): T => { t.set('Authorization', `Bearer ${token}`).set('Origin', origenWeb002).set('Idempotency-Key', clave ?? randomUUID()); return t; };
  return {
    ...e, http,
    servicios: (consulta = '') => get(`/servicios${consulta}`),
    prestadores: (consulta = '') => get(`/prestadores${consulta}`),
    servicio: (id: string) => get(`/servicios/${id}`),
    perfilPublico: (id: string, consulta = '') => get(`/prestadores/${id}${consulta}`),
    transicionar: (token: string, id: string, cuerpo: object) => escritura(http.post(`/api/v1/servicios/${id}/transiciones`), token).send(cuerpo),
    publicar: (token: string, cuerpo: object) => escritura(http.post('/api/v1/servicios'), token).send(cuerpo),
    editar: (token: string, id: string, cuerpo: object) => escritura(http.patch(`/api/v1/servicios/${id}`), token).send(cuerpo),
    revision: async () => BigInt(((await e.db.query('SELECT revision::text AS r FROM catalogo_revision_oferta')) as { r: string }[])[0]!.r),
  };
}
export type EntornoHu05 = Awaited<ReturnType<typeof montarHu05>>;
