import type { ClasificacionPublica, RevisionDeOferta } from '../../api-publica.js';
import type { AlmacenCache, OpcionesCache } from './catalogo-cache.js';

export interface ConsultaCategorias { listar(): Promise<readonly ClasificacionPublica[]> }

const forma = (v: unknown): v is ClasificacionPublica[] => Array.isArray(v) && v.every(c => typeof c === 'object' && c !== null && typeof (c as ClasificacionPublica).categoriaId === 'string' && typeof (c as ClasificacionPublica).nombre === 'string');

/**
 * Categorías activas con la misma garantía que las búsquedas: la revisión se lee de PostgreSQL antes y al aceptar un acierto.
 * Cualquier cambio de clasificación avanza la revisión, por lo que una desactivación excluye de inmediato aun con la caché caliente.
 */
export class CategoriasConCache implements ConsultaCategorias {
  constructor(private readonly origen: ConsultaCategorias, private readonly revision: RevisionDeOferta, private readonly cache: AlmacenCache, private readonly o: OpcionesCache) {}
  async listar(): Promise<readonly ClasificacionPublica[]> {
    const revision = await this.revision.vigente();
    const clave = `${this.o.entorno}:${this.o.versionRepresentacion}:r${revision}:categorias:activas`;
    try {
      const guardado = await this.cache.obtener(clave);
      if (guardado) { const v: unknown = JSON.parse(guardado); if (forma(v) && await this.revision.vigente() === revision) return v; }
    } catch { /* sin caché: se resuelve en PostgreSQL */ }
    const resultado = await this.origen.listar();
    try { if (await this.revision.vigente() === revision) await this.cache.guardar(clave, JSON.stringify(resultado), this.o.ttlSegundos); } catch { /* sin caché */ }
    return resultado;
  }
}
