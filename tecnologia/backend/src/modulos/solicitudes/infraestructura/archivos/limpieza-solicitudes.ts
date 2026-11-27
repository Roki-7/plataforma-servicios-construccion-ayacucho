import type { DataSource } from 'typeorm';
import { filasDe } from '../../../../compartido/infraestructura/postgres/filas.js';
import type { AlmacenArchivosSolicitud } from '../../aplicacion/puertos/archivos.js';

/**
 * Limpieza física de los objetos de archivos de solicitudes (FR-322, research R-10). Tres plazos distintos que no deben confundirse:
 *  - la CADUCIDAD lógica de 24 horas: un archivo no confirmado deja de contar para el cupo y de ser accesible de inmediato; no borra nada;
 *  - el INTERVALO de este proceso (300 s, configurable, mínimo 60 s): cada cuánto se borran físicamente los objetos con entrada vencida;
 *  - el UMBRAL de control (900 s, configurable, al menos tres intervalos): el retraso máximo tolerado entre el vencimiento de una entrada y su procesamiento.
 *    No es un plazo de retención: solo sirve para que `verificar` detecte que el proceso no está corriendo.
 * Riesgo residual (P2): con el monolito detenido, los objetos pendientes se conservan físicamente, aunque la API no los entrega.
 */
export interface OpcionesDeLimpieza { readonly arrendamientoSegundos: number; readonly lote: number; readonly reintentoBaseSegundos: number; readonly reintentoMaximoSegundos: number; readonly umbralSegundos: number }
export const limpiezaPorOmision: OpcionesDeLimpieza = { arrendamientoSegundos: 120, lote: 50, reintentoBaseSegundos: 60, reintentoMaximoSegundos: 3600, umbralSegundos: 900 };

export interface ResultadoDeLimpieza {
  /** Entradas reclamadas en esta pasada. */
  readonly reclamadas: number;
  /** Objetos eliminados del almacenamiento. */
  readonly objetosEliminados: number;
  /** Archivos no confirmados vencidos que pasaron a DESCARTADO en esta pasada. */
  readonly archivosCaducados: number;
  /** Entradas que no se procesaron todavía (la carga sigue vigente) y se reprogramaron a su vencimiento. */
  readonly aplazadas: number;
  /** Entradas obsoletas retiradas sin tocar el objeto (el archivo quedó CONFIRMADO o la clave no pertenece al almacén). */
  readonly retiradasSinBorrar: number;
  /** Fallos reintentables, con espera creciente. */
  readonly reintentos: number;
}
export interface InformeDeVerificacion {
  readonly entradasVencidasSobreElUmbral: number;
  readonly entradasConError: number;
  readonly objetosSinFila: number;
  readonly archivosSinObjeto: number;
  readonly solicitudesConContadoresDistintos: number;
  readonly hallazgos: number;
}

interface Pendiente { clave: string; tipo: 'PREPARACION' | 'PURGA'; solicitud_id: string; intentos: number }
interface FilaDeArchivo { id: string; estado: string; caduca_en: Date | null }
/** Códigos sanitizados: nunca la clave, el texto del error ni datos del cliente. */
const codigoDeError = { almacenamiento: 'ALMACENAMIENTO_NO_DISPONIBLE', interno: 'ERROR_INTERNO' } as const;

export class LimpiezaSolicitudes {
  constructor(private readonly db: DataSource, private readonly almacen: AlmacenArchivosSolicitud, private readonly opciones: OpcionesDeLimpieza = limpiezaPorOmision, private readonly ahora: () => Date = () => new Date()) {}

  /** Reclama entradas vencidas con `FOR UPDATE SKIP LOCKED` y arrendamiento: dos instancias no procesan la misma clave. Un arrendamiento vencido libera la entrada. */
  private async reclamar(): Promise<Pendiente | undefined> {
    const ahora = this.ahora();
    return filasDe<Pendiente>(await this.db.query(`UPDATE solicitudes_objetos_pendientes SET arrendado_hasta = $1::timestamptz + make_interval(secs => $2), intentos = intentos + 1, ultimo_intento_en = $1::timestamptz
      WHERE clave IN (SELECT clave FROM solicitudes_objetos_pendientes WHERE proxima_ejecucion <= $1::timestamptz AND (arrendado_hasta IS NULL OR arrendado_hasta <= $1::timestamptz)
        ORDER BY proxima_ejecucion, clave LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING clave, tipo, solicitud_id, intentos`, [ahora, this.opciones.arrendamientoSegundos]))[0];
  }

