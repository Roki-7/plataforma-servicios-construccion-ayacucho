import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import type { DatosSolicitud, SolicitudPrivada, TipoImagen } from '../modelos/contratos.js';

export function datosDe(solicitud: SolicitudPrivada): DatosSolicitud {
  return {
    tipo: solicitud.tipo, prestadorId: solicitud.prestadorId, servicioId: solicitud.servicio?.servicioId,
    descripcion: solicitud.descripcion, medidas: solicitud.medidas, categoriaId: solicitud.categoriaId,
    distrito: solicitud.distrito, fechaDesde: solicitud.fechaDesde, fechaHasta: solicitud.fechaHasta,
    compartirFotografias: Boolean(solicitud.compartirFotografias),
  };
}

export function cambiosDe(datos: DatosSolicitud): DatosSolicitud;
export function cambiosDe(datos: DatosSolicitud, actual: SolicitudPrivada): Partial<DatosSolicitud>;
export function cambiosDe(datos: DatosSolicitud, actual?: SolicitudPrivada): Partial<DatosSolicitud> {
  const { tipo, descripcion, medidas, servicioId, prestadorId, categoriaId, distrito, fechaDesde, fechaHasta, compartirFotografias } = datos;
  const limpios: DatosSolicitud = {
    tipo, descripcion: descripcion?.trim() || undefined, medidas: medidas?.trim() || undefined,
    prestadorId: tipo === 'DIRIGIDA' ? prestadorId : undefined,
    servicioId: tipo === 'DIRIGIDA' ? servicioId : undefined,
    categoriaId: tipo === 'DIRIGIDA' && servicioId ? undefined : categoriaId,
    distrito, fechaDesde, fechaHasta, compartirFotografias: tipo === 'PUBLICADA' ? Boolean(compartirFotografias) : undefined,
  };
  if (!actual) return limpios;
  const antes = datosDe(actual);
  return Object.fromEntries(Object.entries(limpios).filter(([campo, valor]) => valor !== undefined && valor !== antes[campo as keyof DatosSolicitud]));
}

export function validarCampos(datos: DatosSolicitud, actual?: SolicitudPrivada) {
  const textos = [['descripcion', datos.descripcion, 2000], ['medidas', datos.medidas, 500]] as const;
  const detalles: { campo: string; motivo: string }[] = textos.filter(([, texto, limite]) => (texto?.trim().length ?? 0) > limite)
    .map(([campo, , limite]) => ({ campo, motivo: `Admite hasta ${limite} caracteres.` }));
  if (actual) {
    for (const campo of ['descripcion', 'medidas', 'distrito', 'fechaDesde', 'fechaHasta'] as const) {
      if (actual[campo] && !datos[campo]?.trim()) detalles.push({ campo, motivo: 'Introduce un valor para sustituir el dato guardado.' });
    }
    if (actual.categoriaId && !datos.categoriaId && !datos.servicioId) detalles.push({ campo: 'categoriaId', motivo: 'Elige una categoría.' });
  }
  if (detalles.length) throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Revisa los campos indicados.', detalles);
}

export function fechaLima() {
  const partes = new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts();
  return ['year', 'month', 'day'].map(tipo => partes.find(p => p.type === tipo)?.value).join('-');
}

export const tiposImagen = ['image/jpeg', 'image/png', 'image/webp'] as const;
export function validarFoto(archivo: File): TipoImagen {
  if (!tiposImagen.some(tipo => tipo === archivo.type)) throw new Error(`${archivo.name}: elija una imagen JPG, PNG o WebP.`);
  if (archivo.size > 10_000_000) throw new Error(`${archivo.name}: supera el límite de 10 MB.`);
  return archivo.type as TipoImagen;
}

export function base64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    lector.onload = () => {
      const contenido = String(lector.result).split(',')[1];
      if (contenido) resolve(contenido);
      else reject(new Error('El archivo seleccionado está vacío.'));
    };
    lector.readAsDataURL(archivo);
  });
}

export function mensajeSolicitud(error: unknown): string {
  if (error instanceof ErrorApi) {
    if (error.http === 404) return 'La solicitud o el archivo ya no está disponible.';
    if (error.http === 403) return 'Para gestionar solicitudes, habilite el perfil de cliente en Mis perfiles.';
  }
  return error instanceof Error ? error.message : 'No se pudo completar la operación.';
}
