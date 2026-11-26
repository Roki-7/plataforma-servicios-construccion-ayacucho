import type { ContextoTransaccion } from '../../../../compartido/aplicacion/transaccion.js';
import type { DistritoCodigo } from '../../dominio/clasificacion.js';

export interface ProyeccionPrestador {
  readonly prestadorId: string;
  readonly nombrePublico: string;
  readonly tipo: 'TRABAJADOR_DE_OFICIO' | 'TECNICO' | 'PROFESIONAL' | 'EMPRESA';
  readonly disponibilidadDeclarada: boolean;
  readonly especialidades: readonly string[];
  readonly distritos: readonly DistritoCodigo[];
  readonly publicable: boolean;
}

export interface ProyeccionPublica {
  actualizar(tx: ContextoTransaccion, prestador: ProyeccionPrestador): Promise<void>;
}
