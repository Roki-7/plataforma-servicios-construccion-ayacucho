import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import { limitesServicio, type EntradaServicio, type EstadoServicio, type PaginaServicios, type ServicioPrivado } from '../modelos/contratos.js';
import { claveIdempotencia } from './portafolio.js';
import type { ApiServicios } from './puertos.js';

export function validarServicioWeb(e: Partial<EntradaServicio>, parcial = false): Record<string, string> {
  const errores: Record<string, string> = {};
  const titulo = e.titulo ?? ''; const descripcion = e.descripcion ?? '';
  if (!parcial || e.titulo !== undefined) {
    if (!titulo.trim()) errores['titulo'] = 'Indique el título del servicio.';
    else if (titulo.length > limitesServicio.titulo) errores['titulo'] = `El título admite hasta ${limitesServicio.titulo} caracteres.`;
  }
  if (!parcial || e.descripcion !== undefined) {
    if (!descripcion.trim()) errores['descripcion'] = 'Describa el servicio.';
    else if (descripcion.length > limitesServicio.descripcion) errores['descripcion'] = `La descripción admite hasta ${limitesServicio.descripcion} caracteres.`;
  }
  if (!parcial && !e.categoriaId) errores['categoriaId'] = 'Elija la categoría del servicio.';
  return errores;
}

/** Acciones que el titular puede ejecutar según el estado. RETIRADO es de solo lectura. */
export function accionesDe(estado: EstadoServicio): { readonly editar: boolean; readonly destinos: readonly EstadoServicio[] } {
  if (estado === 'RETIRADO') return { editar: false, destinos: [] };
  return { editar: true, destinos: estado === 'PUBLICADO' ? ['PAUSADO', 'RETIRADO'] : ['PUBLICADO', 'RETIRADO'] };
}

/** Casos de uso de servicios propios. Un reintento tras un fallo de red conserva la clave de idempotencia. */
export class ServiciosWeb {
  private readonly claves = new Map<string, string>();
  constructor(private readonly api: ApiServicios, private readonly nuevaClave: () => string = claveIdempotencia) {}

  private async conClave<T>(firma: string, ejecutar: (clave: string) => Promise<T>): Promise<T> {
    const clave = this.claves.get(firma) ?? this.nuevaClave();
    this.claves.set(firma, clave);
    try { const r = await ejecutar(clave); this.claves.delete(firma); return r; }
    catch (error) { if (error instanceof ErrorApi && error.http < 500) this.claves.delete(firma); throw error; }
  }
  listar(pagina = 1): Promise<PaginaServicios> { return this.api.listarMios(pagina, limitesServicio.pagina); }
  publicar(e: EntradaServicio): Promise<ServicioPrivado> { return this.conClave(`alta:${JSON.stringify(e)}`, c => this.api.publicar(e, c)); }
  editar(servicioId: string, version: number, cambios: Partial<EntradaServicio>) { return this.conClave(`edicion:${servicioId}:${version}:${JSON.stringify(cambios)}`, c => this.api.editar(servicioId, version, cambios, c)); }
  cambiarEstado(servicioId: string, version: number, destino: EstadoServicio) { return this.conClave(`estado:${servicioId}:${version}:${destino}`, c => this.api.cambiarEstado(servicioId, version, destino, c)); }
}
