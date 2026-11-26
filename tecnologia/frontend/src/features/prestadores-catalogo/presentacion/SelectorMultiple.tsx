import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import './estilos-002.css';

export interface OpcionSelector { readonly id: string; readonly nombre: string }
interface Fila { readonly id: string; readonly texto: string; readonly nombre: string }
interface Grupo { readonly clave: string; readonly titulo?: string; readonly filas: Fila[] }

const separador = ' › ';
const normalizar = (t: string): string => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Agrupa las opciones planas «Raíz» y «Raíz › Subcategoría» por su raíz. La raíz con subcategorías aparece como «(toda la categoría)» dentro de su grupo, y las
 * subcategorías con su nombre propio: el título del grupo da el contexto. Las opciones sin jerarquía forman un único grupo sin título.
 */
function construirGrupos(opciones: readonly OpcionSelector[], agrupar: boolean): Grupo[] {
  if (!agrupar) return [{ clave: 'todas', filas: opciones.map(o => ({ id: o.id, texto: o.nombre, nombre: o.nombre })) }];
  const grupos = new Map<string, Grupo>(); const conHijas = new Set(opciones.filter(o => o.nombre.includes(separador)).map(o => o.nombre.split(separador)[0]!));
  for (const o of opciones) {
    const [raiz, hija] = o.nombre.includes(separador) ? o.nombre.split(separador) as [string, string] : [o.nombre, undefined];
    const grupo = grupos.get(raiz) ?? { clave: raiz, titulo: raiz, filas: [] }; grupos.set(raiz, grupo);
    grupo.filas.push({ id: o.id, nombre: o.nombre, texto: hija ?? (conHijas.has(raiz) ? `${raiz} (toda la categoría)` : raiz) });
  }
  return [...grupos.values()].map(g => (g.filas.length === 1 && !conHijas.has(g.clave) ? { clave: g.clave, filas: g.filas } : g));
}

/**
 * Selección múltiple desplegable: botón con resumen, etiquetas con las opciones elegidas (cada una se puede quitar), y un panel con buscador y una lista con
 * desplazamiento vertical agrupada por categoría. Las opciones son casillas nativas (teclado, lectores de pantalla y formularios funcionan como siempre): con
 * el foco en la lista, las flechas ↑ ↓, Inicio y Fin se desplazan entre ellas y Escape cierra el panel. No cambia los datos: devuelve la lista de identificadores.
 */
