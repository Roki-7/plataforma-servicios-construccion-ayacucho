import { useEffect, useState } from 'react';
import { mensajeBusqueda, totalPaginas, type BusquedaWeb } from '../aplicacion/busqueda.js';
import { distritos, tiposPrestador, type PerfilPublico, type ServicioPublico } from '../modelos/contratos.js';

const etiquetaTipo = (v: string) => tiposPrestador.find(t => t.valor === v)?.etiqueta ?? v;
const etiquetaDistrito = (v: string) => distritos.find(d => d.codigo === v)?.etiqueta ?? v;

/** Perfil público sin sesión. Distingue lo declarado por el prestador de los avisos de las fuentes que aún no existen. */
export function DetallePrestador({ busqueda, prestadorId, alVerServicio }: { readonly busqueda: BusquedaWeb; readonly prestadorId: string; readonly alVerServicio?: (id: string) => void }) {
  const [perfil, setPerfil] = useState<PerfilPublico>(); const [error, setError] = useState(''); const [pagina, setPagina] = useState(1);
  const [imagenes, setImagenes] = useState<Readonly<Record<string, string>>>({}); const [errorImagen, setErrorImagen] = useState('');
  useEffect(() => {
    let activo = true;
    busqueda.perfil(prestadorId, pagina).then(p => { if (activo) { setPerfil(p); setError(''); } }).catch(e => { if (activo) setError(mensajeBusqueda(e)); });
    return () => { activo = false; };
  }, [busqueda, prestadorId, pagina]);

  async function verImagen(ruta: string, id: string) {
    setErrorImagen('');
    try { const i = await busqueda.imagen(ruta); setImagenes(a => ({ ...a, [id]: `data:${i.tipoMime};base64,${i.contenidoBase64}` })); }
    catch (e) { setErrorImagen(mensajeBusqueda(e)); }
  }

  if (error && !perfil) return <p role="alert" className="error">{error}</p>;
  if (!perfil) return <p>Cargando perfil…</p>;
  const { avisos } = perfil;
  return <article aria-labelledby="nombre-prestador">
    <h2 id="nombre-prestador">{perfil.nombrePublico}</h2>
    <p>{etiquetaTipo(perfil.tipo)}</p>
    <section aria-label="Información declarada por el prestador">
      <h3>Información declarada por el prestador</h3>
      <p>{perfil.experiencia}</p>
      <p>Zonas de atención: {perfil.distritos.map(etiquetaDistrito).join(', ')}</p>
      <p>Disponibilidad declarada: {perfil.disponibilidadDeclarada ? 'sí' : 'no'}. Es una declaración del prestador y no constituye una reserva ni una confirmación.</p>
    </section>
    <section aria-label="Estado de las fuentes">
      {avisos.calificaciones && <p className="aviso-fuente" data-fuente="calificaciones">{avisos.calificaciones}</p>}
      {avisos.verificaciones && <p className="aviso-fuente" data-fuente="verificaciones">{avisos.verificaciones}</p>}
    </section>
    <section aria-label="Trabajos anteriores">
      <h3>Trabajos anteriores</h3>
      {perfil.trabajos.length === 0 && <p>El prestador aún no ha publicado trabajos anteriores.</p>}
      {errorImagen && <p role="alert" className="error">{errorImagen}</p>}
      {perfil.trabajos.map(t => <article key={t.trabajoId} aria-label={`Trabajo: ${t.titulo}`}>
        <h4>{t.titulo}</h4><p>{t.descripcion}</p>
        <ul>{t.fotografias.map((f, i) => <li key={f.fotografiaId}>
          <button type="button" onClick={() => void verImagen(f.ruta, f.fotografiaId)}>{`Ver imagen ${i + 1} de ${t.titulo}`}</button>
          {imagenes[f.fotografiaId] && <img src={imagenes[f.fotografiaId]} alt={`Imagen ${i + 1} de ${t.titulo}`} width={Math.min(f.ancho, 320)} />}
        </li>)}</ul>
      </article>)}
    </section>
    <section aria-label="Servicios del prestador">
      <h3>Servicios publicados</h3>
      {perfil.servicios.total === 0 && <p>Este prestador no tiene servicios visibles por ahora.</p>}
      <ul>{perfil.servicios.elementos.map((s: ServicioPublico) => <li key={s.servicioId}><article aria-label={`Servicio: ${s.titulo}`}>
        <h4>{s.titulo}</h4><p>{s.descripcion}</p>
        {alVerServicio && <button type="button" onClick={() => alVerServicio(s.servicioId)}>{`Ver detalle de ${s.titulo}`}</button>}
      </article></li>)}</ul>
      {perfil.servicios.total > perfil.servicios.tamano && <nav aria-label="Paginación de servicios">
        <button type="button" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {perfil.servicios.pagina} de {totalPaginas(perfil.servicios)}</span>
        <button type="button" disabled={pagina >= totalPaginas(perfil.servicios)} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
      </nav>}
    </section>
  </article>;
}

/** Detalle de un servicio visible. Uno pausado, retirado o inexistente se presenta igual. */
export function DetalleServicio({ busqueda, servicioId, alVerPrestador }: { readonly busqueda: BusquedaWeb; readonly servicioId: string; readonly alVerPrestador: (id: string) => void }) {
  const [servicio, setServicio] = useState<ServicioPublico>(); const [error, setError] = useState('');
  useEffect(() => { let activo = true; busqueda.servicio(servicioId).then(s => { if (activo) setServicio(s); }).catch(e => { if (activo) setError(mensajeBusqueda(e)); }); return () => { activo = false; }; }, [busqueda, servicioId]);
  if (error) return <p role="alert" className="error">{error}</p>;
  if (!servicio) return <p>Cargando servicio…</p>;
  return <article aria-label={`Servicio: ${servicio.titulo}`}><h2>{servicio.titulo}</h2><p>{servicio.descripcion}</p>
    <button type="button" onClick={() => alVerPrestador(servicio.prestadorId)}>Ver perfil del prestador</button></article>;
}
