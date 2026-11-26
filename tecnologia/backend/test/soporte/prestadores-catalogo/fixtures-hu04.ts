import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { ElegibilidadServicioPostgres } from '../../../src/modulos/catalogo/aplicacion/elegibilidad-servicio.js';
import { PerfilesYPortafolio1795000000004 } from '../../../src/modulos/prestadores/infraestructura/migraciones/perfiles-y-portafolio.js';
import { ELEGIBILIDAD_SERVICIO_002, registroServicios002 } from '../../../src/composicion/servicios-002.js';
import { aplicacionPorHistoria } from './aplicacion-por-historia.js';
import { origenWeb002, registrarCuenta, type CuentaPrueba } from './fixtures-hu03.js';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const clasificaciones04 = {
  /** Raíz activa y su subcategoría activa. */
  raiz: uuid(330), hija: uuid(331),
  /** Raíz inactiva, su subcategoría con estado propio activo (inactiva por el estado de su padre) y otra raíz activa con una hija inactiva. */
  inactiva: uuid(332), hijaDeInactiva: uuid(333), raizActiva2: uuid(334), hijaInactiva: uuid(335),
  /** Identificador con dígitos hexadecimales a-f: permite probar mayúsculas y minúsculas. */
  conLetras: 'abcdefab-cdef-4abc-8def-abcdefabcdef',
} as const;
export interface Hu04Datos { readonly prestador: CuentaPrueba; readonly ajeno: CuentaPrueba; readonly cliente: CuentaPrueba; readonly perfiles: { readonly prestador: string; readonly ajeno: string }; readonly clasificaciones: typeof clasificaciones04 }
export const servicioValido = (c: typeof clasificaciones04, extra: object = {}) => ({ titulo: 'Instalación eléctrica ficticia', descripcion: 'Servicio de prueba con una descripción ficticia.', categoriaId: c.hija, ...extra });

