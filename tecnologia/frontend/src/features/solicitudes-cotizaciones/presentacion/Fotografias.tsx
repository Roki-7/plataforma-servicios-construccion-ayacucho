import { useEffect, useState } from 'react';
import { mensajeSolicitud, tiposImagen } from '../aplicacion/edicion.js';
import type { ApiSolicitudes, FotoSolicitud } from '../modelos/contratos.js';

export function VistaFoto({ api, id, archivoId, numero }: { api: ApiSolicitudes; id: string; archivoId: string; numero: number }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    const fin = new AbortController();
    let local: string | undefined;
    void api.foto(id, archivoId, fin.signal).then(blob => {
      if (!fin.signal.aborted) {
        local = URL.createObjectURL(blob);
        setUrl(local);
      }
    }).catch(e => { if (!fin.signal.aborted) setError(mensajeSolicitud(e)); });
    return () => { fin.abort(); if (local) URL.revokeObjectURL(local); };
  }, [api, id, archivoId, intento]);
  if (error) return <div className="sol-foto-error"><p className="error">{error}</p><button className="boton boton-secundario" type="button" onClick={() => { setError(''); setIntento(n => n + 1); }}>Reintentar vista</button></div>;
  return url ? <img src={url} alt={`Fotografía ${numero} de la solicitud`} /> : <p className="sol-foto-error" role="status">Cargando vista…</p>;
}

export function Fotografias({ api, id, fotos, incluidos, editable, ocupado, archivo, seleccionar, subir, alternar, error }: {
  api: ApiSolicitudes;
  id: string;
  fotos: FotoSolicitud[];
  incluidos: string[];
  editable: boolean;
  ocupado: boolean;
  archivo: File | undefined;
  seleccionar: (archivo: File | undefined) => void;
  subir: () => void;
  alternar: (id: string) => void;
  error: string | undefined;
}) {
  return <div className="sol-panel" aria-labelledby="sol-fotos">
    <h2 id="sol-fotos">Fotografías</h2>
    {editable && <>
      <p id="sol-fotos-limites">Hasta 5 imágenes JPG, PNG o WebP, de 10 MB por archivo y 30 MB almacenados en total. Guarda los cambios para confirmar las fotos incluidas.</p>
      <div className="sol-picker">
        <input className="sol-solo-lectores" id="sol-foto-archivo" type="file" accept={tiposImagen.join(',')} aria-describedby={error ? 'sol-fotos-limites sol-fotos-error' : 'sol-fotos-limites'} onChange={e => {
          seleccionar(e.currentTarget.files?.[0]); e.currentTarget.value = '';
        }} />
        <label className="boton boton-secundario" htmlFor="sol-foto-archivo">Seleccionar fotografía</label>
      </div>
      {archivo && <div className="sol-acciones"><span>{archivo.name}</span><button type="button" className="boton boton-secundario" disabled={ocupado} onClick={subir}>Cargar fotografía</button></div>}
      {error && <p id="sol-fotos-error" className="error" role="alert">{error}</p>}
    </>}
    {!fotos.length && <p className="sol-suave">Aún no hay fotografías cargadas.</p>}
    <ul className="sol-fotos">{fotos.map((foto, i) => {
      const incluir = incluidos.includes(foto.archivoId);
      return <li key={foto.archivoId}>
        <VistaFoto api={api} id={id} archivoId={foto.archivoId} numero={i + 1} />
        <div className="sol-foto-texto">
          <strong>{`Foto ${i + 1}`}</strong>
          <span>{foto.estado === 'CONFIRMADO' ? (incluir ? 'Confirmada' : 'Se retirará al guardar') : (incluir ? 'Por confirmar al guardar' : 'Pendiente de confirmar')}</span>
          {editable && <button type="button" className="boton boton-secundario boton-compacto" aria-label={`${incluir ? 'Excluir' : 'Incluir'} foto ${i + 1}`} onClick={() => alternar(foto.archivoId)}>{incluir ? 'Excluir' : 'Incluir'}</button>}
        </div>
      </li>;
    })}</ul>
  </div>;
}
