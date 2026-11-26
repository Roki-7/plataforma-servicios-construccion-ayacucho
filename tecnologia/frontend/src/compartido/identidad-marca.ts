/** Identidad visual oficial: nombre, lema y recursos gráficos de WasiMaki. Los archivos están en `public/marca/` (ver `assets-fuente/marca/LEEME.md`). */
export const NOMBRE_MARCA = 'WasiMaki';
export const LEMA_MARCA = 'Buenas manos para tu hogar';

const RUTA = '/marca';
/** Logo completo (casco, casa, mano, arco, nombre, lema y rótulo) en tres anchos. Proporción 1250 × 970. */
export const LOGO_COMPLETO = {
  src: `${RUTA}/logo-completo-480.webp`, ancho: 480, alto: 372,
  srcSet: `${RUTA}/logo-completo-480.webp 480w, ${RUTA}/logo-completo-768.webp 768w, ${RUTA}/logo-completo-1200.webp 1200w`,
} as const;
/** Solo el emblema (sin texto), cuadrado, para espacios pequeños como la barra superior del celular. */
export const LOGO_EMBLEMA = {
  src: `${RUTA}/emblema-96.webp`, lado: 96,
  srcSet: `${RUTA}/emblema-96.webp 96w, ${RUTA}/emblema-192.webp 192w, ${RUTA}/emblema-384.webp 384w`,
} as const;
