module.exports = {
  forbidden: [
    { name: 'dominio-sin-otro-modulo', severity: 'error', from: { path: '(^|/)modulos/([^/]+)/dominio/' }, to: { path: '(^|/)modulos/', pathNot: '(^|/)modulos/$2/' } },
    { name: 'puertos-usuarios-sin-persistencia', severity: 'error', from: { path: '/modulos/usuarios-acceso/aplicacion/puertos/' }, to: { path: 'node_modules/(?:typeorm|pg)(/|$)|/infraestructura/' } },
    { name: 'capas-puras-sin-http', severity: 'error', from: { path: '/dominio/|frontend/src/features/.*/(?:modelos|aplicacion)/' }, to: { path: '^(?:node:)?https?$|node_modules/(?:undici|node-fetch|axios)(/|$)' } },
    { name: 'dominio-sin-detalles', severity: 'error', from: { path: '/dominio/' }, to: { path: 'node_modules|/infraestructura/|/presentacion/|/composicion/|/aplicacion/|/modulos/notificaciones/' } },
    { name: 'aplicacion-sin-implementaciones', severity: 'error', from: { path: '/aplicacion/' }, to: { path: '/infraestructura/|/presentacion/|/composicion/|node_modules/(?:@nestjs|typeorm|react|express|nodemailer|@aws-sdk)' } },
    { name: 'frontend-puro', severity: 'error', from: { path: 'frontend/src/features/.*/(?:modelos|aplicacion)/' }, to: { path: 'node_modules/(?:react|axios)|/infraestructura/|/presentacion/' } },
    { name: 'usuarios-no-importa-notificaciones-privadas', severity: 'error', from: { path: '/modulos/usuarios-acceso/' }, to: { path: '/modulos/notificaciones/(?!api-publica\\.)' } },
    { name: 'notificaciones-no-importa-usuarios-privados', severity: 'error', from: { path: '/modulos/notificaciones/' }, to: { path: '/modulos/usuarios-acceso/(?!api-publica\\.)' } },
    { name: 'puertos-002-sin-persistencia', severity: 'error', from: { path: '/modulos/(?:prestadores|catalogo|administracion)/aplicacion/puertos/' }, to: { path: 'node_modules/(?:typeorm|pg|redis|@redis)(/|$)|/infraestructura/' } },
    { name: 'modulos-002-consumen-apis-publicas', severity: 'error', from: { path: '(^|/)modulos/(prestadores|catalogo|administracion)/' }, to: { path: '(^|/)modulos/[^/]+/', pathNot: '(^|/)modulos/(?:$2/|[^/]+/api-publica\\.)' } },
    { name: 'modulos-002-exponen-solo-apis-publicas', severity: 'error', from: { path: '(^|/)modulos/([^/]+)/' }, to: { path: '(^|/)modulos/(?:prestadores|catalogo|administracion)/(?!api-publica\\.)', pathNot: '(^|/)modulos/$2/' } },
    { name: 'sin-ciclos', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true, tsConfig: { fileName: 'tsconfig.json' }, enhancedResolveOptions: { conditionNames: ['import', 'node', 'default'], exportsFields: ['exports'] } },
};
