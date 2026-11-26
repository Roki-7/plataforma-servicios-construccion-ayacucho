import { afterEach, expect, test, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { Avatar, inicialesDe } from '../../src/compartido/Avatar.js';
import { LEMA_MARCA, LOGO_COMPLETO, LOGO_EMBLEMA, NOMBRE_MARCA } from '../../src/compartido/identidad-marca.js';
import { Marca, PortadaMarca } from '../../src/compartido/Marca.js';
import { BarraLateral } from '../../src/composicion/BarraLateral.js';
import { Perfil, FotoPerfil } from '../../src/features/usuarios-acceso/presentacion/Perfil.js';
import { useCuentaSesion } from '../../src/features/usuarios-acceso/presentacion/useCuentaSesion.js';
import type { PerfilWeb } from '../../src/features/usuarios-acceso/aplicacion/perfil.js';
import type { Perfil as DatosPerfil } from '../../src/features/usuarios-acceso/modelos/contratos.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const enlaces = [{ href: '/buscar', texto: 'Buscar servicios', icono: 'buscar' as const, actual: true }];
const perfilBase: DatosPerfil = { cuentaId: '00000000-0000-4000-8000-000000000001', nombreMostrar: 'Ñawpa Wasi', correo: 'a@example.invalid', telefono: null, distrito: null, fotografiaId: null, perfiles: ['cliente'], telefonoCompartible: false, version: 1 };

test('identidad: el nombre y el lema oficiales son WasiMaki y «Buenas manos para tu hogar»', () => {
  expect(NOMBRE_MARCA).toBe('WasiMaki'); expect(LEMA_MARCA).toBe('Buenas manos para tu hogar');
});

test.each([
  ['Ñawpa Wasi', 'ÑW'], ['José Quispe-Huamán', 'JQ'], ['Constructora 3 Hermanos', 'C3'], ['  ñuñu   nunu  ', 'ÑN'], ["Q'ero", 'Q'], ['1234', '1'], ['Cañería', 'C'], ['---', '·'], ['   ', '·'],
])('iniciales de «%s» = %s (conserva la ñ y las letras quechuas)', (nombre, esperado) => { expect(inicialesDe(nombre)).toBe(esperado); });

test('Avatar sin fotografía muestra las iniciales y es decorativo por defecto', () => {
  const { container } = render(<Avatar nombre="Ñawpa Wasi" />);
  expect(container.querySelector('.avatar-iniciales')?.getAttribute('aria-hidden')).toBe('true'); expect(container.textContent).toBe('ÑW'); expect(screen.queryByRole('img')).toBeNull();
});

test('Avatar con alt expone una imagen con nombre; con fotografía usa la URL', () => {
  const { rerender } = render(<Avatar nombre="Ana Pérez" alt="Fotografía de mi cuenta" />);
  expect(screen.getByRole('img', { name: 'Fotografía de mi cuenta' })).toBeInTheDocument();
  rerender(<Avatar nombre="Ana Pérez" url="blob:ficticio" alt="Fotografía de mi cuenta" />);
  expect(screen.getByRole('img', { name: 'Fotografía de mi cuenta' })).toHaveAttribute('src', 'blob:ficticio');
});

test('la barra lateral muestra WasiMaki como encabezado principal con su lema, y sin sesión no muestra datos de cuenta', () => {
  const { container } = render(<BarraLateral ruta="/buscar" enlaces={enlaces} alNavegar={vi.fn()} />);
  expect(screen.getByRole('heading', { level: 1, name: 'WasiMaki' })).toBeInTheDocument();
  expect(screen.getByText('Buenas manos para tu hogar')).toBeInTheDocument();
  expect(container.querySelector('.app-cuenta')).toBeNull(); expect(container.querySelector('.avatar')).toBeNull(); expect(container.querySelector('.marca-emblema-circulo')).not.toBeNull(); expect(container.querySelector('.marca-placa')).toBeNull();
  expect(screen.queryByText('Plataforma Ayacucho')).toBeNull();
});

test('con sesión la navegación muestra el nombre y las iniciales (sin fotografía) o la imagen decorativa (con fotografía)', () => {
  const { container, rerender } = render(<BarraLateral ruta="/cuenta" enlaces={enlaces} alNavegar={vi.fn()} cuenta={{ nombre: 'Ñawpa Wasi', url: '' }} />);
  expect(container.querySelector('.app-cuenta-nombre')?.textContent).toBe('Ñawpa Wasi'); expect(container.querySelectorAll('.avatar-iniciales').length).toBe(2);
  rerender(<BarraLateral ruta="/cuenta" enlaces={enlaces} alNavegar={vi.fn()} cuenta={{ nombre: 'Ñawpa Wasi', url: 'blob:ficticio' }} />);
  expect(container.querySelectorAll('.avatar img[alt=""]').length).toBe(2); expect(screen.queryByRole('img', { name: 'Fotografía de mi cuenta' })).toBeNull();
});

function perfilFicticio(datos: Partial<DatosPerfil>, leer = vi.fn()): PerfilWeb {
  return { consultar: vi.fn().mockResolvedValue({ ...perfilBase, ...datos }), leer, guardar: vi.fn(), subir: vi.fn(), limpiar: vi.fn() } as unknown as PerfilWeb;
}

test('useCuentaSesion: sin sesión no consulta nada; con sesión entrega el nombre y, si hay foto, su URL, que se revoca al desmontar', async () => {
  const crear = vi.fn().mockReturnValue('blob:ficticio'), revocar = vi.fn();
  vi.stubGlobal('URL', class extends URL { static override createObjectURL = crear; static override revokeObjectURL = revocar; });
  const leer = vi.fn().mockResolvedValue({ fotografiaId: 'f1', tipoContenido: 'image/png', contenidoBase64: 'YQ==' });
  const perfil = perfilFicticio({ fotografiaId: 'f1' }, leer);
  const sin = renderHook(() => useCuentaSesion(perfil, false));
  expect(sin.result.current.cuenta).toBeUndefined(); expect(perfil.consultar).not.toHaveBeenCalled(); sin.unmount();
  const con = renderHook(() => useCuentaSesion(perfil, true));
  await waitFor(() => expect(con.result.current.cuenta).toEqual({ nombre: 'Ñawpa Wasi', url: 'blob:ficticio' }));
  con.unmount(); expect(revocar).toHaveBeenCalledWith('blob:ficticio');
});

test('useCuentaSesion: un fallo al leer la fotografía conserva el nombre y las iniciales', async () => {
  const perfil = perfilFicticio({ fotografiaId: 'f1' }, vi.fn().mockRejectedValue(new Error('x')));
  const { result } = renderHook(() => useCuentaSesion(perfil, true));
  await waitFor(() => expect(result.current.cuenta?.nombre).toBe('Ñawpa Wasi')); expect(result.current.cuenta?.url).toBe('');
});

test('Mi cuenta muestra el nombre y las iniciales cuando no hay fotografía, sin cambiar la privacidad', async () => {
  const servicio = perfilFicticio({});
  const { container } = render(<Perfil vista="cuenta" servicio={servicio} habilitar={vi.fn()} />);
  await screen.findByRole('heading', { name: 'Mi cuenta' });
  expect(container.querySelector('.cuenta-nombre')?.textContent).toBe('Ñawpa Wasi'); expect(container.querySelector('.cuenta-identidad .avatar-iniciales')?.textContent).toBe('ÑW');
  expect(screen.queryByRole('img', { name: 'Fotografía de mi cuenta' })).toBeNull(); expect(servicio.leer).not.toHaveBeenCalled();
});

test('Mi cuenta con fotografía conserva el texto alternativo «Fotografía de mi cuenta» en un avatar circular', async () => {
  const crear = vi.fn().mockReturnValue('blob:ficticio');
  vi.stubGlobal('URL', class extends URL { static override createObjectURL = crear; static override revokeObjectURL = vi.fn(); });
  render(<FotoPerfil id="f1" nombre="Ñawpa Wasi" leer={vi.fn().mockResolvedValue({ fotografiaId: 'f1', tipoContenido: 'image/png', contenidoBase64: 'YQ==' })} />);
  const imagen = await screen.findByRole('img', { name: 'Fotografía de mi cuenta' });
  expect(imagen.closest('.avatar-grande')).not.toBeNull();
});

const raiz = resolve(import.meta.dirname, '../..');

test('la barra muestra el emblema circular como imagen decorativa: el nombre accesible sigue siendo el texto «WasiMaki»', () => {
  const { container } = render(<h1><Marca /></h1>);
  expect(screen.getByRole('heading', { level: 1, name: 'WasiMaki' })).toBeInTheDocument();
  const imagenes = [...container.querySelectorAll('img')];
  expect(imagenes).toHaveLength(1); expect(imagenes[0]?.getAttribute('src')).toBe(LOGO_EMBLEMA.src); for (const i of imagenes) { expect(i.getAttribute('alt')).toBe(''); expect(i.closest('[aria-hidden="true"]')).not.toBeNull(); expect(i.getAttribute('srcset')).toMatch(/\d+w/); expect(i.getAttribute('width')).toBeTruthy(); expect(i.getAttribute('height')).toBeTruthy(); }
});

test('la portada de las pantallas públicas usa el logo completo y es decorativa', () => {
  const { container } = render(<PortadaMarca />);
  const imagen = container.querySelector('img'); expect(imagen?.getAttribute('src')).toBe(LOGO_COMPLETO.src); expect(imagen?.getAttribute('alt')).toBe(''); expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
});

test('los recursos gráficos existen: original conservado, derivados del logo y del emblema y favicon enlazado en la página', () => {
  expect(existsSync(resolve(raiz, 'assets-fuente/marca/wasimaki-logo-original.png'))).toBe(true);
  const rutas = [...LOGO_COMPLETO.srcSet.split(','), ...LOGO_EMBLEMA.srcSet.split(',')].map(x => x.trim().split(' ')[0] as string);
  expect(rutas).toHaveLength(6); for (const r of rutas) expect(existsSync(resolve(raiz, 'public' + r)), r).toBe(true);
  const html = readFileSync(resolve(raiz, 'index.html'), 'utf8');
  for (const f of ['favicon.ico', 'favicon-32.png', 'favicon-192.png', 'apple-touch-icon.png']) { expect(html).toContain('/marca/' + f); expect(existsSync(resolve(raiz, 'public/marca', f)), f).toBe(true); }
  expect(html).toContain('<title>WasiMaki · Buenas manos para tu hogar</title>'); expect(html).not.toContain('Plataforma Ayacucho');
});
