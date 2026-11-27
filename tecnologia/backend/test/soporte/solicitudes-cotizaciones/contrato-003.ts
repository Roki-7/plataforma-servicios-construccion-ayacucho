import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { AnySchemaObject } from 'ajv';

let contrato: Promise<AnySchemaObject> | undefined;
/** Contrato normativo de la 003 (el espejo ejecutable es idéntico: lo exige la prueba de composición). */
export const cargarContrato003 = () => contrato ??= readFile(new URL('../../../../../specs/003-solicitudes-y-cotizaciones/contracts/openapi.json', import.meta.url), 'utf8').then(t => JSON.parse(t) as AnySchemaObject);

/** Valida un cuerpo contra un componente de esquema del contrato 003. Los formatos (uuid, date-time) se comprueban en el servidor. */
export async function validarRespuesta003(componente: string, cuerpo: unknown): Promise<void> {
  const ajv = new Ajv2020({ strict: false, validateFormats: false, allErrors: true });
  ajv.addSchema(await cargarContrato003(), 'contrato');
  const valida = ajv.compile({ $ref: `contrato#/components/schemas/${componente}` });
  if (!valida(cuerpo)) throw new Error(`La respuesta no satisface ${componente}: ${JSON.stringify(valida.errors?.slice(0, 4))}`);
}
