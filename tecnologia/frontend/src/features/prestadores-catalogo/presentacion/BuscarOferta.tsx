import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { hayFiltros, mensajeBusqueda, sinFiltros, totalPaginas, type BusquedaWeb } from '../aplicacion/busqueda.js';
import { distritos, tiposPrestador, type Distrito, type FiltrosBusqueda, type PaginaPublica, type PrestadorResumen, type ServicioPublico, type TipoResultado } from '../modelos/contratos.js';

export interface OpcionClasificacion { readonly id: string; readonly nombre: string }
const etiquetaTipo = (v: string) => tiposPrestador.find(t => t.valor === v)?.etiqueta ?? v;
const etiquetaDistrito = (v: string) => distritos.find(d => d.codigo === v)?.etiqueta ?? v;

/** Búsqueda pública base. Funciona sin sesión y no muestra puntuaciones, insignias ni estados de verificación. */
export function BuscarOferta({ busqueda, categorias = [], alVerPrestador, alVerServicio }: {
  readonly busqueda: BusquedaWeb; readonly categorias?: readonly OpcionClasificacion[];
  readonly alVerPrestador: (id: string) => void; readonly alVerServicio?: (id: string) => void;
}) {
  const [tipo, setTipo] = useState<TipoResultado>('servicios');
  const [filtros, setFiltros] = useState<FiltrosBusqueda>(sinFiltros);
  const [borrador, setBorrador] = useState<{ categoria: string; distrito: string; disponibilidad: string }>({ categoria: '', distrito: '', disponibilidad: '' });
  // El tipo se guarda junto al resultado: al cambiar de pestaña, el resultado anterior no se interpreta con el tipo nuevo.
  const [resultado, setResultado] = useState<PaginaPublica<ServicioPublico> | PaginaPublica<PrestadorResumen>>();
  const [tipoResultado, setTipoResultado] = useState<TipoResultado>('servicios');
  const [error, setError] = useState(''); const [cargando, setCargando] = useState(false);
  const peticion = useRef(0);

  const consultar = useCallback(async (t: TipoResultado, f: FiltrosBusqueda) => {
    const mia = ++peticion.current;
    setCargando(true); setError('');
    try {
      const r = t === 'servicios' ? await busqueda.buscar('servicios', f) : await busqueda.buscar('prestadores', f);
      if (mia === peticion.current) { setResultado(r); setTipoResultado(t); }
    } catch (e) { if (mia === peticion.current) setError(mensajeBusqueda(e)); }
    finally { if (mia === peticion.current) setCargando(false); }
  }, [busqueda]);
  useEffect(() => { void consultar(tipo, filtros); }, [consultar, tipo, filtros]);

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setFiltros({ pagina: 1, tamano: sinFiltros.tamano,
      ...(borrador.categoria ? { categoria: borrador.categoria } : {}), ...(borrador.distrito ? { distrito: borrador.distrito as Distrito } : {}),
      ...(borrador.disponibilidad ? { disponibilidad: borrador.disponibilidad === 'true' } : {}) });
  }
  function quitar() { setBorrador({ categoria: '', distrito: '', disponibilidad: '' }); setFiltros(sinFiltros); }
  const irA = (pagina: number) => setFiltros({ ...filtros, pagina });

  return <section aria-labelledby="titulo-busqueda">
    <h2 id="titulo-busqueda">Buscar servicios y prestadores</h2>
    <form noValidate aria-label="Filtros de búsqueda" onSubmit={aplicar}>
      <fieldset><legend>Buscar</legend>
        <label><input type="radio" name="tipo" checked={tipo === 'servicios'} onChange={() => { setTipo('servicios'); setFiltros({ ...filtros, pagina: 1 }); }} />Servicios</label>
        <label><input type="radio" name="tipo" checked={tipo === 'prestadores'} onChange={() => { setTipo('prestadores'); setFiltros({ ...filtros, pagina: 1 }); }} />Prestadores</label>
      </fieldset>
      {categorias.length > 0 && <label>Categoría<select value={borrador.categoria} onChange={e => setBorrador({ ...borrador, categoria: e.target.value })}>
        <option value="">Todas</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>}
      <label>Zona de atención<select value={borrador.distrito} onChange={e => setBorrador({ ...borrador, distrito: e.target.value })}>
        <option value="">Todas</option>{distritos.map(d => <option key={d.codigo} value={d.codigo}>{d.etiqueta}</option>)}</select></label>
      <label>Disponibilidad declarada<select value={borrador.disponibilidad} onChange={e => setBorrador({ ...borrador, disponibilidad: e.target.value })}>
        <option value="">Cualquiera</option><option value="true">Declara estar disponible</option><option value="false">Declara no estar disponible</option></select></label>
      <button type="submit" disabled={cargando}>Buscar</button>
    </form>
    <p>Los datos de cada resultado son declarados por el prestador. La disponibilidad no constituye una reserva ni una confirmación.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {cargando && !resultado && <p>Buscando…</p>}
    {resultado && resultado.total === 0 && !error && <div role="status">
      <p>No hay coincidencias para esos criterios. Ajuste los filtros e intente de nuevo.</p>
      {hayFiltros(filtros) && <button type="button" onClick={quitar}>Quitar filtros</button>}
    </div>}
    {resultado && resultado.elementos.length > 0 && <>
      <p>{resultado.total} {resultado.total === 1 ? 'resultado' : 'resultados'}</p>
      <ul aria-label="Resultados">
        {tipoResultado === 'servicios'
          ? (resultado.elementos as readonly ServicioPublico[]).map(s => <li key={s.servicioId}><article aria-label={`Servicio: ${s.titulo}`}>
            <h3>{s.titulo}</h3><p>{s.descripcion}</p>
            <button type="button" onClick={() => alVerPrestador(s.prestadorId)}>{`Ver prestador de ${s.titulo}`}</button>
            {alVerServicio && <button type="button" onClick={() => alVerServicio(s.servicioId)}>{`Ver detalle de ${s.titulo}`}</button>}
          </article></li>)
          : (resultado.elementos as readonly PrestadorResumen[]).map(p => <li key={p.prestadorId}><article aria-label={`Prestador: ${p.nombrePublico}`}>
            <h3>{p.nombrePublico}</h3>
            <p>{etiquetaTipo(p.tipo)} · Zonas: {p.distritos.map(etiquetaDistrito).join(', ')}</p>
            <p>Disponibilidad declarada: {p.disponibilidadDeclarada ? 'sí' : 'no'}</p>
            <button type="button" onClick={() => alVerPrestador(p.prestadorId)}>{`Ver perfil de ${p.nombrePublico}`}</button>
          </article></li>)}
      </ul>
      <nav aria-label="Paginación">
        <button type="button" disabled={cargando || filtros.pagina <= 1} onClick={() => irA(filtros.pagina - 1)}>Anterior</button>
        <span>Página {resultado.pagina} de {totalPaginas(resultado)}</span>
        <button type="button" disabled={cargando || resultado.pagina >= totalPaginas(resultado)} onClick={() => irA(filtros.pagina + 1)}>Siguiente</button>
      </nav>
    </>}
  </section>;
}
