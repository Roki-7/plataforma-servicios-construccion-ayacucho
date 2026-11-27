import { useEffect, useRef, useState } from 'react';
import type { MouseEventHandler, ReactNode } from 'react';
import type { BusquedaWeb } from '../../prestadores-catalogo/aplicacion/busqueda.js';
import type { CategoriasWeb, OpcionCategoria } from '../../prestadores-catalogo/aplicacion/categorias.js';
import { distritos } from '../../prestadores-catalogo/modelos/contratos.js';
import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import { claveIdempotencia } from '../../usuarios-acceso/infraestructura/api-usuarios.js';
import { base64, cambiosDe, datosDe, fechaLima, mensajeSolicitud, validarCampos, validarFoto } from '../aplicacion/edicion.js';
import type { ApiSolicitudes, DatosSolicitud, SolicitudPrivada } from '../modelos/contratos.js';
import { Fotografias } from './Fotografias.js';
import { Historial } from './Historial.js';
import { estadosSolicitud, nombreDistrito } from './ListaSolicitudes.js';
import { SeleccionPrestador } from './SeleccionPrestador.js';

type Props = {
  api: ApiSolicitudes;
  busqueda: BusquedaWeb;
  categorias: CategoriasWeb;
  id?: string | undefined;
  mensajeInicial?: string | undefined;
  alNavegar?: MouseEventHandler<HTMLAnchorElement> | undefined;
  alCrear: (id: string) => void;
};
type Fallo = { mensaje: string; campos: Record<string, string>; conflicto?: boolean };
type Operacion = 'crear' | 'guardar' | 'publicar' | 'cerrar' | 'foto';

function falloDe(e: unknown): Fallo {
  const detalles = e instanceof ErrorApi ? e.detalles : [];
  return {
    mensaje: mensajeSolicitud(e),
    campos: Object.fromEntries(detalles.flatMap(d => d.campo ? [[d.campo, d.motivo]] : [])),
    conflicto: e instanceof ErrorApi && e.codigo === 'VERSION_DESACTUALIZADA',
  };
}