  private async archivoDe(clave: string): Promise<FilaDeArchivo | undefined> {
    return (await this.db.query('SELECT id, estado, caduca_en FROM solicitudes_archivos WHERE objeto_clave = $1', [clave]) as FilaDeArchivo[])[0];
  }
  private quitar(clave: string) { return this.db.query('DELETE FROM solicitudes_objetos_pendientes WHERE clave = $1', [clave]); }

  async ejecutar(): Promise<ResultadoDeLimpieza> {
    const r = { reclamadas: 0, objetosEliminados: 0, archivosCaducados: 0, aplazadas: 0, retiradasSinBorrar: 0, reintentos: 0 };
    // Se arrienda cada clave al empezar a procesarla para que no venza esperando dentro del lote.
    for (let i = 0; i < this.opciones.lote; i += 1) {
      const entrada = await this.reclamar();
      if (!entrada) break;
      r.reclamadas += 1;
      try {
        const fila = await this.archivoDe(entrada.clave);
        const ahora = this.ahora();
        // Una clave ajena al almacén de solicitudes nunca se borra: se retira la entrada y se deja el objeto.
        if (!this.almacen.pertenece(entrada.clave)) { await this.quitar(entrada.clave); r.retiradasSinBorrar += 1; continue; }
        if (fila?.estado === 'CONFIRMADO') { await this.quitar(entrada.clave); r.retiradasSinBorrar += 1; continue; }
        if (!fila && entrada.tipo === 'PREPARACION') { await this.quitar(entrada.clave); r.retiradasSinBorrar += 1; continue; }
        if (entrada.tipo === 'PREPARACION' && fila && (fila.estado === 'PREPARANDO' || fila.estado === 'PREPARADO')) {
          // Protección de los archivos en carga: una preparación no se procesa antes de que venza su caducidad lógica de 24 horas.
          if (fila.caduca_en && fila.caduca_en.getTime() > ahora.getTime()) {
            await this.db.query('UPDATE solicitudes_objetos_pendientes SET proxima_ejecucion = $2, arrendado_hasta = NULL WHERE clave = $1', [entrada.clave, fila.caduca_en]);
            r.aplazadas += 1; continue;
          }
          const caducados = filasDe(await this.db.query(`WITH d AS (
              UPDATE solicitudes_archivos SET estado = 'DESCARTADO', retirado_en = clock_timestamp()
              WHERE id = $1 AND estado IN ('PREPARANDO','PREPARADO') AND caduca_en <= $2 RETURNING objeto_clave
            ) UPDATE solicitudes_objetos_pendientes p SET tipo = 'PURGA'
              FROM d WHERE p.clave = d.objeto_clave RETURNING p.clave`, [fila.id, ahora]));
          if (!caducados.length) { r.aplazadas += 1; continue; }
          r.archivosCaducados += 1;
        }
        await this.almacen.eliminar(entrada.clave);
        await this.quitar(entrada.clave);
        r.objetosEliminados += 1;
      } catch (error) {
        r.reintentos += 1;
        const espera = Math.min(this.opciones.reintentoMaximoSegundos, this.opciones.reintentoBaseSegundos * 2 ** Math.max(0, entrada.intentos - 1));
        const codigo = error instanceof Error && 'codigo' in error && error.codigo === 'DEPENDENCIA_NO_DISPONIBLE' ? codigoDeError.almacenamiento : codigoDeError.interno;
        await this.db.query(`UPDATE solicitudes_objetos_pendientes SET arrendado_hasta = NULL, ultimo_error = $2, proxima_ejecucion = $3::timestamptz + make_interval(secs => $4) WHERE clave = $1`,
          [entrada.clave, codigo, this.ahora(), espera]).catch(() => undefined);
      }
    }
    return r;
  }

