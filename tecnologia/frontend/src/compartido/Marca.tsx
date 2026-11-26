import { LOGO_COMPLETO, LOGO_EMBLEMA, NOMBRE_MARCA } from './identidad-marca.js';

/**
 * Marca de la navegación: emblema de WasiMaki dentro de un círculo (sin recuadro) junto al nombre. El emblema es decorativo (`alt` vacío):
 * el nombre accesible lo da el texto «WasiMaki». El tamaño del círculo lo define el CSS según el ancho de pantalla (`barra-lateral.css`).
 */
export function Marca({ className = '' }: { readonly className?: string }) {
  return <span className={`marca ${className}`.trim()}>
    <span className="marca-emblema-circulo" aria-hidden="true">
      <img src={LOGO_EMBLEMA.src} srcSet={LOGO_EMBLEMA.srcSet} sizes="(min-width: 48rem) 4.5rem, 2.5rem" width={LOGO_EMBLEMA.lado} height={LOGO_EMBLEMA.lado} alt="" loading="eager" decoding="async" />
    </span>
    <span className="marca-nombre">{NOMBRE_MARCA}</span>
  </span>;
}

/** Portada con el logo completo para las pantallas públicas de acceso y registro. Decorativa: el título de cada pantalla sigue siendo su encabezado. */
export function PortadaMarca() {
  return <div className="portada-marca" aria-hidden="true">
    <img src={LOGO_COMPLETO.src} srcSet={LOGO_COMPLETO.srcSet} sizes="(min-width: 48rem) 20rem, 16rem" width={LOGO_COMPLETO.ancho} height={LOGO_COMPLETO.alto} alt="" decoding="async" />
  </div>;
}
