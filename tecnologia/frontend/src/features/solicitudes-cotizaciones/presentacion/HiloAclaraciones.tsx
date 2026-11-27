import { useEffect, useRef, useState } from 'react';
import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import { claveIdempotencia } from '../../usuarios-acceso/infraestructura/api-usuarios.js';
import { falloDeCotizacion, fechaHoraLima } from '../aplicacion/cotizacion.js';
import type { Aclaracion, ApiCotizaciones, AutorDeAclaracion } from '../modelos/cotizaciones.js';

export const LIMITE_DE_TEXTO = 1000;
export const LIMITE_POR_HILO = 20;

interface Props {
  api: ApiCotizaciones;
  cotizacionId: string;
  /** Quién escribe en esta pantalla. */
  miRol: AutorDeAclaracion;
  /** Nombre público del prestador, solo cuando quien mira es el cliente dueño. */
  nombreDelPrestador?: string | undefined;
  /** Si se indica, el hilo queda en lectura y se explica por qué (cotización retirada o solicitud cerrada). */
  soloLectura?: string | undefined;
}

/**
 * Hilo de aclaraciones entre el cliente dueño y el prestador autor (FR-342). Texto plano, sin adjuntos y sin edición: un mensaje enviado no se puede cambiar ni
 * borrar. No hay respuestas simuladas: el hilo muestra solo lo que ambas partes escribieron; «Actualizar mensajes» vuelve a leerlo. Un fallo conserva lo escrito.
 */