  /**
   * Control de detección (CA-ARC-10 y OP-306). Compara el inventario del prefijo con el registro y recalcula el cupo.
   * Informa sin corregir ni exponer datos. Cualquier hallazgo hace que el comando termine con código distinto de cero.
   */
  async verificar(): Promise<InformeDeVerificacion> {
    const ahora = this.ahora();
    const limite = new Date(ahora.getTime() - this.opciones.umbralSegundos * 1000);
    const [vencidas] = await this.db.query('SELECT count(*)::int AS n FROM solicitudes_objetos_pendientes WHERE proxima_ejecucion <= $1', [limite]) as { n: number }[];
    const [conError] = await this.db.query('SELECT count(*)::int AS n FROM solicitudes_objetos_pendientes WHERE ultimo_error IS NOT NULL') as { n: number }[];
    const inventario = new Set<string>();
    let sinFila = 0;
    for await (const objeto of this.almacen.listar()) {
      inventario.add(objeto.clave);
      if (objeto.modificado.getTime() > limite.getTime()) continue;
      const hay = await this.db.query(`SELECT 1 FROM solicitudes_archivos WHERE objeto_clave = $1 UNION ALL SELECT 1 FROM solicitudes_objetos_pendientes WHERE clave = $1 LIMIT 1`, [objeto.clave]) as unknown[];
      if (!hay.length) sinFila += 1;
    }
    const archivos = await this.db.query(`SELECT objeto_clave FROM solicitudes_archivos
      WHERE estado IN ('PREPARADO','CONFIRMADO') AND creado_en <= $1`, [ahora]) as { objeto_clave: string }[];
    const [contadores] = await this.db.query(`WITH recalculados AS (
        SELECT solicitud_id, count(*) AS cantidad, sum(bytes) AS bytes FROM solicitudes_archivos
        WHERE estado IN ('PREPARANDO','PREPARADO','CONFIRMADO') GROUP BY solicitud_id
      ) SELECT count(*)::int AS n FROM solicitudes s LEFT JOIN recalculados r ON s.id = r.solicitud_id
        WHERE s.archivos_cantidad <> COALESCE(r.cantidad, 0) OR s.archivos_bytes <> COALESCE(r.bytes, 0)`) as { n: number }[];
    const informe = {
      entradasVencidasSobreElUmbral: vencidas?.n ?? 0, entradasConError: conError?.n ?? 0, objetosSinFila: sinFila,
      archivosSinObjeto: archivos.filter(a => this.almacen.pertenece(a.objeto_clave) && !inventario.has(a.objeto_clave)).length,
      solicitudesConContadoresDistintos: contadores?.n ?? 0,
    };
    return { ...informe, hallazgos: Object.values(informe).reduce((total, n) => total + n, 0) };
  }
}

/** Intervalo y umbral configurables: `SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS` (300, mínimo 60) y `SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS` (900, al menos tres intervalos). */
export function leerConfiguracionDeLimpieza(env: NodeJS.ProcessEnv): { readonly intervaloSegundos: number; readonly umbralSegundos: number } {
  const entero = (nombre: string, porOmision: number): number => {
    const crudo = env[nombre];
    if (crudo === undefined || crudo === '') return porOmision;
    if (!/^\d{1,6}$/.test(crudo)) throw new Error(`${nombre} debe ser un entero de segundos.`);
    return Number(crudo);
  };
  const intervaloSegundos = entero('SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS', 300);
  if (intervaloSegundos < 60) throw new Error('SOLICITUDES_LIMPIEZA_INTERVALO_SEGUNDOS no puede ser menor que 60.');
  const umbralSegundos = entero('SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS', 900);
  if (umbralSegundos < intervaloSegundos * 3) throw new Error('SOLICITUDES_UMBRAL_PENDIENTE_SEGUNDOS debe ser al menos tres veces el intervalo de limpieza.');
  return { intervaloSegundos, umbralSegundos };
}
