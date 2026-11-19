import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import { limites, tiposMimeEntrada, type EntradaPerfil, type EntradaTrabajo, type EscrituraFotografia, type PerfilPrivado, type TipoMimeEntrada } from '../modelos/contratos.js';
import type { ApiPrestadores } from './puertos.js';

export interface ArchivoImagen { readonly type: string; readonly size: number }
/** Comprobaciones previas al envío. El servidor decide el formato real y las dimensiones. */
export function validarArchivoImagen(archivo: ArchivoImagen): string | undefined {
  if (!(tiposMimeEntrada as readonly string[]).includes(archivo.type)) return 'Solo se admiten imágenes JPG, PNG o WEBP.';
  if (archivo.size <= 0) return 'El archivo está vacío.';
  if (archivo.size > limites.bytesImagen) return 'La imagen supera el límite de 10 MB.';
  return undefined;
}
export function validarPerfilWeb(e: EntradaPerfil): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!e.nombrePublico.trim()) errores['nombrePublico'] = 'Indique su nombre público.';
  else if (e.nombrePublico.length > limites.nombrePublico) errores['nombrePublico'] = `El nombre admite hasta ${limites.nombrePublico} caracteres.`;
  if (!e.experiencia.trim()) errores['experiencia'] = 'Describa su experiencia.';
  else if (e.experiencia.length > limites.experiencia) errores['experiencia'] = `La experiencia admite hasta ${limites.experiencia} caracteres.`;
  if (e.especialidadesIds.length < 1) errores['especialidadesIds'] = 'Indique al menos una especialidad.';
  if (e.distritos.length < 1) errores['distritos'] = 'Seleccione entre uno y cinco distritos.';
  return errores;
}
export function validarTrabajoWeb(t: EntradaTrabajo): Record<string, string> {
  const errores: Record<string, string> = {};
  if (!t.titulo.trim()) errores['titulo'] = 'Indique el título del trabajo.';
  else if (t.titulo.length > limites.titulo) errores['titulo'] = `El título admite hasta ${limites.titulo} caracteres.`;
  if (!t.descripcion.trim()) errores['descripcion'] = 'Describa el trabajo.';
  else if (t.descripcion.length > limites.descripcion) errores['descripcion'] = `La descripción admite hasta ${limites.descripcion} caracteres.`;
  return errores;
}
export function leerBase64(archivo: Blob): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onerror = () => rechazar(new Error('No fue posible leer el archivo.'));
    lector.onload = () => { const r = String(lector.result); resolver(r.slice(r.indexOf(',') + 1)); };
    lector.readAsDataURL(archivo);
  });
}
/** Mensaje claro para el titular: causa del rechazo o límite superado. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorApi) {
    const detalle = error.detalles.map(d => d.motivo).filter(Boolean).join(' ');
    if (error.codigo === 'VERSION_DESACTUALIZADA') return 'Los datos cambiaron en otra sesión. Recargue su perfil antes de continuar.';
    if (error.codigo === 'DEPENDENCIA_NO_DISPONIBLE') return 'El servicio no está disponible por ahora. Sus datos guardados no cambiaron; reintente.';
    return detalle && !error.message.includes(detalle) ? `${error.message} ${detalle}` : error.message;
  }
  return error instanceof Error ? error.message : 'No fue posible completar la operación.';
}

export function claveIdempotencia(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (n) => n.toString(16).padStart(2, '0')).join('');
}

/** Casos de uso del titular. Una operación reintentada tras un fallo de red conserva su clave de idempotencia. */
export class PortafolioWeb {
  private readonly claves = new Map<string, string>();
  constructor(private readonly api: ApiPrestadores, private readonly nuevaClave: () => string = claveIdempotencia) {}

  private async conClave<T>(firma: string, ejecutar: (clave: string) => Promise<T>): Promise<T> {
    const clave = this.claves.get(firma) ?? this.nuevaClave();
    this.claves.set(firma, clave);
    try { const r = await ejecutar(clave); this.claves.delete(firma); return r; }
    catch (error) {
      // Un rechazo definitivo (4xx) libera la clave. Un fallo de red o 5xx la conserva para el reintento exacto.
      if (error instanceof ErrorApi && error.http < 500) this.claves.delete(firma);
      throw error;
    }
  }
  /** Devuelve `null` cuando el titular aún no tiene perfil. */
  async perfil(): Promise<PerfilPrivado | null> {
    try { return await this.api.obtenerPerfil(); }
    catch (error) { if (error instanceof ErrorApi && error.http === 404) return null; throw error; }
  }
  guardarPerfil(version: number, e: EntradaPerfil) { return this.conClave(`perfil:${version}:${JSON.stringify(e)}`, c => this.api.guardarPerfil(version, e, c)); }
  crearTrabajo(versionPerfil: number, d: EntradaTrabajo) { return this.conClave(`trabajo:${versionPerfil}:${JSON.stringify(d)}`, c => this.api.crearTrabajo(versionPerfil, d, c)); }
  editarTrabajo(trabajoId: string, version: number, cambios: Partial<EntradaTrabajo>) { return this.conClave(`edicion:${trabajoId}:${version}:${JSON.stringify(cambios)}`, c => this.api.editarTrabajo(trabajoId, version, cambios, c)); }
  async escritura(archivo: Blob & ArchivoImagen, versionTrabajo: number): Promise<EscrituraFotografia> {
    const problema = validarArchivoImagen(archivo);
    if (problema) throw new Error(problema);
    return { versionTrabajo, tipoMime: archivo.type as TipoMimeEntrada, contenidoBase64: await leerBase64(archivo) };
  }
  agregarFotografia(trabajoId: string, e: EscrituraFotografia) { return this.conClave(`foto:${trabajoId}:${e.versionTrabajo}:${e.contenidoBase64.length}:${e.contenidoBase64.slice(-32)}`, c => this.api.agregarFotografia(trabajoId, e, c)); }
  reemplazarFotografia(trabajoId: string, fotografiaId: string, e: EscrituraFotografia) { return this.conClave(`reemplazo:${fotografiaId}:${e.versionTrabajo}:${e.contenidoBase64.length}:${e.contenidoBase64.slice(-32)}`, c => this.api.reemplazarFotografia(trabajoId, fotografiaId, e, c)); }
  eliminarFotografia(trabajoId: string, fotografiaId: string, versionTrabajo: number) { return this.conClave(`baja:${fotografiaId}:${versionTrabajo}`, c => this.api.eliminarFotografia(trabajoId, fotografiaId, versionTrabajo, c)); }
  /** Las imágenes se piden solo cuando el titular las abre. */
  imagen(prestadorId: string, trabajoId: string, fotografiaId: string) { return this.api.obtenerFotografiaPublica(prestadorId, trabajoId, fotografiaId); }
}
