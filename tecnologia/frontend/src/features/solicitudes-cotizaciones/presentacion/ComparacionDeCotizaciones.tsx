import { useEffect, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { falloDeCotizacion } from '../aplicacion/cotizacion.js';
import { MAXIMO_COMPARACION, vistaDeComparacion, type ColumnaDeComparacion } from '../aplicacion/comparacion.js';
import type { ApiCotizaciones, Cotizacion } from '../modelos/cotizaciones.js';

/** `true` mientras la consulta de medios coincide. Sin `matchMedia` (pruebas) se asume la distribución estrecha. */
function useCoincide(consulta: string): boolean {
  const leer = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches;
  const [coincide, setCoincide] = useState(leer);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const medio = window.matchMedia(consulta);
    const alCambiar = () => setCoincide(medio.matches);
    medio.addEventListener('change', alCambiar); alCambiar();
    return () => medio.removeEventListener('change', alCambiar);
  }, [consulta]);
  return coincide;
}

interface Props {
  api: ApiCotizaciones;
  solicitudId: string;
  ids: readonly string[];
  alQuitar: (id: string) => void;
  alNavegar: MouseEventHandler<HTMLAnchorElement>;
}

function Encabezado({ c, solicitudId, alNavegar, alQuitar }: { c: ColumnaDeComparacion; solicitudId: string; alNavegar: MouseEventHandler<HTMLAnchorElement>; alQuitar: (id: string) => void }) {
  return <div className="cot-col-cabecera">
    <strong className="cot-col-nombre">{c.prestador}</strong>
    <div className="cot-col-chips">
      <span className="cot-estado" data-estado-cotizacion={c.estado}>{c.etiquetaDeEstado}</span>
      <span className="sol-etiqueta" data-titulo={c.esEstimada ? 'DESTINATARIO' : 'COMPATIBLE'}>{c.rotuloDeTipo}</span>
    </div>
    {c.senales.filter(s => s.motivo !== 'RETIRADA' && s.motivo !== c.estado).map(s => <span key={s.motivo} className="cot-senal">{s.texto}</span>)}
    <div className="cot-col-acciones">
      <a href={`/solicitudes/${solicitudId}/cotizaciones/${c.id}`} onClick={alNavegar} aria-label={`Ver detalle y aclaraciones de ${c.prestador}`}>Ver detalle</a>
      <button type="button" className="boton boton-secundario boton-compacto" onClick={() => alQuitar(c.id)} aria-label={`Quitar a ${c.prestador} de la comparación`}>Quitar</button>
    </div>
  </div>;
}

/**
 * Comparación neutral de hasta 10 cotizaciones (FR-343). Sin «mejor», sin sumas ni totales, en el orden elegido; «No indicado» donde falta un dato; las estimadas se
 * rotulan y se advierte que no son un precio final; vencidas, pendientes de revisión y de solicitud cerrada se señalan sin excluirlas.
 * En pantallas amplias es una tabla con la primera columna fija y desplazamiento SOLO dentro del marco; en tableta y teléfono, una tarjeta por cotización con todos
 * sus datos, sin ocultar ninguno.
 */
export function ComparacionDeCotizaciones({ api, solicitudId, ids, alQuitar, alNavegar }: Props) {
  const amplia = useCoincide('(min-width: 64rem)');
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const clave = ids.join(',');
  useEffect(() => {
    if (ids.length < 2) return;
    let vigente = true;
    setCotizaciones(undefined);
    void api.deSolicitud(solicitudId, 1, ids).then(r => { if (vigente) { setCotizaciones([...r.elementos]); setError(''); } }).catch(e => { if (vigente) setError(falloDeCotizacion(e).mensaje); });
    return () => { vigente = false; };
    // La selección se identifica por su contenido (`clave`): un arreglo nuevo con los mismos ids no vuelve a consultar.
  }, [api, solicitudId, clave, intento]);

  const volver = <a className="sol-volver" href={`/solicitudes/${solicitudId}/cotizaciones`} onClick={alNavegar}>← Cotizaciones recibidas</a>;
  if (ids.length < 2) return <div className="solicitudes">{volver}
    <header className="sol-cabecera"><div><h1>Comparar cotizaciones</h1></div></header>
    <div className="sol-panel sol-vacio"><h2>Elige al menos dos cotizaciones</h2>
      <p>La comparación pone las cotizaciones que elijas lado a lado. Vuelve a la lista y marca entre 2 y {MAXIMO_COMPARACION}.</p>
      <div className="sol-acciones"><a href={`/solicitudes/${solicitudId}/cotizaciones`} onClick={alNavegar}>Elegir cotizaciones</a></div></div></div>;
  if (error) return <div className="solicitudes">{volver}
    <header className="sol-cabecera"><div><h1>Comparar cotizaciones</h1></div></header>
    <div role="alert" className="sol-panel"><p className="error">{error}</p>
      <div className="sol-acciones"><button type="button" className="boton boton-secundario" onClick={() => { setError(''); setIntento(n => n + 1); }}>Reintentar</button></div></div></div>;
  if (!cotizaciones) return <div className="solicitudes">{volver}<p role="status">Preparando la comparación…</p></div>;

  const vista = vistaDeComparacion(cotizaciones);
  return <div className="solicitudes">
    {volver}
    <header className="sol-cabecera">
      <div><h1>Comparar cotizaciones</h1><p>{vista.columnas.length} cotizaciones, en el orden en que las elegiste. No hay una clasificación: tú decides qué pesa más.</p></div>
    </header>
    {vista.advertencias.map(a => <div key={a} className="aviso" role="status">{a}</div>)}
    {amplia
      ? <div className="cot-tabla-marco" role="region" aria-label="Tabla de comparación, se desplaza horizontalmente" tabIndex={0}>
        <table className="cot-tabla" style={{ ['--columnas' as string]: vista.columnas.length }}>
          <caption className="sol-solo-lectores">Comparación de {vista.columnas.length} cotizaciones, en el orden elegido y sin clasificación</caption>
          <thead><tr><th scope="col"><span className="sol-solo-lectores">Dato</span></th>
            {vista.columnas.map(c => <th scope="col" key={c.id}><Encabezado c={c} solicitudId={solicitudId} alNavegar={alNavegar} alQuitar={alQuitar} /></th>)}</tr></thead>
          <tbody>{vista.filas.map(f => <tr key={f.clave}><th scope="row">{f.etiqueta}</th>
            {f.celdas.map((celda, i) => <td key={vista.columnas[i]!.id} className={f.largo ? 'sol-texto' : 'cot-celda-dato'} data-vacio={celda === 'No indicado'}>{celda}</td>)}</tr>)}</tbody>
        </table>
      </div>
      : <ul className="cot-comparacion-tarjetas" aria-label="Cotizaciones comparadas">{vista.columnas.map((c, i) => <li key={c.id}>
        <article className="sol-panel">
          <Encabezado c={c} solicitudId={solicitudId} alNavegar={alNavegar} alQuitar={alQuitar} />
          <dl className="cot-campos">{vista.filas.map(f => <div key={f.clave} className={f.largo ? 'cot-campo-largo' : undefined}><dt>{f.etiqueta}</dt>
            <dd className={f.largo ? 'sol-texto' : undefined} data-vacio={f.celdas[i] === 'No indicado'}>{f.celdas[i]}</dd></div>)}</dl>
        </article>
      </li>)}</ul>}
  </div>;
}
