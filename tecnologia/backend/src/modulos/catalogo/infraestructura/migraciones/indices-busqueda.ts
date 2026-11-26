import type { MigrationInterface, QueryRunner } from 'typeorm';

export class IndicesBusqueda1795000000006 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      -- Servicios visibles de un prestador, en el orden estable de las consultas públicas (id).
      CREATE INDEX catalogo_servicios_publicados_por_prestador ON catalogo_servicios (prestador_id, id) WHERE estado = 'PUBLICADO';
      -- Orden estable de prestadores: nombre sin distinguir mayúsculas y desempate por UUID.
      CREATE INDEX catalogo_proyeccion_orden ON catalogo_proyeccion_prestadores ((lower(nombre_publico)), prestador_id) WHERE publicable;
      -- Selección de prestadores por disponibilidad declarada.
      CREATE INDEX catalogo_proyeccion_disponibilidad ON catalogo_proyeccion_prestadores (disponibilidad_declarada) WHERE publicable;`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP INDEX catalogo_servicios_publicados_por_prestador; DROP INDEX catalogo_proyeccion_orden; DROP INDEX catalogo_proyeccion_disponibilidad;');
  }
}
