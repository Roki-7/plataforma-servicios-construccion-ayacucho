import { Controller, Get, Inject } from '@nestjs/common';
import { ErrorAplicacion } from '../../dominio/errores.js';
export const ESTADO_SALUD = Symbol('estado-salud');
export interface EstadoSalud { disponible(): Promise<boolean> }
@Controller('salud')
export class SaludController {
  constructor(@Inject(ESTADO_SALUD) private readonly estado: EstadoSalud) {}
  @Get()
  async comprobar(): Promise<{ estado: 'disponible' }> {
    if (!await this.estado.disponible()) throw new ErrorAplicacion(503, 'DEPENDENCIA_NO_DISPONIBLE', 'Servicio temporalmente no disponible.', [{ campo: 'estado', motivo: 'noDisponible' }]);
    return { estado: 'disponible' };
  }
}
