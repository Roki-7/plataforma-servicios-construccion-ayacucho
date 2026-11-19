import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ErrorApi } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';
import { PortafolioWeb, validarArchivoImagen } from '../../../src/features/prestadores-catalogo/aplicacion/portafolio.js';
import type { ApiPrestadores } from '../../../src/features/prestadores-catalogo/aplicacion/puertos.js';
import type { FotografiaPrivada, PerfilPrivado, TrabajoPrivado } from '../../../src/features/prestadores-catalogo/modelos/contratos.js';
import { PerfilProfesional } from '../../../src/features/prestadores-catalogo/presentacion/PerfilProfesional.js';
import { Portafolio } from '../../../src/features/prestadores-catalogo/presentacion/Portafolio.js';

afterEach(cleanup);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const foto = (n: number): FotografiaPrivada => ({ fotografiaId: uuid(100 + n), tipoMime: 'image/webp', ancho: 800, alto: 600 });
const trabajo = (n: number, fotos: number, version = 3): TrabajoPrivado => ({ trabajoId: uuid(10 + n), version, titulo: `Trabajo ${n}`, descripcion: `Descripción ${n}`, fotografias: Array.from({ length: fotos }, (_, i) => foto(n * 10 + i)) });
const perfil = (extra: Partial<PerfilPrivado> = {}): PerfilPrivado => ({ prestadorId: uuid(1), version: 2, nombrePublico: 'Maestro ficticio', tipo: 'TECNICO', experiencia: 'Experiencia ficticia',
  especialidadesIds: [uuid(500)], distritos: ['ayacucho'], disponibilidadDeclarada: true, trabajos: [trabajo(1, 2)], ...extra });
const api = (extra: Partial<ApiPrestadores> = {}) => ({
  obtenerPerfil: vi.fn(async () => perfil()), guardarPerfil: vi.fn(async (v: number) => perfil({ version: v + 1 })),
  crearTrabajo: vi.fn(async (v: number, d: { titulo: string; descripcion: string }) => ({ trabajo: { ...trabajo(9, 0, 1), ...d }, versionPerfil: v + 1 })),
  editarTrabajo: vi.fn(async (_id: string, v: number, c: object) => ({ ...trabajo(1, 2, v + 1), ...c })),
  agregarFotografia: vi.fn(async (_t: string, e: { versionTrabajo: number }) => ({ fotografia: foto(99), versionTrabajo: e.versionTrabajo + 1 })),
  reemplazarFotografia: vi.fn(async (_t: string, f: string, e: { versionTrabajo: number }) => ({ fotografia: { ...foto(0), fotografiaId: f }, versionTrabajo: e.versionTrabajo + 1 })),
  eliminarFotografia: vi.fn(async (_t: string, _f: string, v: number) => ({ versionTrabajo: v + 1 })),
  obtenerFotografiaPublica: vi.fn(async () => ({ tipoMime: 'image/webp' as const, contenidoBase64: 'AAAA' })), ...extra,
}) as unknown as ApiPrestadores & { [K in keyof ApiPrestadores]: ReturnType<typeof vi.fn> };
const archivo = (nombre: string, tipo: string, bytes = 100) => new File([new Uint8Array(bytes)], nombre, { type: tipo });
const subir = (etiqueta: string | RegExp, f: File) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { files: [f] } });
const montar = (a: ReturnType<typeof api>, trabajos: TrabajoPrivado[], versionPerfil = 2) => {
  const servicio = new PortafolioWeb(a, () => 'clave-de-prueba-fija');
  render(<Portafolio prestadorId={uuid(1)} trabajos={trabajos} versionPerfil={versionPerfil} servicio={servicio} />);
  return servicio;
};

