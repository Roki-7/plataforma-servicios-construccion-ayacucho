import { Body, Controller, Get, Inject, Patch, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { ConsultarPerfil } from '../aplicacion/consultar-perfil.js';
import type { ActualizarPerfil } from '../aplicacion/actualizar-perfil.js';
import type { EdicionPerfil } from '../dominio/consentimiento-telefono.js';
import { SesionRequerida, type PeticionAutenticada } from './guard-sesion.js';
export const SERVICIOS_PERFIL=Symbol('servicios-perfil');
@Controller('perfil') @SesionRequerida()
export class PerfilController {
  constructor(@Inject(SERVICIOS_PERFIL) private readonly servicios:{consultar:ConsultarPerfil;actualizar:ActualizarPerfil}){}
  @Get() async consultar(@Req() req:PeticionAutenticada){return this.servicios.consultar.ejecutar(req.headers.authorization!.slice(7));}
  @Patch() async actualizar(@Body() d:EdicionPerfil,@Req() req:PeticionAutenticada,@Res() res:Response):Promise<void>{const r=await this.servicios.actualizar.ejecutar(d,req.get('Idempotency-Key')??'',req.headers.authorization!.slice(7));res.status(r.http).json(r.cuerpo);}
}
