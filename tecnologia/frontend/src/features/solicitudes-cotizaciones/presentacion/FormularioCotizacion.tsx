import { useEffect, useRef, useState } from 'react';
import type { MouseEventHandler, ReactNode } from 'react';
import { ErrorApi } from '../../usuarios-acceso/aplicacion/puertos.js';
import { claveIdempotencia } from '../../usuarios-acceso/infraestructura/api-usuarios.js';
import {
  datosDeFormulario, etiquetasTipo, falloDeCotizacion, fechaDeHoyEnLima, requeridosPorTipo, validarFormulario, type ErroresDeFormulario, type FalloDeCotizacion, type FormularioCotizacion,
} from '../aplicacion/cotizacion.js';
import { periodo } from '../aplicacion/oportunidades.js';
import type { SolicitudVisible } from '../modelos/contratos.js';
import type { Cotizacion, DatosCotizacion, TipoCotizacion } from '../modelos/cotizaciones.js';
import { nombreDistrito } from './ListaSolicitudes.js';

interface Props {
  titulo: string;
  introduccion: string;
  etiquetaBoton: string;
  inicial: FormularioCotizacion;
  solicitud: SolicitudVisible;
  categoria: string | undefined;
  /** Envía los datos con la clave de idempotencia. Una repetición con los mismos datos reutiliza la misma clave. */
  enviar: (datos: DatosCotizacion, clave: string) => Promise<Cotizacion>;
  alExito: (cotizacion: Cotizacion) => void;
  /** Vuelve a leer la solicitud (y la cotización, si se actualiza) tras un cambio: conserva lo escrito y usa las versiones vigentes. */
  alRecargarSolicitud: () => void;
  volverA: { href: string; texto: string };
  alNavegar: MouseEventHandler<HTMLAnchorElement>;
  /** Aviso de contexto, por ejemplo la cotización que requiere revisión. */
  aviso?: ReactNode;
}

const tiposDeCotizacion: readonly { tipo: TipoCotizacion; ayuda: string }[] = [
  { tipo: 'ESTIMADA', ayuda: 'Un precio aproximado o la forma de calcularlo. Puede ajustarse después.' },
  { tipo: 'DEFINITIVA', ayuda: 'Precio fijo, plazo y condiciones de pago completos.' },
];

/**
 * Formulario de una cotización (RF17), para enviarla o actualizarla. Conserva lo escrito ante cualquier error, muestra cada error junto a su campo, evita envíos
 * duplicados y reutiliza la clave de idempotencia al reintentar los mismos datos tras un fallo de red.
 */
