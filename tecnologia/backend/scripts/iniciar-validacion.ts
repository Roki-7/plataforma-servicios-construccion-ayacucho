import { cargarLocal } from './entorno.js';
import { iniciar } from '../src/composicion/main.js';
cargarLocal();
if (process.env['VALIDATION_MODE'] !== 'true') throw new Error('Se requiere preparar el entorno de validación.');
await iniciar();
