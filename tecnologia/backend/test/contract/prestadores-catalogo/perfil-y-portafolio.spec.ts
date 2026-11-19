import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { validarRespuesta002 } from '../../soporte/prestadores-catalogo/contrato-002.js';
import { almacenDePrueba002, clasificaciones002, montarHu03, perfilValido, type EntornoHu03 } from '../../soporte/prestadores-catalogo/fixtures-hu03.js';
import { base64, crearImagen, pngDeTamano } from '../../soporte/prestadores-catalogo/imagenes.js';

let e: EntornoHu03;
let almacen: Awaited<ReturnType<typeof almacenDePrueba002>>;
beforeAll(async () => { almacen = await almacenDePrueba002(); e = await montarHu03({ almacen: almacen.almacen }); });
afterAll(async () => { try { await e?.cerrar(); } finally { await almacen?.limpiar(); } });

const trabajo = { titulo: 'Muro de contención ficticio', descripcion: 'Trabajo anterior de prueba con descripción ficticia.' };
const foto = async (versionTrabajo: number, color = '#aa3333') => ({ versionTrabajo, tipoMime: 'image/jpeg', contenidoBase64: base64(await crearImagen({ color })) });
async function prestadorConPerfil() {
  const cuenta = await e.nuevaCuenta('prestador');
  const perfil = await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002)).expect(201);
  return { cuenta, perfil: perfil.body as { prestadorId: string; version: number } };
}
async function conTrabajo() {
  const { cuenta, perfil } = await prestadorConPerfil();
  const creado = await e.crearTrabajo(cuenta.token, { versionPerfil: perfil.version, ...trabajo }).expect(201);
  return { cuenta, prestadorId: perfil.prestadorId, trabajoId: creado.body.trabajo.trabajoId as string, version: creado.body.trabajo.version as number, versionPerfil: creado.body.versionPerfil as number };
}

describe('autenticación, perfil de prestador, Origin e idempotencia en las siete operaciones privadas', () => {
  test('un visitante recibe 401 y una cuenta solo cliente 403 (CA-PRE-03)', async () => {
    const trabajoId = randomUUID(); const fotoId = randomUUID();
    const sinSesion = [e.obtenerPerfil(), e.guardarPerfil(undefined, perfilValido(clasificaciones002)), e.crearTrabajo(undefined, { versionPerfil: 1, ...trabajo }),
      e.editarTrabajo(undefined, trabajoId, { version: 1, titulo: 'x' }), e.agregarFoto(undefined, trabajoId, { versionTrabajo: 1, tipoMime: 'image/png', contenidoBase64: 'AAAA' }),
      e.reemplazarFoto(undefined, trabajoId, fotoId, { versionTrabajo: 1, tipoMime: 'image/png', contenidoBase64: 'AAAA' }), e.eliminarFoto(undefined, trabajoId, fotoId, 1)];
    for (const peticion of sinSesion) { const r = await peticion.expect(401); await validarRespuesta002('C002Error401', r.body); }
    for (const peticion of [e.obtenerPerfil(e.datos.cliente.token), e.guardarPerfil(e.datos.cliente.token, perfilValido(clasificaciones002)),
      e.crearTrabajo(e.datos.cliente.token, { versionPerfil: 1, ...trabajo })]) {
      const r = await peticion.expect(403); await validarRespuesta002('C002Error403', r.body);
      expect(r.body.codigo).toBe('SIN_PERMISO');
    }
  });

  test('exige Origin, Idempotency-Key y rechaza identidad o propiedades enviadas en el cuerpo', async () => {
    const t = e.datos.prestador.token;
    await e.http.put(`${e.base}/perfil`).set('Authorization', `Bearer ${t}`).set('Idempotency-Key', randomUUID()).send(perfilValido(clasificaciones002)).expect(400).then(r => { expect(r.body.codigo).toBe('CABECERA_REQUERIDA'); });
    await e.http.put(`${e.base}/perfil`).set('Authorization', `Bearer ${t}`).set('Origin', 'https://ajeno.example.invalid').set('Idempotency-Key', randomUUID()).send(perfilValido(clasificaciones002)).expect(403).then(r => { expect(r.body.codigo).toBe('ORIGEN_NO_ADMITIDO'); });
    await e.http.put(`${e.base}/perfil`).set('Authorization', `Bearer ${t}`).set('Origin', 'https://localhost:8444').send(perfilValido(clasificaciones002)).expect(400).then(r => { expect(r.body.codigo).toBe('CABECERA_REQUERIDA'); });
    for (const extra of [{ cuentaId: randomUUID() }, { prestadorId: randomUUID() }, { perfiles: ['prestador'] }]) {
      const r = await e.guardarPerfil(t, perfilValido(clasificaciones002, extra)).expect(400);
      expect(r.body.codigo).toBe('PROPIEDAD_NO_ADMITIDA');
      await validarRespuesta002('C002Error400', r.body);
    }
  });
});

