import { Body, Controller, Get, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { actor002, type PeticionIdentidad002 } from '../../../composicion/identidad-002.js';
import type { ServiciosPropiosServicio } from '../aplicacion/servicios-propios.js';
import type { EstadoServicio } from '../dominio/servicio.js';

export const SERVICIOS_PROPIOS_002 = Symbol('Servicio de servicios propios de 002');

@Controller('servicios')
export class ServiciosPropiosController {
  constructor(@Inject(SERVICIOS_PROPIOS_002) private readonly servicios: ServiciosPropiosServicio) {}

  /** Debe declararse antes que las rutas con parámetro para que `mios` no se interprete como un identificador. */
  @Get('mios') async inventario(@Req() req: PeticionIdentidad002, @Res({ passthrough: true }) res: Response) {
    const { pagina, tamano } = res.locals['consulta002'] as { pagina: number; tamano: number };
    return this.servicios.listarPropios(actor002(req), pagina, tamano);
  }

  @Post() async publicar(@Req() req: PeticionIdentidad002, @Body() cuerpo: { titulo: string; descripcion: string; categoriaId: string }, @Res() res: Response): Promise<void> {
    const r = await this.servicios.publicar(actor002(req), req.get('Idempotency-Key') ?? '', cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Patch(':servicioId') async editar(@Req() req: PeticionIdentidad002, @Param('servicioId') servicioId: string,
    @Body() cuerpo: { version: number; titulo?: string; descripcion?: string; categoriaId?: string }, @Res() res: Response): Promise<void> {
    const r = await this.servicios.editar(actor002(req), req.get('Idempotency-Key') ?? '', servicioId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Post(':servicioId/transiciones') async transicionar(@Req() req: PeticionIdentidad002, @Param('servicioId') servicioId: string,
    @Body() cuerpo: { version: number; destino: EstadoServicio }, @Res() res: Response): Promise<void> {
    const r = await this.servicios.cambiarEstado(actor002(req), req.get('Idempotency-Key') ?? '', servicioId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }
}
