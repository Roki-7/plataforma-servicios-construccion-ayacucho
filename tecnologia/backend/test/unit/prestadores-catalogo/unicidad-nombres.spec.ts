import { describe, expect, test } from '@jest/globals';
import type { ContextoTransaccion } from '../../../src/compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../src/compartido/dominio/errores.js';
import type { RevisionDeOferta } from '../../../src/modulos/catalogo/api-publica.js';
import { ClasificacionesServicio } from '../../../src/modulos/catalogo/aplicacion/clasificaciones.js';
import { NombreDeClasificacionEnUso, type RepositorioClasificaciones } from '../../../src/modulos/catalogo/aplicacion/puertos/clasificaciones.js';
import type { Clasificacion } from '../../../src/modulos/catalogo/dominio/clasificacion.js';
import { normalizarNombre } from '../../../src/modulos/catalogo/dominio/gestion-clasificaciones.js';
import { VECTORES_NORMALIZACION } from '../../soporte/prestadores-catalogo/vectores-normalizacion.js';

describe('INC-002-01 · normalización determinista de nombres', () => {
  test.each(VECTORES_NORMALIZACION)('%s', (_caso, entrada, esperado) => { expect(normalizarNombre(entrada)).toBe(esperado); });

  test('conserva la distinción entre ñ y n con palabras españolas y quechuas', () => {
    for (const [con, sin] of [['Año', 'Ano'], ['Cañería', 'Caneria'], ['Ñawpaq', 'Nawpaq'], ['Ñuñu', 'Nunu'], ['Ñan', 'Nan'], ['Ñaupa', 'Naupa'], ['Cañaris', 'Canaris']] as const) {
      expect(normalizarNombre(con)).not.toBe(normalizarNombre(sin));
    }
    expect(normalizarNombre('ÑUÑU')).toBe(normalizarNombre('ñuñu'));
    expect(normalizarNombre('Ñ')).toBe(normalizarNombre('N\u0303'));
  });

  test('los signos ^ ` ¨ · y el apóstrofo se conservan y distinguen nombres', () => {
    for (const [con, sin] of [['A^', 'A'], ['A`', 'A'], ['A¨', 'A'], ['A·B', 'AB'], ["Q'ero", 'Qero']] as const) {
      expect(normalizarNombre(con)).not.toBe(normalizarNombre(sin));
    }
  });

  test('es idempotente y no cambia entre ejecuciones', () => {
    for (const [, entrada] of VECTORES_NORMALIZACION) {
      const una = normalizarNombre(entrada);
      expect(normalizarNombre(una)).toBe(una);
      expect(normalizarNombre(entrada)).toBe(una);
    }
  });

  test('solo cambia las tildes de las vocales, las mayúsculas y los espacios', () => {
    expect(normalizarNombre('Pintura')).not.toBe(normalizarNombre('Pinturas'));
    expect(normalizarNombre('Instalación eléctrica')).toBe(normalizarNombre('  INSTALACION   ELECTRICA'));
  });
});

type Fila = { -readonly [K in keyof Clasificacion]: Clasificacion[K] } & { clave: string };
/** Repositorio en memoria con la misma regla del índice único: hermanas por padre (null = raíces), incluidas las inactivas. */
class RepoMemoria implements Pick<RepositorioClasificaciones, 'existeHermanaConNombre' | 'insertar' | 'actualizar' | 'bloquear'> {
  filas: Fila[] = []; forzarViolacionDeIndice = false; consultas = 0;
  async existeHermanaConNombre(_tx: ContextoTransaccion, padre: string | null, nombre: string, excluir: string | null) {
    this.consultas++; return this.filas.some(f => f.categoriaPadreId === padre && f.clave === normalizarNombre(nombre) && f.id !== excluir);
  }
  async insertar(_tx: ContextoTransaccion, c: Clasificacion, clave: string) {
    if (this.forzarViolacionDeIndice) throw new NombreDeClasificacionEnUso();
    this.filas.push({ ...c, clave });
  }
  async actualizar(_tx: ContextoTransaccion, id: string, c: { nombre?: string; nombreNormalizado?: string; activa?: boolean }) {
    if (this.forzarViolacionDeIndice) throw new NombreDeClasificacionEnUso();
    const f = this.filas.find(x => x.id === id)!; if (c.nombre) { f.nombre = c.nombre; f.clave = c.nombreNormalizado ?? f.clave; } f.version++; return f.version;
  }
  async bloquear(_tx: ContextoTransaccion, id: string) {
    const f = this.filas.find(x => x.id === id); if (!f) return null;
    const padre = this.filas.find(x => x.id === f.categoriaPadreId);
    return { clasificacion: f as Clasificacion, padre: (padre ?? null) as Clasificacion | null };
  }
}
const revision: RevisionDeOferta = { bloquear: async () => 1n, incrementar: async () => 2n } as unknown as RevisionDeOferta;
const tx = {} as ContextoTransaccion;
const rechazo = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e as ErrorAplicacion; } throw new Error('Debía rechazar.'); };

