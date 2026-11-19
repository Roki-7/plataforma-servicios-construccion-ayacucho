import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import request from 'supertest';
import { registroPrestadores002, operacionesPerfilYPortafolio002, type OpcionesPrestadores002 } from '../../../src/composicion/prestadores-002.js';
import { PortafolioS3 } from '../../../src/modulos/prestadores/infraestructura/archivos/portafolio-s3.js';
import { local002, puertos002, recursos002 } from '../../../scripts/entorno-002.js';
import { registroValido } from '../registro.js';
import { aplicacionPorHistoria } from './aplicacion-por-historia.js';

export const origenWeb002 = 'https://localhost:8444';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const clasificaciones002 = { raiz: uuid(230), hija: uuid(231), inactiva: uuid(232), hijaDeInactiva: uuid(233) } as const;

/** Bucket de portafolio de 002 con un prefijo exclusivo de la corrida. Se limpia al terminar. */
export async function almacenDePrueba002() {
  const archivo = await readFile(resolve(local002, 'backend.env'), 'utf8');
  const leer = (n: string) => new RegExp(`^${n}=['"]?([^'"\\r\\n]*)`, 'm').exec(archivo)?.[1];
  const accessKeyId = leer('S3_ACCESS_KEY_ID');
  const secretAccessKey = leer('S3_SECRET_ACCESS_KEY');
  if (!accessKeyId || !secretAccessKey || !accessKeyId.startsWith('GK')) throw new Error('Ejecute storage:init:002 antes de las pruebas de portafolio.');
  const bucket = recursos002.S3_BUCKET;
  const cliente = new S3Client({ endpoint: `http://127.0.0.1:${puertos002.objetos}`, region: 'garage', forcePathStyle: true, requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId, secretAccessKey } });
  const prefijo = `pruebas/${randomUUID()}/portafolio/`;
  const almacen = new PortafolioS3(cliente, bucket, prefijo);
  const claves = async () => (await cliente.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefijo }))).Contents?.map(o => o.Key ?? '') ?? [];
  const limpiar = async () => {
    try { for (const Key of await claves()) await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key })); } finally { cliente.destroy(); }
  };
  return { almacen, cliente, bucket, prefijo, claves, limpiar };
}

export interface CuentaPrueba { readonly token: string; readonly cuentaId: string }
export interface Hu03Datos { readonly prestador: CuentaPrueba; readonly ajeno: CuentaPrueba; readonly cliente: CuentaPrueba; readonly clasificaciones: typeof clasificaciones002 }
export const perfilValido = (c: typeof clasificaciones002, extra: object = {}) => ({
  version: 0, nombrePublico: 'Maestro de obra ficticio', tipo: 'TECNICO', experiencia: 'Diez años de experiencia ficticia en obra.',
  especialidadesIds: [c.hija], distritos: ['ayacucho'], disponibilidadDeclarada: true, ...extra,
});

type AplicacionBase = Parameters<Parameters<typeof aplicacionPorHistoria>[2]['cargar']>[0];
async function registrarCuenta(app: AplicacionBase, http: ReturnType<typeof request>, perfil: 'cliente' | 'prestador'): Promise<CuentaPrueba> {
  const persona = { ...registroValido(), perfiles: [perfil] };
  await http.post('/api/v1/cuentas').set('Origin', origenWeb002).set('Idempotency-Key', randomUUID()).send(persona).expect(201);
  const sesion = await http.post('/api/v1/sesiones').set('Origin', origenWeb002).send({ correo: persona.correo, contrasena: persona.contrasena }).expect(200);
  const token = String(sesion.body.tokenAcceso);
  return { token, cuentaId: (await app.usuariosAcceso.exigir(token)).cuentaId };
}

