import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import './barra-lateral.css';

export type NombreIcono = 'buscar' | 'cuenta' | 'perfiles' | 'profesional' | 'servicios' | 'registro' | 'acceso';
export interface EnlaceMenu { readonly href: string; readonly texto: string; readonly icono: NombreIcono; readonly actual: boolean }

/** Iconos lineales de 24 px: decorativos (el nombre del enlace lo da su texto). */
const trazos: Record<NombreIcono, ReactNode> = {
  buscar: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  cuenta: <><circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.9-3.6 3.8-5.6 7.5-5.6s6.6 2 7.5 5.6" /></>,
  perfiles: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2.2" /><path d="M5.8 16c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h4M14.5 13.5h3" /></>,
  profesional: <><path d="M4 20V9.5L12 4l8 5.5V20" /><path d="M9 20v-5.5h6V20" /></>,
  servicios: <><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 17.5h4" /></>,
  registro: <><circle cx="10" cy="8" r="3.6" /><path d="M3.5 20c.8-3.5 3.3-5.5 6.5-5.5M18 12v6M15 15h6" /></>,
  acceso: <><path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" /><path d="M10 8l4 4-4 4M14 12H4" /></>,
};
function Icono({ nombre }: { readonly nombre: NombreIcono }) {
  return <svg className="app-icono" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{trazos[nombre]}</svg>;
}

const consultaEscritorio = '(min-width: 48rem)';
/** `true` desde 768 px (menú lateral fijo). Sin `matchMedia` (por ejemplo, en pruebas) se asume escritorio. */
function useEscritorio(): boolean {
  const [escritorio, setEscritorio] = useState(() => (typeof matchMedia === 'function' ? matchMedia(consultaEscritorio).matches : true));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const lista = matchMedia(consultaEscritorio); const cambiar = () => setEscritorio(lista.matches);
    cambiar(); lista.addEventListener('change', cambiar); return () => lista.removeEventListener('change', cambiar);
  }, []);
  return escritorio;
}

/**
 * Navegación principal. En tableta y escritorio es una barra lateral fija a la izquierda; en celular, una barra superior con un botón de menú que despliega
 * un panel lateral (se cierra con el botón, la tecla Escape, tocando fuera o al elegir una opción, y no cubre el contenido de forma permanente).
 * Las rutas, la autenticación y el cierre de sesión los resuelve la composición: este componente solo presenta los enlaces que recibe.
 */
export function BarraLateral({ enlaces, alNavegar, cierre, ruta }: { readonly enlaces: readonly EnlaceMenu[]; readonly alNavegar: (e: MouseEvent<HTMLAnchorElement>) => void; readonly cierre?: ReactNode; readonly ruta: string }) {
  const escritorio = useEscritorio(); const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null); const nav = useRef<HTMLElement>(null);
  const visible = escritorio || abierto;
  useEffect(() => { setAbierto(false); }, [ruta, escritorio]);
  useEffect(() => {
    if (!abierto) return;
    nav.current?.querySelector<HTMLElement>('a, button')?.focus();
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') { setAbierto(false); boton.current?.focus(); } };
    document.addEventListener('keydown', alTeclear); return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);
  return <div className="app-lateral">
    <div className="app-marca">
      <h1>Plataforma Ayacucho</h1>
      <button type="button" ref={boton} className="app-menu-boton" aria-expanded={abierto} aria-controls="menu-principal" onClick={() => setAbierto(v => !v)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">{abierto ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}</svg>
        <span>Menú</span>
      </button>
    </div>
    <nav id="menu-principal" ref={nav} className="app-nav" aria-label="Navegación principal" hidden={!visible}>
      {enlaces.map(e => <a key={e.href} href={e.href} aria-current={e.actual ? 'page' : undefined} onClick={alNavegar}><Icono nombre={e.icono} /><span>{e.texto}</span></a>)}
      {cierre}
    </nav>
    {abierto && !escritorio && <div className="app-fondo" aria-hidden="true" onClick={() => setAbierto(false)} />}
  </div>;
}
