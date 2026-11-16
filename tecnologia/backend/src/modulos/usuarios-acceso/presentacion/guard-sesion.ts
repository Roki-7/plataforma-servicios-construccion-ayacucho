import { SetMetadata } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { IdentidadAutenticada, LectorSesion } from '../aplicacion/puertos/puertos.js';
import { ErrorAplicacion } from '../dominio/errores.js';
import { exigirTitularidad } from '../dominio/politica-acceso.js';

const protegida = 'usuarios-acceso:sesion-requerida';
export const SesionRequerida = (): MethodDecorator & ClassDecorator => SetMetadata(protegida, true);
export interface PeticionAutenticada extends Request { identidad?: IdentidadAutenticada }
export class GuardSesion implements CanActivate {
  constructor(private readonly lector: LectorSesion, private readonly reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.reflector.getAllAndOverride<boolean>(protegida, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest<PeticionAutenticada>();
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
    if (!token) throw new ErrorAplicacion(401, 'NO_AUTENTICADO', 'Debe autenticarse.');
    const identidad = await this.lector.leer(token);
    if (!identidad) throw new ErrorAplicacion(401, 'SESION_NO_VALIDA', 'Sesión no válida.');
    exigirTitularidad(identidad.cuentaId, identidad.cuentaId, identidad.perfiles);
    req.identidad = identidad;
    return true;
  }
}
