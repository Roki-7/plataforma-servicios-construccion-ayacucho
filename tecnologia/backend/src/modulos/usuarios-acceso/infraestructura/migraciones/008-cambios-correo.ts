import type {MigrationInterface,QueryRunner} from 'typeorm';
export class CambiosCorreo1794830400008 implements MigrationInterface {
 async up(q:QueryRunner):Promise<void>{await q.query(`ALTER TABLE sesiones ADD CONSTRAINT uq_sesion_titular UNIQUE(id,usuario_id);
 CREATE TABLE cambios_correo(
 id uuid PRIMARY KEY,usuario_id uuid NOT NULL REFERENCES usuarios(id),sesion_solicitante_id uuid NOT NULL,
 nuevo_correo text NOT NULL CHECK(char_length(nuevo_correo) BETWEEN 1 AND 320 AND nuevo_correo ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
 nuevo_correo_canonico text COLLATE correo_001 GENERATED ALWAYS AS(lower(nuevo_correo COLLATE correo_001)) STORED NOT NULL,
 token_digest bytea NOT NULL UNIQUE CHECK(octet_length(token_digest)=32),solicitada_en timestamptz NOT NULL,vence_en timestamptz NOT NULL,
 autenticacion_acreditada_en timestamptz NOT NULL,confirmada_en timestamptz,invalidada_en timestamptz,version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 FOREIGN KEY(sesion_solicitante_id,usuario_id) REFERENCES sesiones(id,usuario_id),
 CHECK(vence_en=solicitada_en+interval '1800 seconds'),CHECK(autenticacion_acreditada_en<=solicitada_en AND solicitada_en-autenticacion_acreditada_en<=interval '300 seconds'),CHECK(confirmada_en IS NULL OR invalidada_en IS NULL));
 CREATE INDEX cambios_correo_usuario_estado ON cambios_correo(usuario_id,confirmada_en,invalidada_en);`);}
 async down(q:QueryRunner):Promise<void>{await q.query('DROP TABLE cambios_correo; ALTER TABLE sesiones DROP CONSTRAINT uq_sesion_titular');}
}
