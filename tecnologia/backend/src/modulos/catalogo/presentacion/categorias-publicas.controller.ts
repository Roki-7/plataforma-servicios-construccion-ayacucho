import { Controller, Get, Inject } from '@nestjs/common';
import type { ConsultaCategorias } from '../infraestructura/cache/categorias-cache.js';

export const CATEGORIAS_PUBLICAS_002 = Symbol('Consulta pública de categorías activas');

/** Consulta anónima. Solo expone identificador, padre y nombre de clasificaciones efectivamente activas. */
@Controller('categorias')
export class CategoriasPublicasController {
  constructor(@Inject(CATEGORIAS_PUBLICAS_002) private readonly categorias: ConsultaCategorias) {}
  @Get() async listar() {
    return { categorias: (await this.categorias.listar()).map(c => ({ categoriaId: c.categoriaId, categoriaPadreId: c.categoriaPadreId, nombre: c.nombre })) };
  }
}
