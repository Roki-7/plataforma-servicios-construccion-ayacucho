import { randomUUID } from 'node:crypto';
import request, { type Response, type Test } from 'supertest';
import { Ajv2020 } from 'ajv/dist/2020.js';
import type { AnySchemaObject, ValidateFunction } from 'ajv';
import { readFile } from 'node:fs/promises';
import { entornoPerfil, imagenPerfil } from '../../soporte/perfil.js';
import { cuentaCorreoFicticia, solicitarCorreo } from '../../soporte/correo.js';
import { origen, registroValido } from '../../soporte/registro.js';
import { cargarContrato } from '../../soporte/contrato.js';
import { datosRecuperacion, emitirEnlace } from '../../soporte/recuperacion.js';
import { datosCambioContrasena } from '../../soporte/contrasena.js';

const operaciones = [
  ['post', '/cuentas', 201], ['post', '/sesiones', 200], ['delete', '/sesiones/actual', 204],
  ['post', '/sesiones/renovacion', 200], ['get', '/sesiones/csrf', 200], ['post', '/sesiones/reautenticacion', 200],
  ['post', '/recuperaciones', 202], ['post', '/recuperaciones/{token}', 200], ['get', '/perfil', 200],
  ['patch', '/perfil', 200], ['post', '/perfil/perfiles', 200], ['post', '/perfil/cambios-correo', 202],
  ['post', '/perfil/cambios-correo/{token}/confirmacion', 200], ['post', '/perfil/cambios-contrasena', 200],
  ['post', '/perfil/fotografias', 201], ['get', '/perfil/fotografias/{fotografiaId}', 200], ['get', '/salud', 200],
] as const;
type Operacion = typeof operaciones[number];
type Esquema = {$ref?: string; content?: {'application/json': {schema: AnySchemaObject}}};
type Detalle = {parameters?: {$ref: string}[]; responses: Record<string, Esquema>; requestBody?: Esquema; 'x-limite-cuerpo-bytes': number};
type Contrato = AnySchemaObject & {paths: Record<string, Record<string, Detalle>>; components: {responses: Record<string, Esquema>; schemas: Record<string, AnySchemaObject>}};
let e: Awaited<ReturnType<typeof entornoPerfil>>;
let contrato: Contrato;
let validador: Ajv2020;
const schemas = new Map<AnySchemaObject, ValidateFunction>();
beforeAll(async () => {
  e = await entornoPerfil();
  contrato = await cargarContrato() as Contrato;
  validador = new Ajv2020({strict: false, validateFormats: false});
  validador.addSchema(contrato, 'contrato');
});
afterAll(async () => { await e?.cerrar(); });

function validar(detalle: Detalle, r: Response, estado: number, codigo?: string) {
  expect(r.status).toBe(estado);
  const respuesta = detalle.responses[estado]!;
  expect(respuesta).toBeDefined();
  const componente = respuesta.$ref?.split('/').at(-1);
  const schema = (componente ? contrato.components.responses[componente] : respuesta)?.content?.['application/json'].schema;
  if (schema) {
    let comprobar = schemas.get(schema);
    if (!comprobar) {
      comprobar = validador.compile(JSON.parse(JSON.stringify(schema).replaceAll('"#/components/', '"contrato#/components/')));
      schemas.set(schema, comprobar);
    }
    expect(comprobar(r.body)).toBe(true);
  }
  if (codigo) expect(r.body.codigo).toBe(codigo);
  expect(r.headers['cache-control']).toBe('no-store');
  if (estado >= 400) expect(r.headers['set-cookie']).toBeUndefined();
}

test('X-08 inventario exacto de 17 rutas publicadas y contrato empaquetado', async () => {
  const enumeradas = operaciones.map(([m, p]) => m + ' ' + p).sort();
  const contratadas = Object.entries(contrato.paths).flatMap(([p, op]) => Object.keys(op).filter(m => ['get', 'post', 'patch', 'delete'].includes(m)).map(m => m + ' ' + p)).sort();
  expect(contratadas).toEqual(enumeradas);
  const app = e.app.getHttpAdapter().getInstance() as {router: {stack: {route?: {path: string; methods: Record<string, boolean>}}[]}};
  const publicadas = app.router.stack.flatMap(layer => layer.route ? Object.keys(layer.route.methods).map(m => m + ' ' + layer.route!.path.replace('/api/v1', '').replace(/:([A-Za-z]+)/g, '{$1}')) : []).sort();
  expect(publicadas).toEqual(enumeradas);
  expect(JSON.parse(await readFile('contracts/openapi.json', 'utf8'))).toEqual(contrato);
  expect(operaciones.filter(([m]) => m !== 'get')).toHaveLength(13);
  for (const [m, p] of operaciones) {
    const detalle = contrato.paths[p]![m]!;
    expect(detalle.responses['413']).toBeDefined();
    expect(Boolean(detalle.parameters?.some(x => x.$ref.endsWith('/Origin')))).toBe(m !== 'get');
    const nombre = detalle.requestBody?.content?.['application/json'].schema.$ref?.split('/').at(-1);
    if (nombre) expect(contrato.components.schemas[nombre]?.['additionalProperties']).toBe(false);
  }
  for (const [nombre, campo] of [['Registro', 'contrasena'], ['ConsumirRecuperacion', 'nuevaContrasena'], ['CambioContrasena', 'nuevaContrasena']] as const) {
    expect(contrato.components.schemas[nombre]?.['properties']?.[campo]).toMatchObject({minLength:15,maxLength:128,writeOnly:true});
  }
});

