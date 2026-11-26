import { Body, Controller, Get, Inject, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { PeticionIdentidad002 } from '../../../composicion/identidad-002.js';
import type { PerfilProfesionalServicio } from '../aplicacion/perfil-profesional.js';
import type { EntradaPerfil } from '../dominio/perfil-profesional.js';
import { actorDe } from './actor.js';

export const PERFIL_PROFESIONAL_002 = Symbol('Servicio de perfil profesional de 002');
type Escritura = EntradaPerfil & { version: number };

@Controller('prestadores/perfil')
export class PerfilProfesionalController {
  constructor(@Inject(PERFIL_PROFESIONAL_002) private readonly perfil: PerfilProfesionalServicio) {}

  @Get() async obtener(@Req() req: PeticionIdentidad002) { return this.perfil.obtener(actorDe(req)); }

  @Put() async guardar(@Req() req: PeticionIdentidad002, @Body() cuerpo: Escritura, @Res() res: Response): Promise<void> {
    const r = await this.perfil.guardar(actorDe(req), req.get('Idempotency-Key') ?? '', cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Post('trabajos') async crearTrabajo(@Req() req: PeticionIdentidad002, @Body() cuerpo: { versionPerfil: number; titulo: string; descripcion: string }, @Res() res: Response): Promise<void> {
    const r = await this.perfil.crearTrabajo(actorDe(req), req.get('Idempotency-Key') ?? '', cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Patch('trabajos/:trabajoId') async editarTrabajo(@Req() req: PeticionIdentidad002, @Param('trabajoId') trabajoId: string,
    @Body() cuerpo: { version: number; titulo?: string; descripcion?: string }, @Res() res: Response): Promise<void> {
    const r = await this.perfil.editarTrabajo(actorDe(req), req.get('Idempotency-Key') ?? '', trabajoId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }
}
