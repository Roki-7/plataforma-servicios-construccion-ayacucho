import { archivoDemasiadoGrande, archivoExpirado, archivoNoListo, imagenDimensionesNoAdmitidas, imagenFormatoNoAdmitido, limiteArchivos, recursoNoDisponible } from './errores.js';
import { limitesDeArchivos, type EstadoDeArchivo } from './tipos.js';

/** Formatos reales admitidos y su tipo MIME. El formato real manda sobre la extensión y sobre el tipo declarado. */
export const formatosDeImagenAdmitidos = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;

export interface DescripcionDeImagen {
  readonly mimeDeclarado: string;
  readonly formatoReal: string | undefined;
  readonly ancho: number;
  readonly alto: number;
  readonly bytes: number;
}

/** Política de imágenes de una solicitud (FR-317 a FR-323): vacía, demasiado grande, formato real no admitido o no coincidente, o con más de 4 096 px por lado. */
export function exigirImagenAdmitida(imagen: DescripcionDeImagen): void {
  if (imagen.bytes <= 0) throw imagenFormatoNoAdmitido('El archivo está vacío.');
  if (imagen.bytes > limitesDeArchivos.bytesMaximosPorImagen) throw archivoDemasiadoGrande();
  const real = imagen.formatoReal ? (formatosDeImagenAdmitidos as Record<string, string>)[imagen.formatoReal] : undefined;
  if (!real) throw imagenFormatoNoAdmitido('El formato real del archivo no es JPG, PNG ni WEBP.');
  if (real !== imagen.mimeDeclarado) throw imagenFormatoNoAdmitido('El tipo declarado no coincide con el contenido.', 'tipoMime');
  if (imagen.ancho > limitesDeArchivos.ladoMaximo || imagen.alto > limitesDeArchivos.ladoMaximo) throw imagenDimensionesNoAdmitidas();
}

export interface ArchivoParaConfirmar {
  readonly id: string;
  readonly solicitudId: string;
  readonly estado: EstadoDeArchivo;
  readonly bytes: number;
  readonly caducaEn: Date | null;
}
export interface PlanDeConfirmacion {
  /** PREPARADO → CONFIRMADO. */
  readonly confirmar: readonly string[];
  /** CONFIRMADO ausente de la lista final → ELIMINADO (borrado lógico con purga). */
  readonly quitar: readonly string[];
  /** Lista final, sin repetidos. */
  readonly conjunto: readonly string[];
}

/**
 * Confirmación de archivos como una operación única de todo o nada (FR-347). Valida, en este orden por archivo: (a) que pertenezca a la solicitud (de lo
 * contrario, recurso inexistente, sin revelar a quién pertenece), (b) que esté PREPARADO (`ARCHIVO_NO_LISTO`), (c) que no haya caducado (`ARCHIVO_EXPIRADO`) y,
 * al final, (d) que la lista no supere 5 archivos ni 30 000 000 bytes (`LIMITE_ARCHIVOS`). Si algo falla lanza sin devolver ningún plan: nada se confirma.
 * `encontrados` son las filas de los identificadores pedidos (de cualquier solicitud); `confirmadosVigentes`, los CONFIRMADO actuales de la solicitud.
 */
export function planificarConfirmacion(entrada: {
  readonly solicitudId: string; readonly ids: readonly string[]; readonly encontrados: readonly ArchivoParaConfirmar[];
  readonly confirmadosVigentes: readonly ArchivoParaConfirmar[]; readonly ahora: Date;
}): PlanDeConfirmacion {
  const conjunto = [...new Set(entrada.ids.map(i => i.toLowerCase()))];
  const filas = new Map(entrada.encontrados.map(f => [f.id.toLowerCase(), f]));
  const confirmar: string[] = []; let bytes = 0;
  for (const id of conjunto) {
    const fila = filas.get(id);
    if (!fila || fila.solicitudId.toLowerCase() !== entrada.solicitudId.toLowerCase()) throw recursoNoDisponible();
    const vencido = fila.caducaEn !== null && fila.caducaEn.getTime() <= entrada.ahora.getTime();
    switch (fila.estado) {
      case 'CONFIRMADO': break;
      case 'PREPARANDO': throw archivoNoListo();
      case 'PREPARADO': if (vencido) throw archivoExpirado(); confirmar.push(id); break;
      case 'DESCARTADO': if (vencido) throw archivoExpirado(); throw recursoNoDisponible();
      case 'ELIMINADO': throw recursoNoDisponible();
    }
    bytes += fila.bytes;
  }
  if (conjunto.length > limitesDeArchivos.maximoPorSolicitud || bytes > limitesDeArchivos.bytesMaximosPorSolicitud) throw limiteArchivos();
  const quitar = entrada.confirmadosVigentes.map(a => a.id.toLowerCase()).filter(id => !conjunto.includes(id));
  return { confirmar, quitar, conjunto };
}

/** Un archivo no confirmado caduca a las 24 horas de su carga y desde entonces no cuenta para el cupo ni es accesible. */
export const caducidadDeCarga = (creado: Date): Date => new Date(creado.getTime() + limitesDeArchivos.caducidadHoras * 3_600_000);
export const haCaducado = (caducaEn: Date | null, ahora: Date): boolean => caducaEn !== null && caducaEn.getTime() <= ahora.getTime();
