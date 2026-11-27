import type { ValorJson } from '../../../compartido/aplicacion/transaccion.js';
import { ErrorAplicacion } from '../../../compartido/dominio/errores.js';
import type { CategoriasDeOferta } from '../../catalogo/api-publica.js';
import type { LecturasDePrestadores, PrestadoresApi } from '../../prestadores/api-publica.js';
import type { IdentidadAcceso } from '../../usuarios-acceso/api-publica.js';
import { decidirAcceso } from '../dominio/politica-acceso.js';
import type { Solicitud } from '../dominio/solicitud.js';
import type { EstadoSolicitud } from '../dominio/tipos.js';
import type { AutoriaDeCotizacion } from './puertos/cotizaciones.js';
import type { RepositorioOportunidades } from './puertos/repositorios.js';

export function exigirPrestadorHabilitado(identidad: IdentidadAcceso): void {
  if (!identidad.perfiles.includes('prestador')) throw new ErrorAplicacion(403, 'SIN_PERMISO', 'Se requiere un perfil de prestador habilitado.');
}

export class OportunidadesServicio {
  constructor(
    private readonly repositorio: RepositorioOportunidades,
    private readonly prestadores: PrestadoresApi & Pick<LecturasDePrestadores, 'distritosDe'>,
    private readonly catalogo: CategoriasDeOferta,
    private readonly autoria: AutoriaDeCotizacion,
  ) {}

  private async cobertura(prestadorId: string) {
    const [categorias, distritos] = await Promise.all([this.catalogo.categoriasDeOferta(prestadorId), this.prestadores.distritosDe(prestadorId)]);
    return { categorias, distritos };
  }

  async listar(identidad: IdentidadAcceso, pagina = 1, tamano = 20): Promise<ValorJson> {
    exigirPrestadorHabilitado(identidad);
    const { cuentaId } = identidad;
    const perfil = await this.prestadores.perfilDeCuenta(cuentaId);
    if (!perfil) return { elementos: [], total: 0, pagina, tamano };
    const { categorias, distritos } = await this.cobertura(perfil.prestadorId);
    const resultado = await this.repositorio.listarAbiertas(cuentaId, perfil.prestadorId, [...categorias], distritos, pagina, tamano);
    return {
      elementos: resultado.elementos.map(f => {
        const decision = decidirAcceso({ solicitud: { ...f, estado: 'ABIERTA' }, actor: { cuentaId, tienePerfilPrestador: true }, compatible: f.tipo === 'PUBLICADA', autorNoRetirado: false });
        return { solicitudId: f.solicitudId, tipo: f.tipo, categoriaId: f.categoriaId, distrito: f.distrito, fechaDesde: f.fechaDesde,
          ...(f.fechaHasta ? { fechaHasta: f.fechaHasta } : {}), descripcionCorta: f.descripcionCorta, versionTrabajo: f.versionTrabajo, publicadaEn: f.publicadaEn.toISOString(),
          hayFotografias: f.hayFotografias, fotografiasCompartidas: decision.fotografias === 'VISIBLES' };
      }),
      total: resultado.total, pagina, tamano,
    };
  }

  async listarComoPrestador(identidad: IdentidadAcceso, estado: EstadoSolicitud | undefined, pagina: number, tamano: number) {
    exigirPrestadorHabilitado(identidad);
    const conAutoria = await this.autoria.solicitudesConNoRetirada(identidad.cuentaId);
    const resultado = await this.repositorio.listarComoPrestador(identidad.cuentaId, conAutoria, estado, pagina, tamano);
    return { ...resultado, conAutoria: new Set(conAutoria) };
  }

  private async esCompatible(solicitud: Solicitud, cuentaId: string): Promise<boolean> {
    if (solicitud.tipo !== 'PUBLICADA' || solicitud.estado !== 'ABIERTA' || !solicitud.categoriaId || !solicitud.distrito) return false;
    const perfil = await this.prestadores.perfilDeCuenta(cuentaId);
    if (!perfil) return false;
    const { categorias, distritos } = await this.cobertura(perfil.prestadorId);
    return categorias.has(solicitud.categoriaId) && distritos.includes(solicitud.distrito);
  }

  async decidir(solicitud: Solicitud, identidad: IdentidadAcceso) {
    const actor = { cuentaId: identidad.cuentaId, tienePerfilPrestador: identidad.perfiles.includes('prestador') };
    if (!actor.tienePerfilPrestador || solicitud.estado === 'BORRADOR' || solicitud.clienteCuentaId === actor.cuentaId) {
      return decidirAcceso({ solicitud, actor, compatible: false, autorNoRetirado: false });
    }
    const [compatible, autorNoRetirado] = await Promise.all([
      this.esCompatible(solicitud, actor.cuentaId), this.autoria.tieneNoRetirada(solicitud.id, actor.cuentaId),
    ]);
    return decidirAcceso({ solicitud, actor, compatible, autorNoRetirado });
  }
}
