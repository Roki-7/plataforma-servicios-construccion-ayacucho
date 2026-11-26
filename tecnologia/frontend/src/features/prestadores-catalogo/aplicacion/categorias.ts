import type { CategoriaPublica } from '../modelos/contratos.js';
import type { ApiCategorias } from './puertos.js';

export interface OpcionCategoria { readonly id: string; readonly nombre: string }

/**
 * Lista plana para los selectores: cada raíz seguida de sus subcategorías («Raíz › Subcategoría»). Una subcategoría cuyo padre no llegó en la respuesta
 * (no activo) no se ofrece: el servidor ya solo entrega clasificaciones efectivamente activas.
 */
export function opcionesDeCategorias(categorias: readonly CategoriaPublica[]): readonly OpcionCategoria[] {
  const raices = categorias.filter(c => c.categoriaPadreId === null);
  const salida: OpcionCategoria[] = [];
  for (const raiz of raices) {
    salida.push({ id: raiz.categoriaId, nombre: raiz.nombre });
    for (const hija of categorias.filter(c => c.categoriaPadreId === raiz.categoriaId)) salida.push({ id: hija.categoriaId, nombre: `${raiz.nombre} › ${hija.nombre}` });
  }
  return salida;
}

/** Carga las categorías una vez por sesión de la página. Un fallo no se conserva: el siguiente intento vuelve a consultar. */
export class CategoriasWeb {
  private pendiente: Promise<readonly OpcionCategoria[]> | undefined;
  constructor(private readonly api: ApiCategorias) {}
  cargar(): Promise<readonly OpcionCategoria[]> {
    this.pendiente ??= this.api.listar().then(opcionesDeCategorias).catch((error: unknown) => { this.pendiente = undefined; throw error; });
    return this.pendiente;
  }
  /** Descarta lo cargado para reflejar cambios de categorías (por ejemplo, tras un reintento). */
  reiniciar(): void { this.pendiente = undefined; }
}
