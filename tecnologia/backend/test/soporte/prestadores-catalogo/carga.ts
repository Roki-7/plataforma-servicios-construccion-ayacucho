/**
 * T081 · Conjunto ficticio y determinista del escenario de carga de la 002 (EQ-01/PR01 y EQ-03/PR03).
 *
 * `generarCarga002` produce, a partir de una semilla, 1 000 prestadores y 5 000 servicios con categorías, relaciones y estados válidos, y calcula con las MISMAS reglas de
 * visibilidad que las consultas públicas (servicio PUBLICADO, clasificación efectivamente activa y prestador publicable) el resultado esperado de cada consulta que usa k6:
 * así el escenario comprueba la corrección de cada respuesta (total, tamaño de página, orden, estados y privacidad) y no solo su latencia. Es una función pura: no toca
 * ninguna base. `scripts/cargar-datos-carga-002.ts` la vuelca en una base descartable y escribe el manifiesto que lee `test/performance/prestadores-catalogo.k6.js`.
 *
 * No contiene datos personales: nombres genéricos («Prestador de carga 0001»), sin correos, documentos, direcciones ni teléfonos.
 */
export const cargaNominal002 = { semilla: 20_260_101, prestadores: 1_000, servicios: 5_000, tamanoPagina: 20 } as const;
export interface ConfiguracionCarga002 { readonly semilla: number; readonly prestadores: number; readonly servicios: number; readonly tamanoPagina: number }

export const uuidCarga = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = { categoria: 8_000, prestador: 10_000, servicio: 100_000, trabajo: 300_000 } as const;
export const distritosCarga = ['ayacucho', 'carmen-alto', 'san-juan-bautista', 'jesus-nazareno', 'andres-avelino-caceres-dorregaray'] as const;
export const tiposCarga = ['TECNICO', 'TRABAJADOR_DE_OFICIO', 'PROFESIONAL'] as const;
/** Clasificaciones de la semilla de la 002 que están efectivamente activas (el resto de la semilla está inactivo o sin servicios de carga). */
export const categoriasActivasDeLaSemilla = 4;

export interface CategoriaCarga { readonly id: string; readonly nombre: string; readonly nivel: 1 | 2; readonly padreId: string | null; readonly activa: boolean }
export interface PrestadorCarga { readonly id: string; readonly cuentaId: string; readonly nombre: string; readonly tipo: (typeof tiposCarga)[number]; readonly experiencia: string; readonly disponible: boolean; readonly publicable: boolean; readonly especialidades: readonly string[]; readonly distritos: readonly string[] }
export interface ServicioCarga { readonly id: string; readonly prestadorId: string; readonly categoriaId: string; readonly titulo: string; readonly descripcion: string; readonly estado: 'PUBLICADO' | 'PAUSADO' | 'RETIRADO' }
export interface TrabajoCarga { readonly id: string; readonly prestadorId: string; readonly titulo: string; readonly descripcion: string }

/** Generador pseudoaleatorio mulberry32: misma semilla, misma secuencia en cualquier máquina. */
export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296; };
}

export interface ConsultaEsperada {
  /** Cadena de consulta sin la página (por ejemplo `categoria=<id>&distrito=ayacucho`). */
  readonly consulta: string; readonly total: number; readonly paginas: number;
  /** Solo servicios: identificadores de categoría admitidos por el filtro de categoría (la categoría y sus subcategorías); vacío si no hay filtro. */
  readonly categoriasValidas: readonly string[];
}
export interface Carga002 {
  readonly configuracion: ConfiguracionCarga002;
  readonly categorias: readonly CategoriaCarga[]; readonly prestadores: readonly PrestadorCarga[]; readonly servicios: readonly ServicioCarga[]; readonly trabajos: readonly TrabajoCarga[];
  readonly manifiesto: ManifiestoCarga002;
}
export interface ManifiestoCarga002 {
  readonly version: 1; readonly semilla: number; readonly tamanoPagina: number;
  readonly conteos: { readonly prestadores: number; readonly servicios: number; readonly categoriasDeCarga: number; readonly serviciosPublicados: number; readonly serviciosPausados: number; readonly serviciosRetirados: number; readonly serviciosVisibles: number; readonly prestadoresPublicables: number };
  readonly categoriasPublicas: number;
  readonly busquedaServicios: readonly ConsultaEsperada[]; readonly busquedaPrestadores: readonly ConsultaEsperada[];
  /** `[id, prestadorId, visible]` de una muestra de servicios (visibles y no disponibles). */
  readonly detalleServicios: readonly (readonly [string, string, boolean])[];
  /** `[id, serviciosVisibles | -1]`: -1 indica un prestador no publicable (404). */
  readonly perfiles: readonly (readonly [string, number])[];
  readonly coberturaPosterior: readonly string[];
}

