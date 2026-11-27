import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import type { ActorCotizaciones, ActualizacionDeCotizacion, CotizacionesServicio, EnvioDeCotizacion } from '../aplicacion/cotizaciones.js';
import type { IdentidadDeCotizador } from '../aplicacion/puertos/entorno.js';

export const COTIZACIONES_003 = Symbol('Servicio de cotizaciones de 003');

/** La identidad la deja el guard del servidor en `identidad002`. Nunca se lee del cuerpo ni de parámetros. */
interface PeticionConIdentidad extends Request { identidad002?: IdentidadDeCotizador }

function actorDe(req: PeticionConIdentidad): ActorCotizaciones {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
  if (!req.identidad002 || !token) throw new ErrorAplicacion(401, 'NO_AUTENTICADO', 'Debe autenticarse.');
  return { token, identidad: req.identidad002 };
}
const claveDe = (req: PeticionConIdentidad) => req.get('Idempotency-Key') ?? '';

/** `POST /solicitudes/{solicitudId}/cotizaciones`. No se solapa con `solicitudes/:solicitudId`: tiene un segmento más. */
@Controller('solicitudes')
export class CotizacionesDeSolicitudController {
  constructor(@Inject(COTIZACIONES_003) private readonly cotizaciones: CotizacionesServicio) {}

  @Post(':solicitudId/cotizaciones') async enviar(@Req() req: PeticionConIdentidad, @Param('solicitudId') solicitudId: string, @Body() cuerpo: EnvioDeCotizacion, @Res() res: Response): Promise<void> {
    const r = await this.cotizaciones.enviar(actorDe(req), claveDe(req), solicitudId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  /** Solo el cliente dueño. Sin `ids`, lista paginada sin clasificación de «mejor»; con `ids` (hasta 10), las cotizaciones para compararlas. */
  @Get(':solicitudId/cotizaciones') async listar(@Req() req: PeticionConIdentidad, @Param('solicitudId') solicitudId: string, @Res({ passthrough: true }) res: Response) {
    const consulta = res.locals['consulta002'] as { ids?: string; pagina?: number; tamano?: number };
    return this.cotizaciones.listarDeSolicitud(actorDe(req), solicitudId, consulta);
  }
}

/** Operaciones sobre una cotización concreta y «mis cotizaciones». El guard y `configurarApi` validan antes de que los casos de uso comprueben perfil y titularidad. */
@Controller('cotizaciones')
export class CotizacionesController {
  constructor(@Inject(COTIZACIONES_003) private readonly cotizaciones: CotizacionesServicio) {}

  @Get() async listarMias(@Req() req: PeticionConIdentidad, @Res({ passthrough: true }) res: Response) {
    const { pagina, tamano } = res.locals['consulta002'] as { pagina?: number; tamano?: number };
    return this.cotizaciones.listarMias(actorDe(req), pagina, tamano);
  }

  @Get(':cotizacionId') async obtener(@Req() req: PeticionConIdentidad, @Param('cotizacionId') cotizacionId: string) {
    return this.cotizaciones.obtener(actorDe(req), cotizacionId);
  }

  @Post(':cotizacionId/versiones') async actualizar(@Req() req: PeticionConIdentidad, @Param('cotizacionId') cotizacionId: string, @Body() cuerpo: ActualizacionDeCotizacion, @Res() res: Response): Promise<void> {
    const r = await this.cotizaciones.actualizar(actorDe(req), claveDe(req), cotizacionId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Post(':cotizacionId/retiro') async retirar(@Req() req: PeticionConIdentidad, @Param('cotizacionId') cotizacionId: string, @Body() cuerpo: { versionCotizacion: number }, @Res() res: Response): Promise<void> {
    const r = await this.cotizaciones.retirar(actorDe(req), claveDe(req), cotizacionId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  /** El cliente dueño y el prestador autor. Cualquier otra cuenta, 404. */
  @Get(':cotizacionId/aclaraciones') async listarAclaraciones(@Req() req: PeticionConIdentidad, @Param('cotizacionId') cotizacionId: string, @Res({ passthrough: true }) res: Response) {
    const { pagina, tamano } = res.locals['consulta002'] as { pagina?: number; tamano?: number };
    return this.cotizaciones.listarAclaraciones(actorDe(req), cotizacionId, pagina, tamano);
  }

  @Post(':cotizacionId/aclaraciones') async enviarAclaracion(@Req() req: PeticionConIdentidad, @Param('cotizacionId') cotizacionId: string, @Body() cuerpo: { texto: string }, @Res() res: Response): Promise<void> {
    const r = await this.cotizaciones.enviarAclaracion(actorDe(req), claveDe(req), cotizacionId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }
}
