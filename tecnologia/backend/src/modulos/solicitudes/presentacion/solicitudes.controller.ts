import { Body, Controller, Get, Inject, Param, Patch, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import type { PeticionIdentidad002 } from '../../../composicion/identidad-002.js';
import type { ArchivosSolicitudServicio, CargaDeArchivo } from '../aplicacion/archivos-solicitud.js';
import type { ActorSolicitudes, SolicitudesServicio } from '../aplicacion/solicitudes.js';
import type { EntradaSolicitud } from '../dominio/solicitud.js';
import type { EstadoSolicitud } from '../dominio/tipos.js';

export const SOLICITUDES_003 = Symbol('Servicio de solicitudes de 003');
export const ARCHIVOS_SOLICITUD_003 = Symbol('Servicio de archivos de solicitudes de 003');

/** La identidad procede del guard del servidor. Nunca se lee del cuerpo ni de parámetros. */
function actorDe(req: PeticionIdentidad002): ActorSolicitudes {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
  if (!req.identidad002 || !token) throw new ErrorAplicacion(401, 'NO_AUTENTICADO', 'Debe autenticarse.');
  return { token, identidad: req.identidad002 };
}
const claveDe = (req: PeticionIdentidad002) => req.get('Idempotency-Key') ?? '';

/**
 * Las nueve operaciones de la historia HU07. La autorización y la validación del esquema ocurren antes (guard de identidad y `configurarApi`); los casos de uso
 * vuelven a comprobar perfil, titularidad y estado en cada operación. El orden de declaración es parte del contrato: las rutas literales deben ir antes que
 * las de parámetro (la historia de oportunidades registra su `solicitudes/oportunidades` en un controlador anterior a este).
 */
@Controller('solicitudes')
export class SolicitudesController {
  constructor(@Inject(SOLICITUDES_003) private readonly solicitudes: SolicitudesServicio, @Inject(ARCHIVOS_SOLICITUD_003) private readonly archivos: ArchivosSolicitudServicio) {}

  @Post() async crear(@Req() req: PeticionIdentidad002, @Body() cuerpo: EntradaSolicitud, @Res() res: Response): Promise<void> {
    const r = await this.solicitudes.crear(actorDe(req), claveDe(req), cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Get() async listar(@Req() req: PeticionIdentidad002, @Res({ passthrough: true }) res: Response) {
    const consulta = res.locals['consulta002'] as { rol?: 'cliente' | 'prestador'; estado?: EstadoSolicitud; pagina?: number; tamano?: number };
    return this.solicitudes.listar(actorDe(req), consulta);
  }

  @Get(':solicitudId') async obtener(@Req() req: PeticionIdentidad002, @Param('solicitudId') solicitudId: string) {
    return this.solicitudes.obtener(actorDe(req), solicitudId);
  }

  @Patch(':solicitudId') async editar(@Req() req: PeticionIdentidad002, @Param('solicitudId') solicitudId: string, @Body() cuerpo: EntradaSolicitud & { version: number }, @Res() res: Response): Promise<void> {
    const r = await this.solicitudes.editar(actorDe(req), claveDe(req), solicitudId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Post(':solicitudId/publicacion') async publicar(@Req() req: PeticionIdentidad002, @Param('solicitudId') solicitudId: string,
    @Body() cuerpo: { version: number; archivosIds?: string[]; compartirFotografias?: boolean }, @Res() res: Response): Promise<void> {
    const r = await this.solicitudes.publicar(actorDe(req), claveDe(req), solicitudId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Post(':solicitudId/cierre') async cerrar(@Req() req: PeticionIdentidad002, @Param('solicitudId') solicitudId: string, @Body() cuerpo: { version: number }, @Res() res: Response): Promise<void> {
    const r = await this.solicitudes.cerrar(actorDe(req), claveDe(req), solicitudId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  @Get(':solicitudId/historial') async historial(@Req() req: PeticionIdentidad002, @Param('solicitudId') solicitudId: string, @Res({ passthrough: true }) res: Response) {
    const { tipo, pagina, tamano } = res.locals['consulta002'] as { tipo: 'versiones' | 'bitacora'; pagina: number; tamano: number };
    return this.solicitudes.historial(actorDe(req), solicitudId, tipo, pagina, tamano);
  }

  @Post(':solicitudId/archivos') async cargarArchivo(@Req() req: PeticionIdentidad002, @Param('solicitudId') solicitudId: string, @Body() cuerpo: CargaDeArchivo, @Res() res: Response): Promise<void> {
    const r = await this.archivos.cargar(actorDe(req), claveDe(req), solicitudId, cuerpo);
    res.status(r.http).json(r.cuerpo);
  }

  /** Descarga autorizada: imagen WebP saneada. No hay direcciones públicas ni firmadas; cada lectura exige sesión y permiso. */
  @Get(':solicitudId/archivos/:archivoId') async obtenerArchivo(@Req() req: PeticionIdentidad002, @Param('solicitudId') solicitudId: string, @Param('archivoId') archivoId: string, @Res() res: Response): Promise<void> {
    const bytes = await this.archivos.obtener(actorDe(req), solicitudId, archivoId);
    res.status(200).type('image/webp').send(Buffer.from(bytes));
  }
}