describe('INC-002-01 · regla de aplicación', () => {
  const nuevo = () => { const repo = new RepoMemoria(); return { repo, servicio: new ClasificacionesServicio(repo as unknown as RepositorioClasificaciones, revision) }; };

  test('rechaza con 409 NOMBRE_CLASIFICACION_EN_USO un nombre equivalente entre raíces, incluso si la existente está inactiva', async () => {
    const { repo, servicio } = nuevo();
    await servicio.crear(tx, { nombre: 'Pintura' });
    for (const variante of ['PINTURA ', 'Pintúra', '  pintura  ']) {
      const e = await rechazo(servicio.crear(tx, { nombre: variante }));
      expect(e).toMatchObject({ http: 409, codigo: 'NOMBRE_CLASIFICACION_EN_USO', detalles: [{ campo: 'nombre' }] });
    }
    expect(repo.filas).toHaveLength(1);
  });

  test('ñ y n son nombres distintos; el mismo nombre bajo padres distintos y entre raíz y subcategoría es válido', async () => {
    const { repo, servicio } = nuevo();
    await servicio.crear(tx, { nombre: 'Año' }); await servicio.crear(tx, { nombre: 'Ano' });
    const a = await servicio.crear(tx, { nombre: 'Acabados' }); const b = await servicio.crear(tx, { nombre: 'Estructuras' });
    await servicio.crear(tx, { nombre: 'Otros', padreId: a.categoriaId }); await servicio.crear(tx, { nombre: 'Otros', padreId: b.categoriaId });
    await servicio.crear(tx, { nombre: 'Acabados', padreId: b.categoriaId });
    expect(repo.filas).toHaveLength(7);
    expect((await rechazo(servicio.crear(tx, { nombre: 'OTROS', padreId: a.categoriaId }))).codigo).toBe('NOMBRE_CLASIFICACION_EN_USO');
  });

  test('editar: el propio nombre y sus variantes se permiten; el de una hermana se rechaza sin cambiar nada', async () => {
    const { repo, servicio } = nuevo();
    const a = await servicio.crear(tx, { nombre: 'Pintura' }); const b = await servicio.crear(tx, { nombre: 'Plomería' });
    expect((await servicio.editar(tx, a.categoriaId, 1, 'PINTÚRA')).nombre).toBe('PINTÚRA');
    const e = await rechazo(servicio.editar(tx, b.categoriaId, 1, ' pintura'));
    expect(e).toMatchObject({ http: 409, codigo: 'NOMBRE_CLASIFICACION_EN_USO' });
    expect(repo.filas.find(f => f.id === b.categoriaId)).toMatchObject({ nombre: 'Plomería', version: 1 });
  });

  test('la violación del índice único (carrera fuera del bloqueo) se traduce al mismo 409', async () => {
    const { repo, servicio } = nuevo(); repo.forzarViolacionDeIndice = true;
    expect(await rechazo(servicio.crear(tx, { nombre: 'Carrera' }))).toMatchObject({ http: 409, codigo: 'NOMBRE_CLASIFICACION_EN_USO' });
    repo.forzarViolacionDeIndice = false; const c = await servicio.crear(tx, { nombre: 'Base' }); repo.forzarViolacionDeIndice = true;
    expect(await rechazo(servicio.editar(tx, c.categoriaId, 1, 'Otra'))).toMatchObject({ http: 409, codigo: 'NOMBRE_CLASIFICACION_EN_USO' });
  });

  test('otros errores de la base no se disfrazan de 409', async () => {
    const { repo, servicio } = nuevo(); repo.insertar = async () => { throw new Error('conexión perdida'); };
    expect((await rechazo(servicio.crear(tx, { nombre: 'Nueva' }))).message).toBe('conexión perdida');
  });
});
