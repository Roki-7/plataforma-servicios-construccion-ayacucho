import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Reporter, TestCase, TestResult, TestStep, TestError } from '@playwright/test/reporter';
export function redactarReporte(texto: string): string {
  return texto.replace(/(\/api\/v1\/perfil\/cambios-correo\/)[A-Za-z0-9_-]{43}/g, '$1[REDACTADO]').replace(/(#token=|\/api\/v1\/recuperaciones\/)[A-Za-z0-9_-]{43}/g, '$1[REDACTADO]')
    .replace(/(Bearer\s+|__Secure-renovacion=)[A-Za-z0-9_-]{43}/g, '$1[REDACTADO]')
    .replace(/("(?:tokenAcceso|csrfToken|contrasena|contrasenaActual|nuevaContrasena|confirmacionContrasena)"\s*:\s*")[^"\r\n]*(")/g, '$1[REDACTADO]$2');
}
function errorSeguro(error: TestError | undefined): void { if (!error) return; const dato = error as unknown as Record<string, unknown>; for (const k of ['message', 'stack', 'snippet', 'value', 'errorContext']) if (typeof dato[k] === 'string') dato[k] = redactarReporte(dato[k]); if (error.cause) errorSeguro(error.cause); }
export default class ReportesSeguros implements Reporter {
  private readonly raiz: string;
  constructor(opciones: { evidencia: string }) { this.raiz = resolve(opciones.evidencia); }
  onStepEnd(_test: TestCase, _resultado: TestResult, paso: TestStep): void { paso.title = redactarReporte(paso.title); errorSeguro(paso.error); }
  onTestEnd(_test: TestCase, resultado: TestResult): void {
    resultado.errors.forEach(errorSeguro);
    for (const a of resultado.attachments) {
      if (!/^(text\/|application\/json)/.test(a.contentType)) continue;
      if (a.body) a.body = Buffer.from(redactarReporte(a.body.toString('utf8')));
      if (a.path && resolve(a.path).startsWith(this.raiz + sep)) { const texto = readFileSync(a.path, 'utf8'); writeFileSync(a.path, redactarReporte(texto), 'utf8'); }
    }
  }
}
