import { useEffect, useRef, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { totalPaginas } from '../../prestadores-catalogo/aplicacion/busqueda.js';
import type { CategoriasWeb, OpcionCategoria } from '../../prestadores-catalogo/aplicacion/categorias.js';
import { estadoFotografias, etiquetaTipo, etiquetasTitulo, mensajePrestador, periodo } from '../aplicacion/oportunidades.js';
import type { ApiSolicitudes, EstadoSolicitud, Oportunidad, Pagina, ResumenComoPrestador } from '../modelos/contratos.js';
import { estadosSolicitud, fechaCorta, nombreDistrito } from './ListaSolicitudes.js';
import { Paginacion } from './SeleccionPrestador.js';

type Navegar = MouseEventHandler<HTMLAnchorElement>;
interface Enlace { href: string; texto: string }

/** Nombres de categoría para las tarjetas. Si no cargan, las tarjetas siguen siendo útiles sin ellos. */
export function useNombresCategoria(categorias: CategoriasWeb): (id?: string) => string | undefined {
  const [opciones, setOpciones] = useState<readonly OpcionCategoria[]>([]);
  useEffect(() => {
    let vigente = true;
    categorias.cargar().then(o => { if (vigente) setOpciones(o); }).catch(() => { categorias.reiniciar(); });
    return () => { vigente = false; };
  }, [categorias]);
  return id => opciones.find(o => o.id === id)?.nombre;
}

function Cabecera({ titulo, texto, alNavegar, enlaces }: { titulo: string; texto: string; alNavegar: Navegar; enlaces: Enlace[] }) {
  return <header className="sol-cabecera">
    <div><h1>{titulo}</h1><p>{texto}</p></div>
    <nav className="sol-acciones" aria-label="Solicitudes del prestador">
      {enlaces.map(e => <a key={e.href} className="boton boton-secundario sol-enlace-boton" href={e.href} onClick={alNavegar}>{e.texto}</a>)}
    </nav>
  </header>;
}

function Estado({ error, cargando, vacio, reintentar }: {
  error: string; cargando: boolean; vacio?: { titulo: string; texto: string; enlaces: Enlace[] } | undefined; reintentar: () => void;
}) {
  if (error) return <div role="alert" className="sol-panel"><p className="error">{error}</p>
    <div className="sol-acciones"><button type="button" className="boton boton-secundario" onClick={reintentar}>Reintentar</button><a href="/habilitar-perfil">Mis perfiles</a></div></div>;
  if (cargando) return <p role="status">Cargando solicitudes…</p>;
  if (vacio) return <div className="sol-panel sol-vacio"><h2>{vacio.titulo}</h2><p>{vacio.texto}</p>
    <div className="sol-acciones">{vacio.enlaces.map(e => <a key={e.href} href={e.href}>{e.texto}</a>)}</div></div>;
  return null;
}

/** `clave` identifica el filtro vigente: al cambiar vuelve a consultar con la función más reciente. */
function usarPagina<T>(cargar: (pagina: number) => Promise<Pagina<T>>, clave: string) {
  const vigenteRef = useRef(cargar);
  vigenteRef.current = cargar;
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<Pagina<T>>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    void vigenteRef.current(pagina).then(r => { if (vigente) setResultado(r); }).catch(e => { if (vigente) setError(mensajePrestador(e)); });
    return () => { vigente = false; };
  }, [pagina, intento, clave]);
  return {
    pagina, resultado, error,
    cambiar: (n: number) => { setPagina(n); setError(''); setResultado(undefined); },
    reintentar: () => { setError(''); setResultado(undefined); setIntento(n => n + 1); },
  };
}

