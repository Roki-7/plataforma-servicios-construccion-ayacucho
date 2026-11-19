import type { Idempotencia002, ResultadoIdempotente } from '../../../compartido/aplicacion/idempotencia.js';
import type { ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import { uuidEnMinusculas } from '../../../compartido/dominio/identificadores.js';
import type { ClasificacionAdmin, GestionClasificaciones } from '../../catalogo/api-publica.js';
import { auditarCategoria, type AccionAuditada } from './auditoria-rf39.js';
import type { AutorizarGestionCategorias } from './autorizar-gestion-categorias.js';
import type { AuditoriaRf39 } from './puertos.js';

/** Identidad ya autenticada por el guard. El token solo sirve para revalidar la sesión antes de abrir la transacción. */
export interface ActorAdmin { readonly token: string }
export interface DependenciasCoordinacion {
  readonly autorizacion: AutorizarGestionCategorias; readonly idempotencia: Idempotencia002;
  readonly clasificaciones: GestionClasificaciones; readonly auditoria: AuditoriaRf39;
}

/**
 * Orden de bloqueos: permiso RF39, idempotencia, revisión de Catálogo, raíz y subcategoría. La mutación, la auditoría y el resultado idempotente
 * comparten una transacción: si la auditoría falla, tampoco se confirma el cambio ni se registra un éxito idempotente.
 */
export class CoordinarCategorias {
  constructor(private readonly d: DependenciasCoordinacion) {}

  async listar(actor: ActorAdmin): Promise<ValorJson> {
    const cuentaId = await this.d.autorizacion.identificar(actor.token);
    await this.d.autorizacion.exigirParaLectura(cuentaId);
    return { categorias: await this.d.clasificaciones.listarAdmin() } as unknown as ValorJson;
  }

  private async ejecutar(actor: ActorAdmin, e: {
    clave: string; metodo: 'POST' | 'PATCH'; rutaLogica: string; ids: Record<string, string>; version?: number; cuerpo: ValorJson; http: number;
    trabajo: (tx: Parameters<GestionClasificaciones['crear']>[0], cuentaId: string) => Promise<ValorJson>;
  }): Promise<ResultadoIdempotente> {
    const cuentaId = await this.d.autorizacion.identificar(actor.token);
    return this.d.idempotencia.ejecutar002({
      actor: cuentaId, metodo: e.metodo, rutaLogica: e.rutaLogica, clave: e.clave, ids: e.ids, ...(e.version !== undefined ? { version: e.version } : {}), cuerpo: e.cuerpo,
      autorizar: tx => this.d.autorizacion.exigirEnTransaccion(tx, cuentaId),
    }, async tx => ({ http: e.http, cuerpo: await e.trabajo(tx, cuentaId) }));
  }

  private auditar = (auditoria: AuditoriaRf39, tx: Parameters<GestionClasificaciones['crear']>[0], responsable: string, accion: AccionAuditada, c: ClasificacionAdmin, motivo: string) =>
    auditarCategoria(auditoria, tx, { responsable, accion, categoriaId: c.categoriaId, motivo });

  crear(actor: ActorAdmin, clave: string, cuerpo: { nombre: string; categoriaPadreId?: string | null; motivo: string }) {
    const padre = cuerpo.categoriaPadreId ? uuidEnMinusculas(cuerpo.categoriaPadreId) : null;
    return this.ejecutar(actor, { clave, metodo: 'POST', rutaLogica: '/admin/categorias', ids: {}, http: 201, cuerpo: { nombre: cuerpo.nombre, categoriaPadreId: padre, motivo: cuerpo.motivo },
      trabajo: async (tx, cuentaId) => {
        const c = await this.d.clasificaciones.crear(tx, { nombre: cuerpo.nombre, padreId: padre });
        await this.auditar(this.d.auditoria, tx, cuentaId, 'CATEGORIA_CREADA', c, cuerpo.motivo);
        return c as unknown as ValorJson;
      } });
  }

  editar(actor: ActorAdmin, clave: string, idEntrada: string, cuerpo: { version: number; nombre: string; motivo: string }) {
    const id = uuidEnMinusculas(idEntrada);
    return this.ejecutar(actor, { clave, metodo: 'PATCH', rutaLogica: '/admin/categorias/{categoriaId}', ids: { categoriaId: id }, version: cuerpo.version, http: 200,
      cuerpo: { nombre: cuerpo.nombre, motivo: cuerpo.motivo },
      trabajo: async (tx, cuentaId) => {
        const c = await this.d.clasificaciones.editar(tx, id, cuerpo.version, cuerpo.nombre);
        await this.auditar(this.d.auditoria, tx, cuentaId, 'CATEGORIA_EDITADA', c, cuerpo.motivo);
        return c as unknown as ValorJson;
      } });
  }

  activar(actor: ActorAdmin, clave: string, idEntrada: string, cuerpo: { version: number; motivo: string }) {
    const id = uuidEnMinusculas(idEntrada);
    return this.ejecutar(actor, { clave, metodo: 'POST', rutaLogica: '/admin/categorias/{categoriaId}/activaciones', ids: { categoriaId: id }, version: cuerpo.version, http: 200,
      cuerpo: { motivo: cuerpo.motivo },
      trabajo: async (tx, cuentaId) => {
        const c = await this.d.clasificaciones.activar(tx, id, cuerpo.version);
        await this.auditar(this.d.auditoria, tx, cuentaId, 'CATEGORIA_ACTIVADA', c, cuerpo.motivo);
        return c as unknown as ValorJson;
      } });
  }

  previsualizar(actor: ActorAdmin, clave: string, idEntrada: string, cuerpo: { version: number }) {
    const id = uuidEnMinusculas(idEntrada);
    return this.ejecutar(actor, { clave, metodo: 'POST', rutaLogica: '/admin/categorias/{categoriaId}/previsualizaciones-desactivacion', ids: { categoriaId: id }, version: cuerpo.version, http: 201,
      cuerpo: {}, trabajo: async (tx, cuentaId) => await this.d.clasificaciones.previsualizarDesactivacion(tx, id, cuerpo.version, cuentaId) as unknown as ValorJson });
  }

  desactivar(actor: ActorAdmin, clave: string, idEntrada: string, cuerpo: { confirmacionId: string; version: number; motivo: string }) {
    const id = uuidEnMinusculas(idEntrada);
    const confirmacionId = uuidEnMinusculas(cuerpo.confirmacionId);
    return this.ejecutar(actor, { clave, metodo: 'POST', rutaLogica: '/admin/categorias/{categoriaId}/desactivaciones', ids: { categoriaId: id }, version: cuerpo.version, http: 200,
      cuerpo: { confirmacionId, motivo: cuerpo.motivo },
      trabajo: async (tx, cuentaId) => {
        const c = await this.d.clasificaciones.desactivar(tx, id, cuerpo.version, confirmacionId, cuentaId);
        await this.auditar(this.d.auditoria, tx, cuentaId, 'CATEGORIA_DESACTIVADA', c, cuerpo.motivo);
        return c as unknown as ValorJson;
      } });
  }
}
