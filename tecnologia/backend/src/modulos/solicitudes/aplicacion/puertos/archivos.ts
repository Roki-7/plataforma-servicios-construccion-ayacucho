/** Objeto del almacenamiento de solicitudes con su fecha de modificación. */
export interface ObjetoListado { readonly clave: string; readonly modificado: Date }

/**
 * Almacén privado de archivos de solicitudes. Sus claves son opacas, inmutables y propias de la 003: `solicitudes/<solicitudId>/<archivoId>`
 * (o `pruebas/<uuid>/solicitudes/…` en pruebas). Nunca genera enlaces públicos ni firmados: toda lectura pasa por la API con autorización por archivo.
 */
export interface AlmacenArchivosSolicitud {
  claveNueva(solicitudId: string, archivoId: string): string;
  /** `true` solo para claves con la forma estricta del ámbito de este almacén. */
  pertenece(clave: string): boolean;
  guardar(clave: string, bytes: Uint8Array): Promise<void>;
  leer(clave: string): Promise<Uint8Array>;
  eliminar(clave: string): Promise<void>;
  listar(): AsyncIterable<ObjetoListado>;
}

/** Imagen ya saneada: WebP estático, sin metadatos de origen. */
export interface ImagenSaneada {
  readonly bytes: Uint8Array;
  readonly ancho: number;
  readonly alto: number;
  /** SHA-256 de `bytes`. */
  readonly checksum: Uint8Array;
}

export interface SaneadorImagenSolicitud {
  /** Valida el formato real, las dimensiones y el tamaño y recodifica a WebP sin EXIF ni GPS. Lanza `ErrorAplicacion` con el código del contrato. */
  sanear(contenidoBase64: string, mimeDeclarado: string): Promise<ImagenSaneada>;
}