export function Oportunidades({ api, categorias, alNavegar }: { api: ApiSolicitudes; categorias: CategoriasWeb; alNavegar: Navegar }) {
  const nombre = useNombresCategoria(categorias);
  const { pagina, resultado, error, cambiar, reintentar } = usarPagina<Oportunidad>(n => api.oportunidades(n), 'oportunidades');
  return <div className="solicitudes">
    <Cabecera titulo="Oportunidades" alNavegar={alNavegar}
      texto="Solicitudes abiertas que coinciden con tus servicios publicados y tus zonas de atención, y las dirigidas a ti."
      enlaces={[{ href: '/prestador/solicitudes', texto: 'Solicitudes recibidas' }]} />
    <div className="sol-lista">
      <Estado error={error} cargando={!resultado && !error} reintentar={reintentar}
        vacio={resultado?.total === 0 ? {
          titulo: 'Aún no hay oportunidades para ti',
          texto: 'Verás una solicitud pública cuando tengas un servicio publicado de su categoría y tu perfil cubra su distrito. Las solicitudes dirigidas a ti también aparecen aquí.',
          enlaces: [{ href: '/prestador/servicios', texto: 'Mis servicios' }, { href: '/prestador/perfil', texto: 'Mi perfil profesional' }],
        } : undefined} />
      {resultado && resultado.total > 0 && <p className="sol-suave" role="status">{resultado.total === 1 ? '1 solicitud abierta' : `${resultado.total} solicitudes abiertas`}</p>}
      <ul className="sol-resultados" aria-label="Oportunidades">{resultado?.elementos.map(o => <li key={o.solicitudId}>
        <article className="sol-panel sol-resumen">
          <div className="sol-acciones">
            <span className="sol-etiqueta" data-titulo={o.tipo === 'DIRIGIDA' ? 'DESTINATARIO' : 'COMPATIBLE'}>{o.tipo === 'DIRIGIDA' ? etiquetasTitulo.DESTINATARIO : etiquetaTipo(o.tipo)}</span>
            {nombre(o.categoriaId) && <span className="sol-suave">{nombre(o.categoriaId)}</span>}
          </div>
          <h2>{o.descripcionCorta}</h2>
          <dl className="sol-datos">
            <div><dt>Distrito</dt><dd>{nombreDistrito(o.distrito) ?? o.distrito}</dd></div>
            <div><dt>Fecha</dt><dd>{periodo(o.fechaDesde, o.fechaHasta)}</dd></div>
            <div><dt>Fotografías</dt><dd>{estadoFotografias(o)}</dd></div>
          </dl>
          <a href={`/prestador/solicitudes/${o.solicitudId}`} onClick={alNavegar} aria-label={`Ver detalle: ${o.descripcionCorta}`}>Ver detalle</a>
        </article>
      </li>)}</ul>
      {resultado && <Paginacion pagina={pagina} total={totalPaginas(resultado)} cambiar={cambiar} />}
    </div>
  </div>;
}

export function SolicitudesRecibidas({ api, categorias, alNavegar }: { api: ApiSolicitudes; categorias: CategoriasWeb; alNavegar: Navegar }) {
  const nombre = useNombresCategoria(categorias);
  const [filtro, setFiltro] = useState<EstadoSolicitud>();
  const { pagina, resultado, error, cambiar, reintentar } = usarPagina<ResumenComoPrestador>(n => api.listarComoPrestador(n, filtro), filtro ?? 'todos');
  const estados = Object.entries(estadosSolicitud).filter(([v]) => v !== 'BORRADOR');
  return <div className="solicitudes">
    <Cabecera titulo="Solicitudes recibidas" alNavegar={alNavegar}
      texto="Solicitudes dirigidas a ti y aquellas donde ya tienes una cotización, aunque estén cerradas."
      enlaces={[{ href: '/prestador/oportunidades', texto: 'Oportunidades' }]} />
    <div className="sol-lista">
      <div className="sol-filtro">
        <label htmlFor="sol-filtro-estado">Estado</label>
        <select id="sol-filtro-estado" value={filtro ?? ''} onChange={e => { setFiltro((e.target.value || undefined) as EstadoSolicitud | undefined); cambiar(1); }}>
          <option value="">Todos los estados</option>
          {estados.map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}
        </select>
      </div>
      <Estado error={error} cargando={!resultado && !error} reintentar={reintentar}
        vacio={resultado?.total === 0 ? {
          titulo: filtro ? 'No hay solicitudes con este estado' : 'Aún no has recibido solicitudes',
          texto: filtro ? 'Elige otro estado para revisar tus solicitudes.' : 'Cuando un cliente te dirija una solicitud, aparecerá aquí aunque después la cierre.',
          enlaces: [{ href: '/prestador/oportunidades', texto: 'Ver oportunidades' }],
        } : undefined} />
      <ul className="sol-resultados" aria-label="Solicitudes recibidas">{resultado?.elementos.map(s => <li key={s.solicitudId}>
        <article className="sol-panel sol-resumen">
          <div className="sol-acciones">
            <span className="estado" data-estado={s.estado}>{estadosSolicitud[s.estado]}</span>
            {s.titulos.map(t => <span key={t} className="sol-etiqueta" data-titulo={t}>{etiquetasTitulo[t]}</span>)}
          </div>
          <h2>{s.descripcionCorta ?? 'Solicitud sin descripción'}</h2>
          <p className="sol-suave">{[nombre(s.categoriaId), nombreDistrito(s.distrito), `Actualizada el ${fechaCorta(s.actualizadaEn)}`].filter(Boolean).join(' · ')}</p>
          <a href={`/prestador/solicitudes/${s.solicitudId}`} onClick={alNavegar} aria-label={s.descripcionCorta ? `Ver detalle: ${s.descripcionCorta}` : 'Ver detalle'}>Ver detalle</a>
        </article>
      </li>)}</ul>
      {resultado && <Paginacion pagina={pagina} total={totalPaginas(resultado)} cambiar={cambiar} />}
    </div>
  </div>;
}