/** Monta US1 con sus ocho rutas reales, migraciones de Prestadores y cuentas, clasificaciones y perfiles ficticios. */
export async function montarHu03(opciones: Partial<OpcionesPrestadores002> & Pick<OpcionesPrestadores002, 'almacen'>, registrar?: (linea: string) => void) {
  const registro = registroPrestadores002({ retrasoPurgaSegundos: 0, ...opciones });
  const e = await aplicacionPorHistoria('HU03', registro, {
    cargar: async (app) => {
      const http = request(app.app.getHttpServer());
      const cuenta = (perfil: 'cliente' | 'prestador') => registrarCuenta(app, http, perfil);
      const insertar = (id: string, nombre: string, nivel: 1 | 2, padre: string | null, activa: boolean) => app.db.query(
        'INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel,categoria_padre_id,activa) VALUES($1,$2::varchar,$2::text,$3,$4,$5)', [id, nombre, nivel, padre, activa]);
      await insertar(clasificaciones002.raiz, 'Construcción de prueba 002', 1, null, true);
      await insertar(clasificaciones002.hija, 'Albañilería de prueba 002', 2, clasificaciones002.raiz, true);
      await insertar(clasificaciones002.inactiva, 'Raíz inactiva de prueba 002', 1, null, false);
      await insertar(clasificaciones002.hijaDeInactiva, 'Hija de raíz inactiva 002', 2, clasificaciones002.inactiva, true);
      const datos: Hu03Datos = { prestador: await cuenta('prestador'), ajeno: await cuenta('prestador'), cliente: await cuenta('cliente'), clasificaciones: clasificaciones002 };
      return datos;
    },
    verificar: async (app, datos) => {
      const filas: unknown[] = await app.db.query('SELECT id FROM catalogo_clasificaciones');
      return filas.length === 4 && (await app.usuariosAcceso.exigir(datos.prestador.token)).perfiles.includes('prestador')
        && !(await app.usuariosAcceso.exigir(datos.cliente.token)).perfiles.includes('prestador');
    },
  }, registrar ? { registrar } : {});
  const http = request(e.app.getHttpServer());
  const base = '/api/v1/prestadores';
  const escritura = <T extends request.Test>(t: T, token?: string, clave?: string, origen: string | null = origenWeb002): T => {
    if (token) t.set('Authorization', `Bearer ${token}`);
    if (origen) t.set('Origin', origen);
    t.set('Idempotency-Key', clave ?? randomUUID());
    return t;
  };
  return {
    ...e, http, base,
    nuevaCuenta: (perfil: 'cliente' | 'prestador' = 'prestador') => registrarCuenta(e, http, perfil),
    obtenerPerfil: (token?: string) => { const t = http.get(`${base}/perfil`); if (token) t.set('Authorization', `Bearer ${token}`); return t; },
    guardarPerfil: (token: string | undefined, cuerpo: object, clave?: string) => escritura(http.put(`${base}/perfil`), token, clave).send(cuerpo),
    crearTrabajo: (token: string | undefined, cuerpo: object, clave?: string) => escritura(http.post(`${base}/perfil/trabajos`), token, clave).send(cuerpo),
    editarTrabajo: (token: string | undefined, trabajoId: string, cuerpo: object, clave?: string) => escritura(http.patch(`${base}/perfil/trabajos/${trabajoId}`), token, clave).send(cuerpo),
    agregarFoto: (token: string | undefined, trabajoId: string, cuerpo: object, clave?: string) => escritura(http.post(`${base}/perfil/trabajos/${trabajoId}/fotografias`), token, clave).send(cuerpo),
    reemplazarFoto: (token: string | undefined, trabajoId: string, fotoId: string, cuerpo: object, clave?: string) => escritura(http.put(`${base}/perfil/trabajos/${trabajoId}/fotografias/${fotoId}`), token, clave).send(cuerpo),
    eliminarFoto: (token: string | undefined, trabajoId: string, fotoId: string, version: number, clave?: string) => escritura(http.delete(`${base}/perfil/trabajos/${trabajoId}/fotografias/${fotoId}?version=${version}`), token, clave),
    fotoPublica: (prestadorId: string, trabajoId: string, fotoId: string) => http.get(`${base}/${prestadorId}/trabajos/${trabajoId}/fotografias/${fotoId}`),
    operaciones: operacionesPerfilYPortafolio002,
  };
}
export type EntornoHu03 = Awaited<ReturnType<typeof montarHu03>>;
