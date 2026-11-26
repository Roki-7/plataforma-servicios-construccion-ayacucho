import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { Controller, Get, Param, Put, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Response } from 'express';
import request from 'supertest';
import type { PeticionIdentidad002 } from '../../../src/composicion/identidad-002.js';
import { aplicacionPorHistoria } from '../../soporte/prestadores-catalogo/aplicacion-por-historia.js';
import { registroValido } from '../../soporte/registro.js';

// Controlador de comprobación del arnés. Los casos de uso se conectan con cada historia.
@Controller()
class ControladorPrueba002 {
  @Get('servicios/mios')
  propios(@Req() req: PeticionIdentidad002, @Res({ passthrough: true }) res: Response) {
    return { identidad: req.identidad002, consulta: res.locals['consulta002'] };
  }

  @Get('servicios/:servicioId')
  publico(@Param('servicioId') servicioId: string) { return { servicioId }; }

  @Get('servicios')
  buscar(@Res({ passthrough: true }) res: Response) { return res.locals['consulta002']; }

  @Put('prestadores/perfil')
  perfil(@Req() req: PeticionIdentidad002) { return { cuenta: req.identidad002?.cuentaId }; }

  @Put('prestadores/perfil/trabajos/:trabajoId/fotografias/:fotografiaId')
  foto() { return { verificada: true }; }
}

const registro = { controladores: [ControladorPrueba002], operaciones: ['listarMisServicios002', 'obtenerServicioPublico002',
  'buscarServicios002', 'guardarMiPerfilProfesional002', 'reemplazarFotografiaPortafolio002'] };
const eventos: string[] = [];
const montar = () => aplicacionPorHistoria('HU04', registro, {
  cargar: async (app, datos) => {
    const http = request(app.app.getHttpServer());
    const persona = { ...registroValido(), correo: datos.cuentas.prestador.correo };
    const origen = 'https://localhost:8444';
    await http.post('/api/v1/cuentas').set('Origin', origen).set('Idempotency-Key', randomUUID()).send(persona).expect(201);
    const sesion = await http.post('/api/v1/sesiones').set('Origin', origen).send({ correo: persona.correo, contrasena: persona.contrasena }).expect(200);
    const token = String(sesion.body.tokenAcceso);
    const cuenta = await app.usuariosAcceso.exigir(token);
    const categoria = datos.clasificaciones[0];
    await app.db.query('INSERT INTO catalogo_clasificaciones(id,nombre,nombre_normalizado,nivel) VALUES($1,$2::varchar,$2::text,1)', [categoria.id, categoria.nombre]);
    return { token, cuenta, categoria, servicio: datos.servicios[0]!, trabajo: randomUUID(), foto: randomUUID() };
  },
  verificar: async (app, datos) => {
    const filas: unknown[] = await app.db.query('SELECT id FROM catalogo_clasificaciones WHERE id=$1', [datos.categoria.id]);
    return filas.length === 1 && Boolean(datos.servicio) && (await app.usuariosAcceso.exigir(datos.token)).cuentaId === datos.cuenta.cuentaId;
  },
}, { registrar: linea => eventos.push(linea) });

let e: Awaited<ReturnType<typeof montar>>;
beforeAll(async () => { e = await montar(); });
afterAll(async () => { await e?.cerrar(); });

test('arnés inicia con Nest, rutas base y datos de la historia listos', async () => {
  const http = request(e.app.getHttpServer());
  await http.get('/api/v1/salud').expect(200);
  await http.get('/api/v1/categorias').expect(404);
  const identidad = await http.get('/api/v1/servicios/mios').set('Authorization', `Bearer ${e.datos.token}`).expect(200);
  expect(identidad.body).toEqual({ identidad: e.datos.cuenta, consulta: { pagina: 1, tamano: 20 } });
  const publica = await http.get(`/api/v1/servicios/${e.datos.servicio.id}`).expect(200);
  expect(publica.body).toEqual({ servicioId: e.datos.servicio.id });
  await http.head('/api/v1/SERVICIOS/mios/').expect(401);
  await http.get('/api/v1/servicios/mios').set('Authorization', `Bearer ${'Z'.repeat(43)}`).expect(401, {
    codigo: 'SESION_NO_VALIDA', mensaje: 'Sesión no válida.', detalles: [],
  });
});

