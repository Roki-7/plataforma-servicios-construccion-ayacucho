import { Body, Controller, Get, Inject, Param, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Fotografias } from '../aplicacion/fotografias.js';
import { SesionRequerida, type PeticionAutenticada } from './guard-sesion.js';
export const SERVICIO_FOTOGRAFIAS=Symbol('servicio-fotografias');
@Controller('perfil/fotografias') @SesionRequerida()
export class FotografiasController {
  constructor(@Inject(SERVICIO_FOTOGRAFIAS) private readonly servicio:Fotografias){}
  @Post() async subir(@Body() d:{tipoContenido:string;contenidoBase64:string},@Req() req:PeticionAutenticada,@Res() res:Response):Promise<void>{const r=await this.servicio.subir(d,req.get('Idempotency-Key')??'',req.headers.authorization!.slice(7));res.status(r.http).json(r.cuerpo);}
  @Get(':fotografiaId') async leer(@Param('fotografiaId') id:string,@Req() req:PeticionAutenticada){return this.servicio.leer(id,req.headers.authorization!.slice(7));}
}
