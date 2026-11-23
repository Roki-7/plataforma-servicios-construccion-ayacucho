import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { redactarReporte } from './reportes-seguros.js';

interface Dispositivo { proyecto: string; navegador: string; versionNavegador: string; dispositivo: string; anchoViewport: number; altoViewport: number; plataformaEjecutor: string; node: string; origen: string; ejecucion: string; entorno: Record<string, string | number> }
interface ResumenProyecto { proyecto: string; navegador: string; versionNavegador: string; dispositivo: string; anchoViewport: number; altoViewport: number; pruebas: number; aprobadas: number; fallidas: number; omitidas: number }
interface PruebaDeCriterio { proyecto: string; titulo: string; estado: string }

/**
 * Reporte 002: agrega por proyecto (navegador y ancho) el dispositivo, la versión y el entorno que cada prueba adjuntó en `dispositivo.json`; vincula cada prueba con los
 * criterios de aceptación que declara (anotaciones `criterio`) en `trazabilidad-criterios-002.json`; y conserva los hechos que las pruebas adjuntan como
 * `evidencia-<nombre>.json` en `hu03/<proyecto>/`. Solo escribe identidades y hechos verificables; el texto pasa por la misma redacción de secretos que usa la 001.
 */
export default class Reporte002 implements Reporter {
  private readonly proyectos = new Map<string, ResumenProyecto>();
  private readonly criterios = new Map<string, PruebaDeCriterio[]>();
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

    for (const anotacion of prueba.annotations.filter((a) => a.type === 'criterio' && a.description)) {
      const lista = this.criterios.get(anotacion.description!) ?? [];
      lista.push({ proyecto, titulo: prueba.title, estado: resultado.status }); this.criterios.set(anotacion.description!, lista);
    }
    // Hechos verificables que las pruebas adjuntan (estados HTTP, huellas, identificadores): uno por proyecto y nombre.
    // Cada historia de usuario conserva sus hechos en su carpeta: `evidencia-ca-pre-*` en `hu03` y `evidencia-ca-ser-*` en `hu04`.
    for (const a of resultado.attachments.filter((x) => /^evidencia-[a-z0-9-]+\.json$/.test(x.name) && x.body)) {
      const carpeta = resolve(this.opciones.evidencia, a.name.startsWith('evidencia-ca-ser-') ? 'hu04' : 'hu03', proyecto);
      mkdirSync(carpeta, { recursive: true });
      writeFileSync(resolve(carpeta, a.name), redactarReporte(a.body!.toString('utf8')), 'utf8');
    }
  }
  onEnd(resultado: FullResult): void {
    mkdirSync(this.opciones.evidencia, { recursive: true });
    const texto = JSON.stringify({
      funcionalidad: '002', ejecucion: this.dispositivo?.ejecucion ?? null, inicio: this.inicio.toISOString(), fin: new Date().toISOString(), resultado: resultado.status,
      origen: this.dispositivo?.origen ?? null, plataformaEjecutor: this.dispositivo?.plataformaEjecutor ?? null, node: this.dispositivo?.node ?? null,
      entorno: this.dispositivo?.entorno ?? null, proyectos: [...this.proyectos.values()].sort((a, b) => a.proyecto.localeCompare(b.proyecto)),
    }, null, 2);
    writeFileSync(resolve(this.opciones.evidencia, 'ejecucion-002.json'), redactarReporte(texto), 'utf8');
    if (this.criterios.size === 0) return;
    const traza = Object.fromEntries([...this.criterios.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, pruebas]) => {
      const porProyecto: Record<string, string[]> = {};
      for (const p of pruebas) (porProyecto[p.proyecto] ??= []).push(p.estado);
      const proyectos = Object.fromEntries(Object.entries(porProyecto).sort(([a], [b]) => a.localeCompare(b)).map(([p, estados]) => [p, estados.every((e) => e === 'passed') ? 'passed' : 'failed']));
      return [id, { aprobado: Object.values(proyectos).every((e) => e === 'passed'), proyectos, pruebas: pruebas.map((p) => ({ proyecto: p.proyecto, prueba: p.titulo, estado: p.estado })) }];
    }));
    writeFileSync(resolve(this.opciones.evidencia, 'trazabilidad-criterios-002.json'), redactarReporte(JSON.stringify({ funcionalidad: '002', ejecucion: this.dispositivo?.ejecucion ?? null, criterios: traza }, null, 2)), 'utf8');
  }
}
