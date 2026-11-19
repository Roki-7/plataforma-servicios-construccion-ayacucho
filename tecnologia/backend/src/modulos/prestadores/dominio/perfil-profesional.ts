import { ErrorAplicacion, type DetalleError } from '../../../compartido/dominio/errores.js';

export const tiposPrestador = ['TRABAJADOR_DE_OFICIO', 'TECNICO', 'PROFESIONAL', 'EMPRESA'] as const;
export type TipoPrestador = typeof tiposPrestador[number];
export const limitesPerfil = { nombrePublico: 120, experiencia: 3000, distritosMinimo: 1, distritosMaximo: 5, especialidadesMinimo: 1 } as const;

export interface EntradaPerfil {
  readonly nombrePublico: string;
  readonly tipo: string;
  readonly experiencia: string;
  readonly especialidadesIds: readonly string[];
  readonly distritos: readonly string[];
  readonly disponibilidadDeclarada: boolean;
}
export interface DatosPerfil {
  readonly nombrePublico: string;
  readonly tipo: TipoPrestador;
  readonly experiencia: string;
  readonly especialidadesIds: readonly string[];
  readonly distritos: readonly string[];
  readonly disponibilidadDeclarada: boolean;
}
/** Perfil persistido. `id` es el prestadorId público y es distinto de `cuentaId`. */
export interface PerfilProfesional extends DatosPerfil {
  readonly id: string;
  readonly cuentaId: string;
  readonly version: number;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Texto plano: sin caracteres de control (salvo saltos de línea en textos largos) ni marcado ejecutable.
// eslint-disable-next-line no-control-regex
const controlMultilinea = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
// eslint-disable-next-line no-control-regex
const controlLinea = /[\u0000-\u001F\u007F]/;
const marcado = /<\s*[a-zA-Z/!?]/;

export function textoPlano(campo: string, valor: unknown, maximo: number, errores: DetalleError[], multilinea = false): string {
  if (typeof valor !== 'string') { errores.push({ campo, motivo: 'Debe ser texto.' }); return ''; }
  if (valor.trim() === '') errores.push({ campo, motivo: 'Es obligatorio.' });
  else if ([...valor].length > maximo) errores.push({ campo, motivo: `Admite hasta ${maximo} caracteres.` });
  else if ((multilinea ? controlMultilinea : controlLinea).test(valor) || !valor.isWellFormed()) errores.push({ campo, motivo: 'Contiene caracteres no admitidos.' });
  else if (marcado.test(valor)) errores.push({ campo, motivo: 'No admite marcado HTML.' });
  return valor;
}

/** Valida y normaliza. `cobertura` son los distritos canónicos del catálogo, inyectados por la aplicación. */
export function validarEntradaPerfil(entrada: EntradaPerfil, cobertura: ReadonlySet<string>): DatosPerfil {
  const errores: DetalleError[] = [];
  const nombrePublico = textoPlano('nombrePublico', entrada.nombrePublico, limitesPerfil.nombrePublico, errores).trim();
  const experiencia = textoPlano('experiencia', entrada.experiencia, limitesPerfil.experiencia, errores, true).trim();
  if (!(tiposPrestador as readonly string[]).includes(entrada.tipo)) errores.push({ campo: 'tipo', motivo: 'Tipo de prestador no admitido.' });
  if (typeof entrada.disponibilidadDeclarada !== 'boolean') errores.push({ campo: 'disponibilidadDeclarada', motivo: 'Debe ser verdadero o falso.' });
  const especialidades = Array.isArray(entrada.especialidadesIds) ? entrada.especialidadesIds : [];
  if (especialidades.length < limitesPerfil.especialidadesMinimo) errores.push({ campo: 'especialidadesIds', motivo: 'Indique al menos una especialidad.' });
  especialidades.forEach((id, i) => { if (typeof id !== 'string' || !uuid.test(id)) errores.push({ campo: `especialidadesIds[${i}]`, motivo: 'Identificador no válido.' }); });
  if (new Set(especialidades).size !== especialidades.length) errores.push({ campo: 'especialidadesIds', motivo: 'Las especialidades deben ser distintas.' });
  const distritos = Array.isArray(entrada.distritos) ? entrada.distritos : [];
  if (distritos.length < limitesPerfil.distritosMinimo || distritos.length > limitesPerfil.distritosMaximo) errores.push({ campo: 'distritos', motivo: 'Indique entre uno y cinco distritos.' });
  distritos.forEach((d, i) => { if (typeof d !== 'string' || !cobertura.has(d)) errores.push({ campo: `distritos[${i}]`, motivo: 'La zona no pertenece a los distritos de cobertura.' }); });
  if (new Set(distritos).size !== distritos.length) errores.push({ campo: 'distritos', motivo: 'Los distritos deben ser distintos.' });
  if (errores.length) throw new ErrorAplicacion(400, 'DATOS_INVALIDOS', 'Revise los datos enviados.', errores);
  return { nombrePublico, tipo: entrada.tipo as DatosPerfil['tipo'], experiencia, especialidadesIds: [...especialidades], distritos: [...distritos], disponibilidadDeclarada: entrada.disponibilidadDeclarada };
}
