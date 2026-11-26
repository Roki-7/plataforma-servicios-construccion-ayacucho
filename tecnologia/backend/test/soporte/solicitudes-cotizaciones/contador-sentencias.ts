// Contador de sentencias SQL para verificar el presupuesto de consultas de la 003 (CP-306): el número de sentencias por petición es constante
// e independiente del tamaño de página. Intercepta `createQueryRunner` de un DataSource de TypeORM, que es la vía de `db.query`, `manager.query`
// y la unidad de trabajo. No cuenta la apertura ni el cierre de transacciones como consultas de negocio: se registran aparte.

interface EjecutorConsulta { query: (consulta: string, parametros?: unknown[]) => Promise<unknown>; [clave: string]: unknown }
interface FuenteDeDatos { createQueryRunner: (...argumentos: unknown[]) => EjecutorConsulta }

/** Control de transacción: abrirla, cerrarla y la configuración del tiempo de espera de bloqueos que la unidad de trabajo hace al abrirla. No es negocio. */
const esControl = (sql: string): boolean => /^\s*(BEGIN|START TRANSACTION|COMMIT|ROLLBACK|SAVEPOINT|RELEASE SAVEPOINT|SET\s+TRANSACTION|SELECT\s+set_config\(\s*'lock_timeout')/i.test(sql);

export interface ResultadoConteo<T> { readonly resultado: T; readonly total: number; readonly control: number; readonly sentencias: readonly string[] }

export class ContadorSentencias {
  private original: FuenteDeDatos['createQueryRunner'] | undefined;
  private destino: FuenteDeDatos | undefined;
  private registro: string[] = [];
  private controles = 0;

  /** Instala el contador. Debe liberarse con `liberar` cuando termine la medición. */
  instalar(db: object): this {
    if (this.destino) throw new Error('El contador de sentencias ya está instalado.');
    const fuente = db as FuenteDeDatos;
    this.destino = fuente;
    const original = fuente.createQueryRunner;
    this.original = original;
    fuente.createQueryRunner = (...argumentos: unknown[]) => {
      const ejecutor = original.apply(fuente, argumentos);
      const consulta = ejecutor.query.bind(ejecutor);
      ejecutor.query = (sql: string, parametros?: unknown[]) => {
        if (esControl(sql)) this.controles += 1; else this.registro.push(sql.replace(/\s+/g, ' ').trim());
        return consulta(sql, parametros);
      };
      return ejecutor;
    };
    return this;
  }

  liberar(): void {
    if (!this.destino || !this.original) return;
    this.destino.createQueryRunner = this.original;
    this.destino = undefined;
    this.original = undefined;
  }

  reiniciar(): void { this.registro = []; this.controles = 0; }
  get total(): number { return this.registro.length; }
  get control(): number { return this.controles; }
  get sentencias(): readonly string[] { return [...this.registro]; }

  /** Ejecuta `trabajo` y devuelve su resultado con el número de sentencias de negocio que emitió. Cuenta también si falla. */
  async contar<T>(trabajo: () => Promise<T>): Promise<ResultadoConteo<T>> {
    this.reiniciar();
    const resultado = await trabajo();
    return { resultado, total: this.total, control: this.control, sentencias: this.sentencias };
  }
}

/** Comprueba que el número de sentencias no depende del tamaño de página: todas las mediciones deben ser iguales (CP-306). */
export function exigirConteoConstante(conteos: readonly number[]): void {
  if (conteos.length < 2) throw new Error('Se requieren al menos dos mediciones con tamaños de página distintos.');
  if (new Set(conteos).size !== 1) throw new Error(`El número de sentencias varía con el tamaño de página: ${conteos.join(', ')}.`);
}
