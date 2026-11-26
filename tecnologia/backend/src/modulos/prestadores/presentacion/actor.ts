import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import type { PeticionIdentidad002 } from '../../../composicion/identidad-002.js';
import type { ActorPrestador } from '../aplicacion/perfil-profesional.js';

/** La identidad procede del guard del servidor. Nunca se lee del cuerpo ni de parámetros. */
export function actorDe(req: PeticionIdentidad002): ActorPrestador {
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization ?? '')?.[1];
  if (!req.identidad002 || !token) throw new ErrorAplicacion(401, 'NO_AUTENTICADO', 'Debe autenticarse.');
  return { token, identidad: req.identidad002 };
}
