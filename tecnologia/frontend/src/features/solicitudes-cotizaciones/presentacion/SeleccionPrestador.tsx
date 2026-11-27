import { useEffect, useState } from 'react';
import { sinFiltros, totalPaginas, type BusquedaWeb } from '../../prestadores-catalogo/aplicacion/busqueda.js';
import type { PaginaPublica, PerfilPublico, PrestadorResumen } from '../../prestadores-catalogo/modelos/contratos.js';
import { mensajeSolicitud } from '../aplicacion/edicion.js';
import type { DatosSolicitud } from '../modelos/contratos.js';

export function SeleccionPrestador({ busqueda, datos, tituloGuardado, fijo, cambiar, errorDe }: {
  busqueda: BusquedaWeb;
  datos: DatosSolicitud;
  tituloGuardado?: string | undefined;
  fijo: boolean;
  cambiar: (cambio: Partial<DatosSolicitud>) => void;
  errorDe: (campo: string) => string | undefined;
}) {
  const [buscando, setBuscando] = useState(!fijo && !datos.prestadorId);
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<PaginaPublica<PrestadorResumen>>();
  const [perfil, setPerfil] = useState<PerfilPublico>();
  const [paginaServicios, setPaginaServicios] = useState(1);
  const [intento, setIntento] = useState(0);
  const [error, setError] = useState('');
  const id = datos.prestadorId;
  useEffect(() => {
    if (!buscando && !id) return;
    let vigente = true;
    if (buscando) {
      void busqueda.buscar('prestadores', { ...sinFiltros, pagina }).then(r => { if (vigente) setResultado(r); }).catch(e => { if (vigente) setError(mensajeSolicitud(e)); });
    } else if (id) {
      void busqueda.perfil(id, paginaServicios).then(p => { if (vigente) setPerfil(p); }).catch(e => { if (vigente) setError(mensajeSolicitud(e)); });
    }
    return () => { vigente = false; };
  }, [buscando, busqueda, id, intento, pagina, paginaServicios]);

  const mensaje = errorDe('prestadorId') ?? errorDe('servicioId');
  return <div className="sol-seleccion">
    <strong>Prestador {fijo ? '' : '(obligatorio para publicar)'}</strong>
    {mensaje && <p className="error" id="sol-destinatario-error">{mensaje}</p>}
    {error && <div role="alert"><p className="error">{error}</p><button type="button" className="boton boton-secundario" onClick={() => { setError(''); setIntento(n => n + 1); }}>Reintentar consulta</button></div>}
    {buscando ? <>
      {!resultado && !error && <p role="status">Cargando prestadores…</p>}
      {resultado && (resultado.total === 0 ? <p>No hay prestadores disponibles.</p> : <>
        <ul className="sol-opciones" aria-label="Prestadores disponibles">{resultado.elementos.map(p => <li key={p.prestadorId}>
          <button type="button" className="boton boton-secundario" aria-describedby={mensaje ? 'sol-destinatario-error' : undefined} onClick={() => {
            setPerfil(undefined); setError(''); setPaginaServicios(1);
            cambiar({ prestadorId: p.prestadorId, servicioId: undefined, categoriaId: datos.servicioId ? undefined : datos.categoriaId }); setBuscando(false);
          }}>{p.nombrePublico}</button>
        </li>)}</ul>
        <Paginacion pagina={pagina} total={totalPaginas(resultado)} cambiar={n => { setResultado(undefined); setError(''); setPagina(n); }} />
      </>)}
      {id && <button type="button" className="boton boton-secundario" onClick={() => { setError(''); setBuscando(false); }}>Conservar prestador</button>}
    </> : <>
      {id && <p>{perfil?.nombrePublico ?? 'Prestador seleccionado'}</p>}
      {!fijo && <button type="button" className="boton boton-secundario" onClick={() => { setError(''); setBuscando(true); }}>{id ? 'Cambiar prestador' : 'Elegir prestador'}</button>}
      {id && !fijo && <label>Servicio <span className="sol-opcional">(opcional)</span>
        <select value={datos.servicioId ?? ''} onChange={e => cambiar({ servicioId: e.target.value || undefined, categoriaId: undefined })}>
          <option value="" disabled={Boolean(tituloGuardado)}>Sin servicio específico</option>
          {datos.servicioId && !perfil?.servicios.elementos.some(s => s.servicioId === datos.servicioId)
            && <option value={datos.servicioId}>{tituloGuardado ?? 'Servicio seleccionado'}</option>}
          {perfil?.servicios.elementos.map(s => <option key={s.servicioId} value={s.servicioId}>{s.titulo}</option>)}
        </select>
      </label>}
      {!fijo && perfil && <Paginacion pagina={paginaServicios} total={totalPaginas(perfil.servicios)} cambiar={n => { setError(''); setPaginaServicios(n); }} />}
      {fijo && tituloGuardado && <p>Servicio vinculado: {tituloGuardado}</p>}
    </>}
  </div>;
}

export function Paginacion({ pagina, total, cambiar }: { pagina: number; total: number; cambiar: (pagina: number) => void }) {
  if (total < 2 && pagina === 1) return null;
  return <nav className="sol-paginacion" aria-label="Paginación">
    <button type="button" className="boton boton-secundario" disabled={pagina <= 1} onClick={() => cambiar(pagina - 1)}>Anterior</button>
    <span>Página {pagina} de {total}</span>
    <button type="button" className="boton boton-secundario" disabled={pagina >= total} onClick={() => cambiar(pagina + 1)}>Siguiente</button>
  </nav>;
}
