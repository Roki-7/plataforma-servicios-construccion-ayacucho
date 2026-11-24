/**
 * T080 · Mediciones que se ejecutan DENTRO de la página (`page.evaluate`). Cada función es autónoma (no usa nada del módulo): Playwright la serializa tal cual.
 * No son una herramienta de terceros: miden criterios concretos de WCAG 2.2 AA y de EQ-07 con el DOM y los estilos calculados reales de cada navegador.
 */

export interface HallazgoDiseno { desbordamientoHorizontal: number; anchoVentana: number; fueraDeVentana: string[]; solapes: string[]; pequenos: string[]; recortados: string[]; controles: number; objetivoMinimo: number }

/** Desplazamiento horizontal general, elementos fuera de la ventana, controles superpuestos, objetivos táctiles pequeños y texto recortado. */
export function medirDiseno(minimoObjetivo: number): HallazgoDiseno {
  const visible = (e: Element): boolean => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const nombre = (e: Element): string => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 40) ? `«${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)}»` : ''}`;
  const todos = Array.from(document.querySelectorAll('body *')).filter(visible);
  const anchoVentana = document.documentElement.clientWidth;
  // Un elemento dentro de un contenedor con su propio desplazamiento horizontal no cuenta como desbordamiento general.
  const enContenedorDesplazable = (e: Element): boolean => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true; } return false; };
  const fueraDeVentana = todos.filter((e) => { const r = e.getBoundingClientRect(); return (r.right > anchoVentana + 1 || r.left < -1) && !enContenedorDesplazable(e); }).map(nombre).slice(0, 8);
  const interactivos = todos.filter((e) => e.matches('a[href], button, input:not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])') && !(e as HTMLInputElement).disabled);
  // Las casillas y radios se activan también con su etiqueta: el objetivo es la etiqueta que los envuelve.
  const objetivo = (e: Element): DOMRect => { if (e.matches('input[type=checkbox], input[type=radio]')) { const l = e.closest('label'); if (l) return l.getBoundingClientRect(); } return e.getBoundingClientRect(); };
  const pequenos = interactivos.filter((e) => { const r = objetivo(e); return r.width < minimoObjetivo - 0.5 || r.height < minimoObjetivo - 0.5; }).map(nombre).slice(0, 8);
  let objetivoMinimo = Infinity; for (const e of interactivos) { const r = objetivo(e); objetivoMinimo = Math.min(objetivoMinimo, r.width, r.height); }
  // Una barra fija o adherida (menú superior en celular, barra lateral) siempre se superpone en pantalla con el contenido que se desplaza por debajo: no es un solape de controles.
  const fijo = (e: Element): boolean => { for (let p: Element | null = e; p; p = p.parentElement) { const pos = getComputedStyle(p).position; if (pos === 'fixed' || pos === 'sticky') return true; } return false; };
  const solapes: string[] = [];
  for (let i = 0; i < interactivos.length; i += 1) for (let j = i + 1; j < interactivos.length; j += 1) {
    const a = interactivos[i]!; const b = interactivos[j]!; if (a.contains(b) || b.contains(a) || fijo(a) !== fijo(b)) continue;
    const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect(); const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left); const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    // La casilla y su etiqueta se solapan por diseño; se ignoran los pares dentro de la misma etiqueta.
    if (w > 2 && h > 2 && !(a.closest('label') && a.closest('label') === b.closest('label'))) solapes.push(`${nombre(a)} ↔ ${nombre(b)}`);
  }
  const recortados = todos.filter((e) => { const s = getComputedStyle(e); return /(hidden|clip)/.test(s.overflowX) && e.scrollWidth > e.clientWidth + 1 && e.children.length === 0 && (e.textContent ?? '').trim().length > 0 && s.textOverflow !== 'ellipsis' ? true : false; }).map(nombre).slice(0, 8);
  return { desbordamientoHorizontal: document.documentElement.scrollWidth - anchoVentana, anchoVentana, fueraDeVentana, solapes: solapes.slice(0, 8), pequenos, recortados, controles: interactivos.length, objetivoMinimo: Number.isFinite(objetivoMinimo) ? Math.round(objetivoMinimo * 10) / 10 : 0 };
}

export interface HallazgoNombres { sinNombre: string[]; imagenesSinAlt: string[]; saltosDeEncabezado: string[]; sinIdioma: boolean; marcas: { main: number; nav: number; h1: number }; campos: number }

/** Nombre accesible aproximado (aria-label, aria-labelledby, etiqueta, contenido, title, alt) de cada control visible; estructura de encabezados y puntos de referencia. */
export function medirNombres(): HallazgoNombres {
  const visible = (e: Element): boolean => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const texto = (e: Element): string => (e.textContent ?? '').replace(/\s+/g, ' ').trim();
  const nombreAccesible = (e: Element): string => {
    const l = e.getAttribute('aria-label'); if (l?.trim()) return l.trim();
    const ids = e.getAttribute('aria-labelledby'); if (ids) { const t = ids.split(/\s+/).map((i) => document.getElementById(i)).filter(Boolean).map((x) => texto(x!)).join(' ').trim(); if (t) return t; }
    if (e.matches('input, select, textarea')) {
      const el = e as HTMLInputElement; const etiquetas = Array.from(el.labels ?? []);
      for (const et of etiquetas) { const copia = et.cloneNode(true) as HTMLElement; copia.querySelectorAll('input, select, textarea, option').forEach((c) => c.remove()); const t = texto(copia); if (t) return t; }
      if (el.type === 'submit' || el.type === 'button') return el.value;
      return el.title ?? '';
    }
    if (e.tagName === 'IMG') return e.getAttribute('alt') ?? '';
    const t = texto(e); if (t) return t; const im = e.querySelector('img[alt]'); if (im?.getAttribute('alt')) return im.getAttribute('alt')!;
    return e.getAttribute('title') ?? '';
  };
  const controles = Array.from(document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=link], [role=checkbox], [role=radio]')).filter(visible);
  const sinNombre = controles.filter((e) => !nombreAccesible(e)).map((e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}[${e.getAttribute('type') ?? ''}]`);
  const imagenesSinAlt = Array.from(document.querySelectorAll('img')).filter(visible).filter((i) => !i.hasAttribute('alt')).map((i) => i.src.slice(0, 40));
  const encabezados = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).filter(visible); const saltos: string[] = []; let previo = 0;
  for (const h of encabezados) { const n = Number(h.tagName[1]); if (previo && n > previo + 1) saltos.push(`${h.tagName.toLowerCase()}«${texto(h).slice(0, 30)}» tras h${previo}`); previo = n; }
  return { sinNombre, imagenesSinAlt, saltosDeEncabezado: saltos, sinIdioma: !document.documentElement.getAttribute('lang'), marcas: { main: document.querySelectorAll('main').length, nav: document.querySelectorAll('nav').length, h1: document.querySelectorAll('h1').length }, campos: controles.filter((e) => e.matches('input, select, textarea')).length };
}