describe('perfil profesional (CA-PRE-01, CA-PRE-02)', () => {
  test('alta, consulta propia, edición con versión, replay y conflictos', async () => {
    const cuenta = await e.nuevaCuenta('prestador');
    await validarRespuesta002('C002Error404', (await e.obtenerPerfil(cuenta.token).expect(404)).body);
    const clave = randomUUID();
    const alta = await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002), clave).expect(201);
    expect(alta.headers['cache-control']).toBe('no-store');
    await validarRespuesta002('C002PerfilPrivado', alta.body);
    expect(alta.body).toMatchObject({ version: 1, tipo: 'TECNICO', distritos: ['ayacucho'], especialidadesIds: [clasificaciones002.hija], disponibilidadDeclarada: true, trabajos: [] });
    expect(alta.body.prestadorId).not.toBe(cuenta.cuentaId);
    expect(JSON.stringify(alta.body)).not.toContain(cuenta.cuentaId);
    // Replay con la misma clave y los mismos datos: mismo resultado confirmado, sin un segundo alta.
    const replay = await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002), clave).expect(201);
    expect(replay.body).toEqual(alta.body);
    await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002, { nombrePublico: 'Otro' }), clave).expect(409).then(r => { expect(r.body.codigo).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA'); });
    const edicion = { ...perfilValido(clasificaciones002), version: 1, nombrePublico: 'Nombre actualizado', disponibilidadDeclarada: false, tipo: 'EMPRESA', distritos: ['ayacucho', 'carmen-alto'] };
    const actualizado = await e.guardarPerfil(cuenta.token, edicion).expect(200);
    await validarRespuesta002('C002PerfilPrivado', actualizado.body);
    expect(actualizado.body).toMatchObject({ version: 2, nombrePublico: 'Nombre actualizado', tipo: 'EMPRESA', disponibilidadDeclarada: false });
    expect(actualizado.body.prestadorId).toBe(alta.body.prestadorId);
    const consulta = await e.obtenerPerfil(cuenta.token).expect(200);
    expect(consulta.body).toEqual(actualizado.body);
    const obsoleta = await e.guardarPerfil(cuenta.token, edicion).expect(409);
    expect(obsoleta.body.codigo).toBe('VERSION_DESACTUALIZADA');
    await validarRespuesta002('C002Error409', obsoleta.body);
    await e.guardarPerfil(cuenta.token, { ...edicion, version: 0 }).expect(409);
  });

  test('una zona fuera de los cinco distritos informa cuál es y conserva los datos guardados (CA-PRE-02)', async () => {
    const { cuenta } = await prestadorConPerfil();
    const antes = (await e.obtenerPerfil(cuenta.token).expect(200)).body;
    const r = await e.guardarPerfil(cuenta.token, perfilValido(clasificaciones002, { version: 1, distritos: ['ayacucho', 'huanta'] })).expect(400);
    await validarRespuesta002('C002Error400', r.body);
    expect(r.body.detalles).toEqual([expect.objectContaining({ campo: 'distritos[1]' })]);
    expect(JSON.stringify(r.body)).not.toContain('huanta');
    expect((await e.obtenerPerfil(cuenta.token).expect(200)).body).toEqual(antes);
  });

  test('valida longitudes, tipo, especialidades y distritos con el contrato y el dominio', async () => {
    const t = (await e.nuevaCuenta('prestador')).token;
    const invalidos: object[] = [{ nombrePublico: '   ' }, { nombrePublico: 'a'.repeat(121) }, { experiencia: 'a'.repeat(3001) }, { tipo: 'OTRO' }, { especialidadesIds: [] },
      { especialidadesIds: [clasificaciones002.hija, clasificaciones002.hija] }, { distritos: [] }, { distritos: ['ayacucho', 'ayacucho'] },
      { distritos: ['ayacucho', 'carmen-alto', 'san-juan-bautista', 'jesus-nazareno', 'andres-avelino-caceres-dorregaray', 'otro'] }, { disponibilidadDeclarada: 'si' }, { nombrePublico: '<script>alert(1)</script>' }];
    for (const extra of invalidos) await e.guardarPerfil(t, perfilValido(clasificaciones002, extra)).expect(400);
    await e.obtenerPerfil(t).expect(404);
    // Los límites exactos se aceptan.
    await e.guardarPerfil(t, perfilValido(clasificaciones002, { nombrePublico: 'n'.repeat(120), experiencia: 'x'.repeat(3000),
      distritos: ['ayacucho', 'carmen-alto', 'san-juan-bautista', 'jesus-nazareno', 'andres-avelino-caceres-dorregaray'] })).expect(201);
  });

  test('las nuevas especialidades deben estar efectivamente activas; las ya declaradas conservan su relación', async () => {
    const t = (await e.nuevaCuenta('prestador')).token;
    for (const id of [clasificaciones002.inactiva, clasificaciones002.hijaDeInactiva, randomUUID()]) {
      const r = await e.guardarPerfil(t, perfilValido(clasificaciones002, { especialidadesIds: [clasificaciones002.hija, id] })).expect(422);
      expect(r.body.codigo).toBe('CATEGORIA_NO_ACTIVA');
      await validarRespuesta002('C002Error422', r.body);
    }
    await e.obtenerPerfil(t).expect(404);
    await e.guardarPerfil(t, perfilValido(clasificaciones002)).expect(201);
    await e.db.query('UPDATE catalogo_clasificaciones SET activa=false WHERE id=$1', [clasificaciones002.hija]);
    try {
      // La desactivación posterior conserva la relación histórica: reenviar la misma especialidad no se rechaza.
      await e.guardarPerfil(t, perfilValido(clasificaciones002, { version: 1, nombrePublico: 'Sin cambio de especialidad' })).expect(200);
    } finally { await e.db.query('UPDATE catalogo_clasificaciones SET activa=true WHERE id=$1', [clasificaciones002.hija]); }
  });
});

