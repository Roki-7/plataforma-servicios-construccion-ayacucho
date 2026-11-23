import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { redactarReporte } from './reportes-seguros.js';

interface Dispositivo { proyecto: string; navegador: string; versionNavegador: string; dispositivo: string; anchoViewport: number; altoViewport: number; plataformaEjecutor: string; node: string; origen: string; ejecucion: string; entorno: Record<string, string | number> }
interface ResumenProyecto { proyecto: string; navegador: string; versionNavegador: string; dispositivo: string; anchoViewport: number; altoViewport: number; pruebas: number; aprobadas: number; fallidas: number; omitidas: number }

/**
 * Reporte 002: agrega por proyecto (navegador y ancho) el dispositivo, la versión y el entorno que cada prueba adjuntó en `dispositivo.json`.
 * Solo escribe identidades (nombres y puertos); el texto pasa por la misma redacción de secretos que usa la 001.
 */
export default class Reporte002 implements Reporter {
  private readonly proyectos = new Map<string, ResumenProyecto>();
  private dispositivo: Dispositivo | undefined;
  private readonly inicio = new Date();
  constructor(private readonly opciones: { evidencia: string }) {}
  onTestEnd(prueba: TestCase, resultado: TestResult): void {
    const proyecto = prueba.parent.project()?.name ?? 'sin-proyecto';
    const adjunto = resultado.attachments.find((a) => a.name === 'dispositivo.json' && a.body);
    const dispositivo = adjunto?.body ? JSON.parse(adjunto.body.toString('utf8')) as Dispositivo : undefined;
    if (dispositivo) this.dispositivo = dispositivo;
    const resumen = this.proyectos.get(proyecto) ?? { proyecto, navegador: dispositivo?.navegador ?? '', versionNavegador: dispositivo?.versionNavegador ?? '', dispositivo: dispositivo?.dispositivo ?? '', anchoViewport: dispositivo?.anchoViewport ?? 0, altoViewport: dispositivo?.altoViewport ?? 0, pruebas: 0, aprobadas: 0, fallidas: 0, omitidas: 0 };
    if (dispositivo && !resumen.navegador) Object.assign(resumen, { navegador: dispositivo.navegador, versionNavegador: dispositivo.versionNavegador, dispositivo: dispositivo.dispositivo, anchoViewport: dispositivo.anchoViewport, altoViewport: dispositivo.altoViewport });
    resumen.pruebas += 1;
    if (resultado.status === 'passed') resumen.aprobadas += 1; else if (resultado.status === 'skipped') resumen.omitidas += 1; else resumen.fallidas += 1;
    this.proyectos.set(proyecto, resumen);
  }
  onEnd(resultado: FullResult): void {
    mkdirSync(this.opciones.evidencia, { recursive: true });
    const texto = JSON.stringify({
      funcionalidad: '002', ejecucion: this.dispositivo?.ejecucion ?? null, inicio: this.inicio.toISOString(), fin: new Date().toISOString(), resultado: resultado.status,
      origen: this.dispositivo?.origen ?? null, plataformaEjecutor: this.dispositivo?.plataformaEjecutor ?? null, node: this.dispositivo?.node ?? null,
      entorno: this.dispositivo?.entorno ?? null, proyectos: [...this.proyectos.values()].sort((a, b) => a.proyecto.localeCompare(b.proyecto)),
    }, null, 2);
    writeFileSync(resolve(this.opciones.evidencia, 'ejecucion-002.json'), redactarReporte(texto), 'utf8');
  }
}
