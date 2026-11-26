import { cuentasFicticias002 } from './datos.js';

export type Historia002 = 'HU03' | 'HU04' | 'HU05' | 'HU25';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export function datasetFicticio002(historia: Historia002) {
  const clasificaciones = [
    { id: uuid(230), nombre: 'Clasificación de prueba 002', nivel: 1, categoriaPadreId: null, activa: true },
    { id: uuid(231), nombre: 'Subcategoría de prueba 002', nivel: 2, categoriaPadreId: uuid(230), activa: true },
  ] as const;
  const perfiles = [
    { prestadorId: uuid(240), cuentaId: cuentasFicticias002.prestador.id, nombrePublico: 'Prestador ficticio',
      tipo: 'TECNICO', disponibilidadDeclarada: true, especialidades: [uuid(231)], distritos: ['ayacucho'] },
    { prestadorId: uuid(241), cuentaId: cuentasFicticias002.prestadorAjeno.id, nombrePublico: 'Otro prestador ficticio',
      tipo: 'TRABAJADOR_DE_OFICIO', disponibilidadDeclarada: false, especialidades: [uuid(230)], distritos: ['carmen-alto'] },
  ] as const;
  const servicios = [
    { id: uuid(250), prestadorId: uuid(240), categoriaId: uuid(231), titulo: 'Servicio de prueba visible', estado: 'PUBLICADO' },
    { id: uuid(251), prestadorId: uuid(241), categoriaId: uuid(230), titulo: 'Servicio de prueba histórico', estado: 'RETIRADO' },
  ] as const;
  const referencias = [{ id: uuid(260), servicioId: uuid(251) }] as const;
  return { historia, cuentas: cuentasFicticias002, perfiles, clasificaciones,
    servicios: historia === 'HU03' ? [] : servicios, referencias: historia === 'HU04' || historia === 'HU25' ? referencias : [] };
}
