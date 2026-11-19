import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { AnySchemaObject } from 'ajv';

let contrato: Promise<AnySchemaObject> | undefined;
export const cargarContrato002 = () => contrato ??= readFile(new URL('../../../../../specs/002-prestadores-y-catalogo/contracts/openapi.json', import.meta.url), 'utf8').then(t => JSON.parse(t) as AnySchemaObject);

/** Valida un cuerpo contra un componente del contrato 002 (los formatos se comprueban en el servidor). */
export async function validarRespuesta002(componente: string, cuerpo: unknown): Promise<void> {
  const ajv = new Ajv2020({ strict: false, validateFormats: false, allErrors: true });
  ajv.addSchema(await cargarContrato002(), 'contrato');
  const valida = ajv.compile({ $ref: `contrato#/components/schemas/${componente}` });
  if (!valida(cuerpo)) throw new Error(`La respuesta no satisface ${componente}: ${JSON.stringify(valida.errors?.slice(0, 3))}`);
}