/** Monta US2: sus cuatro rutas reales, migraciones de Prestadores y Catálogo, cuentas, perfiles y clasificaciones ficticios y referencias históricas de prueba. */
export async function montarHu04(registrar?: (linea: string) => void) {
  const servicios = registroServicios002();
  const registro = { controladores: servicios.controladores, proveedores: servicios.proveedores, operaciones: servicios.operaciones,
    persistencia: [{ migraciones: [PerfilesYPortafolio1795000000004] }, ...servicios.persistencia] };
  const e = await aplicacionPorHistoria('HU04', registro, {
    cargar: async (app) => {
      const http = request(app.app.getHttpServer());
      const insertar = (id: string, nombre: string, nivel: 1 | 2, padre: string | null, activa: boolean) => app.db.query(
        'INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id,activa) VALUES($1,$2::varchar,$2::text,$3,$4,$5)', [id, nombre, nivel, padre, activa]);
      const c = clasificaciones04;
      await insertar(c.raiz, 'Instalaciones 04', 1, null, true);
      await insertar(c.hija, 'Electricidad 04', 2, c.raiz, true);
      await insertar(c.inactiva, 'Raíz inactiva 04', 1, null, false);
      await insertar(c.hijaDeInactiva, 'Hija de raíz inactiva 04', 2, c.inactiva, true);
      await insertar(c.raizActiva2, 'Acabados 04', 1, null, true);
      await insertar(c.hijaInactiva, 'Hija inactiva 04', 2, c.raizActiva2, false);
      await insertar(c.conLetras, 'Identificador con letras 04', 2, c.raiz, true);
      // Referencias históricas de otros módulos (003, 004 y contrataciones): tabla de prueba con clave foránea restrictiva.
      await app.db.query(`CREATE TABLE referencias_prueba_002 (id uuid PRIMARY KEY, servicio_id uuid NOT NULL REFERENCES catalogo_servicios(id) ON DELETE RESTRICT,
        tipo text NOT NULL CHECK (tipo IN ('SOLICITUD','COTIZACION','CONTRATACION')))`);
      const prestador = await registrarCuenta(app, http, 'prestador');
      const ajeno = await registrarCuenta(app, http, 'prestador');
      const cliente = await registrarCuenta(app, http, 'cliente');
      const perfil = async (cuenta: CuentaPrueba, nombre: string) => {
        const id = randomUUID();
        await app.db.query(`INSERT INTO prestadores_perfiles(id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada) VALUES($1,$2,$3,'TECNICO','Experiencia ficticia',true)`, [id, cuenta.cuentaId, nombre]);
        return id;
      };
      const datos: Hu04Datos = { prestador, ajeno, cliente, clasificaciones: c, perfiles: { prestador: await perfil(prestador, 'Prestador 04'), ajeno: await perfil(ajeno, 'Ajeno 04') } };
      return datos;
    },
    verificar: async (app, datos) => {
      const filas: unknown[] = await app.db.query('SELECT id FROM prestadores_perfiles');
      return filas.length === 2 && (await app.usuariosAcceso.exigir(datos.prestador.token)).perfiles.includes('prestador');
    },
  }, registrar ? { registrar } : {});
  const http = request(e.app.getHttpServer());
  const escritura = <T extends request.Test>(t: T, token?: string, clave?: string, origen: string | null = origenWeb002): T => {
    if (token) t.set('Authorization', `Bearer ${token}`);
    if (origen) t.set('Origin', origen);
    t.set('Idempotency-Key', clave ?? randomUUID());
    return t;
  };
  const elegibilidad = e.app.get<ElegibilidadServicioPostgres>(ELEGIBILIDAD_SERVICIO_002);
  return {
    ...e, http, elegibilidad,
    publicar: (token: string | undefined, cuerpo: object, clave?: string) => escritura(http.post('/api/v1/servicios'), token, clave).send(cuerpo),
    editar: (token: string | undefined, servicioId: string, cuerpo: object, clave?: string) => escritura(http.patch(`/api/v1/servicios/${servicioId}`), token, clave).send(cuerpo),
    transicionar: (token: string | undefined, servicioId: string, cuerpo: object, clave?: string) => escritura(http.post(`/api/v1/servicios/${servicioId}/transiciones`), token, clave).send(cuerpo),
    mios: (token?: string, consulta = '') => { const t = http.get(`/api/v1/servicios/mios${consulta}`); if (token) t.set('Authorization', `Bearer ${token}`); return t; },
    nuevaCuenta: (perfil: 'cliente' | 'prestador' = 'prestador') => registrarCuenta(e, http, perfil),
    /** Crea un perfil profesional mínimo para una cuenta. Prestadores es dueño de esos datos: aquí solo se prepara el escenario. */
    crearPerfil: async (cuenta: CuentaPrueba) => {
      const id = randomUUID();
      await e.db.query(`INSERT INTO prestadores_perfiles(id,cuenta_id,nombre_publico,tipo,experiencia,disponibilidad_declarada) VALUES($1,$2,'Perfil de prueba','TECNICO','Experiencia ficticia',true)`, [id, cuenta.cuentaId]);
      return id;
    },
    sembrarReferencias: async (servicioId: string) => {
      for (const tipo of ['SOLICITUD', 'COTIZACION', 'CONTRATACION']) await e.db.query('INSERT INTO referencias_prueba_002(id,servicio_id,tipo) VALUES($1,$2,$3)', [randomUUID(), servicioId, tipo]);
    },
    referencias: async (servicioId: string) => ((await e.db.query('SELECT tipo FROM referencias_prueba_002 WHERE servicio_id=$1 ORDER BY tipo', [servicioId])) as { tipo: string }[]).map(r => r.tipo),
    revision: async () => BigInt(((await e.db.query('SELECT revision::text AS r FROM catalogo_revision_oferta')) as { r: string }[])[0]!.r),
    operaciones: servicios.operaciones,
  };
}
export type EntornoHu04 = Awaited<ReturnType<typeof montarHu04>>;
