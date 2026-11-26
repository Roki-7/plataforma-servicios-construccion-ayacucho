import { Controller, Get, Inject, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { BusquedaPublicaServicio, ConsultaCruda } from '../aplicacion/busqueda-publica.js';
import { paginaPublica, prestadorResumen, servicioPublico } from './representacion-publica.js';

export const BUSQUEDA_PUBLICA_002 = Symbol('Búsqueda pública de oferta de 002');

/**
 * Consultas públicas anónimas. Los filtros llegan ya validados por el adaptador HTTP en `res.locals.consulta002`:
 * un parámetro desconocido, repetido o inválido (incluido `calificacion`) se rechaza con 400 antes de llegar aquí.
 * `servicios/:servicioId` debe registrarse después de `servicios/mios` (HU04).
 */
@Controller()
export class BusquedaController {
  constructor(@Inject(BUSQUEDA_PUBLICA_002) private readonly busqueda: BusquedaPublicaServicio) {}

  @Get('servicios') async servicios(@Res({ passthrough: true }) res: Response) {
    return paginaPublica(await this.busqueda.servicios(res.locals['consulta002'] as ConsultaCruda), servicioPublico);
  }
  @Get('servicios/:servicioId') async servicio(@Param('servicioId') servicioId: string) {
    return servicioPublico(await this.busqueda.servicio(servicioId));
  }
  @Get('prestadores') async prestadores(@Res({ passthrough: true }) res: Response) {
    return paginaPublica(await this.busqueda.prestadores(res.locals['consulta002'] as ConsultaCruda), prestadorResumen);
  }
}
