import { EntitySchema } from 'typeorm';
export interface RecuperacionEntity { id: string; usuarioId: string; tokenDigest: Buffer; emitidaEn: Date; venceEn: Date; consumidaEn: Date | null; invalidadaEn: Date | null; version: string }
export const recuperacionEntity = new EntitySchema<RecuperacionEntity>({ name: 'Recuperacion', tableName: 'recuperaciones_acceso', columns: {
  id: { type: 'uuid', primary: true }, usuarioId: { type: 'uuid', name: 'usuario_id' }, tokenDigest: { type: 'bytea', name: 'token_digest', select: false },
  emitidaEn: { type: 'timestamptz', name: 'emitida_en' }, venceEn: { type: 'timestamptz', name: 'vence_en' }, consumidaEn: { type: 'timestamptz', name: 'consumida_en', nullable: true }, invalidadaEn: { type: 'timestamptz', name: 'invalidada_en', nullable: true }, version: { type: 'bigint', default: 1 },
} });