export function HiloAclaraciones({ api, cotizacionId, miRol, nombreDelPrestador, soloLectura }: Props) {
  const [mensajes, setMensajes] = useState<Aclaracion[]>();
  const [cargaFallida, setCargaFallida] = useState('');
  const [intento, setIntento] = useState(0);
  const [texto, setTexto] = useState('');
  const [errorDeTexto, setErrorDeTexto] = useState('');
  const [fallo, setFallo] = useState('');
  const [estado, setEstado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const ejecutando = useRef(false);
  const intentoDeEnvio = useRef<{ texto: string; clave: string } | undefined>(undefined);
  const campo = useRef<HTMLTextAreaElement>(null);
  const aviso = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vigente = true;
    void api.aclaraciones(cotizacionId, 1).then(r => { if (vigente) { setMensajes([...r.elementos]); setCargaFallida(''); } })
      .catch(e => { if (vigente) setCargaFallida(falloDeCotizacion(e).mensaje); });
    return () => { vigente = false; };
  }, [api, cotizacionId, intento]);
  useEffect(() => { if (fallo) aviso.current?.focus(); }, [fallo]);

  const lleno = (mensajes?.length ?? 0) >= LIMITE_POR_HILO;
  const restantes = texto.trim().length;
  const excede = restantes > LIMITE_DE_TEXTO;
  const etiquetaDe = (m: Aclaracion) => m.autor === miRol ? 'Tú' : m.autor === 'CLIENTE' ? 'El cliente' : (nombreDelPrestador ?? 'El prestador');
  const rolDe = (m: Aclaracion) => m.autor === 'CLIENTE' ? 'Cliente' : 'Prestador';

  async function enviar() {
    if (ejecutando.current) return;
    const limpio = texto.trim();
    if (!limpio) { setErrorDeTexto('Escribe un mensaje antes de enviarlo.'); campo.current?.focus(); return; }
    if (limpio.length > LIMITE_DE_TEXTO) { setErrorDeTexto(`El mensaje admite hasta ${LIMITE_DE_TEXTO} caracteres: sobran ${limpio.length - LIMITE_DE_TEXTO}.`); campo.current?.focus(); return; }
    ejecutando.current = true; setOcupado(true); setFallo(''); setEstado(''); setErrorDeTexto('');
    const clave = intentoDeEnvio.current?.texto === limpio ? intentoDeEnvio.current.clave : claveIdempotencia();
    intentoDeEnvio.current = { texto: limpio, clave };
    try {
      const creada = await api.enviarAclaracion(cotizacionId, limpio, clave);
      intentoDeEnvio.current = undefined;
      setMensajes(previos => [...(previos ?? []).filter(m => m.aclaracionId !== creada.aclaracionId), creada].sort((a, b) => a.numero - b.numero));
      setTexto(''); setEstado('Tu mensaje quedó guardado en el hilo.');
    } catch (e) {
      if (e instanceof ErrorApi && e.http < 500 && e.codigo !== 'CONFLICTO_CONCURRENTE') intentoDeEnvio.current = undefined;
      const f = falloDeCotizacion(e);
      if (f.campos['texto']) setErrorDeTexto(f.campos['texto']); else setFallo(f.mensaje);
      // Si el servidor dice que el hilo ya no admite mensajes, se vuelve a leer para reflejarlo.
      if (e instanceof ErrorApi && e.http === 422 && e.codigo === 'LIMITE_ACLARACIONES') setIntento(n => n + 1);
    } finally { ejecutando.current = false; setOcupado(false); }
  }

  return <section className="sol-panel cot-hilo" aria-labelledby="cot-hilo-titulo">
    <div className="cot-hilo-cabecera">
      <h2 id="cot-hilo-titulo">Aclaraciones</h2>
      <button type="button" className="boton boton-secundario boton-compacto" disabled={ocupado} onClick={() => { setMensajes(undefined); setIntento(n => n + 1); }}>Actualizar mensajes</button>
    </div>
    <p className="sol-suave">Un espacio para resolver dudas sobre esta cotización entre el cliente y el prestador. Solo texto: no se pueden adjuntar archivos ni editar mensajes enviados.</p>
    {cargaFallida && <div role="alert"><p className="error">{cargaFallida}</p>
      <button type="button" className="boton boton-secundario" onClick={() => { setCargaFallida(''); setMensajes(undefined); setIntento(n => n + 1); }}>Reintentar</button></div>}
    {!cargaFallida && !mensajes && <p role="status">Cargando mensajes…</p>}
    {mensajes && mensajes.length === 0 && <p className="cot-hilo-vacio">Aún no hay mensajes. Escribe el primero para aclarar una duda.</p>}
    {mensajes && mensajes.length > 0 && <>
      <p className="sol-suave" aria-live="polite">{mensajes.length} de {LIMITE_POR_HILO} mensajes</p>
      <ol className="cot-hilo-lista" aria-label="Mensajes del hilo">{mensajes.map(m => <li key={m.aclaracionId} className="cot-mensaje" data-propio={m.autor === miRol}>
        <article>
          <div className="cot-mensaje-cabecera"><strong>{etiquetaDe(m)}</strong>{m.autor === miRol || (m.autor === 'PRESTADOR' && nombreDelPrestador) ? <span className="sol-suave"> · {rolDe(m)}</span> : null}
            <time dateTime={m.creadaEn} className="sol-suave">{fechaHoraLima(m.creadaEn)}</time></div>
          <p className="sol-texto">{m.texto}</p>
          <p className="sol-suave cot-mensaje-pie">Mensaje {m.numero} · sobre la versión {m.versionCotizacion} de la cotización</p>
        </article>
      </li>)}</ol>
    </>}
    {estado && <p role="status" className="sol-estado-operacion">{estado}</p>}
    {fallo && <div className="aviso" role="alert" ref={aviso} tabIndex={-1}><p><strong>{fallo}</strong></p></div>}
    {soloLectura && <p className="cot-nota" role="note">{soloLectura}</p>}
    {!soloLectura && mensajes && lleno && <p className="cot-nota" role="note">El hilo alcanzó el máximo de {LIMITE_POR_HILO} mensajes y ya no admite más.</p>}
    {!soloLectura && mensajes && !lleno && <form noValidate onSubmit={e => { e.preventDefault(); void enviar(); }} aria-label="Enviar un mensaje">
      <div className="sol-campo">
        <label htmlFor={`hilo-texto-${cotizacionId}`}>Tu mensaje</label>
        <textarea id={`hilo-texto-${cotizacionId}`} ref={campo} rows={3} value={texto} disabled={ocupado}
          aria-invalid={errorDeTexto || excede ? true : undefined} aria-describedby={`hilo-contador-${cotizacionId}${errorDeTexto ? ` hilo-error-${cotizacionId}` : ''}`}
          onChange={e => { setTexto(e.target.value); setErrorDeTexto(''); setEstado(''); }} />
        <span id={`hilo-contador-${cotizacionId}`} className={excede ? 'error' : 'sol-suave'}>{restantes} / {LIMITE_DE_TEXTO} caracteres</span>
        {errorDeTexto && <span className="error" id={`hilo-error-${cotizacionId}`}>{errorDeTexto}</span>}
      </div>
      <div className="sol-acciones"><button type="submit" className="boton boton-primario" disabled={ocupado}>{ocupado ? 'Enviando…' : 'Enviar mensaje'}</button></div>
    </form>}
  </section>;
}
