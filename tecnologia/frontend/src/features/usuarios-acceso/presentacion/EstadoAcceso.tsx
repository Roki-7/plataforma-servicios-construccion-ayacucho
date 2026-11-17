import { ErrorApi } from '../aplicacion/puertos.js';
export function mensajeAcceso(error:unknown):string {
  if(error instanceof ErrorApi){if(error.http===401)return 'Su sesión no es válida. Inicie sesión de nuevo.';if(error.http===403)return 'No dispone de permiso para esta acción.';if(error.http===404)return 'Recurso no disponible.';}
  return error instanceof Error?error.message:'No fue posible consultar la cuenta.';
}
export function EstadoAcceso({autenticada,comprobando}:{autenticada:boolean;comprobando:boolean}){
  if(comprobando)return null;
  return <aside aria-label="Acceso a mi cuenta"><p>{autenticada?'Puede consultar y modificar su propia cuenta con sus perfiles habilitados.':'Inicie sesión para consultar o modificar su propia cuenta.'}</p></aside>;
}
