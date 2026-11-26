import type { CSSProperties } from 'react';

/** Iniciales (hasta dos) del nombre: primera letra o dígito de las dos primeras palabras. Conserva la ñ, las tildes y las letras quechuas. */
export function inicialesDe(nombre: string): string {
  const palabras = nombre.normalize('NFC').split(/\s+/u).filter(p => /[\p{L}\p{N}]/u.test(p));
  const letras = palabras.slice(0, 2).map(p => (/[\p{L}\p{N}]/u.exec(p) as RegExpExecArray)[0].toLocaleUpperCase('es'));
  return letras.join('') || '·';
}

export type TamanoAvatar = 'pequeno' | 'mediano' | 'grande';

/**
 * Avatar circular reutilizable. Con `url` muestra la fotografía; sin ella, las iniciales del nombre sobre el color de la marca.
 * `alt` vacío (por defecto) lo vuelve decorativo: úsese cuando el nombre de la persona ya aparece como texto al lado.
 */
export function Avatar({ nombre, url, tamano = 'mediano', alt = '', style }: { readonly nombre: string; readonly url?: string | undefined; readonly tamano?: TamanoAvatar; readonly alt?: string; readonly style?: CSSProperties }) {
  const base = `avatar avatar-${tamano}`;
  if (url) return <span className={base} style={style}><img src={url} alt={alt} /></span>;
  return <span className={`${base} avatar-iniciales`} style={style} {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}><span aria-hidden="true">{inicialesDe(nombre)}</span></span>;
}
