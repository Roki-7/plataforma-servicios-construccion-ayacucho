import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import './estilos-002.css';
import { hayFiltros, mensajeBusqueda, sinFiltros, totalPaginas, type BusquedaWeb } from '../aplicacion/busqueda.js';
import { distritos, tiposPrestador, type Distrito, type FiltrosBusqueda, type PaginaPublica, type PrestadorResumen, type ServicioPublico, type TipoResultado } from '../modelos/contratos.js';

export interface OpcionClasificacion { readonly id: string; readonly nombre: string }
const etiquetaTipo = (v: string) => tiposPrestador.find(t => t.valor === v)?.etiqueta ?? v;
const etiquetaDistrito = (v: string) => distritos.find(d => d.codigo === v)?.etiqueta ?? v;
const separador = ' › ';

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
  // Los nombres de las categorías vienen de la consulta pública de categorías: «Raíz» o «Raíz › Subcategoría». Un identificador desconocido no se muestra.
  const nombreCategoria = (id: string) => categorias.find(c => c.id === id)?.nombre;

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

  return <section className="p002 p002-busqueda" aria-labelledby="titulo-busqueda">
    <div className="p002-encabezado">
      <h2 id="titulo-busqueda">Buscar servicios y prestadores</h2>
      <p className="p002-ayuda">Los datos de cada resultado son declarados por el prestador. La disponibilidad no constituye una reserva ni una confirmación.</p>
    </div>
    <form noValidate aria-label="Filtros de búsqueda" aria-busy={cargando} className="p002-filtros" onSubmit={aplicar}>
      <fieldset className="p002-segmentos"><legend>Buscar</legend>
        <label className="p002-segmento"><input type="radio" name="tipo" checked={tipo === 'servicios'} onChange={() => { setTipo('servicios'); setFiltros({ ...filtros, pagina: 1 }); }} />Servicios</label>
        <label className="p002-segmento"><input type="radio" name="tipo" checked={tipo === 'prestadores'} onChange={() => { setTipo('prestadores'); setFiltros({ ...filtros, pagina: 1 }); }} />Prestadores</label>
      </fieldset>
      <div className="p002-campos">
        {categorias.length > 0 && <label className="p002-campo">Categoría<select value={borrador.categoria} onChange={e => setBorrador({ ...borrador, categoria: e.target.value })}>
          <option value="">Todas</option>{categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>}
        <label className="p002-campo">Zona de atención<select value={borrador.distrito} onChange={e => setBorrador({ ...borrador, distrito: e.target.value })}>
          <option value="">Todas</option>{distritos.map(d => <option key={d.codigo} value={d.codigo}>{d.etiqueta}</option>)}</select></label>
        <label className="p002-campo">Disponibilidad declarada<select value={borrador.disponibilidad} onChange={e => setBorrador({ ...borrador, disponibilidad: e.target.value })}>
          <option value="">Cualquiera</option><option value="true">Declara estar disponible</option><option value="false">Declara no estar disponible</option></select></label>
        <div className="p002-accion-filtro"><button type="submit" className="boton boton-acento" disabled={cargando}>Buscar</button></div>
      </div>
    </form>
    {error && <p role="alert" className="error p002-mensaje p002-mensaje-error">{error}</p>}
    {cargando && !resultado && <p className="p002-cargando">Buscando…</p>}
    {resultado && resultado.total === 0 && !error && <div role="status" className="p002-vacio">
      <p>No hay coincidencias para esos criterios. Ajuste los filtros e intente de nuevo.</p>
      {hayFiltros(filtros) && <button type="button" className="boton boton-secundario" onClick={quitar}>Quitar filtros</button>}
    </div>}
    {resultado && resultado.elementos.length > 0 && <>
      <p className="p002-total">{resultado.total} {resultado.total === 1 ? 'resultado' : 'resultados'}</p>
      <ul aria-label="Resultados" className="p002-rejilla">
        {tipoResultado === 'servicios'
          ? (resultado.elementos as readonly ServicioPublico[]).map(s => <li key={s.servicioId}><article className="p002-tarjeta" aria-label={`Servicio: ${s.titulo}`}>
            <h3>{s.titulo}</h3><p className="p002-descripcion">{s.descripcion}</p>
            <ClasificacionServicio nombre={nombreCategoria(s.categoriaId)} />
            {filtros.distrito && <p className="p002-dato">Zona: {etiquetaDistrito(filtros.distrito)}</p>}
            <div className="p002-acciones">
              {alVerServicio && <button type="button" className="boton boton-primario" aria-label={`Ver detalle de ${s.titulo}`} onClick={() => alVerServicio(s.servicioId)}>Ver detalle</button>}
              <button type="button" className="boton boton-secundario" aria-label={`Ver prestador de ${s.titulo}`} onClick={() => alVerPrestador(s.prestadorId)}>Ver prestador</button>
            </div>
          </article></li>)
          : (resultado.elementos as readonly PrestadorResumen[]).map(p => <li key={p.prestadorId}><article className="p002-tarjeta" aria-label={`Prestador: ${p.nombrePublico}`}>
            <h3>{p.nombrePublico}</h3>
            <p className="p002-descripcion">{etiquetaTipo(p.tipo)} · Zonas: {p.distritos.map(etiquetaDistrito).join(', ')}</p>
            {p.especialidadesIds.some(id => nombreCategoria(id)) && <ul className="p002-especialidades" aria-label={`Especialidades de ${p.nombrePublico}`}>
              {p.especialidadesIds.flatMap(id => { const n = nombreCategoria(id); return n ? [<li key={id} className="p002-etiqueta-lectura">{n}</li>] : []; })}
            </ul>}
            <p className={`p002-insignia ${p.disponibilidadDeclarada ? 'p002-insignia-si' : 'p002-insignia-no'}`}>Disponibilidad declarada: {p.disponibilidadDeclarada ? 'sí' : 'no'}</p>
            <div className="p002-acciones"><button type="button" className="boton boton-primario" aria-label={`Ver perfil de ${p.nombrePublico}`} onClick={() => alVerPrestador(p.prestadorId)}>Ver perfil</button></div>
          </article></li>)}
      </ul>
      <nav aria-label="Paginación" className="p002-paginacion">
        <button type="button" className="boton boton-secundario" disabled={cargando || filtros.pagina <= 1} onClick={() => irA(filtros.pagina - 1)}>Anterior</button>
        <span>Página {resultado.pagina} de {totalPaginas(resultado)}</span>
        <button type="button" className="boton boton-secundario" disabled={cargando || resultado.pagina >= totalPaginas(resultado)} onClick={() => irA(filtros.pagina + 1)}>Siguiente</button>
      </nav>
    </>}
  </section>;
}

/** Categoría y, si la hay, subcategoría del servicio (datos de la consulta pública de categorías; sin nombre conocido no se muestra nada). */
function ClasificacionServicio({ nombre }: { readonly nombre: string | undefined }) {
  if (!nombre) return null;
  const [raiz, hija] = nombre.split(separador);
  return <p className="p002-clasificacion"><span>Categoría: <strong>{raiz}</strong></span>{hija && <span>Subcategoría: <strong>{hija}</strong></span>}</p>;
}
