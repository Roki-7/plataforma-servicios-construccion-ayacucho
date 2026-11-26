import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `avisos_negocio` (003, R-05): Outbox de avisos de negocio de Solicitudes. Propiedad de Notificaciones. No toca `avisos_pendientes` ni el worker de correo.
 * Solo identificadores: sin texto libre, correo ni datos personales. La entrega, la visualización y la lectura son de la 006, que añadirá su propia migración.
 * La clave lógica es `tipo:solicitudId:versión:cuentaId` (la versión es `cierre` para el cierre) y la base de datos exige que coincida con sus columnas.
 */
export class AvisosNegocio1796000000003 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE avisos_negocio (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      cuenta_destinatario_id uuid NOT NULL,
      tipo text NOT NULL CHECK (tipo IN ('SOLICITUD_DIRIGIDA_PUBLICADA','SOLICITUD_CAMBIADA','SOLICITUD_CERRADA')),
      solicitud_id uuid NOT NULL,
      version_trabajo integer,
      clave_logica text NOT NULL,
      estado text NOT NULL DEFAULT 'REGISTRADO' CHECK (estado = 'REGISTRADO'),
      creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
      CHECK ((tipo = 'SOLICITUD_CERRADA' AND version_trabajo IS NULL) OR (tipo <> 'SOLICITUD_CERRADA' AND version_trabajo IS NOT NULL AND version_trabajo >= 1)),
      CHECK (clave_logica = tipo || ':' || solicitud_id::text || ':' || COALESCE(version_trabajo::text, 'cierre') || ':' || cuenta_destinatario_id::text)
    );
    CREATE UNIQUE INDEX avisos_negocio_clave_logica ON avisos_negocio (clave_logica);
    CREATE INDEX avisos_negocio_por_destinatario ON avisos_negocio (cuenta_destinatario_id, creado_en, id);
    CREATE INDEX avisos_negocio_por_estado ON avisos_negocio (estado, creado_en);`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE avisos_negocio');
  }
}
