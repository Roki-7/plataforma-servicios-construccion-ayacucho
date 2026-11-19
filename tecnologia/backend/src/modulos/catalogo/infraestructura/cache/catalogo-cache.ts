import { createHash } from 'node:crypto';
import type { RevisionDeOferta } from '../../api-publica.js';
import type { ConsultasPublicas, FiltrosOferta, PaginaDto, PrestadorResumenDto, ServicioPublicoDto } from '../../aplicacion/puertos/consultas-publicas.js';

/** Lo mínimo que necesita el decorador de un cliente de caché. `ClienteRedis002` lo cumple. */
export interface AlmacenCache {
  obtener(clave: string): Promise<string | null>;
  guardar(clave: string, valor: string, ttlSegundos: number): Promise<void>;
}
export interface OpcionesCache { readonly entorno: string; readonly versionRepresentacion: string; readonly ttlSegundos: number }

const forma = (v: unknown): v is PaginaDto<unknown> => typeof v === 'object' && v !== null && Array.isArray((v as PaginaDto<unknown>).elementos) && Number.isSafeInteger((v as PaginaDto<unknown>).total);

/**
 * Decorador de lectura con revisión durable. La revisión se lee del primario de PostgreSQL antes de consultar la caché y de nuevo al aceptar un
 * acierto. La clave incluye entorno, espacio de despliegue (prefijo del cliente), versión de representación, revisión, tipo, filtros y página.
 * Un fallo, una revisión distinta o una carga inválida resuelven desde PostgreSQL, que sigue siendo la fuente de verdad.
 * Los detalles (servicio y servicios de un perfil) no se almacenan: se leen siempre de PostgreSQL para respetar revocaciones de visibilidad.
 */
export class CatalogoCache implements ConsultasPublicas {
  constructor(private readonly origen: ConsultasPublicas, private readonly revision: RevisionDeOferta, private readonly cache: AlmacenCache, private readonly opciones: OpcionesCache) {}

  private async conCache<T>(tipo: string, f: FiltrosOferta, cargar: () => Promise<PaginaDto<T>>): Promise<PaginaDto<T>> {
    // Si PostgreSQL no puede comprobar la revisión, la consulta falla de forma controlada.
    const revision = await this.revision.vigente();
    const huella = createHash('sha256').update(JSON.stringify([f.categoria ?? null, f.especialidad ?? null, f.distrito ?? null, f.disponibilidad ?? null, f.pagina, f.tamano])).digest('hex').slice(0, 32);
    const clave = `${this.opciones.entorno}:${this.opciones.versionRepresentacion}:r${revision}:${tipo}:${huella}`;
    try {
      const guardado = await this.cache.obtener(clave);
      if (guardado) {
        const valor: unknown = JSON.parse(guardado);
        if (forma(valor) && await this.revision.vigente() === revision) return valor as PaginaDto<T>;
      }
    } catch { /* caché no disponible o carga inválida: se resuelve en PostgreSQL */ }
    const resultado = await cargar();
    try { if (await this.revision.vigente() === revision) await this.cache.guardar(clave, JSON.stringify(resultado), this.opciones.ttlSegundos); } catch { /* sin caché */ }
    return resultado;
  }

  buscarServicios(f: FiltrosOferta): Promise<PaginaDto<ServicioPublicoDto>> { return this.conCache('servicios', f, () => this.origen.buscarServicios(f)); }
  buscarPrestadores(f: FiltrosOferta): Promise<PaginaDto<PrestadorResumenDto>> { return this.conCache('prestadores', f, () => this.origen.buscarPrestadores(f)); }
  servicioVisible(servicioId: string) { return this.origen.servicioVisible(servicioId); }
  serviciosVisiblesDe(prestadorId: string, pagina: number, tamano: number) { return this.origen.serviciosVisiblesDe(prestadorId, pagina, tamano); }
}
