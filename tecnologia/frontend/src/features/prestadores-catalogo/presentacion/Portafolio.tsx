import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { mensajeDeError, validarArchivoImagen, validarTrabajoWeb, type PortafolioWeb } from '../aplicacion/portafolio.js';
import { limites, type FotografiaPrivada, type TrabajoPrivado } from '../modelos/contratos.js';

export interface PropiedadesPortafolio {
  readonly prestadorId: string;
  readonly trabajos: readonly TrabajoPrivado[];
  readonly versionPerfil: number;
  readonly servicio: PortafolioWeb;
  /** Notifica el estado confirmado por el servidor tras cada cambio. */
  readonly alCambiar?: (trabajos: readonly TrabajoPrivado[], versionPerfil: number) => void;
}

export function Portafolio({ prestadorId, trabajos: iniciales, versionPerfil: versionInicial, servicio, alCambiar }: PropiedadesPortafolio) {
  const [trabajos, setTrabajos] = useState<readonly TrabajoPrivado[]>(iniciales);
  const [versionPerfil, setVersionPerfil] = useState(versionInicial);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [imagenes, setImagenes] = useState<Readonly<Record<string, string>>>({});
  const [nuevo, setNuevo] = useState({ titulo: '', descripcion: '' });
  const [erroresNuevo, setErroresNuevo] = useState<Record<string, string>>({});

  function aplicar(siguientes: readonly TrabajoPrivado[], version = versionPerfil) {
    setTrabajos(siguientes); setVersionPerfil(version); alCambiar?.(siguientes, version);
  }
  const cambiarTrabajo = (id: string, f: (t: TrabajoPrivado) => TrabajoPrivado) => aplicar(trabajos.map(t => (t.trabajoId === id ? f(t) : t)));

  async function operar(accion: () => Promise<void>, exito: string) {
    if (ocupado) return;
    setOcupado(true); setError(''); setAviso('');
    try { await accion(); setAviso(exito); } catch (e) { setError(mensajeDeError(e)); } finally { setOcupado(false); }
  }

  async function elegirArchivo(evento: ChangeEvent<HTMLInputElement>, t: TrabajoPrivado, fotografiaId?: string) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';
    if (!archivo) return;
    const problema = validarArchivoImagen(archivo);
    if (problema) { setError(problema); setAviso(''); return; }
    await operar(async () => {
      const escritura = await servicio.escritura(archivo, t.version);
      if (fotografiaId) {
        const r = await servicio.reemplazarFotografia(t.trabajoId, fotografiaId, escritura);
        setImagenes(({ [fotografiaId]: _descartada, ...resto }) => resto);
        cambiarTrabajo(t.trabajoId, x => ({ ...x, version: r.versionTrabajo, fotografias: x.fotografias.map(f => (f.fotografiaId === fotografiaId ? r.fotografia : f)) }));
      } else {
        const r = await servicio.agregarFotografia(t.trabajoId, escritura);
        cambiarTrabajo(t.trabajoId, x => ({ ...x, version: r.versionTrabajo, fotografias: [...x.fotografias, r.fotografia] }));
      }
    }, fotografiaId ? 'Fotografía reemplazada.' : 'Fotografía agregada.');
  }

  const eliminar = (t: TrabajoPrivado, f: FotografiaPrivada) => operar(async () => {
    const r = await servicio.eliminarFotografia(t.trabajoId, f.fotografiaId, t.version);
    setImagenes(({ [f.fotografiaId]: _descartada, ...resto }) => resto);
    cambiarTrabajo(t.trabajoId, x => ({ ...x, version: r.versionTrabajo, fotografias: x.fotografias.filter(y => y.fotografiaId !== f.fotografiaId) }));
  }, 'Fotografía eliminada.');

  const ver = (t: TrabajoPrivado, f: FotografiaPrivada) => operar(async () => {
    const imagen = await servicio.imagen(prestadorId, t.trabajoId, f.fotografiaId);
    setImagenes(actuales => ({ ...actuales, [f.fotografiaId]: `data:${imagen.tipoMime};base64,${imagen.contenidoBase64}` }));
  }, '');

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const invalidos = validarTrabajoWeb(nuevo);
    setErroresNuevo(invalidos);
    if (Object.keys(invalidos).length || trabajos.length >= limites.trabajos) return;
    await operar(async () => {
      const r = await servicio.crearTrabajo(versionPerfil, { titulo: nuevo.titulo.trim(), descripcion: nuevo.descripcion.trim() });
      aplicar([...trabajos, r.trabajo], r.versionPerfil);
      setNuevo({ titulo: '', descripcion: '' });
    }, 'Trabajo agregado.');
  }

  const completo = trabajos.length >= limites.trabajos;
  return <section aria-labelledby="titulo-portafolio">
    <h2 id="titulo-portafolio">Portafolio de trabajos</h2>
    {error && <p role="alert" className="error">{error}</p>}
    {aviso && <p role="status" className="aviso">{aviso}</p>}
    {trabajos.map(t => {
      const lleno = t.fotografias.length >= limites.fotografiasPorTrabajo;
      return <article key={t.trabajoId} aria-label={`Trabajo: ${t.titulo}`}>
        <h3>{t.titulo}</h3>
        <p>{t.descripcion}</p>
        <p>{t.fotografias.length} de {limites.fotografiasPorTrabajo} fotografías · versión {t.version}</p>
        <ul>
          {t.fotografias.map((f, i) => <li key={f.fotografiaId}>
            <span>Fotografía {i + 1} ({f.ancho}×{f.alto})</span>{' '}
            <button type="button" disabled={ocupado} onClick={() => void ver(t, f)}>{`Ver imagen ${i + 1}`}</button>{' '}
            <label>{`Reemplazar fotografía ${i + 1}`}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={ocupado} onChange={e => void elegirArchivo(e, t, f.fotografiaId)} /></label>{' '}
            <button type="button" disabled={ocupado} onClick={() => void eliminar(t, f)}>{`Eliminar fotografía ${i + 1}`}</button>
            {imagenes[f.fotografiaId] && <img src={imagenes[f.fotografiaId]} alt={`Fotografía ${i + 1} de ${t.titulo}`} width={Math.min(f.ancho, 320)} />}
          </li>)}
        </ul>
        <label>{`Agregar fotografía a ${t.titulo}`}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={ocupado || lleno} onChange={e => void elegirArchivo(e, t)} /></label>
        {lleno && <p>Este trabajo ya tiene el máximo de {limites.fotografiasPorTrabajo} fotografías.</p>}
        <p>Formatos JPG, PNG o WEBP de hasta 10 MB y 4096 píxeles por lado.</p>
      </article>;
    })}
    <form noValidate onSubmit={e => void crear(e)} aria-label="Agregar trabajo anterior">
      <label>Título del trabajo<input value={nuevo.titulo} maxLength={limites.titulo} disabled={completo || ocupado} onChange={e => setNuevo({ ...nuevo, titulo: e.target.value })} /></label>
      {erroresNuevo['titulo'] && <p role="alert" className="error">{erroresNuevo['titulo']}</p>}
      <label>Descripción del trabajo<textarea value={nuevo.descripcion} maxLength={limites.descripcion} disabled={completo || ocupado} onChange={e => setNuevo({ ...nuevo, descripcion: e.target.value })} /></label>
      {erroresNuevo['descripcion'] && <p role="alert" className="error">{erroresNuevo['descripcion']}</p>}
      <button type="submit" disabled={completo || ocupado}>Agregar trabajo</button>
      {completo && <p>El portafolio admite hasta {limites.trabajos} trabajos.</p>}
    </form>
  </section>;
}