test('CA-PRE-04 la vista informa el límite de 10 MB y el formato no admitido sin enviar nada y conserva las imágenes', async () => {
  const a = api();
  montar(a, [trabajo(1, 2)]);
  subir('Agregar fotografía a Trabajo 1', archivo('grande.png', 'image/png', 10_000_001));
  expect(await screen.findByRole('alert')).toHaveTextContent('La imagen supera el límite de 10 MB.');
  subir('Agregar fotografía a Trabajo 1', archivo('animada.gif', 'image/gif'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Solo se admiten imágenes JPG, PNG o WEBP.'));
  subir('Agregar fotografía a Trabajo 1', archivo('vacia.png', 'image/png', 0));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('El archivo está vacío.'));
  expect(a.agregarFotografia).not.toHaveBeenCalled();
  expect(screen.getByText('2 de 4 fotografías · versión 3')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(validarArchivoImagen({ type: 'image/jpeg', size: 10_000_000 })).toBeUndefined();
});

test('CA-PRE-04 un rechazo del servidor explica la causa y conserva las imágenes y la versión', async () => {
  const a = api({ agregarFotografia: vi.fn(async () => { throw new ErrorApi(422, 'IMAGEN_DIMENSIONES_NO_ADMITIDAS', 'La imagen supera 4096 píxeles por lado.', [{ campo: 'contenidoBase64', motivo: 'La imagen supera 4096 píxeles de ancho o alto.' }]); }) });
  montar(a, [trabajo(1, 2)]);
  subir('Agregar fotografía a Trabajo 1', archivo('enorme.png', 'image/png'));
  expect(await screen.findByRole('alert')).toHaveTextContent('La imagen supera 4096 píxeles por lado.');
  expect(a.agregarFotografia).toHaveBeenCalledWith(uuid(11), expect.objectContaining({ versionTrabajo: 3, tipoMime: 'image/png' }), 'clave-de-prueba-fija');
  expect(screen.getByText('2 de 4 fotografías · versión 3')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

test('CA-PRE-04 un archivo válido se agrega y actualiza el recuento y la versión del trabajo', async () => {
  const a = api();
  montar(a, [trabajo(1, 2)]);
  subir('Agregar fotografía a Trabajo 1', archivo('bien.webp', 'image/webp', 2048));
  await waitFor(() => expect(screen.getByText('3 de 4 fotografías · versión 4')).toBeInTheDocument());
  expect(screen.getByRole('status')).toHaveTextContent('Fotografía agregada.');
  expect(a.agregarFotografia.mock.calls[0]?.[1].contenidoBase64).toMatch(/^[A-Za-z0-9+/]+=*$/);
});

test('CA-PRE-05 con cuatro fotografías no se admite una quinta y se informa el límite', () => {
  montar(api(), [trabajo(1, 4)]);
  expect(screen.getByLabelText('Agregar fotografía a Trabajo 1')).toBeDisabled();
  expect(screen.getByText('Este trabajo ya tiene el máximo de 4 fotografías.')).toBeInTheDocument();
});

test('CA-PRE-05 con diez trabajos no se admite un undécimo y se informa el límite', () => {
  montar(api(), Array.from({ length: 10 }, (_, i) => trabajo(i + 1, 0)));
  expect(screen.getByRole('button', { name: 'Agregar trabajo' })).toBeDisabled();
  expect(screen.getByText('El portafolio admite hasta 10 trabajos.')).toBeInTheDocument();
});

test('CA-PRE-05 un trabajo nuevo se valida, se crea y avanza la versión del perfil', async () => {
  const a = api();
  montar(a, [trabajo(1, 0)], 2);
  fireEvent.click(screen.getByRole('button', { name: 'Agregar trabajo' }));
  expect(await screen.findByText('Indique el título del trabajo.')).toBeInTheDocument();
  expect(a.crearTrabajo).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Título del trabajo'), { target: { value: 'Muro nuevo' } });
  fireEvent.change(screen.getByLabelText('Descripción del trabajo'), { target: { value: 'Detalle del muro' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar trabajo' }));
  await screen.findByRole('article', { name: 'Trabajo: Muro nuevo' });
  expect(a.crearTrabajo).toHaveBeenCalledWith(2, { titulo: 'Muro nuevo', descripcion: 'Detalle del muro' }, 'clave-de-prueba-fija');
});

test('CA-PRE-07 un reemplazo inválido conserva la imagen anterior y uno válido conserva el recuento y el identificador', async () => {
  const a = api({ reemplazarFotografia: vi.fn()
    .mockRejectedValueOnce(new ErrorApi(422, 'IMAGEN_FORMATO_NO_ADMITIDO', 'El formato real del archivo no es JPG, PNG ni WEBP.', []))
    .mockImplementation(async (_t: string, f: string, e: { versionTrabajo: number }) => ({ fotografia: { ...foto(0), fotografiaId: f }, versionTrabajo: e.versionTrabajo + 1 })) });
  montar(a, [trabajo(1, 4)]);
  subir('Reemplazar fotografía 2', archivo('falsa.png', 'image/png'));
  expect(await screen.findByRole('alert')).toHaveTextContent('El formato real del archivo no es JPG, PNG ni WEBP.');
  expect(screen.getByText('4 de 4 fotografías · versión 3')).toBeInTheDocument();
  subir('Reemplazar fotografía 2', archivo('buena.jpg', 'image/jpeg'));
  await waitFor(() => expect(screen.getByText('4 de 4 fotografías · versión 4')).toBeInTheDocument());
  expect(a.reemplazarFotografia).toHaveBeenLastCalledWith(uuid(11), foto(11).fotografiaId, expect.objectContaining({ versionTrabajo: 3 }), 'clave-de-prueba-fija');
  expect(screen.getAllByRole('listitem')).toHaveLength(4);
});

test('CA-PRE-08 eliminar quita la foto del portafolio, envía la versión y libera un cupo', async () => {
  const a = api();
  montar(a, [trabajo(1, 4)]);
  expect(screen.getByLabelText('Agregar fotografía a Trabajo 1')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar fotografía 1' }));
  await waitFor(() => expect(screen.getByText('3 de 4 fotografías · versión 4')).toBeInTheDocument());
  expect(a.eliminarFotografia).toHaveBeenCalledWith(uuid(11), foto(10).fotografiaId, 3, 'clave-de-prueba-fija');
  expect(screen.getByLabelText('Agregar fotografía a Trabajo 1')).toBeEnabled();
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
});

test('las imágenes se cargan bajo demanda y no antes', async () => {
  const a = api();
  montar(a, [trabajo(1, 2)]);
  expect(a.obtenerFotografiaPublica).not.toHaveBeenCalled();
  expect(screen.queryByRole('img')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Ver imagen 1' }));
  const img = await screen.findByRole('img', { name: 'Fotografía 1 de Trabajo 1' });
  expect(img).toHaveAttribute('src', 'data:image/webp;base64,AAAA');
  expect(a.obtenerFotografiaPublica).toHaveBeenCalledTimes(1);
  expect(a.obtenerFotografiaPublica).toHaveBeenCalledWith(uuid(1), uuid(11), foto(10).fotografiaId);
});

test('un conflicto de versión indica recargar y no pierde las imágenes mostradas', async () => {
  const a = api({ eliminarFotografia: vi.fn(async () => { throw new ErrorApi(409, 'VERSION_DESACTUALIZADA', 'La versión enviada ya no es la vigente.', []); }) });
  montar(a, [trabajo(1, 2)]);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar fotografía 1' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Recargue su perfil');
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});

test('un fallo de red conserva la clave de idempotencia y el reintento exacto la reutiliza', async () => {
  const claves: string[] = []; let n = 0;
  const a = api({ agregarFotografia: vi.fn(async (_t: string, e: { versionTrabajo: number }, clave: string) => { claves.push(clave); if (claves.length === 1) throw new ErrorApi(503, 'DEPENDENCIA_NO_DISPONIBLE', 'No fue posible comunicarse con el servidor.', []); return { fotografia: foto(99), versionTrabajo: e.versionTrabajo + 1 }; }) });
  const servicio = new PortafolioWeb(a, () => `clave-${++n}`);
  const e = await servicio.escritura(archivo('a.png', 'image/png'), 3);
  await expect(servicio.agregarFotografia(uuid(11), e)).rejects.toBeInstanceOf(ErrorApi);
  await servicio.agregarFotografia(uuid(11), e);
  expect(claves).toEqual(['clave-1', 'clave-1']);
  await servicio.agregarFotografia(uuid(11), e);
  expect(claves[2]).toBe('clave-2');
});

test('CA-PRE-01 el perfil existente muestra sus datos y versión y se guarda con la versión vigente', async () => {
  const a = api();
  render(<PerfilProfesional servicio={new PortafolioWeb(a, () => 'clave-de-prueba-fija')} />);
  expect(await screen.findByDisplayValue('Maestro ficticio')).toBeInTheDocument();
  expect(screen.getByText('Versión del perfil: 2')).toBeInTheDocument();
  expect(screen.getByLabelText('Ayacucho')).toBeChecked();
  expect(screen.getByLabelText('Carmen Alto')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Carmen Alto'));
  fireEvent.change(screen.getByLabelText('Nombre público'), { target: { value: 'Nuevo nombre' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
  await waitFor(() => expect(screen.getByText('Versión del perfil: 3')).toBeInTheDocument());
  expect(a.guardarPerfil).toHaveBeenCalledWith(2, expect.objectContaining({ nombrePublico: 'Nuevo nombre', distritos: ['ayacucho', 'carmen-alto'], especialidadesIds: [uuid(500)] }), 'clave-de-prueba-fija');
  expect(screen.getByRole('status')).toHaveTextContent('Perfil guardado.');
  expect(screen.getByRole('heading', { name: 'Portafolio de trabajos' })).toBeInTheDocument();
});

test('CA-PRE-02 una zona inválida informa cuál es y conserva lo escrito y lo guardado', async () => {
  const a = api({ guardarPerfil: vi.fn(async () => { throw new ErrorApi(400, 'DATOS_INVALIDOS', 'Revise los datos enviados.', [{ campo: 'distritos[1]', motivo: 'La zona no pertenece a los distritos de cobertura.' }]); }) });
  render(<PerfilProfesional servicio={new PortafolioWeb(a, () => 'clave-de-prueba-fija')} />);
  fireEvent.change(await screen.findByLabelText('Nombre público'), { target: { value: 'Texto sin guardar' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
  expect(await screen.findByText(/La zona no pertenece a los distritos de cobertura\./)).toBeInTheDocument();
  expect(screen.getByLabelText('Nombre público')).toHaveValue('Texto sin guardar');
  expect(screen.getByText('Versión del perfil: 2')).toBeInTheDocument();
});

test('el alta sin perfil exige datos mínimos y no envía hasta ser válidos', async () => {
  const a = api({ obtenerPerfil: vi.fn(async () => { throw new ErrorApi(404, 'RECURSO_NO_DISPONIBLE', 'Recurso no disponible.', []); }) });
  render(<PerfilProfesional servicio={new PortafolioWeb(a, () => 'clave-de-prueba-fija')} especialidades={[{ id: uuid(500), nombre: 'Albañilería' }]} />);
  await screen.findByRole('button', { name: 'Guardar perfil' });
  expect(screen.queryByRole('heading', { name: 'Portafolio de trabajos' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
  const errores = await screen.findAllByRole('alert');
  expect(errores.map(e => e.textContent).join(' ')).toContain('Indique su nombre público.');
  expect(errores.map(e => e.textContent).join(' ')).toContain('Seleccione entre uno y cinco distritos.');
  expect(a.guardarPerfil).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Nombre público'), { target: { value: 'Nuevo' } });
  fireEvent.change(screen.getByLabelText('Experiencia'), { target: { value: 'Años de obra' } });
  fireEvent.click(screen.getByLabelText('Ayacucho'));
  fireEvent.click(within(screen.getByRole('group', { name: 'Especialidades' })).getByLabelText('Albañilería'));
  fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
  await waitFor(() => expect(a.guardarPerfil).toHaveBeenCalledWith(0, expect.objectContaining({ nombrePublico: 'Nuevo', tipo: 'TECNICO', distritos: ['ayacucho'], especialidadesIds: [uuid(500)] }), 'clave-de-prueba-fija'));
});
