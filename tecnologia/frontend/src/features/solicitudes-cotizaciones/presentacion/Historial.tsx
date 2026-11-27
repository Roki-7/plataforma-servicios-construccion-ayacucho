import { useEffect, useState } from 'react';
import { totalPaginas } from '../../prestadores-catalogo/aplicacion/busqueda.js';
import type { OpcionCategoria } from '../../prestadores-catalogo/aplicacion/categorias.js';
import { mensajeSolicitud } from '../aplicacion/edicion.js';
import type { ApiSolicitudes, Pagina, VersionTrabajo } from '../modelos/contratos.js';
import { fechaCorta, nombreDistrito } from './ListaSolicitudes.js';
import { Paginacion } from './SeleccionPrestador.js';

export function Historial({ api, id, version, categorias }: { api: ApiSolicitudes; id: string; version: number; categorias: readonly OpcionCategoria[] }) {
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [datos, setDatos] = useState<{ contenido: Pagina<VersionTrabajo>; version: number }>();
  const [error, setError] = useState('');
  useEffect(() => {
    let activo = true;
    void api.versiones(id, pagina).then(r => { if (activo) setDatos({ contenido: r, version }); }).catch(e => { if (activo) setError(mensajeSolicitud(e)); });
    return () => { activo = false; };
  }, [api, id, version, pagina, intento]);
  const resultado = datos?.version === version ? datos.contenido : undefined;
  return <div className="sol-panel" aria-labelledby="sol-versiones">
    <h2 id="sol-versiones">Historial de versiones</h2>
    {error && <div role="alert"><p className="error">{error}</p><button className="boton boton-secundario" type="button" onClick={() => { setError(''); setIntento(n => n + 1); }}>Reintentar</button></div>}
    {!resultado && !error && <p role="status">Cargando versiones…</p>}
    {resultado?.elementos.map(v => <details className="sol-version" key={v.numero}>
      <summary>Versión {v.numero} · {fechaCorta(v.creadaEn)}</summary>
      <p className="sol-texto">{v.contenido.descripcion}</p>
      {v.contenido.medidas && <p className="sol-texto">Medidas: {v.contenido.medidas}</p>}
      <p className="sol-suave">{[categorias.find(c => c.id === v.contenido.categoriaId)?.nombre, nombreDistrito(v.contenido.distrito), v.contenido.fechaDesde, v.contenido.fechaHasta].filter(Boolean).join(' · ')}</p>
      {v.contenido.archivos.length > 0 && <ul>{v.contenido.archivos.map((a, i) => <li key={a.archivoId}>Fotografía {i + 1}{a.retirado ? ' · Archivo retirado' : ''}</li>)}</ul>}
    </details>)}
    {resultado && <Paginacion pagina={pagina} total={totalPaginas(resultado)} cambiar={n => { setError(''); setDatos(undefined); setPagina(n); }} />}
  </div>;
}
