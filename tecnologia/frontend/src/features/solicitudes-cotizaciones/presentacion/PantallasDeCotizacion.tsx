import { useEffect, useState } from 'react';
import type { MouseEventHandler } from 'react';
import type { CategoriasWeb } from '../../prestadores-catalogo/aplicacion/categorias.js';
import { buscarMiCotizacion, falloDeCotizacion, formularioDe, formularioVacio, admiteCambios } from '../aplicacion/cotizacion.js';
import { mensajePrestador } from '../aplicacion/oportunidades.js';
import type { ApiSolicitudes, SolicitudVisible } from '../modelos/contratos.js';
import type { ApiCotizaciones, Cotizacion, CotizacionDetalle } from '../modelos/cotizaciones.js';
import { FormularioDeCotizacion } from './FormularioCotizacion.js';
import { useNombresCategoria } from './ListasPrestador.js';

interface ComunProps { api: ApiCotizaciones; solicitudes: ApiSolicitudes; categorias: CategoriasWeb; alNavegar: MouseEventHandler<HTMLAnchorElement>; ir: (ruta: string, aviso?: string) => void }

function Cuadro({ titulo, texto, enlaces, alNavegar, alerta = false }: { titulo: string; texto: string; enlaces: { href: string; texto: string }[]; alNavegar: MouseEventHandler<HTMLAnchorElement>; alerta?: boolean }) {
  return <div className="solicitudes">
    <header className="sol-cabecera"><div><h1>{titulo}</h1></div></header>
    <div className="sol-panel" {...(alerta ? { role: 'alert' } : {})}><p>{texto}</p><div className="sol-acciones">{enlaces.map(e => <a key={e.href} href={e.href} onClick={alNavegar}>{e.texto}</a>)}</div></div>
  </div>;
}

/** Lee la solicitud visible para el prestador. Recargarla conserva lo escrito en el formulario, que no se desmonta. */
function useSolicitudVisible(api: ApiSolicitudes, id: string | undefined) {
  const [solicitud, setSolicitud] = useState<SolicitudVisible>();
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    void api.obtenerVisible(id).then(s => { if (vigente) { setSolicitud(s); setError(''); } }).catch(e => { if (vigente) setError(mensajePrestador(e)); });
    return () => { vigente = false; };
  }, [api, id, intento]);
  return { solicitud, error, recargar: () => setIntento(n => n + 1) };
}

/** `/prestador/solicitudes/{id}/cotizar`: enviar una cotización nueva sobre la versión de trabajo vigente. */
export function PantallaCotizar({ api, solicitudes, categorias, alNavegar, ir, solicitudId }: ComunProps & { solicitudId: string }) {
  const { solicitud, error, recargar } = useSolicitudVisible(solicitudes, solicitudId);
  const nombre = useNombresCategoria(categorias);
  const [existente, setExistente] = useState<Cotizacion | null>();
  const [errorExistente, setErrorExistente] = useState('');
  useEffect(() => {
    let vigente = true;
    void buscarMiCotizacion(api, solicitudId).then(c => { if (vigente) setExistente(c ?? null); }).catch(e => { if (vigente) setErrorExistente(falloDeCotizacion(e).mensaje); });
    return () => { vigente = false; };
  }, [api, solicitudId]);
  const volver = { href: `/prestador/solicitudes/${solicitudId}`, texto: 'Volver a la solicitud' };
  const enlacesAtras = [{ href: '/prestador/oportunidades', texto: 'Oportunidades' }, { href: '/prestador/cotizaciones', texto: 'Mis cotizaciones' }];
  if (error) return <Cuadro titulo="Solicitud no disponible" texto={error} enlaces={enlacesAtras} alNavegar={alNavegar} alerta />;
  if (errorExistente) return <Cuadro titulo="No se pudo preparar la cotización" texto={errorExistente} enlaces={[volver, ...enlacesAtras]} alNavegar={alNavegar} alerta />;
  if (!solicitud || existente === undefined) return <div className="solicitudes"><p role="status">Preparando la cotización…</p></div>;
  if (existente) return <Cuadro titulo="Ya cotizaste esta solicitud" texto="Tienes una cotización sin retirar para esta solicitud. Actualízala en lugar de enviar otra."
    enlaces={[{ href: `/prestador/cotizaciones/${existente.cotizacionId}`, texto: 'Ver mi cotización' }, volver]} alNavegar={alNavegar} />;
  if (solicitud.estado !== 'ABIERTA') return <Cuadro titulo="La solicitud ya no está abierta" texto="Una solicitud cerrada no admite cotizaciones nuevas." enlaces={[volver, ...enlacesAtras]} alNavegar={alNavegar} />;
  if (!solicitud.titulos.some(t => t === 'DESTINATARIO' || t === 'COMPATIBLE')) return <Cuadro titulo="No puedes enviar una cotización nueva"
    texto="Ya no cumples las condiciones para cotizar esta solicitud: necesitas un servicio publicado de su categoría y cubrir su distrito, o ser el destinatario." enlaces={[volver, ...enlacesAtras]} alNavegar={alNavegar} />;
  return <FormularioDeCotizacion key={solicitudId} titulo="Enviar cotización" introduccion="Revisa la solicitud y detalla tu propuesta. El cliente verá todos estos datos."
    etiquetaBoton="Enviar cotización" inicial={formularioVacio()} solicitud={solicitud} categoria={nombre(solicitud.categoriaId)} volverA={volver} alNavegar={alNavegar}
    enviar={(datos, clave) => api.enviar(solicitudId, { ...datos, versionTrabajoSolicitud: solicitud.versionTrabajo }, clave)}
    alExito={c => ir(`/prestador/cotizaciones/${c.cotizacionId}`, 'Cotización enviada.')} alRecargarSolicitud={recargar} />;
}

