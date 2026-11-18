import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const id = /\bCA-[A-Z]{3}-\d{2}\b/g;
const niveles = ['U','I','C','V','E'] as const;
type Nivel = typeof niveles[number];
type Matriz = Map<string, Nivel[]>;
type Asociaciones = Map<Nivel, Set<string>>;
interface Manifiesto {
  commit: string;
  version: string;
  entorno: string;
  corpus: string;
  exigirMatrizE?: boolean;
  reportes: Record<Nivel, string[]>;
}
interface PruebaPlaywright {
  projectName: string;
  status: string;
  expectedStatus: string;
  annotations?: {type:string;description?:string}[];
  results: {status:string;retry:number}[];
}
interface SuitePlaywright {
  suites?: SuitePlaywright[];
  specs?: {title:string; tests:PruebaPlaywright[]}[];
}
const proyectos = ['chromium','firefox','webkit'].flatMap(n=>[360,768,1366].map(px=>n+'-'+px)).sort();

export function leerMatriz(spec: string, texto: string): Matriz {
  const ids = [...spec.matchAll(/\*\*(CA-[A-Z]{3}-\d{2})\s+—\s+Given\*\*/g)].map(m=>m[1]!);
  assert.equal(ids.length,53,'La spec debe contener 53 casos');
  assert.equal(new Set(ids).size,ids.length,'Casos duplicados en spec');
  const matriz: Matriz = new Map();
  for (const linea of texto.split(/\r?\n/)) {
    const columnas = linea.split('|').map(p=>p.trim());
    const caso = columnas[1] ?? '';
    if (!/^CA-[A-Z]{3}-\d{2}$/.test(caso)) continue;
    assert.ok(!matriz.has(caso),'Caso duplicado en matriz: '+caso);
    const ns = (columnas[4] ?? '').split('/');
    assert.ok(ns.length && ns.every(n=>niveles.includes(n as Nivel)) && new Set(ns).size===ns.length,'Niveles inválidos: '+caso);
    matriz.set(caso,ns as Nivel[]);
  }
  assert.deepEqual([...matriz.keys()].sort(),ids.sort(),'Identificadores de spec y matriz difieren');
  return matriz;
}

export function leerJUnit(xml: string, archivo: string) {
  const raiz = /<testsuites\b([^>]+)>/.exec(xml)?.[1];
  assert.ok(raiz && xml.includes('</testsuites>'),'JUnit incompleto: '+archivo);
  const total = Number(/\btests="(\d+)"/.exec(raiz)?.[1]);
  assert.ok(Number.isSafeInteger(total) && total>0,'JUnit sin pruebas ejecutadas: '+archivo);
  assert.ok(!/<(?:skipped|failure|error)\b/.test(xml),'JUnit contiene casos omitidos o fallidos: '+archivo);
  assert.ok(!/\b(?:failures|errors|skipped|disabled)="[1-9]\d*"/.test(xml),'JUnit no verde: '+archivo);
  const casos = [...xml.matchAll(/<testcase\b([^>]+)>/g)];
  assert.equal(casos.length,total,'Total JUnit inconsistente: '+archivo);
  const cubiertos = casos.flatMap(c=>(/\bname="([^"]*)"/.exec(c[1]!)?.[1]??'').match(id)??[]);
  return {total,cubiertos};
}

function leerEscenarios(suites: SuitePlaywright[]): {titulo:string;prueba:PruebaPlaywright}[] {
  return suites.flatMap(s=>[...(s.specs??[]).flatMap(spec=>spec.tests.map(prueba=>({titulo:spec.title,prueba}))),...leerEscenarios(s.suites??[])]);
}
export function leerNavegadores(json: string, archivo: string, matriz: Matriz, exigirMatrizE = false) {
  const informe = JSON.parse(json) as {suites:SuitePlaywright[];stats:Record<string,number>;config:{projects:{name:string}[];metadata:Record<string,unknown>}};
  for (const k of ['unexpected','skipped','flaky']) assert.equal(informe.stats[k],0,'Playwright '+k+': '+archivo);
  const casos = leerEscenarios(informe.suites);
  assert.ok(casos.length > 0, 'Playwright sin pruebas ejecutadas: ' + archivo);
  assert.equal(casos.length,informe.stats['expected'],'Conteo Playwright: '+archivo);
  const ejecutados = [...new Set(casos.map(c => c.prueba.projectName))].sort();
  assert.ok(ejecutados.every(p => proyectos.includes(p)), 'Proyecto Playwright desconocido: ' + archivo);
  if (exigirMatrizE) assert.deepEqual(ejecutados, proyectos, 'Proyectos requeridos: ' + archivo);
  const porProyecto = new Map(ejecutados.map(p => [p, new Set<string>()]));
  const navegadores = new Set<string>();
  for (const {titulo,prueba} of casos) {
    assert.ok(prueba.status==='expected' && prueba.expectedStatus==='passed' && prueba.results.length===1 && prueba.results[0]?.status==='passed' && prueba.results[0].retry===0,'Caso sin aprobación inicial: '+titulo+' / '+prueba.projectName);
    for (const caso of titulo.match(id)??[]) porProyecto.get(prueba.projectName)!.add(caso);
    for (const a of prueba.annotations??[]) if(a.type==='navegador'&&a.description)navegadores.add(a.description);
  }
  if (exigirMatrizE) {
    for (const [proyecto, ids] of porProyecto) {
      const faltan = [...matriz].filter(([c, ns]) => ns.includes('E') && !ids.has(c)).map(([c]) => c);
      assert.deepEqual(faltan, [], 'Casos E ausentes en ' + proyecto);
    }
  }
  for (const motor of new Set(ejecutados.map(p => p.split('-')[0]))) {
    assert.ok([...navegadores].some(v => v.toLowerCase().startsWith(`${motor} `)), 'Falta versión de ' + motor + ': ' + archivo);
  }
  return {total:casos.length,cubiertos:[...new Set([...porProyecto.values()].flatMap(s=>[...s]))],navegadores:[...navegadores].sort(),proyectos:ejecutados,plataforma:informe.config.metadata['plataforma']};
}

