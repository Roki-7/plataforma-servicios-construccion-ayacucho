import { crearDataSource } from '../compartido/infraestructura/postgres/data-source.js';
import { Cuentas1794830400001 } from '../modulos/usuarios-acceso/infraestructura/migraciones/001-cuentas.js';
import { Sesiones1794830400002 } from '../modulos/usuarios-acceso/infraestructura/migraciones/002-sesiones.js';
import { Idempotencia1794830400003 } from '../compartido/infraestructura/postgres/migraciones/003-idempotencia.js';
import { Avisos1794830400004 } from '../modulos/notificaciones/infraestructura/migraciones/004-avisos.js';
import { Fotografias1794830400005 } from '../modulos/usuarios-acceso/infraestructura/migraciones/005-fotografias.js';
import { cuentaEntity, perfilHabilitadoEntity } from '../modulos/usuarios-acceso/infraestructura/persistencia/cuenta.entity.js';
import { sesionEntity } from '../modulos/usuarios-acceso/infraestructura/persistencia/sesion.entity.js';
import { fotografiaEntity } from '../modulos/usuarios-acceso/infraestructura/persistencia/fotografia.entity.js';
import { Recuperaciones1794830400006 } from '../modulos/usuarios-acceso/infraestructura/migraciones/006-recuperaciones.js';
import { recuperacionEntity } from '../modulos/usuarios-acceso/infraestructura/persistencia/recuperacion.entity.js';
import { Consentimientos1794830400007 } from '../modulos/usuarios-acceso/infraestructura/migraciones/007-consentimientos.js';
import { consentimientoEntity } from '../modulos/usuarios-acceso/infraestructura/persistencia/consentimiento.entity.js';
import {CambiosCorreo1794830400008} from '../modulos/usuarios-acceso/infraestructura/migraciones/008-cambios-correo.js';
import {cambioCorreoEntity} from '../modulos/usuarios-acceso/infraestructura/persistencia/cambio-correo.entity.js';

export function persistenciaFundacional(url: string) {
  return crearDataSource(url, { migrations: [Cuentas1794830400001, Sesiones1794830400002, Idempotencia1794830400003, Avisos1794830400004, Fotografias1794830400005, Recuperaciones1794830400006, Consentimientos1794830400007,CambiosCorreo1794830400008], entities: [cuentaEntity, perfilHabilitadoEntity, sesionEntity, fotografiaEntity, recuperacionEntity, consentimientoEntity,cambioCorreoEntity] });
}
