import { etiquetasEstado, etiquetasTipo, fechaHoraLima, formatoSoles } from '../aplicacion/cotizacion.js';
import type { Cotizacion, EstadoCotizacion, VersionDeCotizacion } from '../modelos/cotizaciones.js';

const NO_INDICADO = 'No indicado';

/** Etiqueta del estado efectivo. El color nunca es el único portador del significado: siempre lleva texto. */
export function EtiquetaDeEstado({ estado }: { estado: EstadoCotizacion }) {
  return <span className="cot-estado" data-estado-cotizacion={estado}>{etiquetasEstado[estado]}</span>;
}

/** Precio de una versión: el importe si lo hay, si no «No indicado». */
export const textoDePrecio = (v: Pick<VersionDeCotizacion, 'precioCentimos'>) => v.precioCentimos === undefined ? NO_INDICADO : formatoSoles(v.precioCentimos);

/** Todos los campos de RF17 de una versión; los no informados se muestran como «No indicado». Una estimada se rotula como tal y no se presenta como definitiva. */
export function CamposDeVersion({ v }: { v: VersionDeCotizacion }) {
  const textos: [string, string | undefined][] = [['Alcance', v.alcance], ['Exclusiones', v.exclusiones], ['Materiales', v.materiales], ['Mano de obra', v.manoDeObra], ['Forma de cálculo', v.formaCalculo], ['Condiciones de pago', v.condicionesPago]];
  return <dl className="cot-campos">
    <div><dt>Tipo</dt><dd>{etiquetasTipo[v.tipo]}{v.tipo === 'ESTIMADA' && <span className="sol-suave"> · el precio puede ajustarse</span>}</dd></div>
    <div><dt>Precio</dt><dd>{textoDePrecio(v)}</dd></div>
    <div><dt>Plazo</dt><dd>{v.plazoDias === undefined ? NO_INDICADO : `${v.plazoDias} ${v.plazoDias === 1 ? 'día' : 'días'}`}</dd></div>
    <div><dt>Válida hasta</dt><dd>{fechaHoraLima(v.vigenteHasta)}</dd></div>
    {textos.map(([nombre, valor]) => <div key={nombre} className="cot-campo-largo"><dt>{nombre}</dt><dd className="sol-texto">{valor ?? NO_INDICADO}</dd></div>)}
  </dl>;
}

/**
 * Resumen compacto: estado, tipo, importe y vigencia. Sin precio no se destaca «No indicado» (confunde): se rotula «Precio por definir» y se muestra la forma de cálculo.
 * Con `conAlcance` añade un extracto del trabajo cotizado para distinguir una cotización de otra.
 */
export function ResumenDeCotizacion({ c, conAlcance = false }: { c: Cotizacion; conAlcance?: boolean }) {
  const v = c.versionVigente;
  const conPrecio = v.precioCentimos !== undefined;
  return <>
    <div className="sol-acciones">
      <EtiquetaDeEstado estado={c.estado} />
      <span className="sol-suave">{etiquetasTipo[v.tipo]}</span>
      {c.solicitudCerrada && <span className="sol-etiqueta" data-titulo="AUTOR_DE_COTIZACION">Solicitud cerrada</span>}
    </div>
    {conAlcance && <p className="sol-texto cot-alcance">{v.alcance}</p>}
    <p className={conPrecio ? 'cot-precio' : 'cot-precio cot-precio-pendiente'}>{conPrecio ? textoDePrecio(v) : 'Precio por definir'}</p>
    <p className="sol-suave">{!conPrecio && v.formaCalculo ? `${v.formaCalculo} · ` : ''}Válida hasta {fechaHoraLima(v.vigenteHasta)}</p>
  </>;
}
