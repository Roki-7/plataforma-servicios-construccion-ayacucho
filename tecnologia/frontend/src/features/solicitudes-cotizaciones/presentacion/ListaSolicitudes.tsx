import { useEffect, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { distritos } from '../../prestadores-catalogo/modelos/contratos.js';
import { totalPaginas } from '../../prestadores-catalogo/aplicacion/busqueda.js';
import { mensajeSolicitud } from '../aplicacion/edicion.js';
import type { ApiSolicitudes, EstadoSolicitud, Pagina, ResumenSolicitud } from '../modelos/contratos.js';
import { Paginacion } from './SeleccionPrestador.js';

export const estadosSolicitud = { BORRADOR: 'Borrador', ABIERTA: 'Abierta', CERRADA: 'Cerrada' };
export const nombreDistrito = (codigo?: string) => distritos.find(d => d.codigo === codigo)?.etiqueta;
export const fechaCorta = (dato: string) => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'America/Lima' }).format(new Date(dato));

export function ListaSolicitudes({ api, alNavegar }: { api: ApiSolicitudes; alNavegar: MouseEventHandler<HTMLAnchorElement> }) {
  const [pagina, setPagina] = useState(1);
  const [filtro, setFiltro] = useState<EstadoSolicitud>();
  const [resultado, setResultado] = useState<Pagina<ResumenSolicitud>>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    void api.listar(pagina, filtro).then(r => { if (vigente) setResultado(r); }).catch(e => { if (vigente) setError(mensajeSolicitud(e)); });
    return () => { vigente = false; };
  }, [api, pagina, filtro, intento]);
  function cambiarPagina(n: number) { setPagina(n); setError(''); setResultado(undefined); }
  return <div className="solicitudes">
    <header className="sol-cabecera">
      <div><h1>Mis solicitudes</h1><p>Describe el trabajo que necesitas y consulta el estado de cada solicitud.</p></div>
      <a className="boton boton-primario sol-enlace-boton" href="/solicitudes/nueva" onClick={alNavegar}>Nueva solicitud</a>
    </header>
    <div className="sol-lista">
      <div className="sol-filtro">
        <label htmlFor="sol-filtro-estado">Estado</label>
        <select id="sol-filtro-estado" value={filtro ?? ''} onChange={e => { setFiltro((e.target.value || undefined) as EstadoSolicitud | undefined); cambiarPagina(1); }}>
          <option value="">Todos los estados</option>
          {Object.entries(estadosSolicitud).map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}
        </select>
      </div>
      {error && <div role="alert" className="sol-panel"><p className="error">{error}</p><div className="sol-acciones">
        <button type="button" className="boton boton-secundario" onClick={() => { setError(''); setIntento(n => n + 1); }}>Reintentar</button>
        <a href="/habilitar-perfil">Mis perfiles</a>
      </div></div>}
      {!error && !resultado && <p role="status">Cargando solicitudes…</p>}
      {resultado?.total === 0 && <div className="sol-panel"><h2>{filtro ? 'No hay solicitudes con este estado' : 'Aún no tienes solicitudes'}</h2>
        <p>{filtro ? 'Elige otro estado para revisar tus solicitudes.' : 'Guarda un borrador para empezar y publícalo cuando esté listo.'}</p>
      </div>}
      <ul className="sol-resultados">{resultado?.elementos.map(s => <li key={s.solicitudId}>
        <article className="sol-panel sol-resumen">
          <div className="sol-acciones">
            <span className="estado" data-estado={s.estado}>{estadosSolicitud[s.estado]}</span>
            <span className="sol-suave">{s.tipo === 'DIRIGIDA' ? 'Dirigida' : 'Pública'}</span>
          </div>
          <h2>{s.descripcionCorta ?? 'Solicitud sin descripción'}</h2>
          <p className="sol-suave">{[nombreDistrito(s.distrito), `Actualizada el ${fechaCorta(s.actualizadaEn)}`].filter(Boolean).join(' · ')}</p>
          <a href={`/solicitudes/${s.solicitudId}`} onClick={alNavegar}>Ver solicitud<span className="sol-solo-lectores">{s.descripcionCorta ? `: ${s.descripcionCorta}` : ''}</span></a>
        </article>
      </li>)}</ul>
      {resultado && <Paginacion pagina={pagina} total={totalPaginas(resultado)} cambiar={cambiarPagina} />}
    </div>
  </div>;
}
