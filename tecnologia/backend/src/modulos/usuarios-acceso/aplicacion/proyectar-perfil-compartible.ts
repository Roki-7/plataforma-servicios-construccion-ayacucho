import type { PerfilCuenta } from '../dominio/cuenta.js';
/** Proyección interna. No habilita un endpoint ni un perfil público RF10. */
export function proyectarPerfilCompartible(p: PerfilCuenta) { return {nombreMostrar:p.nombreMostrar,distrito:p.distrito,perfiles:[...p.perfiles],...(p.telefonoCompartible && p.telefono ? {telefono:p.telefono} : {})}; }