describe('trabajos anteriores', () => {
  test('alta, edición, versiones y respuestas de error', async () => {
    const { cuenta, perfil } = await prestadorConPerfil();
    const creado = await e.crearTrabajo(cuenta.token, { versionPerfil: perfil.version, ...trabajo }).expect(201);
    await validarRespuesta002('C002TrabajoCreado', creado.body);
    expect(creado.body).toMatchObject({ versionPerfil: perfil.version + 1, trabajo: { version: 1, fotografias: [] } });
    const trabajoId = creado.body.trabajo.trabajoId as string;
    await e.crearTrabajo(cuenta.token, { versionPerfil: perfil.version, ...trabajo }).expect(409).then(r => { expect(r.body.codigo).toBe('VERSION_DESACTUALIZADA'); });
    const editado = await e.editarTrabajo(cuenta.token, trabajoId, { version: 1, titulo: 'Título editado' }).expect(200);
    await validarRespuesta002('C002TrabajoPrivado', editado.body);
    expect(editado.body).toMatchObject({ version: 2, titulo: 'Título editado', descripcion: trabajo.descripcion });
    await e.editarTrabajo(cuenta.token, trabajoId, { version: 1, titulo: 'Obsoleto' }).expect(409);
    await e.editarTrabajo(cuenta.token, trabajoId, { version: 2 }).expect(400);
    await e.editarTrabajo(cuenta.token, trabajoId, { version: 2, titulo: ' ' }).expect(400);
    await e.editarTrabajo(cuenta.token, randomUUID(), { version: 1, titulo: 'x' }).expect(404).then(r => { expect(r.body.codigo).toBe('RECURSO_NO_DISPONIBLE'); });
    await e.crearTrabajo(cuenta.token, { versionPerfil: perfil.version + 1, titulo: '', descripcion: 'x' }).expect(400);
    const perfilConTrabajo = await e.obtenerPerfil(cuenta.token).expect(200);
    expect(perfilConTrabajo.body.trabajos).toHaveLength(1);
    await validarRespuesta002('C002PerfilPrivado', perfilConTrabajo.body);
  });

  test('un prestador ajeno no ve ni modifica trabajos de otro perfil (CA-PRE-03)', async () => {
    const { trabajoId, version } = await conTrabajo();
    const ajeno = (await e.nuevaCuenta('prestador')).token;
    await e.editarTrabajo(ajeno, trabajoId, { version, titulo: 'Intrusión' }).expect(404);
    await e.agregarFoto(ajeno, trabajoId, await foto(version)).expect(404);
    await e.guardarPerfil(ajeno, perfilValido(clasificaciones002)).expect(201);
    await e.editarTrabajo(ajeno, trabajoId, { version, titulo: 'Intrusión' }).expect(404);
    await e.agregarFoto(ajeno, trabajoId, await foto(version)).expect(404);
  });
});

