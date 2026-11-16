import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const tecnologia = resolve(backend, '..');
export const local = resolve(tecnologia, '.local');
export function cargarLocal(): void { config({ path: resolve(local, 'backend.env'), override: false, quiet: true }); }
