import { EntitySchema } from 'typeorm';
export const sesionEntity = new EntitySchema({ name: 'Sesion', tableName: 'sesiones', columns: {
  id: { type: 'uuid', primary: true }, usuarioId: { type: 'uuid', name: 'usuario_id' }, accesoDigest: { type: 'bytea', name: 'acceso_digest', unique: true, select: false }, accesoVenceEn: { type: 'timestamptz', name: 'acceso_vence_en' },
  renovacionDigest: { type: 'bytea', name: 'renovacion_digest', unique: true, select: false }, renovacionVenceEn: { type: 'timestamptz', name: 'renovacion_vence_en' }, autenticadaConContrasenaEn: { type: 'timestamptz', name: 'autenticada_con_contrasena_en', nullable: true },
  creadaEn: { type: 'timestamptz', name: 'creada_en' }, renovadaEn: { type: 'timestamptz', name: 'renovada_en' }, revocadaEn: { type: 'timestamptz', name: 'revocada_en', nullable: true }, version: { type: 'bigint', default: 1 },
} });
