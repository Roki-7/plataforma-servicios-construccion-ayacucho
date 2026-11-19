import { Body, Controller, Get, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { actor002, type PeticionIdentidad002 } from '../../../composicion/identidad-002.js';
import type { CoordinarCategorias } from '../aplicacion/coordinar-categorias.js';

export const CATEGORIAS_ADMIN_002 = Symbol('Coordinación de categorías RF39');

/** Canal interno autenticado de RF39. La identidad sale del Bearer verificado en el servidor y el permiso se consulta en PostgreSQL. */
@Controller('admin/categorias')
export class CategoriasAdminController {
  constructor(@Inject(CATEGORIAS_ADMIN_002) private readonly categorias: CoordinarCategorias) {}
  private clave = (req: PeticionIdentidad002) => req.get('Idempotency-Key') ?? '';

  @Get() async listar(@Req() req: PeticionIdentidad002) { return this.categorias.listar(actor002(req)); }

  @Post() async crear(@Req() req: PeticionIdentidad002, @Body() cuerpo: { nombre: string; categoriaPadreId?: string | null; motivo: string }, @Res() res: Response): Promise<void> {
    const r = await this.categorias.crear(actor002(req), this.clave(req), cuerpo);
    res.status(r.http).json(r.cuerpo);
  }
  @Patch(':categoriaId') async editar(@Req() req: PeticionIdentidad002, @Param('categoriaId') id: string, @Body() cuerpo: { version: number; nombre: string; motivo: string }, @Res() res: Response): Promise<void> {
    const r = await this.categorias.editar(actor002(req), this.clave(req), id, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }
  @Post(':categoriaId/previsualizaciones-desactivacion') async previsualizar(@Req() req: PeticionIdentidad002, @Param('categoriaId') id: string, @Body() cuerpo: { version: number }, @Res() res: Response): Promise<void> {
    const r = await this.categorias.previsualizar(actor002(req), this.clave(req), id, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }
  @Post(':categoriaId/desactivaciones') async desactivar(@Req() req: PeticionIdentidad002, @Param('categoriaId') id: string, @Body() cuerpo: { confirmacionId: string; version: number; motivo: string }, @Res() res: Response): Promise<void> {
    const r = await this.categorias.desactivar(actor002(req), this.clave(req), id, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }
  @Post(':categoriaId/activaciones') async activar(@Req() req: PeticionIdentidad002, @Param('categoriaId') id: string, @Body() cuerpo: { version: number; motivo: string }, @Res() res: Response): Promise<void> {
    const r = await this.categorias.activar(actor002(req), this.clave(req), id, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }
}
