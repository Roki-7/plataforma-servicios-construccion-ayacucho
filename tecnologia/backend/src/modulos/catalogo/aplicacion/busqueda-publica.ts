import { datosInvalidos, ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import type { ConsultasPublicas, FiltrosOferta, PaginaDto, PrestadorResumenDto, ServicioPublicoDto } from './puertos/consultas-publicas.js';

export const paginacion = { primera: 1, tamanoPredeterminado: 20, tamanoMaximo: 50 } as const;
/** Consulta ya validada por el contrato: valores de `res.locals.consulta002`. */
export interface ConsultaCruda { readonly categoria?: unknown; readonly especialidad?: unknown; readonly distrito?: unknown; readonly disponibilidad?: unknown; readonly pagina?: unknown; readonly tamano?: unknown }

function entero(valor: unknown, predeterminado: number, minimo: number, maximo: number, campo: string): number {
  if (valor === undefined) return predeterminado;
  if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < minimo || valor > maximo) throw datosInvalidos('Parámetro de consulta no válido.', [{ campo, motivo: 'Valor fuera de rango.' }]);
  return valor;
}
/** Normaliza: UUID en minúsculas, `pagina` desde 1 y `tamano` de 20 por defecto con máximo de 50. Ignora filtros ausentes. */
export function normalizarFiltros(c: ConsultaCruda): FiltrosOferta {
  const texto = (v: unknown, campo: string) => {
    if (v === undefined) return undefined;
    if (typeof v !== 'string' || v === '') throw datosInvalidos('Parámetro de consulta no válido.', [{ campo, motivo: 'Valor no válido.' }]);
    return v;
  };
  const categoria = texto(c.categoria, 'categoria'); const especialidad = texto(c.especialidad, 'especialidad'); const distrito = texto(c.distrito, 'distrito');
  if (c.disponibilidad !== undefined && typeof c.disponibilidad !== 'boolean') throw datosInvalidos('Parámetro de consulta no válido.', [{ campo: 'disponibilidad', motivo: 'Debe ser true o false.' }]);
  return {
    ...(categoria ? { categoria: uuidEnMinusculas(categoria) } : {}), ...(especialidad ? { especialidad: uuidEnMinusculas(especialidad) } : {}),
    ...(distrito ? { distrito } : {}), ...(c.disponibilidad === undefined ? {} : { disponibilidad: c.disponibilidad as boolean }),
    pagina: entero(c.pagina, paginacion.primera, 1, 2_147_483_647, 'pagina'), tamano: entero(c.tamano, paginacion.tamanoPredeterminado, 1, paginacion.tamanoMaximo, 'tamano'),
  };
}

export interface PaginaPublica<T> { readonly elementos: readonly T[]; readonly total: number; readonly pagina: number; readonly tamano: number }
const pagina = <T>(r: PaginaDto<T>, f: FiltrosOferta): PaginaPublica<T> => ({ elementos: r.elementos, total: r.total, pagina: f.pagina, tamano: f.tamano });

/** Búsqueda pública base de servicios y prestadores. Un resultado vacío es válido; un servicio no visible es 404. */
export class BusquedaPublicaServicio {
  constructor(private readonly consultas: ConsultasPublicas) {}
  async servicios(c: ConsultaCruda): Promise<PaginaPublica<ServicioPublicoDto>> { const f = normalizarFiltros(c); return pagina(await this.consultas.buscarServicios(f), f); }
  async prestadores(c: ConsultaCruda): Promise<PaginaPublica<PrestadorResumenDto>> { const f = normalizarFiltros(c); return pagina(await this.consultas.buscarPrestadores(f), f); }
  async servicio(servicioId: string): Promise<ServicioPublicoDto> {
    const s = await this.consultas.servicioVisible(uuidEnMinusculas(servicioId));
    if (!s) throw new ErrorAplicacion(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.');
    return s;
  }
}
