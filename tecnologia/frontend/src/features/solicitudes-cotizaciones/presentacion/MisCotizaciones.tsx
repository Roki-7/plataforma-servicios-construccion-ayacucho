import { useEffect, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { totalPaginas } from '../../prestadores-catalogo/aplicacion/busqueda.js';
import { falloDeCotizacion } from '../aplicacion/cotizacion.js';
import type { Pagina } from '../modelos/contratos.js';
import type { ApiCotizaciones, Cotizacion } from '../modelos/cotizaciones.js';
import { ResumenDeCotizacion } from './DatosDeCotizacion.js';
import { fechaCorta } from './ListaSolicitudes.js';
import { Paginacion } from './SeleccionPrestador.js';

/** «Mis cotizaciones» del prestador: todas las suyas, de la más reciente a la más antigua, con su estado efectivo. */
export function MisCotizaciones({ api, alNavegar }: { api: ApiCotizaciones; alNavegar: MouseEventHandler<HTMLAnchorElement> }) {
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<Pagina<Cotizacion>>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    void api.mias(pagina).then(r => { if (vigente) setResultado(r); }).catch(e => { if (vigente) setError(falloDeCotizacion(e).mensaje); });
    return () => { vigente = false; };
  }, [api, pagina, intento]);
  const cambiar = (n: number) => { setPagina(n); setError(''); setResultado(undefined); };
  return <div className="solicitudes">
    <header className="sol-cabecera">
      <div><h1>Mis cotizaciones</h1><p>Las cotizaciones que enviaste, con su estado según la vigencia y los cambios de cada solicitud.</p></div>
      <nav className="sol-acciones" aria-label="Cotizaciones del prestador">
        <a className="boton boton-secundario sol-enlace-boton" href="/prestador/oportunidades" onClick={alNavegar}>Oportunidades</a>
      </nav>
    </header>
    <div className="sol-lista">
      {error && <div role="alert" className="sol-panel"><p className="error">{error}</p>
        <div className="sol-acciones"><button type="button" className="boton boton-secundario" onClick={() => { setError(''); setIntento(n => n + 1); }}>Reintentar</button><a href="/habilitar-perfil">Mis perfiles</a></div></div>}
      {!error && !resultado && <p role="status">Cargando cotizaciones…</p>}
      {resultado?.total === 0 && <div className="sol-panel sol-vacio"><h2>Aún no enviaste cotizaciones</h2>
        <p>Cuando cotices una solicitud, la verás aquí con su estado. Empieza por las oportunidades compatibles con tus servicios.</p>
        <div className="sol-acciones"><a href="/prestador/oportunidades" onClick={alNavegar}>Ver oportunidades</a><a href="/prestador/solicitudes" onClick={alNavegar}>Solicitudes recibidas</a></div></div>}
      <ul className="sol-resultados" aria-label="Mis cotizaciones">{resultado?.elementos.map(c => <li key={c.cotizacionId}>
        <article className="sol-panel sol-resumen">
          <ResumenDeCotizacion c={c} conAlcance />
          <p className="sol-suave">Enviada el {fechaCorta(c.creadaEn)}{c.versionVigente.numero > 1 ? ` · versión ${c.versionVigente.numero}` : ''}</p>
          <a href={`/prestador/cotizaciones/${c.cotizacionId}`} onClick={alNavegar} aria-label={`Ver cotización de ${c.versionVigente.alcance.slice(0, 80)}`}>Ver cotización</a>
        </article>
      </li>)}</ul>
      {resultado && <Paginacion pagina={pagina} total={totalPaginas(resultado)} cambiar={cambiar} />}
    </div>
  </div>;
}
