import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { RegistrarCuenta } from '../aplicacion/registrar-cuenta.js';
import type { HabilitarPerfil } from '../aplicacion/habilitar-perfil.js';
import { SesionRequerida } from './guard-sesion.js';
import { registroDto, habilitacionDto } from './registro.dto.js';
export const REGISTRAR_CUENTA = Symbol('registrar-cuenta'); export const HABILITAR_PERFIL = Symbol('habilitar-perfil');
@Controller()
export class RegistroController {
  constructor(@Inject(REGISTRAR_CUENTA) private readonly registrar: RegistrarCuenta, @Inject(HABILITAR_PERFIL) private readonly habilitar: HabilitarPerfil) {}
  @Post('cuentas') async registro(@Body() datos: unknown, @Req() req: Request, @Res() res: Response): Promise<void> { const r = await this.registrar.ejecutar(registroDto(datos), req.get('Idempotency-Key') ?? ''); res.status(r.http).json(r.cuerpo); }
  @SesionRequerida() @Post('perfil/perfiles') async perfil(@Body() datos: unknown, @Req() req: Request, @Res() res: Response): Promise<void> { const r = await this.habilitar.ejecutar(habilitacionDto(datos), req.get('Idempotency-Key') ?? '', req.headers.authorization?.slice(7) ?? ''); res.status(r.http).json(r.cuerpo); }
}