/** `/prestador/cotizaciones/{id}/actualizar`: nueva versión de la cotización sobre la versión de trabajo vigente. Resuelve «Requiere revisión» y «Vencida». */
export function PantallaActualizar({ api, solicitudes, categorias, alNavegar, ir, cotizacionId }: ComunProps & { cotizacionId: string }) {
  const [c, setC] = useState<CotizacionDetalle>();
  const [errorCotizacion, setErrorCotizacion] = useState('');
  const [intentoC, setIntentoC] = useState(0);
  useEffect(() => {
    let vigente = true;
    void api.obtener(cotizacionId).then(r => { if (vigente) setC(r); }).catch(e => { if (vigente) setErrorCotizacion(falloDeCotizacion(e).mensaje); });
    return () => { vigente = false; };
  }, [api, cotizacionId, intentoC]);
  const { solicitud, error, recargar } = useSolicitudVisible(solicitudes, c?.solicitudId);
  const nombre = useNombresCategoria(categorias);
  const volver = { href: `/prestador/cotizaciones/${cotizacionId}`, texto: 'Volver a la cotización' };
  const enlacesAtras = [{ href: '/prestador/cotizaciones', texto: 'Mis cotizaciones' }];
  if (errorCotizacion) return <Cuadro titulo="Cotización no disponible" texto={errorCotizacion} enlaces={enlacesAtras} alNavegar={alNavegar} alerta />;
  if (error) return <Cuadro titulo="Solicitud no disponible" texto={error} enlaces={[volver, ...enlacesAtras]} alNavegar={alNavegar} alerta />;
  if (!c || !solicitud) return <div className="solicitudes"><p role="status">Preparando la actualización…</p></div>;
  if (!admiteCambios(c)) return <Cuadro titulo="Esta cotización ya no admite cambios"
    texto={c.estado === 'RETIRADA' ? 'La cotización está retirada.' : 'La solicitud está cerrada: la cotización se conserva en lectura.'} enlaces={[volver, ...enlacesAtras]} alNavegar={alNavegar} />;
  const aviso = c.requiereRevision
    ? <div className="aviso" role="status"><strong>La solicitud cambió después de tu última versión.</strong> Revisa el trabajo actualizado en el resumen y ajusta tu cotización si hace falta.
      {' '}<a href={`/prestador/solicitudes/${c.solicitudId}`} onClick={alNavegar}>Ver la solicitud completa</a></div>
    : c.vencida ? <div className="aviso" role="status"><strong>Tu cotización está vencida.</strong> Elige una nueva fecha de vigencia para que vuelva a estar vigente.</div> : undefined;
  return <FormularioDeCotizacion key={cotizacionId} titulo="Actualizar cotización" introduccion="Se guardará como una versión nueva; las anteriores se conservan como reemplazadas."
    etiquetaBoton="Guardar nueva versión" inicial={formularioDe(c.versionVigente)} solicitud={solicitud} categoria={nombre(solicitud.categoriaId)} volverA={volver} alNavegar={alNavegar}
    {...(aviso ? { aviso } : {})}
    enviar={(datos, clave) => api.actualizar(cotizacionId, { ...datos, versionTrabajoSolicitud: solicitud.versionTrabajo, versionCotizacion: c.version }, clave)}
    alExito={r => ir(`/prestador/cotizaciones/${r.cotizacionId}`, 'Cotización actualizada.')} alRecargarSolicitud={() => { setIntentoC(n => n + 1); recargar(); }} />;
}
