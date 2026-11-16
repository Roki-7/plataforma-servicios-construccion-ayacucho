import { EntitySchema } from 'typeorm';
export const fotografiaEntity = new EntitySchema({ name: 'Fotografia', tableName: 'fotografias_perfil', columns: {
  id: { type: 'uuid', primary: true }, usuarioId: { type: 'uuid', name: 'usuario_id' }, objetoClave: { type: 'text', name: 'objeto_clave', unique: true },
  mime: { type: 'text' }, bytes: { type: 'bigint' }, checksum: { type: 'bytea' }, estado: { type: 'text' }, creadaEn: { type: 'timestamptz', name: 'creada_en' }, vinculadaEn: { type: 'timestamptz', name: 'vinculada_en', nullable: true },
} });
