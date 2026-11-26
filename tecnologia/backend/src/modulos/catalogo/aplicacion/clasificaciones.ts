import { randomUUID } from 'node:crypto';
import type { ContextoTransaccion } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import type { ClasificacionAdmin, GestionClasificaciones, PrevisualizacionDesactivacion, RevisionDeOferta } from '../api-publica.js';
import { clasificacionActiva, type Clasificacion } from '../dominio/clasificacion.js';
import { cambiarEstadoClasificacion, crearClasificacion, editarNombreClasificacion, normalizarNombre } from '../dominio/gestion-clasificaciones.js';
import { NombreDeClasificacionEnUso, type RepositorioClasificaciones } from './puertos/clasificaciones.js';
import { calcularImpacto, validarConfirmacion } from './impacto-desactivacion.js';

const noDisponible = () => new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.');
export const versionDesactualizada = () => new ErrorAplicacion(409, 'VERSION_DESACTUALIZADA', 'La versión enviada ya no es la vigente.', [{ campo: 'version', motivo: 'La versión enviada ya no es la vigente.' }]);

export function aAdmin(c: Clasificacion, padre: Clasificacion | null): ClasificacionAdmin {
  return { categoriaId: c.id, categoriaPadreId: c.categoriaPadreId, nombre: c.nombre, activaPropia: c.activa, activaEfectiva: clasificacionActiva(c, padre ?? undefined), version: c.version };
}

export const nombreEnUso = () => new ErrorAplicacion(409, 'NOMBRE_CLASIFICACION_EN_USO', 'Ya existe una clasificación con un nombre equivalente en la misma categoría.',
  [{ campo: 'nombre', motivo: 'El nombre ya está en uso entre las clasificaciones hermanas.' }]);

/** Gestión de clasificaciones. El llamador (Administración) ya tomó el permiso RF39 y la idempotencia. Aquí: revisión exclusiva, raíz, subcategoría. */
export class ClasificacionesServicio implements GestionClasificaciones {
  constructor(private readonly repo: RepositorioClasificaciones, private readonly revision: RevisionDeOferta) {}

  listarAdmin() { return this.repo.listarAdmin(); }
  listarPublicas() { return this.repo.listarPublicas(); }

  private async cargar(tx: ContextoTransaccion, idEntrada: string) {
    const r = await this.repo.bloquear(tx, uuidEnMinusculas(idEntrada));
    if (!r) throw noDisponible();
    return r;
  }

  async crear(tx: ContextoTransaccion, entrada: { nombre: unknown; padreId?: string | null }): Promise<ClasificacionAdmin> {
    await this.revision.bloquear(tx, 'exclusivo');
    let padre: Clasificacion | undefined;
    if (entrada.padreId) {
      const p = await this.repo.bloquear(tx, uuidEnMinusculas(entrada.padreId));
      if (!p) throw noDisponible();
      padre = p.clasificacion;
    }
    const nueva = crearClasificacion({ id: randomUUID(), nombre: entrada.nombre, ...(padre ? { padre } : {}) });
    if (await this.repo.existeHermanaConNombre(tx, nueva.categoriaPadreId, nueva.nombre, null)) throw nombreEnUso();
    try { await this.repo.insertar(tx, nueva, normalizarNombre(nueva.nombre)); } catch (e) { throw e instanceof NombreDeClasificacionEnUso ? nombreEnUso() : e; }
    await this.revision.incrementar(tx);
    return aAdmin(nueva, padre ?? null);
  }

  async editar(tx: ContextoTransaccion, id: string, version: number, nombre: unknown): Promise<ClasificacionAdmin> {
    await this.revision.bloquear(tx, 'exclusivo');
    const { clasificacion, padre } = await this.cargar(tx, id);
    if (clasificacion.version !== version) throw versionDesactualizada();
    const nueva = editarNombreClasificacion(clasificacion, nombre);
    if (await this.repo.existeHermanaConNombre(tx, clasificacion.categoriaPadreId, nueva.nombre, clasificacion.id)) throw nombreEnUso();
    try { await this.repo.actualizar(tx, clasificacion.id, { nombre: nueva.nombre, nombreNormalizado: normalizarNombre(nueva.nombre) }); }
    catch (e) { throw e instanceof NombreDeClasificacionEnUso ? nombreEnUso() : e; }
    await this.revision.incrementar(tx);
    return aAdmin(nueva, padre);
  }

  async activar(tx: ContextoTransaccion, id: string, version: number): Promise<ClasificacionAdmin> {
    await this.revision.bloquear(tx, 'exclusivo');
    const { clasificacion, padre } = await this.cargar(tx, id);
    if (clasificacion.version !== version) throw versionDesactualizada();
    const nueva = cambiarEstadoClasificacion(clasificacion, true);
    await this.repo.actualizar(tx, clasificacion.id, { activa: true });
    await this.revision.incrementar(tx);
    return aAdmin(nueva, padre);
  }

  async previsualizarDesactivacion(tx: ContextoTransaccion, id: string, version: number, actor: string): Promise<PrevisualizacionDesactivacion> {
    const revision = await this.revision.bloquear(tx, 'compartido');
    const { clasificacion } = await this.cargar(tx, id);
    if (clasificacion.version !== version) throw versionDesactualizada();
    cambiarEstadoClasificacion(clasificacion, false);
    return calcularImpacto(this.repo, tx, { clasificacionId: clasificacion.id, version, revision, actor });
  }

  async desactivar(tx: ContextoTransaccion, id: string, version: number, confirmacionEntrada: string, actor: string): Promise<ClasificacionAdmin> {
    const revision = await this.revision.bloquear(tx, 'exclusivo');
    const { clasificacion, padre } = await this.cargar(tx, id);
    const confirmacion = await validarConfirmacion(this.repo, tx, { confirmacionId: uuidEnMinusculas(confirmacionEntrada), actor, clasificacion, revision, versionEnviada: version });
    const nueva = cambiarEstadoClasificacion(clasificacion, false);
    await this.repo.consumirConfirmacion(tx, confirmacion.id);
    await this.repo.actualizar(tx, clasificacion.id, { activa: false });
    await this.revision.incrementar(tx);
    return aAdmin(nueva, padre);
  }
}
