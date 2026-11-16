import { EntitySchema } from 'typeorm';

export interface CuentaEntity {
  id: string; correo: string; correoCanonico: string; nombreMostrar: string; contrasenaHash: string; versionCredencial: string;
  telefono: string | null; distrito: string | null; fotografiaId: string | null; politicaPrivacidadVersion: string;
  privacidadAceptadaEn: Date; fallosConsecutivos: number; bloqueadaHasta: Date | null; version: string; creadaEn: Date; actualizadaEn: Date;
}
export const cuentaEntity = new EntitySchema<CuentaEntity>({
  name: 'Cuenta', tableName: 'usuarios', columns: {
    id: { type: 'uuid', primary: true }, correo: { type: 'text' }, correoCanonico: { type: 'text', name: 'correo_canonico', generatedType: 'STORED', asExpression: 'lower(correo COLLATE correo_001)', insert: false, update: false },
    nombreMostrar: { type: 'text', name: 'nombre_mostrar' }, contrasenaHash: { type: 'text', name: 'contrasena_hash', select: false }, versionCredencial: { type: 'bigint', name: 'version_credencial', default: 1 },
    telefono: { type: 'text', nullable: true }, distrito: { type: 'text', nullable: true }, fotografiaId: { type: 'uuid', name: 'fotografia_id', nullable: true },
    politicaPrivacidadVersion: { type: 'text', name: 'politica_privacidad_version' }, privacidadAceptadaEn: { type: 'timestamptz', name: 'privacidad_aceptada_en' },
    fallosConsecutivos: { type: 'integer', name: 'fallos_consecutivos', default: 0 }, bloqueadaHasta: { type: 'timestamptz', name: 'bloqueada_hasta', nullable: true }, version: { type: 'bigint', default: 1 },
    creadaEn: { type: 'timestamptz', name: 'creada_en' }, actualizadaEn: { type: 'timestamptz', name: 'actualizada_en' },
  },
});
export const perfilHabilitadoEntity = new EntitySchema({ name: 'PerfilHabilitado', tableName: 'perfiles_habilitados', columns: {
  usuarioId: { type: 'uuid', name: 'usuario_id', primary: true }, perfil: { type: 'text', primary: true }, habilitadoEn: { type: 'timestamptz', name: 'habilitado_en' }, confirmadoPorTitularEn: { type: 'timestamptz', name: 'confirmado_por_titular_en' },
} });