describe('fotografías de portafolio', () => {
  test('alta, reemplazo, eliminación y entrega pública con sus versiones (CA-PRE-04, CA-PRE-07, CA-PRE-08)', async () => {
    const { cuenta, prestadorId, trabajoId, version } = await conTrabajo();
    const alta = await e.agregarFoto(cuenta.token, trabajoId, await foto(version)).expect(201);
    await validarRespuesta002('C002FotografiaModificada', alta.body);
    expect(alta.body).toMatchObject({ versionTrabajo: version + 1, fotografia: { tipoMime: 'image/webp', ancho: 64, alto: 48 } });
    const fotoId = alta.body.fotografia.fotografiaId as string;
    const publica = await e.fotoPublica(prestadorId, trabajoId, fotoId).expect(200);
    await validarRespuesta002('C002ImagenPublica', publica.body);
    expect(publica.headers['cache-control']).toBe('no-store');
    expect(publica.body.tipoMime).toBe('image/webp');
    await e.agregarFoto(cuenta.token, trabajoId, await foto(version)).expect(409).then(r => { expect(r.body.codigo).toBe('VERSION_DESACTUALIZADA'); });
    const reemplazo = await e.reemplazarFoto(cuenta.token, trabajoId, fotoId, await foto(version + 1, '#33aa33')).expect(200);
    await validarRespuesta002('C002FotografiaModificada', reemplazo.body);
    expect(reemplazo.body.fotografia.fotografiaId).toBe(fotoId);
    expect(reemplazo.body.versionTrabajo).toBe(version + 2);
    const nueva = await e.fotoPublica(prestadorId, trabajoId, fotoId).expect(200);
    expect(nueva.body.contenidoBase64).not.toBe(publica.body.contenidoBase64);
    await e.reemplazarFoto(cuenta.token, trabajoId, randomUUID(), await foto(version + 2)).expect(404);
    const baja = await e.eliminarFoto(cuenta.token, trabajoId, fotoId, version + 2).expect(200);
    await validarRespuesta002('C002FotografiaEliminada', baja.body);
    expect(baja.body.versionTrabajo).toBe(version + 3);
    const retirada = await e.fotoPublica(prestadorId, trabajoId, fotoId).expect(404);
    await validarRespuesta002('C002Error404', retirada.body);
    await e.eliminarFoto(cuenta.token, trabajoId, fotoId, version + 3).expect(404);
    await e.eliminarFoto(cuenta.token, trabajoId, fotoId, 0).expect(400);
  });

  test('los rechazos de archivo informan la causa y conservan la imagen vinculada (CA-PRE-04, CA-PRE-07)', async () => {
    const { cuenta, prestadorId, trabajoId, version } = await conTrabajo();
    const alta = await e.agregarFoto(cuenta.token, trabajoId, await foto(version)).expect(201);
    const fotoId = alta.body.fotografia.fotografiaId as string;
    const antes = (await e.fotoPublica(prestadorId, trabajoId, fotoId).expect(200)).body.contenidoBase64;
    const v = version + 1;
    const gif = base64(await crearImagen({ formato: 'gif' }));
    const casos: [string, object, number, string][] = [
      ['formato real no permitido con tipo de imagen', { versionTrabajo: v, tipoMime: 'image/png', contenidoBase64: gif }, 422, 'IMAGEN_FORMATO_NO_ADMITIDO'],
      ['tipo declarado distinto del contenido', { versionTrabajo: v, tipoMime: 'image/png', contenidoBase64: base64(await crearImagen({ formato: 'jpeg' })) }, 422, 'IMAGEN_FORMATO_NO_ADMITIDO'],
      ['contenido que no es imagen', { versionTrabajo: v, tipoMime: 'image/png', contenidoBase64: Buffer.from('no soy una imagen').toString('base64') }, 422, 'IMAGEN_FORMATO_NO_ADMITIDO'],
      ['más de 4096 píxeles de ancho', { versionTrabajo: v, tipoMime: 'image/png', contenidoBase64: base64(await crearImagen({ formato: 'png', ancho: 4097, alto: 8 })) }, 422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS'],
      ['más de 4096 píxeles de alto', { versionTrabajo: v, tipoMime: 'image/webp', contenidoBase64: base64(await crearImagen({ formato: 'webp', ancho: 8, alto: 4097 })) }, 422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS'],
    ];
    for (const [, cuerpo, http, codigo] of casos) {
      const r = await e.reemplazarFoto(cuenta.token, trabajoId, fotoId, cuerpo).expect(http);
      expect(r.body.codigo).toBe(codigo);
      expect(r.body.detalles.length).toBeGreaterThan(0);
      await validarRespuesta002('C002Error422', r.body);
      const alta2 = await e.agregarFoto(cuenta.token, trabajoId, cuerpo).expect(http);
      expect(alta2.body.codigo).toBe(codigo);
    }
    for (const base of ['!!!!', 'AAA', 'QUJD=QUJD', 'AAAA\n']) await e.agregarFoto(cuenta.token, trabajoId, { versionTrabajo: v, tipoMime: 'image/png', contenidoBase64: base }).expect(400);
    await e.agregarFoto(cuenta.token, trabajoId, { versionTrabajo: v, tipoMime: 'image/gif', contenidoBase64: gif }).expect(400);
    expect((await e.fotoPublica(prestadorId, trabajoId, fotoId).expect(200)).body.contenidoBase64).toBe(antes);
    const perfil = await e.obtenerPerfil(cuenta.token).expect(200);
    expect(perfil.body.trabajos[0].fotografias).toHaveLength(1);
    expect(perfil.body.trabajos[0].version).toBe(v);
  });

  test('acepta JPG, PNG y WEBP válidos, incluidos 10 000 000 bytes y 4096 píxeles por lado, y rechaza el exceso por HTTP (CA-PRE-04)', async () => {
    const { cuenta, trabajoId, version } = await conTrabajo();
    let v = version;
    const aceptar = async (cuerpo: object) => { const r = await e.agregarFoto(cuenta.token, trabajoId, cuerpo).expect(201); await validarRespuesta002('C002FotografiaModificada', r.body); v = r.body.versionTrabajo; };
    await aceptar({ versionTrabajo: v, tipoMime: 'image/png', contenidoBase64: base64(await pngDeTamano(10_000_000)) });
    const exacto = await e.reemplazarFoto(cuenta.token, trabajoId, (await e.obtenerPerfil(cuenta.token)).body.trabajos[0].fotografias[0].fotografiaId, { versionTrabajo: v, tipoMime: 'image/jpeg', contenidoBase64: base64(await crearImagen({ ancho: 4096, alto: 4096 })) }).expect(200);
    v = exacto.body.versionTrabajo;
    await aceptar({ versionTrabajo: v, tipoMime: 'image/webp', contenidoBase64: base64(await crearImagen({ formato: 'webp', ancho: 4096, alto: 16 })) });
    await aceptar({ versionTrabajo: v, tipoMime: 'image/png', contenidoBase64: base64(await crearImagen({ formato: 'png', ancho: 16, alto: 4096 })) });
    const grande = await e.reemplazarFoto(cuenta.token, trabajoId, (await e.obtenerPerfil(cuenta.token)).body.trabajos[0].fotografias[0].fotografiaId,
      { versionTrabajo: v, tipoMime: 'image/png', contenidoBase64: base64(Buffer.concat([await pngDeTamano(10_000_000), Buffer.alloc(1)])) }).expect(413);
    expect(grande.body.codigo).toBe('ARCHIVO_DEMASIADO_GRANDE');
    await validarRespuesta002('C002Error413', grande.body);
    expect((await e.obtenerPerfil(cuenta.token).expect(200)).body.trabajos[0].fotografias).toHaveLength(3);
  }, 60000);

  test('cuatro fotos por trabajo y diez trabajos por prestador se rechazan con la causa (CA-PRE-05)', async () => {
    const { cuenta, trabajoId, version } = await conTrabajo();
    let v = version;
    for (let i = 0; i < 4; i++) v = (await e.agregarFoto(cuenta.token, trabajoId, await foto(v, `#${i}0${i}0${i}0`)).expect(201)).body.versionTrabajo;
    const quinta = await e.agregarFoto(cuenta.token, trabajoId, await foto(v)).expect(422);
    expect(quinta.body.codigo).toBe('LIMITE_PORTAFOLIO');
    expect(quinta.body.detalles[0].motivo).toContain('4');
    await validarRespuesta002('C002Error422', quinta.body);
    const perfil = (await e.obtenerPerfil(cuenta.token).expect(200)).body;
    expect(perfil.trabajos[0].fotografias).toHaveLength(4);
    let versionPerfil = perfil.version as number;
    for (let i = 1; i < 10; i++) versionPerfil = (await e.crearTrabajo(cuenta.token, { versionPerfil, titulo: `Trabajo ${i + 1}`, descripcion: 'Descripción ficticia' }).expect(201)).body.versionPerfil;
    const undecimo = await e.crearTrabajo(cuenta.token, { versionPerfil, titulo: 'Undécimo', descripcion: 'Descripción ficticia' }).expect(422);
    expect(undecimo.body.codigo).toBe('LIMITE_PORTAFOLIO');
    expect(undecimo.body.detalles[0].motivo).toContain('10');
    expect((await e.obtenerPerfil(cuenta.token).expect(200)).body.trabajos).toHaveLength(10);
  }, 60000);

  test('la entrega pública responde 404 para IDs inexistentes, mezclados o de otro perfil', async () => {
    const a = await conTrabajo();
    const alta = await e.agregarFoto(a.cuenta.token, a.trabajoId, await foto(a.version)).expect(201);
    const fotoId = alta.body.fotografia.fotografiaId as string;
    const b = await conTrabajo();
    for (const [p, t, f] of [[randomUUID(), a.trabajoId, fotoId], [a.prestadorId, randomUUID(), fotoId], [a.prestadorId, a.trabajoId, randomUUID()], [b.prestadorId, a.trabajoId, fotoId], [a.prestadorId, b.trabajoId, fotoId]] as const) {
      const r = await e.fotoPublica(p, t, f).expect(404);
      expect(r.body.codigo).toBe('RECURSO_NO_DISPONIBLE');
    }
    await e.http.get(`${e.base}/${a.prestadorId}/trabajos/no-es-uuid/fotografias/${fotoId}`).expect(400);
    await e.fotoPublica(a.prestadorId, a.trabajoId, fotoId).expect(200);
  });
});