export function EditorSolicitud({ api, busqueda, categorias, id, alCrear, mensajeInicial, alNavegar }: Props) {
  const [actual, setActual] = useState<SolicitudPrivada>();
  const [datos, setDatos] = useState<DatosSolicitud>({ tipo: 'PUBLICADA' });
  const [incluidos, setIncluidos] = useState<string[]>([]);
  const [opciones, setOpciones] = useState<readonly OpcionCategoria[]>([]);
  const [errorCategorias, setErrorCategorias] = useState('');
  const [cargandoCategorias, setCargandoCategorias] = useState(true);
  const [archivo, setArchivo] = useState<File>();
  const [fallo, setFallo] = useState<Fallo>();
  const [errorFoto, setErrorFoto] = useState<string>();
  const [estado, setEstado] = useState(mensajeInicial ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [confirmarCierre, setConfirmarCierre] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);
  const [intento, setIntento] = useState(0);
  const [intentoCategorias, setIntentoCategorias] = useState(0);
  const ejecutando = useRef(false);
  const datosParaRecarga = useRef<Partial<DatosSolicitud> | undefined>(undefined);
  const reintentos = useRef(new Map<Operacion, { firma: string | File; clave: string }>());
  const alerta = useRef<HTMLDivElement>(null);

  function adoptar(s: SolicitudPrivada) {
    setActual(s);
    setDatos(datosDe(s));
    setIncluidos(s.archivos.filter(a => a.estado === 'CONFIRMADO').map(a => a.archivoId));
  }
  useEffect(() => {
    if (!id) return;
    let vigente = true;
    void api.obtener(id).then(s => {
      if (!vigente) return;
      adoptar(s);
      if (datosParaRecarga.current) {
        setDatos({ ...datosDe(s), ...datosParaRecarga.current });
        datosParaRecarga.current = undefined;
        setEstado('Se cargó la versión actual. Revisa los campos antes de volver a guardar.');
      }
    }).catch(e => { if (vigente) setFallo(falloDe(e)); });
    return () => { vigente = false; };
  }, [api, id, intento]);
  useEffect(() => {
    let vigente = true;
    void categorias.cargar().then(r => { if (vigente) setOpciones(r); })
      .catch(e => { if (vigente) setErrorCategorias(mensajeSolicitud(e)); })
      .finally(() => { if (vigente) setCargandoCategorias(false); });
    return () => { vigente = false; };
  }, [categorias, intentoCategorias]);
  useEffect(() => { if (fallo?.mensaje) alerta.current?.focus(); }, [fallo?.mensaje]);

  async function conClave<T>(operacion: Operacion, contenido: object | File, enviar: (clave: string) => Promise<T>): Promise<T> {
    const firma = contenido instanceof File ? contenido : JSON.stringify(contenido);
    const anterior = reintentos.current.get(operacion);
    const clave = anterior?.firma === firma ? anterior.clave : claveIdempotencia();
    reintentos.current.set(operacion, { firma, clave });
    try {
      const resultado = await enviar(clave);
      reintentos.current.delete(operacion);
      return resultado;
    } catch (e) {
      if (e instanceof ErrorApi && e.http < 500 && e.codigo !== 'CONFLICTO_CONCURRENTE') reintentos.current.delete(operacion);
      throw e;
    }
  }

  async function ejecutar(mensaje: string, accion: () => Promise<void>, foto = false) {
    if (ejecutando.current) return;
    ejecutando.current = true;
    setOcupado(true); setFallo(undefined); setErrorFoto(undefined); setEstado(mensaje);
    try { await accion(); }
    catch (e) { setEstado(''); if (foto) setErrorFoto(mensajeSolicitud(e)); else setFallo(falloDe(e)); }
    finally { ejecutando.current = false; setOcupado(false); }
  }

  function cambiar(cambio: Partial<DatosSolicitud>) {
    setDatos(previos => ({ ...previos, ...cambio }));
    if (fallo && Object.keys(cambio).some(campo => campo in fallo.campos)) {
      setFallo({ ...fallo, campos: Object.fromEntries(Object.entries(fallo.campos).filter(([campo]) => !(campo in cambio))) });
    }
  }
  function errorDe(campo: string) { return fallo?.campos[campo]; }
  function atributos(campo: string, ayuda?: string) {
    return { id: `sol-${campo}`, 'aria-invalid': errorDe(campo) ? true : undefined, 'aria-describedby': [ayuda, errorDe(campo) ? `sol-${campo}-error` : undefined].filter(Boolean).join(' ') || undefined };
  }
  function errorCampo(campo: string): ReactNode {
    return errorDe(campo) && <span className="error" id={`sol-${campo}-error`}>{errorDe(campo)}</span>;
  }

  function fotosModificadas(s: SolicitudPrivada) {
    const confirmados = s.archivos.filter(a => a.estado === 'CONFIRMADO').map(a => a.archivoId);
    return confirmados.length !== incluidos.length || confirmados.some(a => !incluidos.includes(a));
  }

  async function guardar(s: SolicitudPrivada, guardarFotos = true) {
    validarCampos(datos, s);
    const cambios = cambiosDe(datos, s);
    const cambioFotos = guardarFotos && fotosModificadas(s);
    const cuerpo = { ...cambios, version: s.version, ...(cambioFotos ? { archivosIds: incluidos } : {}) };
    if (!cambioFotos && Object.keys(cambios).length === 0) return s;
    const guardada = await conClave('guardar', cuerpo, clave => api.editar(s.solicitudId, cuerpo, clave));
    if (guardarFotos) adoptar(guardada);
    else { setActual(guardada); setDatos(datosDe(guardada)); }
    return guardada;
  }

  function publicar(s: SolicitudPrivada) {
    void ejecutar('Publicando solicitud…', async () => {
      const guardada = await guardar(s, false);
      const cuerpo = { version: guardada.version, ...(fotosModificadas(guardada) ? { archivosIds: incluidos } : {}) };
      const publicada = await conClave('publicar', cuerpo, clave => api.publicar(s.solicitudId, cuerpo, clave));
      adoptar(publicada);
      setEstado('Solicitud publicada.');
    });
  }

  function subir(s: SolicitudPrivada, foto: File) {
    void ejecutar('Cargando fotografía…', async () => {
      const tipo = validarFoto(foto);
      const preparada = await conClave('foto', foto, async clave => api.cargar(s.solicitudId, tipo, await base64(foto), clave));
      setActual(previa => previa && { ...previa, archivos: [...previa.archivos.filter(a => a.archivoId !== preparada.archivoId), preparada] });
      setIncluidos(previos => [...new Set([...previos, preparada.archivoId])]);
      setArchivo(undefined);
      setEstado('Fotografía cargada. Guarda los cambios para confirmarla.');
    }, true);
  }

  const cerrada = actual?.estado === 'CERRADA';
  const publicada = Boolean(actual?.versionTrabajo);
  const Titulo = id ? 'Detalle de solicitud' : 'Nueva solicitud';
  const nombreCategoria = opciones.find(c => c.id === datos.categoriaId)?.nombre;

  return <div className="solicitudes">
    <a className="sol-volver" href="/solicitudes" onClick={alNavegar}>← Mis solicitudes</a>
    <header className="sol-cabecera">
      <div><h1>{Titulo}</h1><p>{!id ? 'Guarda un borrador para continuar y agregar fotografías cuando quieras.' : cerrada ? 'Consulta la información y las versiones guardadas del trabajo.' : 'Completa los datos del trabajo y revisa qué fotografías incluir.'}</p></div>
      {actual && <span className="estado" data-estado={actual.estado}>{estadosSolicitud[actual.estado]}</span>}
    </header>
    {estado && <p className="sol-estado-operacion" role="status">{estado}</p>}
    {fallo && <div className="aviso" role="alert" ref={alerta} tabIndex={-1}>
      <p><strong>{fallo.mensaje}</strong></p>
      {(fallo.conflicto || (id && !actual)) && <button type="button" className="boton boton-secundario" onClick={() => {
        if (actual) datosParaRecarga.current = cambiosDe(datos, actual);
        setFallo(undefined); setIntento(n => n + 1);
      }}>Volver a cargar la solicitud</button>}
    </div>}
    {id && !actual && !fallo && <p role="status">Cargando solicitud…</p>}
    {(actual || !id) && <div className="sol-distribucion">
      <div className="sol-principal">
        {cerrada ? <div className="sol-panel">
          <h2>Datos del trabajo</h2>
          <p className="sol-texto">{datos.descripcion ?? 'Sin descripción.'}</p>
          {datos.medidas && <p className="sol-texto">Medidas: {datos.medidas}</p>}
          <p className="sol-suave">{[datos.tipo === 'DIRIGIDA' ? 'Dirigida' : 'Pública', actual?.servicio?.titulo, nombreCategoria, nombreDistrito(datos.distrito), datos.fechaDesde, datos.fechaHasta].filter(Boolean).join(' · ')}</p>
        </div> : <form id="sol-formulario" noValidate onSubmit={e => {
          e.preventDefault();
          void ejecutar(actual ? 'Guardando cambios…' : 'Guardando borrador…', async () => {
            if (actual) {
              await guardar(actual);
              setEstado(actual.estado === 'ABIERTA' ? 'Cambio registrado.' : 'Borrador guardado.');
            } else {
              validarCampos(datos);
              const cuerpo = cambiosDe(datos);
              const creada = await conClave('crear', cuerpo, clave => api.crear(cuerpo, clave));
              alCrear(creada.solicitudId);
            }
          });
        }}>
          <fieldset disabled={ocupado} className="sol-panel">
            <legend>Modalidad de la solicitud</legend>
            {publicada ? <p>{datos.tipo === 'DIRIGIDA' ? 'Dirigida a un prestador' : 'Pública para prestadores compatibles'}</p> : <div className="sol-modalidad">
              {([['PUBLICADA', 'Pública', 'Para prestadores compatibles con el trabajo.'], ['DIRIGIDA', 'Dirigida', 'Para el prestador que elijas.']] as const).map(([tipo, texto, ayuda]) =>
                <label key={tipo}><input type="radio" name="sol-tipo" checked={datos.tipo === tipo} onChange={() => cambiar({ tipo, ...(tipo === 'PUBLICADA' ? { prestadorId: undefined, servicioId: undefined } : {}) })} />
                  <span><strong>{texto}</strong><small>{ayuda}</small></span>
                </label>)}
            </div>}
            {datos.tipo === 'DIRIGIDA' && <SeleccionPrestador key={publicada ? 'fijo' : 'libre'} busqueda={busqueda} datos={datos} tituloGuardado={actual?.servicio?.titulo} fijo={publicada} cambiar={cambiar} errorDe={errorDe} />}
          </fieldset>
          <fieldset disabled={ocupado} className="sol-panel">
            <legend>Datos del trabajo</legend>
            <p className="sol-suave">Los campos marcados con * se requieren para publicar.</p>
            <div className="sol-campo">
              <label htmlFor="sol-descripcion">Descripción del trabajo *</label>
              <textarea {...atributos('descripcion', 'sol-descripcion-ayuda')} rows={5} value={datos.descripcion ?? ''} onChange={e => cambiar({ descripcion: e.target.value })} placeholder="Ej. Levantar un muro de ladrillo en el patio" />
              <span id="sol-descripcion-ayuda" className="sol-suave">Evita incluir teléfonos, correos o direcciones. {(datos.descripcion ?? '').length} / 2000</span>
              {errorCampo('descripcion')}
            </div>
            <div className="sol-campo">
              <label htmlFor="sol-medidas">Medidas <span className="sol-opcional">(opcional)</span></label>
              <textarea {...atributos('medidas', 'sol-medidas-ayuda')} rows={2} value={datos.medidas ?? ''} onChange={e => cambiar({ medidas: e.target.value })} placeholder="Ej. 3 m de largo por 2 m de alto" />
              <span id="sol-medidas-ayuda" className="sol-suave">{(datos.medidas ?? '').length} / 500</span>
              {errorCampo('medidas')}
            </div>
            <div className="sol-doble">
              <div className="sol-campo">
                {datos.servicioId ? <p><strong>Categoría</strong> {nombreCategoria ?? 'Se toma del servicio elegido.'}</p> : <>
                  <label htmlFor="sol-categoriaId">Categoría *</label>
                  <select {...atributos('categoriaId')} value={datos.categoriaId ?? ''} onChange={e => cambiar({ categoriaId: e.target.value || undefined })}>
                    <option value="">{cargandoCategorias ? 'Cargando categorías…' : 'Elige una categoría'}</option>
                    {datos.categoriaId && !nombreCategoria && <option value={datos.categoriaId}>Categoría guardada</option>}
                    {opciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </>}
                {errorCampo('categoriaId')}
                {errorCategorias && !datos.servicioId && <div role="alert"><p className="error">{errorCategorias}</p><button className="boton boton-secundario" type="button" onClick={() => {
                  setErrorCategorias(''); setCargandoCategorias(true); categorias.reiniciar(); setIntentoCategorias(n => n + 1);
                }}>Reintentar categorías</button></div>}
              </div>
              <div className="sol-campo">
                <label htmlFor="sol-distrito">Distrito *</label>
                <select {...atributos('distrito')} value={datos.distrito ?? ''} onChange={e => cambiar({ distrito: e.target.value || undefined })}>
                  <option value="">Elige un distrito</option>
                  {distritos.map(d => <option key={d.codigo} value={d.codigo}>{d.etiqueta}</option>)}
                </select>
                {errorCampo('distrito')}
              </div>
            </div>
            <div className="sol-doble">
              <div className="sol-campo"><label htmlFor="sol-fechaDesde">Fecha deseada *</label>
                <input {...atributos('fechaDesde')} type="date" min={fechaLima()} value={datos.fechaDesde ?? ''} onChange={e => cambiar({ fechaDesde: e.target.value || undefined })} />{errorCampo('fechaDesde')}</div>
              <div className="sol-campo"><label htmlFor="sol-fechaHasta">Hasta <span className="sol-opcional">(opcional)</span></label>
                <input {...atributos('fechaHasta')} type="date" min={datos.fechaDesde || fechaLima()} value={datos.fechaHasta ?? ''} onChange={e => cambiar({ fechaHasta: e.target.value || undefined })} />{errorCampo('fechaHasta')}</div>
            </div>
          </fieldset>
        </form>}
        {actual && verHistorial && <Historial api={api} id={actual.solicitudId} version={actual.versionTrabajo} categorias={opciones} />}
      </div>
      <div className="sol-lateral">
        {actual?.advertencias.length ? <div className="aviso sol-advertencias" role="status">
          <h2>Advertencias para revisar</h2>
          <ul>{actual.advertencias.map(a => <li key={a.codigo + a.campo}>{a.mensaje}</li>)}</ul>
        </div> : null}
        {actual && <fieldset className="sol-contenedor-fotos" disabled={ocupado}>
          <Fotografias api={api} id={actual.solicitudId} fotos={actual.archivos} incluidos={incluidos} editable={!cerrada} ocupado={ocupado} archivo={archivo} error={errorFoto}
            seleccionar={f => { setErrorFoto(undefined); setArchivo(f); }} subir={() => { if (archivo) subir(actual, archivo); }}
            alternar={a => setIncluidos(previos => previos.includes(a) ? previos.filter(i => i !== a) : [...previos, a])} />
          {datos.tipo === 'PUBLICADA' && !cerrada && <label className="confirmacion sol-privacidad">
            <input type="checkbox" checked={Boolean(datos.compartirFotografias)} onChange={e => cambiar({ compartirFotografias: e.target.checked })} />
            <span>Compartir fotografías con prestadores autorizados</span>
          </label>}
        </fieldset>}
        <div className="sol-panel sol-panel-acciones">
          {!cerrada && <button className={actual?.estado === 'BORRADOR' ? 'boton boton-secundario' : 'boton boton-primario'} type="submit" form="sol-formulario" disabled={ocupado}>{actual ? 'Guardar cambios' : 'Guardar borrador'}</button>}
          {actual?.estado === 'BORRADOR' && <button className="boton boton-primario" type="button" disabled={ocupado} onClick={() => publicar(actual)}>Publicar solicitud</button>}
          {publicada && actual && <a className="boton boton-secundario sol-enlace-boton" href={`/solicitudes/${actual.solicitudId}/cotizaciones`} onClick={alNavegar}>Ver cotizaciones recibidas</a>}
          {publicada && <button type="button" className="boton boton-secundario" aria-expanded={verHistorial} onClick={() => setVerHistorial(v => !v)}>{verHistorial ? 'Ocultar versiones' : 'Ver versiones'}</button>}
          {actual && !cerrada && !confirmarCierre && <button className="boton boton-secundario" type="button" disabled={ocupado} onClick={() => setConfirmarCierre(true)}>{publicada ? 'Cerrar solicitud' : 'Descartar borrador'}</button>}
          {actual && !cerrada && confirmarCierre && <div className="sol-confirmar">
            <p>{publicada ? 'El cierre es definitivo. Podrás consultar el historial.' : 'El borrador se cerrará y ya no podrás publicarlo.'}</p>
            <button className="boton boton-secundario" type="button" disabled={ocupado} onClick={() => setConfirmarCierre(false)}>Cancelar</button>
            <button className="boton boton-primario" type="button" disabled={ocupado} onClick={() => {
              void ejecutar('Cerrando solicitud…', async () => {
                adoptar(await conClave('cerrar', { version: actual.version }, clave => api.cerrar(actual.solicitudId, actual.version, clave)));
                setConfirmarCierre(false);
                setEstado(publicada ? 'Solicitud cerrada.' : 'Borrador descartado.');
              });
            }}>{publicada ? 'Confirmar cierre' : 'Confirmar descarte'}</button>
          </div>}
        </div>
      </div>
    </div>}
  </div>;
}