test('valida estrictamente consultas 002 sin modificar las consultas de la 001', async () => {
  const http = request(e.app.getHttpServer());
  await http.get('/api/v1/servicios?distrito=ayacucho&disponibilidad=false&pagina=2').expect(200, {
    distrito: 'ayacucho', disponibilidad: false, pagina: 2, tamano: 20,
  });
  for (const consulta of ['calificacion=5', 'pagina=1&%70agina=2', 'pagina=01', 'pagina=1e1', 'pagina=0', 'tamano=51',
    'disponibilidad=1', 'distrito=ajeno', 'distrito=%FF', 'categoria=no-uuid']) await http.get(`/api/v1/servicios?${consulta}`).expect(400);
  await http.get('/api/v1/salud?anterior=1').expect(200);
});

test('PUT valida cuerpo, origen, Bearer y límites, y redacta identidad y datos privados', async () => {
  const http = request(e.app.getHttpServer());
  const put = (ruta: string) => http.put(`/api/v1${ruta}`).set('Origin', e.config.origen)
    .set('Idempotency-Key', randomUUID()).set('Authorization', `Bearer ${e.datos.token}`);
  const perfil = { version: 0, nombrePublico: 'Nombre ficticio', tipo: 'TECNICO', experiencia: 'Experiencia de prueba',
    especialidadesIds: [e.datos.categoria.id], distritos: ['ayacucho'], disponibilidadDeclarada: true };
  await put('/prestadores/perfil').send({ ...perfil, cuentaId: 'suplantacion-privada' }).expect(400);
  await put('/prestadores/perfil').set('Origin', 'https://ajeno.example.invalid').send(perfil).expect(403);
  await put('/prestadores/perfil').set('Content-Length', '65537').expect(413);
  const ok = await put('/prestadores/perfil').send(perfil).expect(200);
  expect(ok.body).toEqual({ cuenta: e.datos.cuenta.cuentaId });
  expect(ok.headers['cache-control']).toBe('no-store');
  expect(ok.headers['referrer-policy']).toBe('no-referrer');
  expect(ok.headers['x-content-type-options']).toBe('nosniff');
  const ruta = `/prestadores/perfil/trabajos/${e.datos.trabajo}/fotografias/${e.datos.foto}`;
  await put(ruta).set('Content-Length', '14000001').expect(413);
  const foto = (longitud: number) => ({ versionTrabajo: 1, tipoMime: 'image/png', contenidoBase64: Buffer.alloc(longitud).toString('base64') });
  expect((await put(ruta).send(foto(10000001)).expect(413)).body.codigo).toBe('ARCHIVO_DEMASIADO_GRANDE');
  await put(ruta).send(foto(10000000)).expect(200);
  const log = eventos.join('\n');
  expect(log).toContain('"metodo":"PUT"');
  expect(log).toContain('/prestadores/perfil/trabajos/:redactado/fotografias/:redactado');
  for (const dato of [e.datos.trabajo, e.datos.foto, e.datos.token, e.datos.cuenta.cuentaId, 'suplantacion-privada', perfil.experiencia]) {
    expect(log).not.toContain(dato);
  }
});

test('arnés impide ejecutar si faltan rutas contractuales o los datos no están listos', async () => {
  const cargar = async () => undefined;
  const verificar = async () => false;
  await expect(aplicacionPorHistoria('HU04', { controladores: [], operaciones: ['listarMisServicios002'] }, { cargar, verificar })).rejects.toThrow('router no coincide');
  await expect(aplicacionPorHistoria('HU04', registro, { cargar, verificar })).rejects.toThrow('datos de HU04 no están listos');
});
