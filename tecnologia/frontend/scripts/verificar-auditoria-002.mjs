// T079 · Contrasta la auditoría exportada por el ejecutor (`auditoria-corrida-N.json`, tabla `administracion_auditoria` de la base descartable) con los hechos
// `auditoriaEsperada` que adjuntan las pruebas de `categorias.spec.ts` (`hu25/<proyecto>/evidencia-ca-cat-*.json`). Solo lee la evidencia local; no toca ninguna base.
//   node scripts/verificar-auditoria-002.mjs [directorio-de-evidencia]
// Comprueba, por cada recurso (clasificación) tocado por las pruebas: (1) cada acción esperada existe una sola vez con su motivo y con el mismo responsable (la cuenta del
// operador que recibió el permiso en la propia auditoría), (2) no hay ninguna otra fila para ese recurso (los intentos rechazados no dejan registros ni cambios), y
// (3) la auditoría es de solo adición (orden cronológico) y no contiene motivos de intentos no autorizados.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../../.local/evidencia/002/e2e-linux'));
const lee = (ruta) => JSON.parse(readFileSync(ruta, 'utf8'));
// Solo las corridas de la serie vigente (`serie-002.json`): una exportación de una serie anterior no se mezcla.
const vigentes = new Set((lee(resolve(raiz, 'serie-002.json')).corridas ?? []).map((c) => c.id));
const auditorias = readdirSync(raiz).filter((n) => /^auditoria-corrida-\d+\.json$/.test(n)).map((n) => lee(resolve(raiz, n))).filter((a) => vigentes.has(a.ejecucion));
if (!auditorias.length) { console.error('No hay auditoria-corrida-N.json en la evidencia.'); process.exit(2); }
const registros = auditorias.flatMap((a) => a.registros);
const hu25 = resolve(raiz, 'hu25');
if (!existsSync(hu25)) { console.error('No hay evidencia hu25 (ejecute categorias.spec.ts).'); process.exit(2); }

const operador = registros.filter((r) => r.accion === 'PERMISO_RF39_CONCEDIDO');
if (operador.length !== 1) { console.error(`Se esperaba una sola concesión del permiso y hay ${operador.length}.`); process.exit(1); }
const cuentaOperador = operador[0].recurso_id;
const fallos = []; let esperadasTotal = 0; const recursos = new Set(); const proyectos = new Set();
for (const proyecto of readdirSync(hu25)) {
  proyectos.add(proyecto);
  for (const archivo of readdirSync(resolve(hu25, proyecto)).filter((n) => /^evidencia-ca-cat-.*\.json$/.test(n))) {
    for (const esperada of lee(resolve(hu25, proyecto, archivo)).auditoriaEsperada ?? []) {
      esperadasTotal += 1; recursos.add(esperada.recursoId);
      const coinciden = registros.filter((r) => r.recurso_id === esperada.recursoId && r.accion === esperada.accion && r.motivo === esperada.motivo && r.responsable === cuentaOperador && r.recurso_tipo === 'CLASIFICACION');
      if (coinciden.length !== 1) fallos.push(`${proyecto}/${archivo}: ${esperada.accion} de ${esperada.recursoId} («${esperada.motivo}») aparece ${coinciden.length} veces`);
    }
  }
}
// Ninguna fila inesperada para los recursos de las pruebas: cada recurso tiene exactamente las acciones registradas (los rechazos no auditan).
const porRecurso = new Map();
for (const r of registros.filter((x) => recursos.has(x.recurso_id))) porRecurso.set(r.recurso_id, (porRecurso.get(r.recurso_id) ?? 0) + 1);
let esperadasPorRecurso = new Map();
for (const proyecto of proyectos) for (const archivo of readdirSync(resolve(hu25, proyecto)).filter((n) => /^evidencia-ca-cat-.*\.json$/.test(n)))
  for (const e of lee(resolve(hu25, proyecto, archivo)).auditoriaEsperada ?? []) esperadasPorRecurso.set(e.recursoId, (esperadasPorRecurso.get(e.recursoId) ?? 0) + 1);
for (const [recurso, n] of esperadasPorRecurso) if ((porRecurso.get(recurso) ?? 0) !== n) fallos.push(`El recurso ${recurso} tiene ${porRecurso.get(recurso) ?? 0} filas y se esperaban ${n}`);
const intrusos = registros.filter((r) => /Intento no autorizado|Intrusa|Editada ajena/.test(`${r.motivo ?? ''}`)); if (intrusos.length) fallos.push(`Hay ${intrusos.length} filas de intentos no autorizados`);
const fechas = registros.map((r) => Date.parse(r.ocurrio_en)); if (fechas.some((f, i) => i > 0 && f < fechas[i - 1])) fallos.push('La auditoría no está en orden cronológico');
const resumen = { proyectos: proyectos.size, filasDeAuditoria: registros.length, accionesEsperadas: esperadasTotal, recursosVerificados: recursos.size, filasPorRecursoExactas: esperadasPorRecurso.size, concesionesDelPermiso: operador.length, responsableUnico: cuentaOperador, fallos };
console.log(JSON.stringify(resumen, null, 2));
process.exit(fallos.length ? 1 : 0);
