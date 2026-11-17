import {Controller,Post,Body,Req,Inject,HttpCode} from '@nestjs/common';
import type {ReautenticarSesion} from '../aplicacion/reautenticar-sesion.js';
import {SesionRequerida,type PeticionAutenticada} from './guard-sesion.js';
export const REAUTENTICAR=Symbol('reautenticar');
@Controller('sesiones/reautenticacion') @SesionRequerida()
export class ReautenticacionController {
 constructor(@Inject(REAUTENTICAR)private readonly servicio:ReautenticarSesion){}
 @Post() @HttpCode(200) async ejecutar(@Body()d:{contrasenaActual:string},@Req()r:PeticionAutenticada){return this.servicio.ejecutar(r.headers.authorization!.slice(7),d.contrasenaActual);}
}