export function FormularioDeCotizacion({ titulo, introduccion, etiquetaBoton, inicial, solicitud, categoria, enviar, alExito, alRecargarSolicitud, volverA, alNavegar, aviso }: Props) {
  const [f, setF] = useState<FormularioCotizacion>(inicial);
  const [errores, setErrores] = useState<ErroresDeFormulario>({});
  const [fallo, setFallo] = useState<FalloDeCotizacion>();
  const [ocupado, setOcupado] = useState(false);
  const ejecutando = useRef(false);
  const intento = useRef<{ firma: string; clave: string } | undefined>(undefined);
  const alerta = useRef<HTMLDivElement>(null);
  const requeridos = requeridosPorTipo(f.tipo);
  const hoy = fechaDeHoyEnLima();
  useEffect(() => { if (fallo) alerta.current?.focus(); }, [fallo]);

  function cambiar(cambio: Partial<FormularioCotizacion>) {
    setF(previo => ({ ...previo, ...cambio }));
    setErrores(previos => Object.fromEntries(Object.entries(previos).filter(([campo]) => !(campo in cambio))));
    if (fallo) setFallo(undefined);
  }
  const error = (campo: keyof FormularioCotizacion) => errores[campo] ?? fallo?.campos[campo];
  const atributos = (campo: keyof FormularioCotizacion, ayuda?: string) => ({
    id: `cot-${campo}`, 'aria-invalid': error(campo) ? true : undefined,
    'aria-describedby': [ayuda, error(campo) ? `cot-${campo}-error` : undefined].filter(Boolean).join(' ') || undefined,
  });
  const mensaje = (campo: keyof FormularioCotizacion) => error(campo) && <span className="error" id={`cot-${campo}-error`}>{error(campo)}</span>;
  const asterisco = (si: boolean) => si ? <span aria-hidden="true"> *</span> : null;
  const opcional = <span className="sol-opcional"> (opcional)</span>;

  async function enviarFormulario() {
    if (ejecutando.current) return;
    const invalidos = validarFormulario(f, hoy);
    if (Object.keys(invalidos).length) {
      setErrores(invalidos); setFallo(undefined);
      requestAnimationFrame(() => document.getElementById(`cot-${Object.keys(invalidos)[0]}`)?.focus());
      return;
    }
    ejecutando.current = true; setOcupado(true); setFallo(undefined);
    const datos = datosDeFormulario(f);
    const firma = JSON.stringify(datos);
    const clave = intento.current?.firma === firma ? intento.current.clave : claveIdempotencia();
    intento.current = { firma, clave };
    try {
      const creada = await enviar(datos, clave);
      intento.current = undefined;
      alExito(creada);
    } catch (e) {
      // Un rechazo definitivo del servidor libera la clave: el siguiente intento, con otros datos o tras corregir, es una operación nueva.
      if (e instanceof ErrorApi && e.http < 500 && e.codigo !== 'CONFLICTO_CONCURRENTE') intento.current = undefined;
      setFallo(falloDeCotizacion(e));
    } finally { ejecutando.current = false; setOcupado(false); }
  }

  return <div className="solicitudes cotizar">
    <a className="sol-volver" href={volverA.href} onClick={alNavegar}>← {volverA.texto}</a>
    <header className="sol-cabecera"><div><h1>{titulo}</h1><p>{introduccion}</p></div></header>
    {aviso}
    {fallo && <div className="aviso" role="alert" ref={alerta} tabIndex={-1}>
      <p><strong>{fallo.mensaje}</strong></p>
      {(fallo.solicitudCambio || fallo.versionVieja) && <button type="button" className="boton boton-secundario" onClick={() => { setFallo(undefined); alRecargarSolicitud(); }}>
        {fallo.versionVieja ? 'Volver a cargar la cotización' : 'Ver la solicitud actualizada'}</button>}
    </div>}
    <div className="sol-distribucion">
      <div className="sol-principal">
        <form id="cot-formulario" noValidate onSubmit={e => { e.preventDefault(); void enviarFormulario(); }}>
          <fieldset disabled={ocupado} className="sol-panel">
            <legend>Tipo de cotización</legend>
            <div className="sol-modalidad">
              {tiposDeCotizacion.map(({ tipo, ayuda }) => <label key={tipo}>
                <input type="radio" name="cot-tipo" checked={f.tipo === tipo} onChange={() => cambiar({ tipo })} />
                <span><strong>{etiquetasTipo[tipo]}</strong><small>{ayuda}</small></span>
              </label>)}
            </div>
          </fieldset>
          <fieldset disabled={ocupado} className="sol-panel">
            <legend>Trabajo que cotizas</legend>
            <div className="sol-campo">
              <label htmlFor="cot-alcance">Alcance del trabajo{asterisco(true)}</label>
              <textarea {...atributos('alcance', 'cot-alcance-ayuda')} rows={5} maxLength={2000} value={f.alcance} onChange={e => cambiar({ alcance: e.target.value })} />
              <span className="sol-suave" id="cot-alcance-ayuda">Qué incluye tu trabajo, paso a paso. Hasta 2 000 caracteres.</span>{mensaje('alcance')}
            </div>
            <div className="sol-campo">
              <label htmlFor="cot-exclusiones">Exclusiones{opcional}</label>
              <textarea {...atributos('exclusiones')} rows={3} maxLength={2000} value={f.exclusiones} onChange={e => cambiar({ exclusiones: e.target.value })} />{mensaje('exclusiones')}
            </div>
            <div className="sol-doble">
              <div className="sol-campo">
                <label htmlFor="cot-materiales">Materiales{opcional}</label>
                <textarea {...atributos('materiales')} rows={3} maxLength={2000} value={f.materiales} onChange={e => cambiar({ materiales: e.target.value })} />{mensaje('materiales')}
              </div>
              <div className="sol-campo">
                <label htmlFor="cot-manoDeObra">Mano de obra{opcional}</label>
                <textarea {...atributos('manoDeObra')} rows={3} maxLength={2000} value={f.manoDeObra} onChange={e => cambiar({ manoDeObra: e.target.value })} />{mensaje('manoDeObra')}
              </div>
            </div>
          </fieldset>
          <fieldset disabled={ocupado} className="sol-panel">
            <legend>Precio y plazo</legend>
            <p className="sol-suave">{f.tipo === 'ESTIMADA' ? 'Indica un precio, una forma de cálculo, o ambos.' : 'Una cotización definitiva exige precio fijo, plazo y condiciones de pago.'}</p>
            <div className="sol-doble">
              <div className="sol-campo">
                <label htmlFor="cot-precio">Precio total en soles{asterisco(requeridos.precio)}{!requeridos.precio && opcional}</label>
                <div className="cot-dinero"><span aria-hidden="true">S/</span>
                  <input {...atributos('precio', 'cot-precio-ayuda')} type="text" inputMode="decimal" autoComplete="off" value={f.precio} onChange={e => cambiar({ precio: e.target.value })} />
                </div>
                <span className="sol-suave" id="cot-precio-ayuda">Ejemplo: 2500 o 2 500,50.</span>{mensaje('precio')}
              </div>
              <div className="sol-campo">
                <label htmlFor="cot-plazoDias">Plazo de ejecución en días{asterisco(requeridos.plazoDias)}{!requeridos.plazoDias && opcional}</label>
                <input {...atributos('plazoDias')} type="text" inputMode="numeric" autoComplete="off" value={f.plazoDias} onChange={e => cambiar({ plazoDias: e.target.value })} />{mensaje('plazoDias')}
              </div>
            </div>
            <div className="sol-campo">
              <label htmlFor="cot-formaCalculo">Forma de cálculo{f.tipo === 'ESTIMADA' ? <span className="sol-opcional"> (si no indicas precio)</span> : opcional}</label>
              <input {...atributos('formaCalculo')} type="text" maxLength={1000} value={f.formaCalculo} onChange={e => cambiar({ formaCalculo: e.target.value })} />
              {mensaje('formaCalculo')}
            </div>
          </fieldset>
          <fieldset disabled={ocupado} className="sol-panel">
            <legend>Vigencia y condiciones de pago</legend>
            <div className="sol-campo">
              <label htmlFor="cot-vigenteHasta">Válida hasta{asterisco(true)}</label>
              <input {...atributos('vigenteHasta', 'cot-vigencia-ayuda')} type="date" min={hoy} value={f.vigenteHasta} onChange={e => cambiar({ vigenteHasta: e.target.value })} />
              <span className="sol-suave" id="cot-vigencia-ayuda">Tu cotización vale hasta el final de ese día, hora de Lima.</span>{mensaje('vigenteHasta')}
            </div>
            <div className="sol-campo">
              <label htmlFor="cot-condicionesPago">Condiciones de pago{asterisco(requeridos.condicionesPago)}{!requeridos.condicionesPago && opcional}</label>
              <textarea {...atributos('condicionesPago')} rows={3} maxLength={1000} value={f.condicionesPago} onChange={e => cambiar({ condicionesPago: e.target.value })} />{mensaje('condicionesPago')}
            </div>
          </fieldset>
        </form>
      </div>
      <div className="sol-lateral">
        <section className="sol-panel" aria-labelledby="cot-resumen">
          <h2 id="cot-resumen">Solicitud que cotizas</h2>
          <p className="sol-suave">Versión de trabajo {solicitud.versionTrabajo}. Tu cotización se elabora sobre esta versión.</p>
          <p className="sol-texto cot-resumen-texto">{solicitud.descripcion}</p>
          {solicitud.medidas && <p className="sol-texto"><strong>Medidas:</strong> {solicitud.medidas}</p>}
          <dl className="sol-datos">
            <div><dt>Categoría</dt><dd>{categoria ?? '—'}</dd></div>
            <div><dt>Distrito</dt><dd>{nombreDistrito(solicitud.distrito) ?? solicitud.distrito}</dd></div>
            <div><dt>Fecha</dt><dd>{periodo(solicitud.fechaDesde, solicitud.fechaHasta)}</dd></div>
          </dl>
        </section>
        <div className="sol-panel sol-panel-acciones">
          <button type="submit" form="cot-formulario" className="boton boton-primario" disabled={ocupado}>{ocupado ? 'Enviando…' : etiquetaBoton}</button>
          <a className="boton boton-secundario sol-enlace-boton" href={volverA.href} onClick={alNavegar}>Cancelar</a>
          {ocupado && <p role="status" className="sol-suave">Guardando tu cotización…</p>}
        </div>
      </div>
    </div>
  </div>;
}
