import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorAplicacion } from '../compartido/dominio/errores.js';
import type { IdentidadAcceso, UsuariosAcceso } from '../modulos/usuarios-acceso/api-publica.js';

export async function exigirIdentidad002(usuarios: Pick<UsuariosAcceso, 'exigir'>, authorization: string | undefined): Promise<IdentidadAcceso> {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(authorization ?? '')?.[1];
  if (!token) throw new ErrorAplicacion(401, 'NO_AUTENTICADO', 'Debe autenticarse.');
  return usuarios.exigir(token);
}

export interface PeticionIdentidad002 extends Request { identidad002?: IdentidadAcceso }

/** Actor autenticado por el guard del servidor: identidad y token para revalidar antes de un replay. Nunca se lee del cuerpo. */
export function actor002(req: PeticionIdentidad002): { readonly token: string; readonly identidad: IdentidadAcceso } {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
  if (!req.identidad002 || !token) throw new ErrorAplicacion(401, 'NO_AUTENTICADO', 'Debe autenticarse.');
  return { token, identidad: req.identidad002 };
}

export class GuardIdentidad002 implements CanActivate {
  constructor(private readonly usuarios: Pick<UsuariosAcceso, 'exigir'>,
    private readonly sesionBase: { canActivate(ctx: ExecutionContext): Promise<boolean> }) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const http = ctx.switchToHttp();
    const { locals } = http.getResponse<Response>();
    if (locals['ruta002'] !== true) return this.sesionBase.canActivate(ctx);
    if (locals['requiereBearer'] !== true) return true;
    const peticion = http.getRequest<PeticionIdentidad002>();
    peticion.identidad002 = await exigirIdentidad002(this.usuarios, peticion.headers.authorization);
    return true;
  }
}
