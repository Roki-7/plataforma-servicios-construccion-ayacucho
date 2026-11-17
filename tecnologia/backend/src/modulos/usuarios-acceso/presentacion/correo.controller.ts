import {Controller,Post,Body,Req,Res,Param,Inject} from '@nestjs/common';
import type {Response} from 'express';
import type {SolicitarCambioCorreo} from '../aplicacion/solicitar-cambio-correo.js';
import type {ConfirmarCambioCorreo} from '../aplicacion/confirmar-cambio-correo.js';
import {SesionRequerida,type PeticionAutenticada} from './guard-sesion.js';
export const SERVICIOS_CORREO=Symbol('servicios-correo');
@Controller('perfil/cambios-correo') @SesionRequerida()
export class CorreoController {
 constructor(@Inject(SERVICIOS_CORREO)private readonly s:{solicitar:SolicitarCambioCorreo;confirmar:ConfirmarCambioCorreo}){}
 @Post() async solicitar(@Body()d:{version:number;nuevoCorreo:string},@Req()r:PeticionAutenticada,@Res()res:Response){const x=await this.s.solicitar.ejecutar(d,r.get('Idempotency-Key')??'',r.headers.authorization!.slice(7));res.status(x.http).json(x.cuerpo);}
 @Post(':token/confirmacion') async confirmar(@Param('token')token:string,@Body()d:{version:number;versionDesafio:number},@Req()r:PeticionAutenticada,@Res()res:Response){const x=await this.s.confirmar.ejecutar(token,d,r.get('Idempotency-Key')??'',r.headers.authorization!.slice(7));res.status(x.http).json(x.cuerpo);}
}
