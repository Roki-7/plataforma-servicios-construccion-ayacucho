export type TipoSolicitud = 'PUBLICADA' | 'DIRIGIDA';
export type EstadoSolicitud = 'BORRADOR' | 'ABIERTA' | 'CERRADA';
export type TipoImagen = 'image/jpeg' | 'image/png' | 'image/webp';

export interface DatosSolicitud {
  tipo: TipoSolicitud;
  prestadorId?: string | undefined;
  servicioId?: string | undefined;
  descripcion?: string | undefined;
  medidas?: string | undefined;
  categoriaId?: string | undefined;
  distrito?: string | undefined;
  fechaDesde?: string | undefined;
  fechaHasta?: string | undefined;
  compartirFotografias?: boolean | undefined;
  archivosIds?: string[];
}

export interface Advertencia {
  codigo: string;
  campo?: string;
  mensaje: string;
}

export interface FotoSolicitud {
  archivoId: string;
  estado: 'PREPARADO' | 'CONFIRMADO';
  bytes: number;
  ancho: number;
  alto: number;
  caducaEn?: string;
}

export interface ResumenSolicitud {
  solicitudId: string;
  estado: EstadoSolicitud;
  tipo: TipoSolicitud;
  descripcionCorta?: string;
  distrito?: string;
  actualizadaEn: string;
  versionTrabajo: number;
}

export interface SolicitudPrivada extends DatosSolicitud, Omit<ResumenSolicitud, 'distrito'> {
  version: number;
  servicio?: { servicioId: string; titulo: string; categoriaId: string };
  archivos: FotoSolicitud[];
  advertencias: Advertencia[];
}

export interface Pagina<T> {
  elementos: T[];
  total: number;
  pagina: number;
  tamano: number;
}

export interface VersionTrabajo {
  numero: number;
  creadaEn: string;
  contenido: Pick<DatosSolicitud, 'descripcion' | 'medidas' | 'categoriaId' | 'distrito' | 'fechaDesde' | 'fechaHasta'> & {
    archivos: { archivoId: string; retirado: boolean }[];
  };
}

export interface ApiSolicitudes {
  listar(pagina: number, estado?: EstadoSolicitud): Promise<Pagina<ResumenSolicitud>>;
  obtener(id: string): Promise<SolicitudPrivada>;
  crear(datos: DatosSolicitud, clave: string): Promise<SolicitudPrivada>;
  editar(id: string, datos: Partial<DatosSolicitud> & { version: number }, clave: string): Promise<SolicitudPrivada>;
  publicar(id: string, datos: { version: number; archivosIds?: string[] }, clave: string): Promise<SolicitudPrivada>;
  cerrar(id: string, version: number, clave: string): Promise<SolicitudPrivada>;
  cargar(id: string, tipoMime: TipoImagen, contenidoBase64: string, clave: string): Promise<FotoSolicitud>;
  foto(id: string, archivoId: string, signal: AbortSignal): Promise<Blob>;
  versiones(id: string, pagina: number): Promise<Pagina<VersionTrabajo>>;
}
