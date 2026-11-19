export const distritosCanonicos = {
  ayacucho: 'Ayacucho',
  'carmen-alto': 'Carmen Alto',
  'san-juan-bautista': 'San Juan Bautista',
  'jesus-nazareno': 'Jesús Nazareno',
  'andres-avelino-caceres-dorregaray': 'Andrés Avelino Cáceres Dorregaray',
} as const;

export type DistritoCodigo = keyof typeof distritosCanonicos;
export type JerarquiaClasificacion = { nivel: 1; categoriaPadreId: null } | { nivel: 2; categoriaPadreId: string };
export type Clasificacion = Readonly<JerarquiaClasificacion & { id: string; nombre: string; activa: boolean; version: number }>;

export function clasificacionActiva(clasificacion: Clasificacion, padre?: Clasificacion): boolean {
  return clasificacion.activa && (clasificacion.nivel === 1 ||
    (padre?.nivel === 1 && padre.id === clasificacion.categoriaPadreId && padre.activa));
}
