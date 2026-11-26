/** Vectores de INC-002-01. Los mismos casos se comparan contra `catalogo_clave_nombre` de PostgreSQL en la prueba de integración. */
export const VECTORES_NORMALIZACION: readonly (readonly [string, string, string])[] = [
  ['tilde y mayúsculas', 'Albañilería', 'albañileria'], ['mayúsculas', 'ALBAÑILERÍA', 'albañileria'], ['sin tildes de vocal', 'Pintúra', 'pintura'],
  ['ñ distinta de n', 'Cañería', 'cañeria'], ['n sin tilde', 'Caneria', 'caneria'], ['Ñ inicial', 'Ñandú', 'ñandu'],
  ['quechua ñawpaq', 'Ñawpaq', 'ñawpaq'], ['quechua nawpaq', 'Nawpaq', 'nawpaq'], ['quechua ñuñu', 'ÑUÑU', 'ñuñu'], ['quechua nunu', 'Nunu', 'nunu'],
  ['ñ descompuesta', 'Año', 'año'], ['ñ con n y tilde combinante', 'An\u0303o', 'año'], ['apóstrofo quechua', "Q'ero", "q'ero"], ['apóstrofo tipográfico', 'Ch’aska', 'ch’aska'],
  ['espacio final', 'Pintura ', 'pintura'], ['espacios múltiples', '  Pintura   de   muros  ', 'pintura de muros'], ['tabulador y salto', 'Pintura\tde\nmuros', 'pintura de muros'],
  ['espacio no separable', 'Pintura\u00a0de muros', 'pintura de muros'], ['espacio em y ancho completo', 'a\u2003b\u3000c', 'a b c'], ['separador de línea', 'Pintura\u2028muros', 'pintura muros'],
  ['NEL', 'a\u0085b', 'a b'], ['espacio ogham', 'a\u1680b', 'a b'], ['espacio estrecho', 'a\u202fb', 'a b'], ['espacio medio matemático', 'a\u205fb', 'a b'],
  ['espacio de ancho cero se conserva', 'Pin\u200btura', 'pin\u200btura'], ['circunflejo suelto', 'Cafe^', 'cafe^'], ['acento grave suelto', 'Cafe`', 'cafe`'], ['diéresis suelta', 'Cafe¨', 'cafe¨'],
  ['punto medio', 'Pintura · muros', 'pintura · muros'], ['e descompuesta', 'Cafe\u0301', 'cafe'], ['I con punto', 'İstanbul', 'istanbul'], ['ligadura', 'ﬁbra', 'ﬁbra'],
  ['ß', 'Straße', 'straße'], ['sigma final', 'ΑΣ', 'ασ'], ['ancho completo', 'ＰＩＮ', 'ｐｉｎ'], ['emoji', 'Pintura 🎨', 'pintura 🎨'],
];