export function SelectorMultiple({ etiqueta, opciones, seleccion, alCambiar, deshabilitado = false, agrupar = true, vacio, descritoPor }: {
  readonly etiqueta: string; readonly opciones: readonly OpcionSelector[]; readonly seleccion: readonly string[]; readonly alCambiar: (ids: string[]) => void;
  readonly deshabilitado?: boolean; readonly agrupar?: boolean; readonly vacio?: string; readonly descritoPor?: string | undefined;
}) {
  const id = useId(); const [abierto, setAbierto] = useState(false); const [consulta, setConsulta] = useState('');
  const raiz = useRef<HTMLFieldSetElement>(null); const boton = useRef<HTMLButtonElement>(null); const busqueda = useRef<HTMLInputElement>(null); const lista = useRef<HTMLDivElement>(null);
  const minuscula = etiqueta.toLowerCase();
  const grupos = useMemo(() => construirGrupos(opciones, agrupar), [opciones, agrupar]);
  const filtrados = useMemo(() => {
    const q = normalizar(consulta.trim());
    return grupos.map(g => ({ ...g, filas: g.filas.filter(f => !q || normalizar(f.nombre).includes(q) || normalizar(f.texto).includes(q)) })).filter(g => g.filas.length > 0);
  }, [grupos, consulta]);
  const total = filtrados.reduce((n, g) => n + g.filas.length, 0);
  const elegidas = seleccion.map(s => opciones.find(o => o.id === s) ?? { id: s, nombre: `Elemento registrado ${s.slice(0, 8)}` });
  const alternar = (ident: string) => alCambiar(seleccion.includes(ident) ? seleccion.filter(x => x !== ident) : [...seleccion, ident]);

  useEffect(() => { if (!abierto) return; busqueda.current?.focus(); }, [abierto]);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => { if (!raiz.current?.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener('pointerdown', fuera); return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);
  const cerrar = (devolverFoco: boolean) => { setAbierto(false); setConsulta(''); if (devolverFoco) boton.current?.focus(); };
  function teclado(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(true); return; }
    const casillas = Array.from(lista.current?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? []); const activo = document.activeElement as HTMLElement | null;
    const enBusqueda = activo === busqueda.current; const indice = activo instanceof HTMLInputElement ? casillas.indexOf(activo) : -1;
    if (e.key === 'ArrowDown') { e.preventDefault(); (enBusqueda ? casillas[0] : casillas[Math.min(indice + 1, casillas.length - 1)])?.focus(); }
    else if (e.key === 'ArrowUp' && !enBusqueda) { e.preventDefault(); if (indice <= 0) busqueda.current?.focus(); else casillas[indice - 1]?.focus(); }
    else if (e.key === 'Home' && indice >= 0) { e.preventDefault(); casillas[0]?.focus(); }
    else if (e.key === 'End' && indice >= 0) { e.preventDefault(); casillas[casillas.length - 1]?.focus(); }
  }
  let posicion = 0;
  return <fieldset ref={raiz} className="p002-opciones p002-selector" aria-label={etiqueta} aria-describedby={descritoPor} disabled={deshabilitado}
    onBlur={e => { if (abierto && e.relatedTarget && !raiz.current?.contains(e.relatedTarget as Node)) cerrar(false); }}>
    <legend>{etiqueta}</legend>
    <button type="button" ref={boton} className="p002-selector-boton" aria-expanded={abierto} aria-controls={`${id}-panel`} onClick={() => (abierto ? cerrar(false) : setAbierto(true))}>
      <span>{elegidas.length === 0 ? `Seleccionar ${minuscula}` : `${elegidas.length} ${elegidas.length === 1 ? 'seleccionada' : 'seleccionadas'}`}</span>
      <svg className="p002-selector-flecha" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {abierto && <div id={`${id}-panel`} className="p002-selector-panel" role="group" aria-label={`Opciones de ${minuscula}`} onKeyDown={teclado}>
      <input ref={busqueda} type="search" className="p002-selector-busqueda" aria-label={`Buscar en ${minuscula}`} placeholder={`Buscar ${minuscula}…`} value={consulta} autoComplete="off" onChange={e => setConsulta(e.target.value)} />
      <p className="p002-ayuda" aria-live="polite">{total === 0 ? (opciones.length === 0 ? (vacio ?? 'No hay opciones disponibles.') : 'Ninguna opción coincide con la búsqueda.') : `${total} ${total === 1 ? 'opción' : 'opciones'}. Use las flechas ↑ ↓ para recorrerlas.`}</p>
      <div ref={lista} className="p002-selector-lista">
        {filtrados.map(g => {
          const idGrupo = `${id}-g-${g.clave.replace(/\W+/g, '-')}`;
          return <div key={g.clave} className="p002-selector-grupo" {...(g.titulo ? { role: 'group', 'aria-labelledby': idGrupo } : {})}>
            {g.titulo && <p className="p002-selector-titulo" id={idGrupo}>{g.titulo}</p>}
            {g.filas.map(f => { const i = posicion++; return <label className="p002-opcion" key={f.id}>
              <input type="checkbox" tabIndex={i === 0 ? 0 : -1} checked={seleccion.includes(f.id)} onChange={() => alternar(f.id)} />{f.texto}
            </label>; })}
          </div>;
        })}
      </div>
      <div className="p002-selector-pie">
        <button type="button" className="boton boton-secundario boton-compacto" disabled={seleccion.length === 0} onClick={() => alCambiar([])}>Quitar todas</button>
        <button type="button" className="boton boton-primario boton-compacto" onClick={() => cerrar(true)}>Listo</button>
      </div>
    </div>}
    {elegidas.length > 0 ? <ul className="p002-seleccion" aria-label={`${etiqueta} seleccionadas`}>
      {elegidas.map(o => <li key={o.id} className="p002-etiqueta"><span>{o.nombre}</span>
        <button type="button" aria-label={`Quitar ${o.nombre}`} onClick={() => alternar(o.id)}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18" /></svg></button></li>)}
    </ul> : <p className="p002-ayuda">Ninguna seleccionada.</p>}
  </fieldset>;
}
