import { useEffect, useState } from 'react';
import type { MouseEventHandler } from 'react';
import type { CategoriasWeb, OpcionCategoria } from '../../prestadores-catalogo/aplicacion/categorias.js';
import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import { etiquetaTipo, etiquetasTitulo, mensajePrestador, periodo } from '../aplicacion/oportunidades.js';
import type { ApiSolicitudes, SolicitudVisible } from '../modelos/contratos.js';
import { VistaFoto } from './Fotografias.js';
import { Historial } from './Historial.js';
import { estadosSolicitud, nombreDistrito } from './ListaSolicitudes.js';

/**
 * Vista de solo lectura para un prestador. El servidor decide qué se muestra (títulos y política de fotografías); aquí solo se presenta lo recibido.
 * La respuesta no trae datos del cliente, de modo que la pantalla no puede mostrarlos.
 */
export function DetalleSolicitudPrestador({ api, categorias, id, alNavegar }: {
  api: ApiSolicitudes; categorias: CategoriasWeb; id: string; alNavegar: MouseEventHandler<HTMLAnchorElement>;
}) {
  const [solicitud, setSolicitud] = useState<SolicitudVisible>();
  const [error, setError] = useState<{ mensaje: string; propia: boolean }>();
  const [intento, setIntento] = useState(0);
  const [opciones, setOpciones] = useState<readonly OpcionCategoria[]>([]);
  const [verVersiones, setVerVersiones] = useState(false);
  useEffect(() => {
    let vigente = true;
    void api.obtenerVisible(id).then(s => { if (vigente) setSolicitud(s); })
      .catch(e => { if (vigente) setError({ mensaje: mensajePrestador(e), propia: e instanceof ErrorApi && e.codigo === 'SOLICITUD_PROPIA' }); });
    return () => { vigente = false; };
  }, [api, id, intento]);
  useEffect(() => {
    let vigente = true;
    categorias.cargar().then(o => { if (vigente) setOpciones(o); }).catch(() => { categorias.reiniciar(); });
    return () => { vigente = false; };
  }, [categorias]);

  const enlaces = <>
    <a className="sol-volver" href="/prestador/oportunidades" onClick={alNavegar}>Volver a oportunidades</a>
    <a href="/prestador/solicitudes" onClick={alNavegar}>Solicitudes recibidas</a>
  </>;
  if (error) return <div className="solicitudes">
    <header className="sol-cabecera"><div><h1>Solicitud no disponible</h1></div></header>
    <div role="alert" className="sol-panel"><p className="error">{error.mensaje}</p>
      <div className="sol-acciones">
        {error.propia
          ? <a href={`/solicitudes/${id}`} onClick={alNavegar}>Ir a mi solicitud</a>
          : <button type="button" className="boton boton-secundario" onClick={() => { setError(undefined); setIntento(n => n + 1); }}>Reintentar</button>}
        {enlaces}
      </div></div>
  </div>;
  if (!solicitud) return <div className="solicitudes"><p role="status">Cargando solicitud…</p></div>;

  const categoria = opciones.find(o => o.id === solicitud.categoriaId)?.nombre;
  const cerrada = solicitud.estado === 'CERRADA';
  const puedeVerVersiones = solicitud.titulos.some(t => t === 'DESTINATARIO' || t === 'AUTOR_DE_COTIZACION');
  const { fotografias } = solicitud;
  return <div className="solicitudes">
    <header className="sol-cabecera">
      <div>
        <h1>Detalle de la solicitud</h1>
        <p>{categoria ?? 'Solicitud de trabajo'} · {nombreDistrito(solicitud.distrito) ?? solicitud.distrito}</p>
      </div>
      <div className="sol-acciones">{enlaces}</div>
    </header>
    <div className="sol-distribucion">
      <div className="sol-principal">
        {cerrada && <div className="aviso" role="status"><strong>Solicitud cerrada.</strong> El cliente ya no la tiene abierta. Puedes consultarla porque tienes acceso a ella.</div>}
        <section className="sol-panel" aria-labelledby="sol-trabajo">
          <div className="sol-acciones">
            <span className="estado" data-estado={solicitud.estado}>{estadosSolicitud[solicitud.estado]}</span>
            <span className="sol-suave">{etiquetaTipo(solicitud.tipo)}</span>
            {solicitud.titulos.map(t => <span key={t} className="sol-etiqueta" data-titulo={t}>{etiquetasTitulo[t]}</span>)}
          </div>
          <h2 id="sol-trabajo">Trabajo solicitado</h2>
          <p className="sol-texto">{solicitud.descripcion}</p>
          {solicitud.medidas && <><h3 className="sol-subtitulo">Medidas</h3><p className="sol-texto">{solicitud.medidas}</p></>}
          <dl className="sol-datos">
            <div><dt>Categoría</dt><dd>{categoria ?? '—'}</dd></div>
            <div><dt>Distrito</dt><dd>{nombreDistrito(solicitud.distrito) ?? solicitud.distrito}</dd></div>
            <div><dt>Fecha</dt><dd>{periodo(solicitud.fechaDesde, solicitud.fechaHasta)}</dd></div>
          </dl>
        </section>
        {verVersiones && puedeVerVersiones && <Historial api={api} id={solicitud.solicitudId} version={solicitud.versionTrabajo} categorias={opciones} />}
      </div>
      <div className="sol-lateral">
        <section className="sol-panel" aria-labelledby="sol-fotos">
          <h2 id="sol-fotos">Fotografías</h2>
          {!fotografias.hay && <p className="sol-suave">Esta solicitud no incluye fotografías.</p>}
          {fotografias.hay && !fotografias.compartidas && <p className="sol-suave">El cliente no compartió las fotografías de esta solicitud.</p>}
          {fotografias.compartidas && fotografias.archivos.length > 0 && <ul className="sol-fotos">{fotografias.archivos.map((f, i) => <li key={f.archivoId}>
            <VistaFoto api={api} id={solicitud.solicitudId} archivoId={f.archivoId} numero={i + 1} />
            <div className="sol-foto-texto"><strong>{`Foto ${i + 1}`}</strong></div>
          </li>)}</ul>}
        </section>
        {puedeVerVersiones && <div className="sol-panel sol-panel-acciones">
          <button type="button" className="boton boton-secundario" aria-expanded={verVersiones} onClick={() => setVerVersiones(v => !v)}>{verVersiones ? 'Ocultar versiones' : 'Ver versiones'}</button>
        </div>}
      </div>
    </div>
  </div>;
}