export function generarCarga002(configuracion: ConfiguracionCarga002 = cargaNominal002): Carga002 {
  const { semilla, prestadores: nPrestadores, servicios: nServicios, tamanoPagina } = configuracion;
  const azar = mulberry32(semilla); const entero = (n: number): number => Math.floor(azar() * n);
  /** Barajado de Fisher-Yates con el generador sembrado (no depende del algoritmo de ordenación del motor). */
  const barajar = <T>(lista: T[]): T[] => { for (let i = lista.length - 1; i > 0; i -= 1) { const j = entero(i + 1); [lista[i], lista[j]] = [lista[j]!, lista[i]!]; } return lista; };

  // Categorías de carga: 6 raíces con 4 subcategorías. La raíz 6 está inactiva (sus subcategorías quedan efectivamente inactivas) y una subcategoría de la raíz 5 tiene estado propio inactivo.
  const categorias: CategoriaCarga[] = [];
  for (let r = 0; r < 6; r += 1) {
    const raizId = uuidCarga(base.categoria + r * 10); categorias.push({ id: raizId, nombre: `Categoría de carga ${r + 1}`, nivel: 1, padreId: null, activa: r !== 5 });
    for (let h = 0; h < 4; h += 1) categorias.push({ id: uuidCarga(base.categoria + r * 10 + h + 1), nombre: `Subcategoría de carga ${r + 1}.${h + 1}`, nivel: 2, padreId: raizId, activa: !(r === 4 && h === 3) });
  }
  const porId = new Map(categorias.map((c) => [c.id, c])); const efectivamenteActiva = (c: CategoriaCarga): boolean => c.activa && (c.nivel === 1 || (porId.get(c.padreId!)?.activa ?? false));
  const activas = categorias.filter(efectivamenteActiva); const inactivas = categorias.filter((c) => !efectivamenteActiva(c));

  const prestadores: PrestadorCarga[] = []; const trabajos: TrabajoCarga[] = [];
  for (let i = 0; i < nPrestadores; i += 1) {
    const k = 1 + entero(3); const zonas = barajar([...distritosCarga]).slice(0, k).sort();
    const n = 1 + entero(2); const especialidades = [...new Set(Array.from({ length: n }, () => activas[entero(activas.length)]!.id))].sort();
    const id = uuidCarga(base.prestador + i);
    prestadores.push({ id, cuentaId: uuidCarga(500_000 + i), nombre: `Prestador de carga ${String(i + 1).padStart(4, '0')}`, tipo: tiposCarga[i % tiposCarga.length]!, experiencia: `Experiencia ficticia del prestador de carga ${i + 1}.`,
      disponible: azar() < 0.6, publicable: azar() < 0.95, especialidades, distritos: zonas });
    if (i % 5 === 0) for (let t = 0; t < 2; t += 1) trabajos.push({ id: uuidCarga(base.trabajo + i * 2 + t), prestadorId: id, titulo: `Trabajo ficticio ${t + 1} del prestador ${i + 1}`, descripcion: 'Trabajo anterior ficticio del conjunto de carga.' });
  }
  const servicios: ServicioCarga[] = [];
  for (let j = 0; j < nServicios; j += 1) {
    const prestador = prestadores[j % nPrestadores]!; const categoria = azar() < 0.95 ? activas[entero(activas.length)]! : inactivas[entero(inactivas.length)]!;
    const u = azar(); const estado = u < 0.8 ? 'PUBLICADO' : u < 0.9 ? 'PAUSADO' : 'RETIRADO';
    servicios.push({ id: uuidCarga(base.servicio + j), prestadorId: prestador.id, categoriaId: categoria.id, titulo: `Servicio de carga ${String(j + 1).padStart(5, '0')}`, descripcion: `Descripción ficticia del servicio de carga ${j + 1}.`, estado });
  }

  // Resultados esperados con las reglas de las consultas públicas.
  const prestadorDe = new Map(prestadores.map((p) => [p.id, p]));
  const visible = (s: ServicioCarga): boolean => s.estado === 'PUBLICADO' && efectivamenteActiva(porId.get(s.categoriaId)!) && prestadorDe.get(s.prestadorId)!.publicable;
  const visibles = servicios.filter(visible);
  const coincide = (p: PrestadorCarga, f: { distrito?: string; disponibilidad?: boolean; especialidad?: string }): boolean =>
    (f.especialidad === undefined || p.especialidades.includes(f.especialidad)) && (f.distrito === undefined || p.distritos.includes(f.distrito)) && (f.disponibilidad === undefined || p.disponible === f.disponibilidad);
  const enCategoria = (s: ServicioCarga, categoria?: string): boolean => categoria === undefined || s.categoriaId === categoria || porId.get(s.categoriaId)!.padreId === categoria;
  const validas = (categoria?: string): string[] => (categoria === undefined ? [] : categorias.filter((c) => c.id === categoria || c.padreId === categoria).map((c) => c.id));
  const cadena = (f: { categoria?: string; especialidad?: string; distrito?: string; disponibilidad?: boolean }): string =>
    [f.categoria && `categoria=${f.categoria}`, f.especialidad && `especialidad=${f.especialidad}`, f.distrito && `distrito=${f.distrito}`, f.disponibilidad !== undefined && `disponibilidad=${f.disponibilidad}`].filter(Boolean).join('&');
  const raicesActivas = categorias.filter((c) => c.nivel === 1 && efectivamenteActiva(c)); const hijasActivas = categorias.filter((c) => c.nivel === 2 && efectivamenteActiva(c));
  const filtros: { categoria?: string; especialidad?: string; distrito?: string; disponibilidad?: boolean }[] = [{}];
  raicesActivas.forEach((r, i) => filtros.push({ categoria: r.id }, { categoria: r.id, distrito: distritosCarga[i % distritosCarga.length]! }, { categoria: r.id, disponibilidad: true }));
  for (const h of hijasActivas.slice(0, 8)) filtros.push({ categoria: h.id }, { especialidad: h.id, distrito: 'ayacucho' });
  for (const d of distritosCarga) filtros.push({ distrito: d }, { distrito: d, disponibilidad: false });
  filtros.push({ disponibilidad: true }, { disponibilidad: false });
  const paginas = (total: number): number => Math.max(1, Math.ceil(total / tamanoPagina));
  const busquedaServicios = filtros.map((f): ConsultaEsperada => {
    const total = visibles.filter((s) => enCategoria(s, f.categoria) && coincide(prestadorDe.get(s.prestadorId)!, f)).length;
    return { consulta: cadena(f), total, paginas: paginas(total), categoriasValidas: validas(f.categoria) };
  });
  const busquedaPrestadores = filtros.map((f): ConsultaEsperada => {
    const total = prestadores.filter((p) => p.publicable && coincide(p, f) && (f.categoria === undefined || visibles.some((s) => s.prestadorId === p.id && enCategoria(s, f.categoria)))).length;
    return { consulta: cadena(f), total, paginas: paginas(total), categoriasValidas: [] };
  });
  // Muestras: servicios (visibles y no disponibles) y perfiles (publicables y no publicables), repartidas con la misma semilla.
  const muestra = <T>(lista: readonly T[], n: number): T[] => { const copia = [...lista]; const salida: T[] = []; while (salida.length < n && copia.length) salida.push(copia.splice(entero(copia.length), 1)[0]!); return salida; };
  const detalleServicios = [...muestra(visibles, Math.min(400, visibles.length)), ...muestra(servicios.filter((s) => !visible(s)), Math.min(40, servicios.length - visibles.length))].map((s) => [s.id, s.prestadorId, visible(s)] as const);
  const visiblesDe = new Map<string, number>(); for (const s of visibles) visiblesDe.set(s.prestadorId, (visiblesDe.get(s.prestadorId) ?? 0) + 1);
  const perfiles = [...muestra(prestadores.filter((p) => p.publicable), Math.min(300, nPrestadores)), ...muestra(prestadores.filter((p) => !p.publicable), Math.min(15, nPrestadores))]
    .map((p) => [p.id, p.publicable ? (visiblesDe.get(p.id) ?? 0) : -1] as const);

  const manifiesto: ManifiestoCarga002 = {
    version: 1, semilla, tamanoPagina,
    conteos: { prestadores: prestadores.length, servicios: servicios.length, categoriasDeCarga: categorias.length, serviciosPublicados: servicios.filter((s) => s.estado === 'PUBLICADO').length,
      serviciosPausados: servicios.filter((s) => s.estado === 'PAUSADO').length, serviciosRetirados: servicios.filter((s) => s.estado === 'RETIRADO').length, serviciosVisibles: visibles.length, prestadoresPublicables: prestadores.filter((p) => p.publicable).length },
    categoriasPublicas: categoriasActivasDeLaSemilla + activas.length, busquedaServicios, busquedaPrestadores, detalleServicios, perfiles,
    coberturaPosterior: ['10 000 solicitudes del escenario integral de EQ-01 (requieren la 003)', 'comparaciones de cotizaciones (requieren la 004 y posteriores)'],
  };
  return { configuracion, categorias, prestadores, servicios, trabajos, manifiesto };
}
