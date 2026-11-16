import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { AnySchemaObject } from 'ajv';

export async function cargarContrato(): Promise<AnySchemaObject> {
  return JSON.parse(await readFile(new URL('../../../../specs/001-usuarios-y-acceso/contracts/openapi.json', import.meta.url), 'utf8')) as AnySchemaObject;
}

export async function validarRespuesta(componente: string, respuesta: unknown): Promise<void> {
  const contrato = await cargarContrato();
  const ajv = new Ajv2020({ strict: false, validateFormats: false });
  ajv.addSchema(contrato, 'contrato');
  const valid = ajv.compile({ $ref: `contrato#/components/schemas/${componente}` });
  if (!valid(respuesta)) throw new Error('La respuesta no satisface el contrato versionado.');
}