async function preparar([metodo, patron]: Operacion) {
  const c = await cuentaCorreoFicticia(e.db);
  let ruta: string = patron;
  let cuerpo: object | undefined;
  const cabeceras: Record<string, string> = { Authorization:'Bearer ' + c.acceso, 'Idempotency-Key': randomUUID() };
  if (metodo !== 'get') cabeceras['Origin'] = origen;
  switch (patron) {
    case '/cuentas': cuerpo = {...registroValido(), fotografia: await imagenPerfil()}; break;
    case '/sesiones': cuerpo = {correo: c.correo, contrasena: c.contrasena}; break;
    case '/sesiones/csrf':
    case '/sesiones/renovacion': {
      const sesiones = await e.post('/sesiones', {correo: c.correo, contrasena:c.contrasena}).expect(200);
      cabeceras['Cookie'] = String(sesiones.headers['set-cookie']).split(';')[0]!;
      if (metodo === 'get') cabeceras['Sec-Fetch-Site'] = 'same-origin';
      else cabeceras['X-CSRF-Token'] = sesiones.body.csrfToken;
      break;
    }
    case '/sesiones/reautenticacion': cuerpo = {contrasenaActual: c.contrasena}; break;
    case '/recuperaciones': cuerpo = {correo:c.correo}; break;
    case '/recuperaciones/{token}': {
      ruta = patron.replace('{token}', (await emitirEnlace(e,c.correo)).token);
      cuerpo = datosRecuperacion();
      break;
    }
    case '/perfil': if (metodo === 'patch') cuerpo = {version:1, nombreMostrar:'Perfil actualizado'}; break;
    case '/perfil/perfiles': cuerpo = {perfil:'prestador',version:1,confirmacionExplicita:true}; break;
    case '/perfil/cambios-correo': cuerpo = {nuevoCorreo: randomUUID()+'@example.invalid', version:1}; break;
    case '/perfil/cambios-correo/{token}/confirmacion': {
      const pendiente = await solicitarCorreo(e,c.acceso);
      ruta = patron.replace('{token}', pendiente.token);
      cuerpo = {version:1, versionDesafio:1};
      break;
    }
    case '/perfil/cambios-contrasena': cuerpo = datosCambioContrasena(c.contrasena); break;
    case '/perfil/fotografias': cuerpo = await imagenPerfil(); break;
    case '/perfil/fotografias/{fotografiaId}': {
      const foto = await e.post('/perfil/fotografias', await imagenPerfil(), randomUUID(), c.acceso).expect(201);
      ruta = patron.replace('{fotografiaId}', foto.body.fotografiaId);
      break;
    }
  }
  const crear = (cambios: Partial<Record<string, string | undefined>> = {}, rutaAlterna = ruta): Test => {
    const req = request(e.app.getHttpServer())[metodo]('/api/v1'+rutaAlterna);
    for (const [k,v] of Object.entries({...cabeceras,...cambios})) if (v !== undefined) req.set(k,v);
    return req;
  };
  const enviar = (req: Test, x = cuerpo) => x === undefined ? req : req.send(x);
  return {c, ruta, cuerpo, crear, enviar};
}

