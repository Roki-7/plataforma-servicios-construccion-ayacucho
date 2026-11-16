module.exports = {
  forbidden: [
    { name: 'dominio-sin-detalles', severity: 'error', from: { path: '/dominio/' }, to: { path: 'node_modules|/infraestructura/|/presentacion/|/composicion/|/aplicacion/|/modulos/notificaciones/' } },
    { name: 'aplicacion-sin-implementaciones', severity: 'error', from: { path: '/aplicacion/' }, to: { path: '/infraestructura/|/presentacion/|/composicion/|node_modules/(?:@nestjs|typeorm|react|express|nodemailer|@aws-sdk)' } },
    { name: 'frontend-puro', severity: 'error', from: { path: 'frontend/src/features/.*/(?:modelos|aplicacion)/' }, to: { path: 'node_modules/(?:react|axios)|/infraestructura/|/presentacion/' } },
    { name: 'usuarios-no-importa-notificaciones-privadas', severity: 'error', from: { path: '/modulos/usuarios-acceso/' }, to: { path: '/modulos/notificaciones/(?!api-publica\\.)' } },
    { name: 'notificaciones-no-importa-usuarios-privados', severity: 'error', from: { path: '/modulos/notificaciones/' }, to: { path: '/modulos/usuarios-acceso/(?!api-publica\\.)' } },
    { name: 'sin-ciclos', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' }, enhancedResolveOptions: { conditionNames: ['import', 'node', 'default'], exportsFields: ['exports'] } },
};
