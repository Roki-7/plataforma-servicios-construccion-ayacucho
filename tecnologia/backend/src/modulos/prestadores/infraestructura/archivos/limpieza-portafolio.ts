import type { DataSource } from 'typeorm';
import type { AlmacenPortafolio } from '../../aplicacion/puertos/puertos.js';
import { filasDe } from '../persistencia/filas.js';

export interface ResultadoLimpieza { readonly purgados: number; readonly descartados: number; readonly reintentos: number; readonly huerfanos: number }
interface Pendiente { clave: string; tipo: 'PREPARACION' | 'PURGA' }

/**
 * Procesa purgas y preparaciones vencidas con arrendamiento. Es idempotente, tolera reinicios y no toca objetos fuera del ámbito
 * del portafolio de 002 (los objetos de la 001 viven en otro bucket y con otras credenciales).
 */
export class LimpiezaPortafolio {
  constructor(private readonly db: DataSource, private readonly almacen: AlmacenPortafolio,
    private readonly opciones: { arrendamientoSegundos: number; lote: number; reintentoSegundos: number; gracia: number } = { arrendamientoSegundos: 120, lote: 50, reintentoSegundos: 60, gracia: 15 * 60 * 1000 },
    private readonly ahora: () => Date = () => new Date()) {}

  /** Reclama trabajos vencidos sin esperar a otros procesadores. Con `FOR UPDATE SKIP LOCKED` dos réplicas no repiten la misma clave. */
  private async reclamar(): Promise<Pendiente[]> {
    return filasDe<Pendiente>(await this.db.query(`UPDATE prestadores_objetos_pendientes SET arrendado_hasta=$1::timestamptz + make_interval(secs => $2), intentos=intentos+1
      WHERE clave IN (SELECT clave FROM prestadores_objetos_pendientes WHERE proxima_ejecucion <= $1::timestamptz
        AND (arrendado_hasta IS NULL OR arrendado_hasta <= $1::timestamptz) ORDER BY proxima_ejecucion, clave LIMIT $3 FOR UPDATE SKIP LOCKED)
      RETURNING clave, tipo`, [this.ahora(), this.opciones.arrendamientoSegundos, this.opciones.lote]));
  }

  async ejecutar(): Promise<ResultadoLimpieza> {
    let purgados = 0; let descartados = 0; let reintentos = 0;
    for (const { clave, tipo } of await this.reclamar()) {
      try {
        if (!this.almacen.pertenece(clave)) { await this.finalizar(clave); descartados++; continue; }
        if (await this.referenciada(clave)) { await this.finalizar(clave); descartados++; continue; }
        await this.almacen.eliminar(clave);
        await this.finalizar(clave);
        if (tipo === 'PURGA') purgados++; else descartados++;
      } catch {
        reintentos++;
        await this.db.query(`UPDATE prestadores_objetos_pendientes SET arrendado_hasta=NULL, proxima_ejecucion=$2::timestamptz + make_interval(secs => $3 * LEAST(intentos, 10)) WHERE clave=$1`,
          [clave, this.ahora(), this.opciones.reintentoSegundos]).catch(() => undefined);
      }
    }
    return { purgados, descartados, reintentos, huerfanos: 0 };
  }

  /** Cubre escrituras tardías y caídas entre el envío y la confirmación: objetos antiguos sin referencia ni tarea. */
  async reconciliarHuerfanos(): Promise<number> {
    let eliminados = 0;
    const limite = this.ahora().getTime() - this.opciones.gracia;
    for await (const objeto of this.almacen.listar()) {
      if (objeto.modificado.getTime() > limite) continue;
      if (await this.referenciada(objeto.clave)) continue;
      const pendiente: unknown[] = await this.db.query('SELECT 1 FROM prestadores_objetos_pendientes WHERE clave=$1 AND (proxima_ejecucion > $2::timestamptz OR arrendado_hasta > $2::timestamptz)', [objeto.clave, this.ahora()]);
      if (pendiente.length) continue;
      await this.almacen.eliminar(objeto.clave);
      await this.db.query('DELETE FROM prestadores_objetos_pendientes WHERE clave=$1', [objeto.clave]);
      eliminados++;
    }
    return eliminados;
  }

  private async referenciada(clave: string): Promise<boolean> {
    const filas: unknown[] = await this.db.query('SELECT 1 FROM prestadores_fotografias WHERE objeto_clave=$1', [clave]);
    return filas.length > 0;
  }
  private async finalizar(clave: string): Promise<void> { await this.db.query('DELETE FROM prestadores_objetos_pendientes WHERE clave=$1', [clave]); }
}
