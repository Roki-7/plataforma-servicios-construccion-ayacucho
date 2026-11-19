import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { PeticionIdentidad002 } from '../../../composicion/identidad-002.js';
import type { EscrituraFotografia, FotografiasPortafolioServicio } from '../aplicacion/fotografias-portafolio.js';
import { actorDe } from './actor.js';

export const FOTOGRAFIAS_PORTAFOLIO_002 = Symbol('Servicio de fotografías de portafolio de 002');

@Controller('prestadores')
export class PortafolioController {
  constructor(@Inject(FOTOGRAFIAS_PORTAFOLIO_002) private readonly fotos: FotografiasPortafolioServicio) {}

  @Post('perfil/trabajos/:trabajoId/fotografias')
  async agregar(@Req() req: PeticionIdentidad002, @Param('trabajoId') trabajoId: string, @Body() cuerpo: EscrituraFotografia, @Res() res: Response): Promise<void> {
    const r = await this.fotos.agregar(actorDe(req), req.get('Idempotency-Key') ?? '', trabajoId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Put('perfil/trabajos/:trabajoId/fotografias/:fotografiaId')
  async reemplazar(@Req() req: PeticionIdentidad002, @Param('trabajoId') trabajoId: string, @Param('fotografiaId') fotografiaId: string,
    @Body() cuerpo: EscrituraFotografia, @Res() res: Response): Promise<void> {
    const r = await this.fotos.reemplazar(actorDe(req), req.get('Idempotency-Key') ?? '', trabajoId, fotografiaId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Delete('perfil/trabajos/:trabajoId/fotografias/:fotografiaId')
  async eliminar(@Req() req: PeticionIdentidad002, @Param('trabajoId') trabajoId: string, @Param('fotografiaId') fotografiaId: string, @Res() res: Response): Promise<void> {
    const { version } = res.locals['consulta002'] as { version: number };
    const r = await this.fotos.eliminar(actorDe(req), req.get('Idempotency-Key') ?? '', trabajoId, fotografiaId, version);
    res.status(r.http).json(r.cuerpo);
  }

  /** Entrega pública anónima. La aplicación revalida foto, trabajo y perfil en PostgreSQL. */
  @Get(':prestadorId/trabajos/:trabajoId/fotografias/:fotografiaId')
  async publica(@Param('prestadorId') prestadorId: string, @Param('trabajoId') trabajoId: string, @Param('fotografiaId') fotografiaId: string) {
    return this.fotos.obtenerPublica(prestadorId, trabajoId, fotografiaId);
  }
}
