import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import { mensajeDeError, validarPerfilWeb, type PortafolioWeb } from '../aplicacion/portafolio.js';
import { distritos, limites, tiposPrestador, type Distrito, type PerfilPrivado, type TipoPrestador } from '../modelos/contratos.js';
import { Portafolio } from './Portafolio.js';
import './estilos-002.css';
import { campoConError, idError } from './errores-campo.js';
import { SelectorMultiple } from './SelectorMultiple.js';

export interface EspecialidadOpcion { readonly id: string; readonly nombre: string }
/** Formulario del perfil profesional propio. El catálogo de especialidades llega desde la composición cuando está disponible. */
const zonasDisponibles = distritos.map(d => ({ id: d.codigo, nombre: d.etiqueta }));
export function PerfilProfesional({ servicio, especialidades = [] }: { readonly servicio: PortafolioWeb; readonly especialidades?: readonly EspecialidadOpcion[] }) {
  const [perfil, setPerfil] = useState<PerfilPrivado | null>();
  const [epoca, setEpoca] = useState(0);
  const [cargaFallida, setCargaFallida] = useState('');
  const [nombre, setNombre] = useState(''); const [tipo, setTipo] = useState<TipoPrestador>('TECNICO'); const [experiencia, setExperiencia] = useState('');
  const [zonas, setZonas] = useState<readonly Distrito[]>([]); const [especialidadesIds, setEspecialidadesIds] = useState<readonly string[]>([]); const [disponible, setDisponible] = useState(true);
  const [errores, setErrores] = useState<Record<string, string>>({}); const [error, setError] = useState(''); const [aviso, setAviso] = useState(''); const [ocupado, setOcupado] = useState(false);

  function cargar(p: PerfilPrivado | null) {
    setPerfil(p);
    if (p) { setNombre(p.nombrePublico); setTipo(p.tipo); setExperiencia(p.experiencia); setZonas(p.distritos); setEspecialidadesIds(p.especialidadesIds); setDisponible(p.disponibilidadDeclarada); }
  }
  useEffect(() => { let activo = true; servicio.perfil().then(p => { if (activo) cargar(p); }).catch(e => { if (activo) setCargaFallida(mensajeDeError(e)); }); return () => { activo = false; }; }, [servicio]);


  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (ocupado) return;
    const entrada = { nombrePublico: nombre.trim(), tipo, experiencia: experiencia.trim(), especialidadesIds, distritos: distritos.map(d => d.codigo).filter(c => zonas.includes(c)), disponibilidadDeclarada: disponible };
    const invalidos = validarPerfilWeb(entrada);
    setErrores(invalidos); setError(''); setAviso('');
    if (Object.keys(invalidos).length) return;
    setOcupado(true);
    try { const guardado = await servicio.guardarPerfil(perfil?.version ?? 0, entrada); cargar(guardado); setEpoca(n => n + 1); setAviso('Perfil guardado.'); }
    catch (e) {
      // El rechazo conserva lo escrito y el perfil guardado. Se indica el campo y la causa.
      const detalle = e instanceof ErrorApi ? e.detalles.map(d => (d.campo ? `${d.campo}: ${d.motivo}` : d.motivo)).join(' ') : '';
      setError(`${mensajeDeError(e)}${detalle ? ` ${detalle}` : ''}`);
    } finally { setOcupado(false); }
  }

  if (cargaFallida) return <p role="alert">{cargaFallida}</p>;
  if (perfil === undefined) return <p>Cargando mi perfil profesional…</p>;
  return <section className="p002 p002-perfil-editable" aria-labelledby="titulo-perfil-profesional">
    <div className="p002-encabezado">
      <h2 id="titulo-perfil-profesional">Mi perfil profesional</h2>
      {perfil && <p className="p002-ayuda">Versión del perfil: {perfil.version}</p>}
    </div>
    <form noValidate aria-busy={ocupado} className="p002-formulario" onSubmit={e => void guardar(e)}>
      <div className="p002-campos p002-campos-2">
        <div className="p002-grupo-campo">
          <label className="p002-campo">Nombre público<input {...campoConError(errores, 'perfil', 'nombrePublico')} value={nombre} maxLength={limites.nombrePublico} disabled={ocupado} onChange={e => setNombre(e.target.value)} /></label>
          {errores['nombrePublico'] && <p role="alert" id={idError('perfil', 'nombrePublico')} className="error">{errores['nombrePublico']}</p>}
        </div>
        <label className="p002-campo">Tipo de prestador<select value={tipo} disabled={ocupado} onChange={e => setTipo(e.target.value as TipoPrestador)}>
          {tiposPrestador.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}</select></label>
      </div>
      <div className="p002-grupo-campo">
        <label className="p002-campo">Experiencia<textarea {...campoConError(errores, 'perfil', 'experiencia')} value={experiencia} maxLength={limites.experiencia} disabled={ocupado} onChange={e => setExperiencia(e.target.value)} /></label>
        {errores['experiencia'] && <p role="alert" id={idError('perfil', 'experiencia')} className="error">{errores['experiencia']}</p>}
      </div>
      <div className="p002-campos p002-campos-2 p002-selectores">
        <div className="p002-grupo-campo">
          <SelectorMultiple etiqueta="Especialidades" opciones={especialidades.length ? especialidades : especialidadesIds.map(id => ({ id, nombre: `Especialidad registrada ${id.slice(0, 8)}` }))} seleccion={especialidadesIds} alCambiar={setEspecialidadesIds}
            deshabilitado={ocupado} vacio="Aún no hay especialidades disponibles para elegir." descritoPor={errores['especialidadesIds'] ? idError('perfil', 'especialidadesIds') : undefined} />
          {errores['especialidadesIds'] && <p role="alert" id={idError('perfil', 'especialidadesIds')} className="error">{errores['especialidadesIds']}</p>}
        </div>
        <div className="p002-grupo-campo">
          <SelectorMultiple etiqueta="Zonas de atención" opciones={zonasDisponibles} seleccion={zonas} alCambiar={ids => setZonas(ids as Distrito[])} agrupar={false}
            deshabilitado={ocupado} descritoPor={errores['distritos'] ? idError('perfil', 'distritos') : undefined} />
          {errores['distritos'] && <p role="alert" id={idError('perfil', 'distritos')} className="error">{errores['distritos']}</p>}
        </div>
      </div>
      <div className="p002-disponibilidad-campo">
        <label className="p002-chip p002-chip-destacado"><input type="checkbox" checked={disponible} disabled={ocupado} onChange={e => setDisponible(e.target.checked)} />Disponible para nuevos trabajos</label>
        <p className="p002-ayuda">La disponibilidad es una declaración suya. No constituye una reserva ni una confirmación.</p>
      </div>
      {error && <p role="alert" className="error p002-mensaje p002-mensaje-error">{error}</p>}
      {aviso && <p role="status" className="aviso p002-mensaje p002-mensaje-exito">{aviso}</p>}
      <div className="p002-acciones-formulario"><button type="submit" className="boton boton-acento" disabled={ocupado}>Guardar perfil</button></div>
    </form>
    {perfil && <Portafolio key={`${perfil.prestadorId}:${epoca}`} prestadorId={perfil.prestadorId} trabajos={perfil.trabajos} versionPerfil={perfil.version} servicio={servicio}
      alCambiar={(trabajos, version) => setPerfil(actual => (actual ? { ...actual, trabajos, version } : actual))} />}
  </section>;
}
