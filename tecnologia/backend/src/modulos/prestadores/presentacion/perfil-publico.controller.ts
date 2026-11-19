import { Controller, Get, Inject, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { PerfilPublicoServicio } from '../aplicacion/perfil-publico.js';

export const PERFIL_PUBLICO_002 = Symbol('Perfil público de Prestadores');

/**
 * Perfil público anónimo. Debe registrarse después de `PerfilProfesionalController` para que `prestadores/perfil` (privada)
 * no se interprete como un identificador. `pagina` y `tamano` llegan validados y con sus valores por defecto.
 */
@Controller('prestadores')
export class PerfilPublicoController {
  constructor(@Inject(PERFIL_PUBLICO_002) private readonly perfiles: PerfilPublicoServicio) {}

  @Get(':prestadorId') async obtener(@Param('prestadorId') prestadorId: string, @Res({ passthrough: true }) res: Response) {
    const { pagina, tamano } = res.locals['consulta002'] as { pagina: number; tamano: number };
    return this.perfiles.obtener(prestadorId, pagina, tamano);
  }
}