export function verificarAsociaciones(matriz: Matriz, cubiertos: Asociaciones): void {
  const faltantes = [...matriz].flatMap(([caso, ns])=>ns.filter(n=>!cubiertos.get(n)?.has(caso)).map(n=>caso+' '+n));
  assert.deepEqual(faltantes,[],'Casos sin evidencia aprobada por nivel');
  for(const [n, casos] of cubiertos) for(const caso of casos) assert.ok(matriz.has(caso),'Caso desconocido en '+n+': '+caso);
}

async function principal() {
  const archivo = process.argv[2];
  const salida = process.argv[3];
  assert.ok(archivo && salida,'Uso: npm run test:coverage:001 -- <manifiesto.json> <resultado.json>');
  const manifiesto = JSON.parse(await readFile(archivo,'utf8')) as Manifiesto;
  assert.match(manifiesto.commit,/^[a-f0-9]{40}$/i,'Falta commit Git');
  for(const campo of ['version','entorno','corpus'] as const) assert.ok(manifiesto[campo]?.trim(),'Falta '+campo);
  assert.ok(manifiesto.exigirMatrizE === undefined || typeof manifiesto.exigirMatrizE === 'boolean', 'exigirMatrizE debe ser booleano');
  const feature = new URL('../../../specs/001-usuarios-y-acceso/',import.meta.url);
  const [spec,matrizMd] = await Promise.all(['spec.md','test-matrix.md'].map(p=>readFile(new URL(p,feature),'utf8')));
  const matriz = leerMatriz(spec!,matrizMd!);
  const cubiertos: Asociaciones = new Map();
  const evidencias = [];
  const rutas = new Set<string>();
  for (const nivel of niveles) {
    assert.ok(Array.isArray(manifiesto.reportes[nivel]) && manifiesto.reportes[nivel].length,'Falta reporte '+nivel);
    const conjunto = new Set<string>();
    for (const informe of manifiesto.reportes[nivel]) {
      const ruta = resolve(dirname(archivo),informe);
      assert.ok(!rutas.has(ruta),'Reporte repetido en manifiesto: '+informe);
      rutas.add(ruta);
      const datos = await readFile(ruta,'utf8');
      const resultado = nivel==='E' ? leerNavegadores(datos,informe,matriz,manifiesto.exigirMatrizE) : leerJUnit(datos,informe);
      for(const caso of resultado.cubiertos) conjunto.add(caso);
      evidencias.push({nivel,informe,...resultado});
    }
    cubiertos.set(nivel,conjunto);
  }
  verificarAsociaciones(matriz,cubiertos);
  const asociaciones = [...matriz.values()].reduce((s,ns)=>s+ns.length,0);
  await writeFile(salida,JSON.stringify({fecha:new Date().toISOString(),commit:manifiesto.commit,version:manifiesto.version,entorno:manifiesto.entorno,corpus:manifiesto.corpus,exigirMatrizE:manifiesto.exigirMatrizE===true,casos:matriz.size,asociaciones,evidencias},null,2)+'\n',{flag:'wx'});
  process.stdout.write('Cobertura aprobada: '+matriz.size+' escenarios y '+asociaciones+' asociaciones.\n');
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  await principal().catch((error:unknown)=>{process.stderr.write((error instanceof Error ? error.message : 'Error de verificación')+'\n');process.exitCode=1;});
}
