import { isDeepStrictEqual } from 'node:util';

export const metodosOpenApi = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;
type Metodo = typeof metodosOpenApi[number];
export type OperacionOpenApi = Record<string, unknown> & { operationId: string };
type PathItem = Record<string, unknown> & Partial<Record<Metodo, OperacionOpenApi>>;
export type DocumentoOpenApi = Record<string, unknown> & {
  openapi: string; paths: Record<string, PathItem>;
  components?: Record<string, Record<string, unknown>>;
  tags?: { name: string }[];
};

export function inventarioOpenApi(documento: DocumentoOpenApi) {
  return Object.entries(documento.paths).flatMap(([ruta, item]) => metodosOpenApi.flatMap(metodo => {
    const operacion = item[metodo];
    return operacion ? [{ metodo, ruta, operacion }] : [];
  }));
}

function comprobarReferencias(documento: DocumentoOpenApi, valor: unknown): void {
  if (!valor || typeof valor !== 'object') return;
  for (const [clave, dato] of Object.entries(valor)) {
    if (clave === '$ref') {
      if (typeof dato !== 'string' || !dato.startsWith('#/')) throw new Error('Referencia OpenAPI no local o no válida.');
      let destino: unknown = documento;
      for (const segmento of decodeURIComponent(dato.slice(2)).split('/')) {
        const nombre = segmento.replaceAll('~1', '/').replaceAll('~0', '~');
        if (!destino || typeof destino !== 'object' || !Object.hasOwn(destino, nombre)) throw new Error(`Referencia OpenAPI sin resolución: ${dato}`);
        destino = (destino as Record<string, unknown>)[nombre];
      }
    } else comprobarReferencias(documento, dato);
  }
}

function ambiguas(a: string, b: string): boolean {
  const izquierda = a.split('/');
  const derecha = b.split('/');
  if (izquierda.length !== derecha.length) return false;
  let aLiteral = false;
  let bLiteral = false;
  for (const [i, parte] of izquierda.entries()) {
    const otra = derecha[i]!;
    if (parte === otra) continue;
    const aParam = /^\{[^{}]+\}$/.test(parte);
    const bParam = /^\{[^{}]+\}$/.test(otra);
    if (!aParam && !bParam) return false;
    if (!aParam) aLiteral = true;
    if (!bParam) bLiteral = true;
  }
  return aLiteral === bLiteral;
}

function unirComponentes(uno: DocumentoOpenApi['components'], dos: DocumentoOpenApi['components']) {
  const grupos = new Set([...Object.keys(uno ?? {}), ...Object.keys(dos ?? {})]);
  return Object.fromEntries([...grupos].sort().map(grupo => {
    const entries = new Map(Object.entries(uno?.[grupo] ?? {}));
    for (const [clave, valor] of Object.entries(dos?.[grupo] ?? {})) {
      if (entries.has(clave) && !isDeepStrictEqual(entries.get(clave), valor)) throw new Error(`Componente OpenAPI incompatible: ${grupo}/${clave}`);
      entries.set(clave, valor);
    }
    return [grupo, Object.fromEntries(entries)];
  }));
}

export function componerOpenApi(base: DocumentoOpenApi, oferta: DocumentoOpenApi): DocumentoOpenApi {
  if (base.openapi !== oferta.openapi) throw new Error('Versiones OpenAPI incompatibles.');
  const ids = new Set<string>();
  const rutasPorMetodo = new Map<Metodo, string[]>();
  for (const { metodo, ruta, operacion } of [...inventarioOpenApi(base), ...inventarioOpenApi(oferta)]) {
    const registradas = rutasPorMetodo.get(metodo) ?? [];
    if (registradas.includes(ruta)) throw new Error(`Colisión de método y ruta OpenAPI: ${metodo} ${ruta}`);
    if (registradas.some(otra => ambiguas(ruta, otra))) throw new Error(`Rutas OpenAPI ambiguas: ${metodo} ${ruta}`);
    if (!operacion.operationId || ids.has(operacion.operationId)) throw new Error('operationId OpenAPI ausente o duplicado.');
    ids.add(operacion.operationId);
    registradas.push(ruta);
    rutasPorMetodo.set(metodo, registradas);
  }
  const paths = new Map(Object.entries(base.paths));
  for (const [ruta, item] of Object.entries(oferta.paths)) paths.set(ruta, { ...paths.get(ruta), ...item });
  const tags = new Map([...(base.tags ?? []), ...(oferta.tags ?? [])].map(tag => [tag.name, tag]));
  const resultado = structuredClone({ ...base, paths: Object.fromEntries(paths), components: unirComponentes(base.components, oferta.components), tags: [...tags.values()] });
  comprobarReferencias(resultado, resultado);
  return resultado;
}
