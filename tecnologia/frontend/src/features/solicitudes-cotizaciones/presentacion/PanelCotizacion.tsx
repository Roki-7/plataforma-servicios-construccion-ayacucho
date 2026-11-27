import { useEffect, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { buscarMiCotizacion, falloDeCotizacion } from '../aplicacion/cotizacion.js';
import type { SolicitudVisible } from '../modelos/contratos.js';
import type { ApiCotizaciones, Cotizacion } from '../modelos/cotizaciones.js';
import { ResumenDeCotizacion } from './DatosDeCotizacion.js';

/**
 * «Tu cotización» en el detalle de una solicitud. Solo ofrece enviar una cotización cuando el servidor lo permitiría (solicitud abierta y título de destinatario o de
 * compatible); el servidor vuelve a decidirlo. Si ya existe una cotización sin retirar, enlaza a ella en lugar de ofrecer otra.
 */
export function PanelCotizacion({ api, solicitud, alNavegar }: { api: ApiCotizaciones; solicitud: SolicitudVisible; alNavegar: MouseEventHandler<HTMLAnchorElement> }) {
  const [propia, setPropia] = useState<Cotizacion | null>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    void buscarMiCotizacion(api, solicitud.solicitudId).then(c => { if (vigente) setPropia(c ?? null); }).catch(e => { if (vigente) setError(falloDeCotizacion(e).mensaje); });
    return () => { vigente = false; };
  }, [api, solicitud.solicitudId, intento]);
  const puedeEnviar = solicitud.estado === 'ABIERTA' && solicitud.titulos.some(t => t === 'DESTINATARIO' || t === 'COMPATIBLE');
  return <section className="sol-panel" aria-labelledby="cot-panel-titulo">
    <h2 id="cot-panel-titulo">Tu cotización</h2>
    {error && <div role="alert"><p className="error">{error}</p>
      <button type="button" className="boton boton-secundario" onClick={() => { setError(''); setPropia(undefined); setIntento(n => n + 1); }}>Reintentar</button></div>}
    {!error && propia === undefined && <p role="status">Comprobando tu cotización…</p>}
    {propia && <>
      <ResumenDeCotizacion c={propia} conAlcance />
      <div className="sol-acciones"><a className="boton boton-primario sol-enlace-boton" href={`/prestador/cotizaciones/${propia.cotizacionId}`} onClick={alNavegar}>Ver mi cotización</a></div>
    </>}
    {propia === null && (puedeEnviar
      ? <><p>Aún no cotizaste esta solicitud. Revisa el trabajo y envía una propuesta con tu precio, plazo y condiciones.</p>
        <div className="sol-acciones"><a className="boton boton-primario sol-enlace-boton" href={`/prestador/solicitudes/${solicitud.solicitudId}/cotizar`} onClick={alNavegar}>Enviar cotización</a></div></>
      : <p className="sol-suave">{solicitud.estado === 'CERRADA' ? 'La solicitud está cerrada y no admite cotizaciones nuevas.' : 'No puedes enviar una cotización nueva a esta solicitud.'}</p>)}
  </section>;
}