test.each(operaciones)('X-08 %s %s límites de transporte, cabeceras, esquema y control positivo', async (metodo, patron, ok) => {
  const control = await preparar([metodo,patron,ok] as Operacion);
  const {c, ruta, cuerpo, crear, enviar} = control;
  const detalle = contrato.paths[patron]![metodo]!;
  const max = detalle['x-limite-cuerpo-bytes'];
  const texto = JSON.stringify(cuerpo ?? {});
  const exacto = texto + ' '.repeat(max - Buffer.byteLength(texto));
  const textoJson = (req: Test, texto: string) => req.type('json').send(texto);
  const estado = async () => JSON.stringify({
    cuenta: await e.db.query('SELECT * FROM usuarios WHERE id=$1',[c.id]),
    sesiones: await e.db.query('SELECT * FROM sesiones WHERE usuario_id=$1 ORDER BY id',[c.id]),
    enlaces: await e.db.query('SELECT * FROM recuperaciones_acceso WHERE usuario_id=$1 ORDER BY id',[c.id]),
  });
  const antes = await estado();
  // El límite de cabecera se decide antes de leer el stream. No seguir
  // transmitiendo después de la respuesta anticipada evita reiniciar el socket.
  validar(detalle, await crear().type('json').set('Content-Length', String(max + 1)), 413,'CUERPO_DEMASIADO_GRANDE');
  if (cuerpo === undefined) validar(detalle, await textoJson(crear(), exacto), 400,'DATOS_INVALIDOS');
  else {
    validar(detalle, await textoJson(crear(), '{'), 400,'DATOS_INVALIDOS');
    validar(detalle, await enviar(crear(), {...cuerpo, campoFueraDeContrato: true}), 400,'PROPIEDAD_NO_ADMITIDA');
  }
  if (metodo !== 'get') {
    for (const [origin, status, codigo] of [
      [undefined, 400, 'CABECERA_REQUERIDA'],
      ['malformado', 400, 'DATOS_INVALIDOS'],
      ['https://ajeno.example.invalid', 403, 'ORIGEN_NO_ADMITIDO'],
    ] as const) validar(detalle, await enviar(crear({Origin:origin})),status,codigo);
  }
  if (detalle.parameters?.some(p => p.$ref.endsWith('/IdempotencyKey'))) {
    validar(detalle,await enviar(crear({'Idempotency-Key':undefined})),400,'CABECERA_REQUERIDA');
  }
  if (patron.includes('{')) {
    const invalida = ruta.split('/').map((segmento, i) => patron.split('/')[i]?.startsWith('{') ? 'invalido' : segmento).join('/');
    validar(detalle,await enviar(crear({},invalida)),400,'DATOS_INVALIDOS');
  }
  expect((await estado()) === antes).toBe(true);
  const r = cuerpo === undefined ? await crear() : await textoJson(crear(),exacto);
  validar(detalle,r,ok);
  if (['/sesiones','/sesiones/renovacion','/sesiones/actual'].includes(patron)) expect(Boolean(r.headers['set-cookie'])).toBe(true);
  else expect(r.headers['set-cookie']).toBeUndefined();
}, 45000);

test('X-08 enum de rechazos semánticos 401/403/404/409/422/429/503', async () => {
  const c = await cuentaCorreoFicticia(e.db);
  const detalle = (p: string, m = 'post') => contrato.paths[p]![m]!;
  validar(detalle('/perfil','get'),await e.get(),401,'NO_AUTENTICADO');
  const login = await e.post('/sesiones',{correo:c.correo,contrasena:c.contrasena}).expect(200);
  const renovar = await e.post('/sesiones/renovacion',undefined).set('Cookie',String(login.headers['set-cookie']).split(';')[0]!);
  validar(detalle('/sesiones/renovacion'),renovar,403,'CSRF_NO_VALIDO');
  validar(detalle('/perfil/fotografias/{fotografiaId}','get'),await e.get(c.acceso,'/perfil/fotografias/'+randomUUID()),404,'RECURSO_NO_DISPONIBLE');
  const clave = randomUUID();
  await e.patch(c.acceso,{version:1,nombreMostrar:'Cambio legítimo'},clave).expect(200);
  validar(detalle('/perfil','patch'),await e.patch(c.acceso,{version:1,nombreMostrar:'Otra petición'},clave),409,'CLAVE_IDEMPOTENCIA_REUTILIZADA');
  validar(detalle('/perfil','patch'),await e.patch(c.acceso,{version:1,nombreMostrar:'Otra petición'}),409,'VERSION_DESACTUALIZADA');
  validar(detalle('/perfil/cambios-contrasena'),await e.post('/perfil/cambios-contrasena',datosCambioContrasena('Incorrecta',undefined,2),randomUUID(),c.acceso),422,'CONTRASENA_ACTUAL_INVALIDA');
  for(let intento=1;intento<=5;intento++) {
    const r=await e.post('/sesiones',{correo:c.correo,contrasena:'Incorrecta'});
    validar(detalle('/sesiones'),r,intento===5?429:401,intento===5?'CUENTA_TEMPORALMENTE_BLOQUEADA':'CREDENCIALES_INVALIDAS');
    if(intento===5) expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
  }
  const preparada = e.catalogo.preparada;
  try {
    e.catalogo.preparada = async () => false;
    validar(detalle('/cuentas'),await e.post('/cuentas',registroValido()),503,'DEPENDENCIA_NO_DISPONIBLE');
  } finally { e.catalogo.preparada = preparada; }
});

test('X-08 distingue el exceso de foto decodificada y el límite ordinario de alta sin foto', async () => {
  const c = await cuentaCorreoFicticia(e.db);
  const r = await e.post('/perfil/fotografias',{tipoContenido:'image/png',contenidoBase64:Buffer.alloc(10000001).toString('base64')},randomUUID(),c.acceso);
  validar(contrato.paths['/perfil/fotografias']!.post!,r,413,'ARCHIVO_DEMASIADO_GRANDE');
  const alta = JSON.stringify(registroValido());
  const enviar = (a: number) => request(e.app.getHttpServer()).post('/api/v1/cuentas').set('Origin',origen).set('Idempotency-Key',randomUUID()).type('json').send(alta+' '.repeat(a-Buffer.byteLength(alta)));
  validar(contrato.paths['/cuentas']!.post!,await enviar(65537),413,'CUERPO_DEMASIADO_GRANDE');
  validar(contrato.paths['/cuentas']!.post!,await enviar(65536),201);
});
