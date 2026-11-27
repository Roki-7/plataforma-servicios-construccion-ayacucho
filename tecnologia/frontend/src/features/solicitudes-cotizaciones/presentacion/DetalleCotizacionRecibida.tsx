import { useEffect, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { etiquetasTipo, explicacionParaCliente, falloDeCotizacion, fechaHoraLima, textoDeMotivo } from '../aplicacion/cotizacion.js';
import type { ApiCotizaciones, CotizacionDetalle } from '../modelos/cotizaciones.js';
import { CamposDeVersion, EtiquetaDeEstado } from './DatosDeCotizacion.js';
import { HiloAclaraciones } from './HiloAclaraciones.js';

/**
 * Una cotización recibida, vista por el cliente dueño: autor (nombre público que el servidor entrega solo a él), estado, todos los campos de la versión vigente,
 * versiones anteriores y el hilo de aclaraciones con el prestador. No ofrece seleccionar, aceptar ni contratar: eso corresponde a otra historia.
 */
export function DetalleCotizacionRecibida({ api, solicitudId, cotizacionId, alNavegar }: { api: ApiCotizaciones; solicitudId: string; cotizacionId: string; alNavegar: MouseEventHandler<HTMLAnchorElement> }) {
  const [c, setC] = useState<CotizacionDetalle>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let vigente = true;
    void api.obtener(cotizacionId).then(r => { if (vigente) setC(r); }).catch(e => { if (vigente) setError(falloDeCotizacion(e).mensaje); });
    return () => { vigente = false; };
  }, [api, cotizacionId, intento]);
  const volver = <a className="sol-volver" href={`/solicitudes/${solicitudId}/cotizaciones`} onClick={alNavegar}>← Cotizaciones recibidas</a>;
  if (error) return <div className="solicitudes">{volver}<header className="sol-cabecera"><div><h1>Cotización no disponible</h1></div></header>
    <div role="alert" className="sol-panel"><p className="error">{error}</p>
      <div className="sol-acciones"><button type="button" className="boton boton-secundario" onClick={() => { setError(''); setIntento(n => n + 1); }}>Reintentar</button></div></div></div>;
  if (!c) return <div className="solicitudes">{volver}<p role="status">Cargando cotización…</p></div>;

  const nombre = c.prestadorNombrePublico ?? 'Prestador';
  const soloLectura = c.estado === 'RETIRADA' ? 'El prestador retiró esta cotización: el hilo queda en lectura.'
    : c.solicitudCerrada ? 'Tu solicitud está cerrada: el hilo queda en lectura.' : undefined;
  return <div className="solicitudes">
    {volver}
    <header className="sol-cabecera">
      <div><h1>Cotización de {nombre}</h1><p>{etiquetasTipo[c.versionVigente.tipo]} · recibida el {fechaHoraLima(c.creadaEn)}</p></div>
      <EtiquetaDeEstado estado={c.estado} />
    </header>
    <div className="sol-distribucion">
      <div className="sol-principal">
        <section className="sol-panel" aria-labelledby="cot-estado-titulo">
          <h2 id="cot-estado-titulo">Estado</h2>
          <p>{explicacionParaCliente(c)}</p>
          {c.motivosNoAceptable.length > 0 && <ul className="cot-motivos" aria-label="Qué afecta a esta cotización">{c.motivosNoAceptable.map(m => <li key={m}>{textoDeMotivo[m]}</li>)}</ul>}
        </section>
        <section className="sol-panel" aria-labelledby="cot-vigente-titulo">
          <h2 id="cot-vigente-titulo">Versión vigente (n.º {c.versionVigente.numero})</h2>
          <CamposDeVersion v={c.versionVigente} />
        </section>
        {c.versiones.length > 1 && <section className="sol-panel" aria-labelledby="cot-versiones-titulo">
          <h2 id="cot-versiones-titulo">Versiones anteriores</h2>
          {c.versiones.filter(v => v.reemplazada).map(v => <details className="sol-version" key={v.numero}>
            <summary>Versión {v.numero} · {fechaHoraLima(v.creadaEn)} · reemplazada</summary>
            <CamposDeVersion v={v} />
          </details>)}
        </section>}
      </div>
      <div className="sol-lateral">
        <HiloAclaraciones api={api} cotizacionId={cotizacionId} miRol="CLIENTE" nombreDelPrestador={nombre} soloLectura={soloLectura} />
      </div>
    </div>
  </div>;
}
