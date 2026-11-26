import { useCallback, useEffect, useState } from 'react';
import type { PerfilWeb } from '../aplicacion/perfil.js';
import { useFotoUrl } from './useFotoUrl.js';

export interface CuentaSesion { readonly nombre: string; readonly url: string }

/**
 * Nombre y fotografía de la persona con sesión, solo para su propia navegación. Consulta el perfil propio (privado) y, si hay fotografía, la lee por la API.
 * Cualquier fallo deja el nombre y las iniciales: nunca bloquea la navegación. Sin sesión no hay datos.
 */
export function useCuentaSesion(perfil: PerfilWeb, autenticada: boolean): { readonly cuenta: CuentaSesion | undefined; readonly refrescar: () => void } {
  const [datos, setDatos] = useState<{ readonly nombre: string; readonly fotografiaId: string | undefined }>(); const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!autenticada) { setDatos(undefined); return; }
    let viva = true;
    void perfil.consultar().then(p => { if (viva) setDatos({ nombre: p.nombreMostrar, fotografiaId: p.fotografiaId ?? undefined }); }).catch(() => { /* se conserva lo anterior */ });
    return () => { viva = false; };
  }, [perfil, autenticada, version]);
  const foto = useFotoUrl(autenticada ? datos?.fotografiaId : undefined, perfil.leer);
  const refrescar = useCallback(() => setVersion(v => v + 1), []);
  return { cuenta: autenticada && datos ? { nombre: datos.nombre, url: foto.url } : undefined, refrescar };
}