export interface HallazgoContraste { fallos: { elemento: string; texto: string; razon: number; minimo: number }[]; comprobados: number; peor: number; bordes: { elemento: string; razon: number }[]; omitidosPorFondoComplejo: number }

/** Relación de contraste de todo el texto visible (4,5:1; 3:1 si es grande) y de los bordes de los campos de formulario (3:1). Los controles deshabilitados están exentos. */
export function medirContraste(): HallazgoContraste {
  const canal = (v: number): number => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const luminancia = (c: number[]): number => 0.2126 * canal(c[0]!) + 0.7152 * canal(c[1]!) + 0.0722 * canal(c[2]!);
  const analizar = (valor: string): number[] | null => { const m = valor.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number); return p.length >= 3 ? [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1] : null; };
  const mezclar = (sobre: number[], base: number[]): number[] => { const a = sobre[3]!; return [sobre[0]! * a + base[0]! * (1 - a), sobre[1]! * a + base[1]! * (1 - a), sobre[2]! * a + base[2]! * (1 - a), 1]; };
  let omitidos = 0;
  const fondoDe = (e: Element): number[] | null => {
    const capas: number[][] = [];
    for (let p: Element | null = e; p; p = p.parentElement) {
      const s = getComputedStyle(p); if (s.backgroundImage && s.backgroundImage !== 'none') { omitidos += 1; return null; }
      const c = analizar(s.backgroundColor); if (c && c[3]! > 0) { capas.push(c); if (c[3] === 1) break; }
    }
    let base = [255, 255, 255, 1]; for (const c of capas.reverse()) base = mezclar(c, base); return base;
  };
  const razon = (a: number[], b: number[]): number => { const l1 = luminancia(a); const l2 = luminancia(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const nombre = (e: Element): string => `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? `.${e.className.split(' ')[0]}` : ''}`;
  const fallos: HallazgoContraste['fallos'] = []; let comprobados = 0; let peor = Infinity;
  const visible = (e: Element): boolean => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0; };
  const caminante = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const vistos = new Set<Element>();
  for (let n = caminante.nextNode(); n; n = caminante.nextNode()) {
    const e = n.parentElement; if (!e || vistos.has(e) || !(n.textContent ?? '').trim() || !visible(e) || e.closest('script, style, option')) continue;
    vistos.add(e); if (e.closest(':disabled') || e.closest('fieldset:disabled')) continue;
    const s = getComputedStyle(e); const fondo = fondoDe(e); const color = analizar(s.color); if (!fondo || !color) continue;
    // La opacidad del propio elemento o de sus ancestros atenúa el color efectivo.
    let opacidad = 1; for (let p: Element | null = e; p; p = p.parentElement) opacidad *= Number(getComputedStyle(p).opacity);
    const frente = mezclar([color[0]!, color[1]!, color[2]!, color[3]! * opacidad], fondo);
    const tam = parseFloat(s.fontSize); const grande = tam >= 24 || (tam >= 18.66 && Number(s.fontWeight) >= 700); const minimo = grande ? 3 : 4.5; const r = razon(frente, fondo);
    comprobados += 1; peor = Math.min(peor, r); if (r < minimo) fallos.push({ elemento: nombre(e), texto: (n.textContent ?? '').trim().slice(0, 40), razon: Math.round(r * 100) / 100, minimo });
  }
  // Contraste de componentes de interfaz (1.4.11): el borde de cada campo frente al fondo que lo rodea.
  const bordes: HallazgoContraste['bordes'] = [];
  for (const c of Array.from(document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea')).filter(visible)) {
    if ((c as HTMLInputElement).disabled) continue; const s = getComputedStyle(c); const borde = analizar(s.borderTopColor); const entorno = c.parentElement ? fondoDe(c.parentElement) : null;
    if (!borde || !entorno || parseFloat(s.borderTopWidth) < 1) continue; const r = razon(mezclar(borde, entorno), entorno);
    if (r < 3) bordes.push({ elemento: nombre(c), razon: Math.round(r * 100) / 100 });
  }
  return { fallos, comprobados, peor: Number.isFinite(peor) ? Math.round(peor * 100) / 100 : 0, bordes, omitidosPorFondoComplejo: omitidos };
}

export interface Foco { etiqueta: string; nombre: string; indice: number; enVentana: boolean; indicador: boolean; contrasteIndicador: number; tabIndexPositivo: boolean; arriba: number; izquierda: number; fijo: boolean; geometria: string }

/** Describe el elemento enfocado: dónde está en el documento, si es visible y si el foco tiene un indicador de al menos 3:1. */
export function describirFoco(): Foco | null {
  const e = document.activeElement as HTMLElement | null; if (!e || e === document.body || e === document.documentElement) return null;
  let fijo = false; for (let p: Element | null = e; p; p = p.parentElement) { const pos = getComputedStyle(p).position; if (pos === 'fixed' || pos === 'sticky') { fijo = true; break; } }
  const todos = Array.from(document.querySelectorAll('*')); const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
  const analizar = (valor: string): number[] | null => { const m = valor.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1]!.split(/[ ,/]+/).filter(Boolean).map(Number); return p.length >= 3 ? [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1] : null; };
  const canal = (v: number): number => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  const lum = (c: number[]): number => 0.2126 * canal(c[0]!) + 0.7152 * canal(c[1]!) + 0.0722 * canal(c[2]!);
  let fondo = [255, 255, 255, 1]; for (let p: Element | null = e.parentElement; p; p = p.parentElement) { const c = analizar(getComputedStyle(p).backgroundColor); if (c && c[3] === 1) { fondo = c; break; } }
  const contornoVisible = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0; const color = contornoVisible ? analizar(s.outlineColor) : null;
  const sombra = s.boxShadow !== 'none'; let contraste = 0;
  if (color) contraste = (Math.max(lum(color), lum(fondo)) + 0.05) / (Math.min(lum(color), lum(fondo)) + 0.05);
  const nombre = (e.getAttribute('aria-label') ?? (e.textContent ?? '')).replace(/\s+/g, ' ').trim().slice(0, 40) || (e as HTMLInputElement).name || e.tagName;
  return { etiqueta: e.tagName.toLowerCase(), nombre, indice: todos.indexOf(e), enVentana: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth, indicador: contornoVisible || sombra, contrasteIndicador: Math.round(contraste * 100) / 100, tabIndexPositivo: e.tabIndex > 0, arriba: Math.round(r.top + window.scrollY), izquierda: Math.round(r.left), fijo, geometria: `top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} alto=${window.innerHeight} scrollY=${Math.round(window.scrollY)}` };
}

/** Controles visibles que deberían ser alcanzables con Tab (los radios no marcados se alcanzan con las flechas, y los deshabilitados no se enfocan). */
export function controlesAlcanzables(): string[] {
  const visible = (e: Element): boolean => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  return Array.from(document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary')).filter(visible)
    .filter((e) => !(e as HTMLInputElement).disabled && !e.closest('fieldset:disabled') && !((e as HTMLInputElement).type === 'radio' && !(e as HTMLInputElement).checked))
    .map((e) => `${e.tagName.toLowerCase()}|${(e.getAttribute('aria-label') ?? (e.textContent ?? '')).replace(/\s+/g, ' ').trim().slice(0, 40) || (e as HTMLInputElement).name || e.tagName}`);
}
