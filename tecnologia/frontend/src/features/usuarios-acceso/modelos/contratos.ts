// Derivado del contrato OpenAPI 1.0.1 de 001. Modelos puros; sin React ni HTTP.
export type Error = { readonly "codigo": string; readonly "mensaje": string; readonly "detalles": readonly ({ readonly "campo"?: string; readonly "motivo": string; })[]; };
export type ImagenEntrada = { readonly "tipoContenido": "image/jpeg" | "image/png" | "image/webp"; readonly "contenidoBase64": string; };
export type Registro = { readonly "nombreMostrar": string; readonly "correo": string; readonly "contrasena": string; readonly "confirmacionContrasena": string; readonly "perfiles": readonly ("cliente" | "prestador")[]; readonly "politicaPrivacidadAceptada": true; readonly "politicaPrivacidadVersion": string; readonly "telefono"?: string | null; readonly "distrito"?: string | null; readonly "fotografia"?: ImagenEntrada; };
export type RegistroResultado = { readonly "cuentaId": string; readonly "perfiles": readonly ("cliente" | "prestador")[]; readonly "version": number; };
export type InicioSesion = { readonly "correo": string; readonly "contrasena": string; };
export type SesionResultado = { readonly "tokenAcceso": string; readonly "tipo": "Bearer"; readonly "expiraEnSegundos": 900; readonly "renovacionVenceEn": string; readonly "autenticacionConContrasenaEn": string; readonly "csrfToken": string; };
export type CsrfResultado = { readonly "csrfToken": string; };
export type Reautenticacion = { readonly "contrasenaActual": string; };
export type ReautenticacionResultado = { readonly "autenticacionConContrasenaEn": string; };
export type SolicitudRecuperacion = { readonly "correo": string; };
export type SolicitudRecuperacionResultado = { readonly "mensaje": "Si el correo corresponde a una cuenta, recibirás instrucciones para recuperar el acceso"; };
export type ConsumirRecuperacion = { readonly "nuevaContrasena": string; readonly "confirmacionContrasena": string; readonly "version": number; };
export type OperacionResultado = { readonly "codigo": string; readonly "mensaje": string; };
export type Perfil = { readonly "cuentaId": string; readonly "nombreMostrar": string; readonly "correo": string; readonly "telefono": string | null; readonly "distrito": string | null; readonly "fotografiaId": string | null; readonly "perfiles": readonly ("cliente" | "prestador")[]; readonly "telefonoCompartible": boolean; readonly "version": number; };
export type ActualizarPerfil = { readonly "version": number; readonly "nombreMostrar"?: string; readonly "telefono"?: string | null; readonly "distrito"?: string | null; readonly "fotografiaId"?: string | null; readonly "autorizarCompartirTelefono"?: boolean; };
export type HabilitarPerfil = { readonly "version": number; readonly "perfil": "cliente" | "prestador"; readonly "confirmacionExplicita": true; };
export type SolicitarCambioCorreo = { readonly "version": number; readonly "nuevoCorreo": string; };
export type CambioCorreoPendiente = { readonly "cambioId": string; readonly "venceEn": string; readonly "mensaje": string; };
export type ConfirmarCambioCorreo = { readonly "version": number; readonly "versionDesafio": number; };
export type CambioContrasena = { readonly "version": number; readonly "contrasenaActual": string; readonly "nuevaContrasena": string; readonly "confirmacionContrasena": string; };
export type FotografiaResultado = { readonly "fotografiaId": string; readonly "tipoContenido": "image/jpeg" | "image/png" | "image/webp"; readonly "bytes": number; };
export type FotografiaLectura = { readonly "fotografiaId": string; readonly "tipoContenido": "image/jpeg" | "image/png" | "image/webp"; readonly "contenidoBase64": string; };
export type Salud = { readonly "estado": "disponible" | "noDisponible"; };
export interface OperacionesUsuarios {
  crearCuenta: { entrada: Registro; salida: RegistroResultado };
  iniciarSesion: { entrada: InicioSesion; salida: SesionResultado };
  cerrarSesion: { entrada: void; salida: void };
  renovarSesion: { entrada: void; salida: SesionResultado };
  obtenerCsrf: { entrada: void; salida: CsrfResultado };
  reautenticarSesion: { entrada: Reautenticacion; salida: ReautenticacionResultado };
  solicitarRecuperacion: { entrada: SolicitudRecuperacion; salida: SolicitudRecuperacionResultado };
  consumirRecuperacion: { entrada: ConsumirRecuperacion; salida: OperacionResultado };
  consultarPerfil: { entrada: void; salida: Perfil };
  actualizarPerfil: { entrada: ActualizarPerfil; salida: Perfil };
  habilitarPerfil: { entrada: HabilitarPerfil; salida: Perfil };
  solicitarCambioCorreo: { entrada: SolicitarCambioCorreo; salida: CambioCorreoPendiente };
  confirmarCambioCorreo: { entrada: ConfirmarCambioCorreo; salida: Perfil };
  cambiarContrasena: { entrada: CambioContrasena; salida: OperacionResultado };
  subirFotografia: { entrada: ImagenEntrada; salida: FotografiaResultado };
  leerFotografia: { entrada: void; salida: FotografiaLectura };
  comprobarSalud: { entrada: void; salida: Salud };
}
export const operaciones = {
  crearCuenta: { metodo: "POST", ruta: "/cuentas", protegida: false, idempotente: true, csrf: false },
  iniciarSesion: { metodo: "POST", ruta: "/sesiones", protegida: false, idempotente: false, csrf: false },
  cerrarSesion: { metodo: "DELETE", ruta: "/sesiones/actual", protegida: true, idempotente: false, csrf: false },
  renovarSesion: { metodo: "POST", ruta: "/sesiones/renovacion", protegida: false, idempotente: false, csrf: true },
  obtenerCsrf: { metodo: "GET", ruta: "/sesiones/csrf", protegida: false, idempotente: false, csrf: false },
  reautenticarSesion: { metodo: "POST", ruta: "/sesiones/reautenticacion", protegida: true, idempotente: false, csrf: false },
  solicitarRecuperacion: { metodo: "POST", ruta: "/recuperaciones", protegida: false, idempotente: false, csrf: false },
  consumirRecuperacion: { metodo: "POST", ruta: "/recuperaciones/{token}", protegida: false, idempotente: true, csrf: false },
  consultarPerfil: { metodo: "GET", ruta: "/perfil", protegida: true, idempotente: false, csrf: false },
  actualizarPerfil: { metodo: "PATCH", ruta: "/perfil", protegida: true, idempotente: true, csrf: false },
  habilitarPerfil: { metodo: "POST", ruta: "/perfil/perfiles", protegida: true, idempotente: true, csrf: false },
  solicitarCambioCorreo: { metodo: "POST", ruta: "/perfil/cambios-correo", protegida: true, idempotente: true, csrf: false },
  confirmarCambioCorreo: { metodo: "POST", ruta: "/perfil/cambios-correo/{token}/confirmacion", protegida: true, idempotente: true, csrf: false },
  cambiarContrasena: { metodo: "POST", ruta: "/perfil/cambios-contrasena", protegida: true, idempotente: true, csrf: false },
  subirFotografia: { metodo: "POST", ruta: "/perfil/fotografias", protegida: true, idempotente: true, csrf: false },
  leerFotografia: { metodo: "GET", ruta: "/perfil/fotografias/{fotografiaId}", protegida: true, idempotente: false, csrf: false },
  comprobarSalud: { metodo: "GET", ruta: "/salud", protegida: false, idempotente: false, csrf: false },
} as const;
