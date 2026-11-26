import { useEffect, useState } from 'react';
import type { FotografiaLectura } from '../modelos/contratos.js';

export interface EstadoFoto { readonly url: string; readonly error: boolean }

/** Lee la fotografía privada de la cuenta por la API y la expone como URL de objeto, que se revoca al cambiar el identificador o desmontar. */
export function useFotoUrl(id: string | undefined, leer: (id: string) => Promise<FotografiaLectura>): EstadoFoto {
  const [estado, setEstado] = useState<EstadoFoto>({ url: '', error: false });
  useEffect(() => {
    let viva = true; let creada: string | undefined;
    setEstado({ url: '', error: false });
    if (!id) return;
    void leer(id).then(f => {
      if (!viva) return;
      const bytes = Uint8Array.from(atob(f.contenidoBase64), c => c.charCodeAt(0));
      creada = URL.createObjectURL(new Blob([bytes], { type: f.tipoContenido }));
      setEstado({ url: creada, error: false });
    }).catch(() => { if (viva) setEstado({ url: '', error: true }); });
    return () => { viva = false; if (creada) URL.revokeObjectURL(creada); };
  }, [id, leer]);
  return estado;
}
