import { useEffect, useState } from 'react';
import './estilos-002.css';
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
  return <article className="p002 p002-perfil" aria-labelledby="nombre-prestador">
    <div className="p002-portada">
      <h2 id="nombre-prestador">{perfil.nombrePublico}</h2>
      <p className="p002-insignia p002-insignia-tipo">{etiquetaTipo(perfil.tipo)}</p>
    </div>
    <section className="p002-panel" aria-label="Información declarada por el prestador">
      <h3>Información declarada por el prestador</h3>
      <p>{perfil.experiencia}</p>
      <p className="p002-dato">Zonas de atención: {perfil.distritos.map(etiquetaDistrito).join(', ')}</p>
      <p className={`p002-dato p002-disponibilidad ${perfil.disponibilidadDeclarada ? 'p002-disponibilidad-si' : 'p002-disponibilidad-no'}`}>Disponibilidad declarada: {perfil.disponibilidadDeclarada ? 'sí' : 'no'}. Es una declaración del prestador y no constituye una reserva ni una confirmación.</p>
    </section>
    <section className="p002-fuentes" aria-label="Estado de las fuentes">
      {avisos.calificaciones && <p className="aviso-fuente p002-fuente" data-fuente="calificaciones">{avisos.calificaciones}</p>}
      {avisos.verificaciones && <p className="aviso-fuente p002-fuente" data-fuente="verificaciones">{avisos.verificaciones}</p>}
    </section>
    <section className="p002-panel" aria-label="Trabajos anteriores">
      <h3>Trabajos anteriores</h3>
      {perfil.trabajos.length === 0 && <p className="p002-vacio-suave">El prestador aún no ha publicado trabajos anteriores.</p>}
      {errorImagen && <p role="alert" className="error p002-mensaje p002-mensaje-error">{errorImagen}</p>}
      <div className="p002-rejilla">{perfil.trabajos.map(t => <article className="p002-tarjeta" key={t.trabajoId} aria-label={`Trabajo: ${t.titulo}`}>
        <h4>{t.titulo}</h4><p className="p002-descripcion">{t.descripcion}</p>
        <ul className="p002-fotos">{t.fotografias.map((f, i) => <li key={f.fotografiaId}>
          <button type="button" className="boton boton-secundario boton-compacto" onClick={() => void verImagen(f.ruta, f.fotografiaId)}>{`Ver imagen ${i + 1} de ${t.titulo}`}</button>
          {imagenes[f.fotografiaId] && <img src={imagenes[f.fotografiaId]} alt={`Imagen ${i + 1} de ${t.titulo}`} width={Math.min(f.ancho, 320)} />}
        </li>)}</ul>
      </article>)}</div>
    </section>
    <section className="p002-panel" aria-label="Servicios del prestador">
      <h3>Servicios publicados</h3>
      {perfil.servicios.total === 0 && <p className="p002-vacio-suave">Este prestador no tiene servicios visibles por ahora.</p>}
      <ul className="p002-rejilla">{perfil.servicios.elementos.map((s: ServicioPublico) => <li key={s.servicioId}><article className="p002-tarjeta" aria-label={`Servicio: ${s.titulo}`}>
        <h4>{s.titulo}</h4><p className="p002-descripcion">{s.descripcion}</p>
        {alVerServicio && <div className="p002-acciones"><button type="button" className="boton boton-primario" aria-label={`Ver detalle de ${s.titulo}`} onClick={() => alVerServicio(s.servicioId)}>Ver detalle</button></div>}
      </article></li>)}</ul>
      {perfil.servicios.total > perfil.servicios.tamano && <nav aria-label="Paginación de servicios" className="p002-paginacion">
        <button type="button" className="boton boton-secundario" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {perfil.servicios.pagina} de {totalPaginas(perfil.servicios)}</span>
        <button type="button" className="boton boton-secundario" disabled={pagina >= totalPaginas(perfil.servicios)} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
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
  return <article className="p002 p002-detalle" aria-label={`Servicio: ${servicio.titulo}`}><h2>{servicio.titulo}</h2><p className="p002-descripcion">{servicio.descripcion}</p>
    <div className="p002-acciones"><button type="button" className="boton boton-primario" onClick={() => alVerPrestador(servicio.prestadorId)}>Ver perfil del prestador</button></div></article>;
}
