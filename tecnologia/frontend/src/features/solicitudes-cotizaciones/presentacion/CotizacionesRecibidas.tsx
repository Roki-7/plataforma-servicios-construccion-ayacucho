import { useEffect, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { totalPaginas } from '../../prestadores-catalogo/aplicacion/busqueda.js';
import { fechaHoraLima, falloDeCotizacion } from '../aplicacion/cotizacion.js';
import { alternarSeleccion, MAXIMO_COMPARACION } from '../aplicacion/comparacion.js';
import type { Pagina } from '../modelos/contratos.js';
import type { ApiCotizaciones, Cotizacion } from '../modelos/cotizaciones.js';
import { EtiquetaDeEstado, textoDePrecio } from './DatosDeCotizacion.js';
import { Paginacion } from './SeleccionPrestador.js';
import { etiquetasTipo } from '../aplicacion/cotizacion.js';

interface Props {
  api: ApiCotizaciones;
  solicitudId: string;
  /** Cotizaciones marcadas para comparar (se conservan al cambiar de página). */
  seleccion: readonly string[];
  alCambiarSeleccion: (ids: string[]) => void;
  alNavegar: MouseEventHandler<HTMLAnchorElement>;
  /** Navega a la comparación con la selección actual. */
  alComparar: () => void;
}

/**
 * Cotizaciones que recibió el cliente para su solicitud: en el orden en que llegaron, SIN clasificación de «mejor». Cada tarjeta muestra autor, tipo, estado, importe,
 * plazo y vigencia, y permite marcar hasta 10 para compararlas. El nombre del autor lo entrega el servidor solo al cliente dueño de la solicitud.
 */
export function CotizacionesRecibidas({ api, solicitudId, seleccion, alCambiarSeleccion, alNavegar, alComparar }: Props) {
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState<Pagina<Cotizacion>>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    void api.deSolicitud(solicitudId, pagina).then(r => { if (vigente) setResultado(r); }).catch(e => { if (vigente) setError(falloDeCotizacion(e).mensaje); });
    return () => { vigente = false; };
  }, [api, solicitudId, pagina, intento]);
  const cambiar = (n: number) => { setPagina(n); setError(''); setResultado(undefined); };
  const alMaximo = seleccion.length >= MAXIMO_COMPARACION;
  const puedeComparar = seleccion.length >= 2;

  return <div className="solicitudes">
    <a className="sol-volver" href={`/solicitudes/${solicitudId}`} onClick={alNavegar}>← Mi solicitud</a>
    <header className="sol-cabecera">
      <div><h1>Cotizaciones recibidas</h1><p>Se muestran en el orden en que llegaron, sin clasificarlas. Marca las que quieras comparar lado a lado (hasta {MAXIMO_COMPARACION}).</p></div>
    </header>
    <div className="sol-lista">
      {error && <div role="alert" className="sol-panel"><p className="error">{error}</p>
        <div className="sol-acciones"><button type="button" className="boton boton-secundario" onClick={() => { setError(''); setIntento(n => n + 1); }}>Reintentar</button>
          <a href="/solicitudes" onClick={alNavegar}>Mis solicitudes</a></div></div>}
      {!error && !resultado && <p role="status">Cargando cotizaciones…</p>}
      {resultado?.total === 0 && <div className="sol-panel sol-vacio"><h2>Aún no recibiste cotizaciones</h2>
        <p>Cuando un prestador cotice tu solicitud, la verás aquí con su tipo, importe, plazo y vigencia. Puedes aclarar dudas con cada prestador y comparar las cotizaciones.</p>
        <div className="sol-acciones"><a href={`/solicitudes/${solicitudId}`} onClick={alNavegar}>Volver a mi solicitud</a></div></div>}
      {resultado && resultado.total > 0 && <div className="cot-barra" role="region" aria-label="Comparación">
        <p aria-live="polite"><strong>{seleccion.length}</strong> de {MAXIMO_COMPARACION} seleccionadas{alMaximo ? ' · alcanzaste el máximo' : ''}{seleccion.length === 1 ? ' · elige al menos una más' : ''}</p>
        <div className="sol-acciones">
          {seleccion.length > 0 && <button type="button" className="boton boton-secundario" onClick={() => alCambiarSeleccion([])}>Limpiar selección</button>}
          <button type="button" className="boton boton-primario" disabled={!puedeComparar} onClick={alComparar}>Comparar seleccionadas</button>
        </div>
      </div>}
      <ul className="sol-resultados" aria-label="Cotizaciones recibidas">{resultado?.elementos.map(c => {
        const marcada = seleccion.includes(c.cotizacionId);
        const nombre = c.prestadorNombrePublico ?? 'Prestador';
        const v = c.versionVigente;
        return <li key={c.cotizacionId}>
          <article className="sol-panel sol-resumen cot-tarjeta" data-seleccionada={marcada}>
            <div className="cot-tarjeta-cabecera">
              <h2>{nombre}</h2>
              <label className="cot-marca"><input type="checkbox" checked={marcada} disabled={!marcada && alMaximo} onChange={() => alCambiarSeleccion(alternarSeleccion(seleccion, c.cotizacionId))} />
                <span>Comparar<span className="sol-solo-lectores"> la cotización de {nombre}</span></span></label>
            </div>
            <div className="sol-acciones"><EtiquetaDeEstado estado={c.estado} /><span className="sol-suave">{etiquetasTipo[v.tipo]}</span>
              {c.solicitudCerrada && <span className="sol-etiqueta" data-titulo="AUTOR_DE_COTIZACION">Solicitud cerrada</span>}</div>
            <p className={v.precioCentimos === undefined ? 'cot-precio cot-precio-pendiente' : 'cot-precio'}>{v.precioCentimos === undefined ? 'Precio por definir' : textoDePrecio(v)}</p>
            <dl className="sol-datos">
              <div><dt>Plazo</dt><dd>{v.plazoDias === undefined ? 'No indicado' : `${v.plazoDias} ${v.plazoDias === 1 ? 'día' : 'días'}`}</dd></div>
              <div><dt>Válida hasta</dt><dd>{fechaHoraLima(v.vigenteHasta)}</dd></div>
            </dl>
            <a href={`/solicitudes/${solicitudId}/cotizaciones/${c.cotizacionId}`} onClick={alNavegar} aria-label={`Ver detalle y aclaraciones de la cotización de ${nombre}`}>Ver detalle y aclaraciones</a>
          </article>
        </li>;
      })}</ul>
      {resultado && <Paginacion pagina={pagina} total={totalPaginas(resultado)} cambiar={cambiar} />}
    </div>
  </div>;
}
