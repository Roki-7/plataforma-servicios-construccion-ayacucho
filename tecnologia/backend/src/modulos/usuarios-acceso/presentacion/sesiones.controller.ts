import { Body, Controller, Delete, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { IniciarSesion } from '../aplicacion/iniciar-sesion.js';
import type { RenovarSesion } from '../aplicacion/renovar-sesion.js';
import type { ObtenerCsrf } from '../aplicacion/obtener-csrf.js';
import type { CerrarSesion } from '../aplicacion/cerrar-sesion.js';
import { ErrorAplicacion } from '../dominio/errores.js';
import { SesionRequerida } from './guard-sesion.js';
export const SERVICIOS_SESION = Symbol('servicios-sesion');
interface Servicios { iniciar: IniciarSesion; renovar: RenovarSesion; csrf: ObtenerCsrf; cerrar: CerrarSesion; origen: string }
const opcionesCookie = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/api/v1/sesiones' };
function renovacion(req: Request): string | undefined { const valores = (req.headers.cookie ?? '').split(';').map((s) => s.trim()).filter((s) => s.startsWith('__Secure-renovacion=')); if (valores.length > 1) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.'); return valores[0]?.slice('__Secure-renovacion='.length); }
@Controller('sesiones')
export class SesionesController {
  constructor(@Inject(SERVICIOS_SESION) private readonly servicios: Servicios) {}
  @Post() async iniciar(@Body() datos: { correo: string; contrasena: string }, @Res() res: Response): Promise<void> { const e = await this.servicios.iniciar.ejecutar(datos); res.cookie('__Secure-renovacion', e.renovacion, { ...opcionesCookie, expires: e.venceEn }); res.status(200).json(e.respuesta); }
  @Post('renovacion') async renovar(@Req() req: Request, @Res() res: Response): Promise<void> { const e = await this.servicios.renovar.ejecutar(renovacion(req), req.get('X-CSRF-Token')); res.cookie('__Secure-renovacion', e.renovacion, { ...opcionesCookie, expires: e.venceEn }); res.status(200).json(e.respuesta); }
  @Get('csrf') async csrf(@Req() req: Request, @Res() res: Response): Promise<void> {
    const sitio = req.get('Sec-Fetch-Site'); const origen = req.get('Origin'); let referencia: string | undefined;
    try { if (req.get('Referer')) referencia = new URL(req.get('Referer')!).origin; } catch { /* Contexto no confiable. */ }
    if ((sitio !== undefined && sitio !== 'same-origin') || (origen !== undefined && origen !== this.servicios.origen) || (sitio !== 'same-origin' && origen !== this.servicios.origen && referencia !== this.servicios.origen)) throw new ErrorAplicacion(403, 'ORIGEN_NO_ADMITIDO', 'Se requiere contexto del mismo origen.');
    res.status(200).json(await this.servicios.csrf.ejecutar(renovacion(req)));
  }
  @SesionRequerida() @Delete('actual') async cerrar(@Req() req: Request, @Res() res: Response): Promise<void> { await this.servicios.cerrar.ejecutar(req.headers.authorization?.slice(7) ?? ''); res.clearCookie('__Secure-renovacion', opcionesCookie); res.status(204).send(); }
}
