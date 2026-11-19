import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import { mensajeDeError, validarPerfilWeb, type PortafolioWeb } from '../aplicacion/portafolio.js';
import { distritos, limites, tiposPrestador, type Distrito, type PerfilPrivado, type TipoPrestador } from '../modelos/contratos.js';
import { Portafolio } from './Portafolio.js';

export interface EspecialidadOpcion { readonly id: string; readonly nombre: string }
/** Formulario del perfil profesional propio. El catálogo de especialidades llega desde la composición cuando está disponible. */
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

  const alternar = <T,>(lista: readonly T[], valor: T) => (lista.includes(valor) ? lista.filter(x => x !== valor) : [...lista, valor]);

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
  return <section aria-labelledby="titulo-perfil-profesional">
    <h2 id="titulo-perfil-profesional">Mi perfil profesional</h2>
    {perfil && <p>Versión del perfil: {perfil.version}</p>}
    <form noValidate onSubmit={e => void guardar(e)}>
      <label>Nombre público<input value={nombre} maxLength={limites.nombrePublico} disabled={ocupado} onChange={e => setNombre(e.target.value)} /></label>
      {errores['nombrePublico'] && <p role="alert" className="error">{errores['nombrePublico']}</p>}
      <label>Tipo de prestador<select value={tipo} disabled={ocupado} onChange={e => setTipo(e.target.value as TipoPrestador)}>
        {tiposPrestador.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}</select></label>
      <label>Experiencia<textarea value={experiencia} maxLength={limites.experiencia} disabled={ocupado} onChange={e => setExperiencia(e.target.value)} /></label>
      {errores['experiencia'] && <p role="alert" className="error">{errores['experiencia']}</p>}
      <fieldset aria-label="Especialidades" disabled={ocupado}><legend>Especialidades</legend>
        {especialidades.length === 0 && especialidadesIds.length === 0 && <p>Aún no hay especialidades disponibles para elegir.</p>}
        {(especialidades.length ? especialidades : especialidadesIds.map(id => ({ id, nombre: `Especialidad registrada ${id.slice(0, 8)}` }))).map(o =>
          <label key={o.id}><input type="checkbox" checked={especialidadesIds.includes(o.id)} onChange={() => setEspecialidadesIds(alternar(especialidadesIds, o.id))} />{o.nombre}</label>)}
      </fieldset>
      {errores['especialidadesIds'] && <p role="alert" className="error">{errores['especialidadesIds']}</p>}
      <fieldset aria-label="Zonas de atención" disabled={ocupado}><legend>Zonas de atención</legend>
        {distritos.map(d => <label key={d.codigo}><input type="checkbox" checked={zonas.includes(d.codigo)} onChange={() => setZonas(alternar(zonas, d.codigo))} />{d.etiqueta}</label>)}
      </fieldset>
      {errores['distritos'] && <p role="alert" className="error">{errores['distritos']}</p>}
      <label><input type="checkbox" checked={disponible} disabled={ocupado} onChange={e => setDisponible(e.target.checked)} />Disponible para nuevos trabajos</label>
      <p>La disponibilidad es una declaración suya. No constituye una reserva ni una confirmación.</p>
      {error && <p role="alert" className="error">{error}</p>}
      {aviso && <p role="status" className="aviso">{aviso}</p>}
      <button type="submit" disabled={ocupado}>Guardar perfil</button>
    </form>
    {perfil && <Portafolio key={`${perfil.prestadorId}:${epoca}`} prestadorId={perfil.prestadorId} trabajos={perfil.trabajos} versionPerfil={perfil.version} servicio={servicio}
      alCambiar={(trabajos, version) => setPerfil(actual => (actual ? { ...actual, trabajos, version } : actual))} />}
  </section>;
}
