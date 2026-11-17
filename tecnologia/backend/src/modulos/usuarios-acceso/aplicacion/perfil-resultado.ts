import type { PerfilCuenta } from '../dominio/cuenta.js';
export function perfilResultado(p: PerfilCuenta): PerfilCuenta { return {cuentaId:p.cuentaId,nombreMostrar:p.nombreMostrar,correo:p.correo,telefono:p.telefono,distrito:p.distrito,fotografiaId:p.fotografiaId,perfiles:[...p.perfiles],telefonoCompartible:p.telefonoCompartible,version:p.version}; }
