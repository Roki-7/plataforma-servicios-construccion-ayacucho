import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { CambiarContrasena } from '../aplicacion/cambiar-contrasena.js';
import { leerCambioContrasena, type CambioContrasenaDto } from './contrasena.dto.js';
import { SesionRequerida, type PeticionAutenticada } from './guard-sesion.js';

export const CAMBIAR_CONTRASENA = Symbol('cambiar-contrasena');

@Controller('perfil/cambios-contrasena')
@SesionRequerida()
export class ContrasenaController {
  constructor(@Inject(CAMBIAR_CONTRASENA) private readonly servicio: CambiarContrasena) {}

  @Post()
  async cambiar(@Body() dto: CambioContrasenaDto, @Req() req: PeticionAutenticada, @Res() res: Response): Promise<void> {
    const resultado = await this.servicio.ejecutar(
      leerCambioContrasena(dto),
      req.get('Idempotency-Key') ?? '',
      req.headers.authorization!.slice(7),
    );
    res.status(resultado.http).json(resultado.cuerpo);
  }
}
