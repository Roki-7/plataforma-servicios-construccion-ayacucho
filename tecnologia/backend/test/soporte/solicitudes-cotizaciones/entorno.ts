import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Controller, Delete, Get, Patch, Post, Put } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { leerConfiguracion003 } from '../../../scripts/entorno-003.js';
import type { Configuracion } from '../../../src/composicion/configuracion.js';
import type { AlmacenPortafolio } from '../../../src/modulos/prestadores/aplicacion/puertos/puertos.js';
import { componerExtensiones, inventarioOpenApi, type DocumentoOpenApi } from '../../../src/composicion/componer-openapi.js';
import { readFileSync } from 'node:fs';

/** Configuración de las suites de la 003: infraestructura propia (PostgreSQL 54331, Garage 3911, correo 1027) y una base descartable. */
export async function configuracionDePrueba003(databaseUrl: string): Promise<Configuracion> {
  const env = await leerConfiguracion003();
  return {
    validacion: true, puerto: Number(env['PORT']), origen: env['PUBLIC_ORIGIN']!, urlPublica: env['PUBLIC_URL']!, databaseUrl,
    catalogo: env['CATALOGO_MANIFIESTO']!, contrato: resolve('contracts/openapi.json'),
    hmacId: 'prueba', hmac: new Map([['prueba', Buffer.alloc(32, 1)]]),
    aeadId: 'prueba', aead: new Map([['prueba', Buffer.alloc(32, 2)]]),
    smtp: { host: env['SMTP_HOST']!, port: Number(env['SMTP_PORT']), secure: false, from: 'pruebas003@example.invalid', validacion: true },
    s3: { endpoint: env['S3_ENDPOINT']!, region: env['S3_REGION']!, bucket: env['S3_BUCKET']!, accessKeyId: 'fixture-003', secretAccessKey: 'fixture-003' },
  };
}

/** Almacén de portafolio en memoria: las pruebas de composición no necesitan Garage y no deben crear objetos. */
export function almacenEnMemoria003(): AlmacenPortafolio {
  const objetos = new Map<string, Uint8Array>();
  return {
    claveNueva: (prestadorId) => `pruebas/${randomUUID()}/portafolio/${prestadorId}/${randomUUID()}`,
    guardar: async (clave, bytes) => { objetos.set(clave, bytes); },
    leer: async (clave) => { const bytes = objetos.get(clave); if (!bytes) throw new Error('Objeto inexistente.'); return bytes; },
    eliminar: async (clave) => { objetos.delete(clave); },
    async *listar() { for (const clave of objetos.keys()) yield { clave, modificado: new Date() }; },
    pertenece: (clave) => clave.includes('/portafolio/'),
  };
}

const decoradores = { get: Get, post: Post, patch: Patch, put: Put, delete: Delete } as const;

/**
 * Controlador simulado con las rutas de las operaciones indicadas del contrato de la 003. Sirve para ensayar la composición (tabla de rutas,
 * `verificarRouter`) antes de que existan los controladores reales; no implementa ningún comportamiento. Las rutas sin parámetros se registran
 * primero, igual que exige la composición real (las literales antes que las de parámetro).
 */
export function controladorSimulado003(operaciones?: readonly string[]): Type {
  const fuente: DocumentoOpenApi = JSON.parse(readFileSync(resolve('contracts/solicitudes-cotizaciones.openapi.json'), 'utf8'));
  const elegidas = inventarioOpenApi(fuente).filter(({ operacion }) => !operaciones || operaciones.includes(operacion.operationId))
    .sort((a, b) => (a.ruta.match(/\{/g)?.length ?? 0) - (b.ruta.match(/\{/g)?.length ?? 0) || a.ruta.localeCompare(b.ruta));
  class Simulado003 {}
  for (const { metodo, ruta, operacion } of elegidas) {
    const nombre = operacion.operationId;
    Object.defineProperty(Simulado003.prototype, nombre, { value: async () => ({}), writable: true, configurable: true });
    const descriptor = Object.getOwnPropertyDescriptor(Simulado003.prototype, nombre)!;
    const decorador = decoradores[metodo as keyof typeof decoradores];
    decorador(ruta.replace(/^\//, '').replace(/\{(\w+)\}/g, ':$1'))(Simulado003.prototype, nombre, descriptor);
  }
  Controller()(Simulado003);
  return Simulado003;
}

/** Operaciones del contrato fuente de la 003. */
export function operaciones003(): readonly { metodo: string; ruta: string; operationId: string }[] {
  const fuente: DocumentoOpenApi = JSON.parse(readFileSync(resolve('contracts/solicitudes-cotizaciones.openapi.json'), 'utf8'));
  return inventarioOpenApi(fuente).map(({ metodo, ruta, operacion }) => ({ metodo, ruta, operationId: operacion.operationId }));
}

/** Contrato compuesto de las tres funcionalidades, útil para derivar la tabla de rutas esperada. */
export function contratoCompuesto003(): DocumentoOpenApi {
  const leer = (archivo: string): DocumentoOpenApi => JSON.parse(readFileSync(resolve('contracts', archivo), 'utf8'));
  return componerExtensiones(leer('openapi.json'), [leer('prestadores-catalogo.openapi.json'), leer('solicitudes-cotizaciones.openapi.json')]);
}
