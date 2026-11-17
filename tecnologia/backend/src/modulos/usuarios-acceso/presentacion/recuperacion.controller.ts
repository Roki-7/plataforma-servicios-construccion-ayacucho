import { Body, Controller, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { SolicitarRecuperacion } from '../aplicacion/solicitar-recuperacion.js';
import type { ConsumirRecuperacion, DatosRecuperacion } from '../aplicacion/consumir-recuperacion.js';
export const SERVICIOS_RECUPERACION = Symbol('servicios-recuperacion');
@Controller('recuperaciones')
export class RecuperacionController {
  constructor(@Inject(SERVICIOS_RECUPERACION) private readonly servicios: { solicitar: SolicitarRecuperacion; consumir: ConsumirRecuperacion }) {}
  @Post() async solicitar(@Body() datos: { correo: string }, @Res() res: Response): Promise<void> { res.status(202).json(await this.servicios.solicitar.ejecutar(datos.correo)); }
  @Post(':token') async consumir(@Param('token') token: string, @Body() datos: DatosRecuperacion, @Req() req: Request, @Res() res: Response): Promise<void> { const r = await this.servicios.consumir.ejecutar(token, datos, req.get('Idempotency-Key') ?? ''); res.status(r.http).json(r.cuerpo); }
}
