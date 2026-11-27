import { useEffect, useRef, useState } from 'react';
import type { MouseEventHandler } from 'react';
import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import { claveIdempotencia } from '../../usuarios-acceso/infraestructura/api-usuarios.js';
import { admiteCambios, etiquetasTipo, explicacionDeEstado, falloDeCotizacion, fechaHoraLima, textoDeMotivo, type FalloDeCotizacion } from '../aplicacion/cotizacion.js';
import type { ApiCotizaciones, CotizacionDetalle } from '../modelos/cotizaciones.js';
import { CamposDeVersion, EtiquetaDeEstado, ResumenDeCotizacion } from './DatosDeCotizacion.js';

/**
 * Detalle de una cotización propia: estado efectivo con su explicación, todos los campos de la versión vigente, versiones anteriores, y las acciones reales de
 * actualizar y retirar. Retirar es terminal: pide confirmación y, al repetirse tras un fallo de red, reutiliza su clave de idempotencia.
 */
export function DetalleCotizacion({ api, id, alNavegar, ir }: { api: ApiCotizaciones; id: string; alNavegar: MouseEventHandler<HTMLAnchorElement>; ir: (ruta: string, aviso?: string) => void }) {
  const [c, setC] = useState<CotizacionDetalle>();
  const [error, setError] = useState<FalloDeCotizacion>();
  const [intento, setIntento] = useState(0);
  const [confirmando, setConfirmando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const clave = useRef<{ version: number; clave: string } | undefined>(undefined);
  const ejecutando = useRef(false);
  const alerta = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let vigente = true;
    void api.obtener(id).then(r => { if (vigente) setC(r); }).catch(e => { if (vigente) setError(falloDeCotizacion(e)); });
    return () => { vigente = false; };
  }, [api, id, intento]);
  useEffect(() => { if (error) alerta.current?.focus(); }, [error]);

  async function retirar(actual: CotizacionDetalle) {
    if (ejecutando.current) return;
    ejecutando.current = true; setOcupado(true); setError(undefined);
    const k = clave.current?.version === actual.version ? clave.current.clave : claveIdempotencia();
    clave.current = { version: actual.version, clave: k };
    try {
      await api.retirar(actual.cotizacionId, actual.version, k);
      clave.current = undefined;
      ir('/prestador/cotizaciones', 'Cotización retirada. Se conserva en tu historial.');
    } catch (e) {
      if (e instanceof ErrorApi && e.http < 500 && e.codigo !== 'CONFLICTO_CONCURRENTE') clave.current = undefined;
      setError(falloDeCotizacion(e)); setConfirmando(false);
    } finally { ejecutando.current = false; setOcupado(false); }
  }

  const volver = <a className="sol-volver" href="/prestador/cotizaciones" onClick={alNavegar}>← Mis cotizaciones</a>;
  if (error && !c) return <div className="solicitudes">{volver}
    <header className="sol-cabecera"><div><h1>Cotización no disponible</h1></div></header>
    <div role="alert" className="sol-panel"><p className="error">{error.mensaje}</p>
      <div className="sol-acciones"><button type="button" className="boton boton-secundario" onClick={() => { setError(undefined); setIntento(n => n + 1); }}>Reintentar</button></div></div></div>;
  if (!c) return <div className="solicitudes"><p role="status">Cargando cotización…</p></div>;

  const cambios = admiteCambios(c);
  return <div className="solicitudes">
    {volver}
    <header className="sol-cabecera">
      <div><h1>Cotización</h1><p>{etiquetasTipo[c.versionVigente.tipo]} · enviada el {fechaHoraLima(c.creadaEn)}</p></div>
      <EtiquetaDeEstado estado={c.estado} />
    </header>
    {error && <div className="aviso" role="alert" ref={alerta} tabIndex={-1}>
      <p><strong>{error.mensaje}</strong></p>
      {error.versionVieja && <button type="button" className="boton boton-secundario" onClick={() => { setError(undefined); setC(undefined); setIntento(n => n + 1); }}>Volver a cargar la cotización</button>}
    </div>}
    <div className="sol-distribucion">
      <div className="sol-principal">
        <section className="sol-panel" aria-labelledby="cot-estado-titulo">
          <h2 id="cot-estado-titulo">Estado</h2>
          <p className={c.requiereRevision && c.estado !== 'RETIRADA' ? 'cot-nota' : undefined}>{explicacionDeEstado(c)}</p>
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
        <div className="sol-panel sol-panel-acciones">
          <h2>Acciones</h2>
          {cambios && <a className="boton boton-primario sol-enlace-boton" href={`/prestador/cotizaciones/${c.cotizacionId}/actualizar`} onClick={alNavegar}>{c.requiereRevision ? 'Revisar y actualizar' : 'Actualizar cotización'}</a>}
          {cambios && !confirmando && <button type="button" className="boton boton-secundario" disabled={ocupado} onClick={() => setConfirmando(true)}>Retirar cotización</button>}
          {cambios && confirmando && <div className="sol-confirmar">
            <p>Retirar es definitivo: la cotización se conserva en lectura y podrás enviar otra distinta si todavía tienes acceso a la solicitud.</p>
            <button type="button" className="boton boton-secundario" disabled={ocupado} onClick={() => setConfirmando(false)}>Cancelar</button>
            <button type="button" className="boton boton-primario" disabled={ocupado} onClick={() => { void retirar(c); }}>{ocupado ? 'Retirando…' : 'Confirmar retiro'}</button>
          </div>}
          {c.estado === 'RETIRADA' && <a className="boton boton-secundario sol-enlace-boton" href={`/prestador/solicitudes/${c.solicitudId}/cotizar`} onClick={alNavegar}>Enviar una cotización nueva</a>}
          <a href={`/prestador/solicitudes/${c.solicitudId}`} onClick={alNavegar}>Ver la solicitud</a>
          {!cambios && c.estado !== 'RETIRADA' && <p className="sol-suave">La solicitud está cerrada: la cotización ya no admite cambios.</p>}
        </div>
        <section className="sol-panel" aria-labelledby="cot-resumen-titulo">
          <h2 id="cot-resumen-titulo">Resumen</h2>
          <ResumenDeCotizacion c={c} />
        </section>
      </div>
    </div>
  </div>;
}
