import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { mensajeDeError } from '../aplicacion/portafolio.js';
import { accionesDe, validarServicioWeb, type ServiciosWeb } from '../aplicacion/servicios.js';
import { limitesServicio, type EstadoServicio, type ServicioPrivado } from '../modelos/contratos.js';

export interface CategoriaOpcion { readonly id: string; readonly nombre: string }
const etiquetaDestino: Record<EstadoServicio, string> = { PUBLICADO: 'Reactivar', PAUSADO: 'Pausar', RETIRADO: 'Retirar' };
const etiquetaEstado: Record<EstadoServicio, string> = { PUBLICADO: 'Publicado', PAUSADO: 'Pausado', RETIRADO: 'Retirado' };

/** Inventario y ciclo de vida de los servicios del titular. Un fallo conserva el estado mostrado y la versión vigente. */
export function ServiciosPropios({ servicio, categorias }: { readonly servicio: ServiciosWeb; readonly categorias: readonly CategoriaOpcion[] }) {
  const [servicios, setServicios] = useState<readonly ServicioPrivado[]>();
  const [total, setTotal] = useState(0); const [pagina, setPagina] = useState(1);
  const [error, setError] = useState(''); const [aviso, setAviso] = useState(''); const [conflicto, setConflicto] = useState(false); const [ocupado, setOcupado] = useState(false);
  const [nuevo, setNuevo] = useState({ titulo: '', descripcion: '', categoriaId: categorias[0]?.id ?? '' }); const [erroresNuevo, setErroresNuevo] = useState<Record<string, string>>({});
  const [edicion, setEdicion] = useState<{ id: string; titulo: string; descripcion: string; categoriaId: string }>(); const [erroresEdicion, setErroresEdicion] = useState<Record<string, string>>({});
  const [retiro, setRetiro] = useState<string>();

  const cargar = useCallback(async (destino = 1, acumular = false) => {
    try {
      const p = await servicio.listar(destino);
      setServicios(actual => (acumular ? [...(actual ?? []), ...p.elementos] : p.elementos)); setTotal(p.total); setPagina(p.pagina); setConflicto(false);
    } catch (e) { setError(mensajeDeError(e)); setServicios(actual => actual ?? []); }
  }, [servicio]);
  useEffect(() => { void cargar(); }, [cargar]);

  async function operar(accion: () => Promise<void>, exito: string) {
    if (ocupado) return;
    setOcupado(true); setError(''); setAviso(''); setConflicto(false);
    try { await accion(); setAviso(exito); }
    catch (e) { setError(mensajeDeError(e)); setConflicto(typeof e === 'object' && e !== null && 'codigo' in e && e.codigo === 'VERSION_DESACTUALIZADA'); }
    finally { setOcupado(false); }
  }
  const reemplazar = (s: ServicioPrivado) => setServicios(actual => actual?.map(x => (x.servicioId === s.servicioId ? s : x)));

  async function publicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const invalidos = validarServicioWeb(nuevo); setErroresNuevo(invalidos);
    if (Object.keys(invalidos).length) return;
    await operar(async () => {
      const s = await servicio.publicar({ titulo: nuevo.titulo.trim(), descripcion: nuevo.descripcion.trim(), categoriaId: nuevo.categoriaId });
      setServicios(actual => [...(actual ?? []), s]); setTotal(t => t + 1); setNuevo({ ...nuevo, titulo: '', descripcion: '' });
    }, 'Servicio publicado.');
  }
  async function guardarEdicion(evento: FormEvent<HTMLFormElement>, s: ServicioPrivado) {
    evento.preventDefault();
    if (!edicion) return;
    const cambios = { ...(edicion.titulo.trim() !== s.titulo ? { titulo: edicion.titulo.trim() } : {}), ...(edicion.descripcion.trim() !== s.descripcion ? { descripcion: edicion.descripcion.trim() } : {}),
      ...(edicion.categoriaId !== s.categoriaId ? { categoriaId: edicion.categoriaId } : {}) };
    const invalidos = validarServicioWeb(cambios, true); setErroresEdicion(invalidos);
    if (Object.keys(invalidos).length) return;
    if (!Object.keys(cambios).length) { setAviso('No hay cambios que guardar.'); return; }
    await operar(async () => { reemplazar(await servicio.editar(s.servicioId, s.version, cambios)); setEdicion(undefined); }, 'Servicio actualizado.');
  }
  const cambiarEstado = (s: ServicioPrivado, destino: EstadoServicio) => operar(async () => {
    reemplazar(await servicio.cambiarEstado(s.servicioId, s.version, destino)); setRetiro(undefined);
  }, destino === 'RETIRADO' ? 'Servicio retirado.' : destino === 'PAUSADO' ? 'Servicio pausado.' : 'Servicio reactivado.');
  const nombreCategoria = (id: string) => categorias.find(c => c.id === id)?.nombre ?? `Categoría ${id.slice(0, 8)}`;

  if (servicios === undefined) return <p>Cargando mis servicios…</p>;
  return <section aria-labelledby="titulo-servicios">
    <h2 id="titulo-servicios">Mis servicios</h2>
    {error && <p role="alert" className="error">{error}</p>}
    {conflicto && <button type="button" onClick={() => void cargar()}>Recargar servicios</button>}
    {aviso && <p role="status" className="aviso">{aviso}</p>}
    {servicios.length === 0 && <p>Aún no ha publicado servicios.</p>}
    {servicios.map(s => {
      const { editar, destinos } = accionesDe(s.estado);
      const editando = edicion?.id === s.servicioId;
      return <article key={s.servicioId} aria-label={`Servicio: ${s.titulo}`}>
        <h3>{s.titulo}</h3>
        <p>{s.descripcion}</p>
        <p>Categoría: {nombreCategoria(s.categoriaId)}</p>
        <p>Estado: {etiquetaEstado[s.estado]} · versión {s.version}</p>
        {s.estado === 'RETIRADO' && <p>Registro histórico de solo lectura. No admite cambios.</p>}
        {editar && !editando && <button type="button" disabled={ocupado} onClick={() => { setEdicion({ id: s.servicioId, titulo: s.titulo, descripcion: s.descripcion, categoriaId: s.categoriaId }); setErroresEdicion({}); }}>{`Editar ${s.titulo}`}</button>}
        {destinos.filter(d => d !== 'RETIRADO').map(d => <button key={d} type="button" disabled={ocupado} onClick={() => void cambiarEstado(s, d)}>{`${etiquetaDestino[d === 'PUBLICADO' ? 'PUBLICADO' : 'PAUSADO']} ${s.titulo}`}</button>)}
        {destinos.includes('RETIRADO') && (retiro === s.servicioId
          ? <><p>El retiro es definitivo: el servicio quedará de solo lectura.</p>
            <button type="button" disabled={ocupado} onClick={() => void cambiarEstado(s, 'RETIRADO')}>{`Confirmar retiro de ${s.titulo}`}</button>
            <button type="button" onClick={() => setRetiro(undefined)}>Cancelar retiro</button></>
          : <button type="button" disabled={ocupado} onClick={() => setRetiro(s.servicioId)}>{`Retirar ${s.titulo}`}</button>)}
        {editando && edicion && <form noValidate aria-label={`Edición de ${s.titulo}`} onSubmit={e => void guardarEdicion(e, s)}>
          <label>Título<input value={edicion.titulo} maxLength={limitesServicio.titulo} onChange={e => setEdicion({ ...edicion, titulo: e.target.value })} /></label>
          {erroresEdicion['titulo'] && <p role="alert" className="error">{erroresEdicion['titulo']}</p>}
          <label>Descripción<textarea value={edicion.descripcion} maxLength={limitesServicio.descripcion} onChange={e => setEdicion({ ...edicion, descripcion: e.target.value })} /></label>
          {erroresEdicion['descripcion'] && <p role="alert" className="error">{erroresEdicion['descripcion']}</p>}
          <label>Categoría<select value={edicion.categoriaId} onChange={e => setEdicion({ ...edicion, categoriaId: e.target.value })}>
            {[...new Set([s.categoriaId, ...categorias.map(c => c.id)])].map(id => <option key={id} value={id}>{nombreCategoria(id)}</option>)}</select></label>
          <button type="submit" disabled={ocupado}>Guardar cambios</button>
          <button type="button" onClick={() => setEdicion(undefined)}>Descartar cambios</button>
        </form>}
      </article>;
    })}
    {servicios.length < total && <button type="button" disabled={ocupado} onClick={() => void cargar(pagina + 1, true)}>Cargar más servicios</button>}
    <form noValidate aria-label="Publicar servicio" onSubmit={e => void publicar(e)}>
      <h3>Publicar un servicio</h3>
      <label>Título del servicio<input value={nuevo.titulo} maxLength={limitesServicio.titulo} disabled={ocupado} onChange={e => setNuevo({ ...nuevo, titulo: e.target.value })} /></label>
      {erroresNuevo['titulo'] && <p role="alert" className="error">{erroresNuevo['titulo']}</p>}
      <label>Descripción del servicio<textarea value={nuevo.descripcion} maxLength={limitesServicio.descripcion} disabled={ocupado} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} /></label>
      {erroresNuevo['descripcion'] && <p role="alert" className="error">{erroresNuevo['descripcion']}</p>}
      <label>Categoría del servicio<select value={nuevo.categoriaId} disabled={ocupado || categorias.length === 0} onChange={e => setNuevo({ ...nuevo, categoriaId: e.target.value })}>
        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
      {erroresNuevo['categoriaId'] && <p role="alert" className="error">{erroresNuevo['categoriaId']}</p>}
      {categorias.length === 0 && <p>Aún no hay categorías disponibles para publicar.</p>}
      <button type="submit" disabled={ocupado || categorias.length === 0}>Publicar servicio</button>
    </form>
  </section>;
}
