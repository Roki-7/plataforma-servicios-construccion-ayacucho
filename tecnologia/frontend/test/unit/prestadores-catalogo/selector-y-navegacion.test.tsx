import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SelectorMultiple } from '../../../src/features/prestadores-catalogo/presentacion/SelectorMultiple.js';
import { BarraLateral, type EnlaceMenu } from '../../../src/composicion/BarraLateral.js';

/** T080 · Selector múltiple desplegable y navegación lateral (presentación): el comportamiento, no la estética. */
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const categorias = [
  { id: 'r1', nombre: 'Construcción' }, { id: 'h1', nombre: 'Construcción › Albañilería' }, { id: 'h2', nombre: 'Construcción › Cimentación' },
  { id: 'r2', nombre: 'Acabados' }, { id: 'h3', nombre: 'Acabados › Pintura' }, { id: 'r3', nombre: 'Electricidad' },
];
function Prueba({ inicial = [] as string[], agrupar = true, opciones = categorias }: { inicial?: string[]; agrupar?: boolean; opciones?: typeof categorias }) {
  const [sel, setSel] = useState<string[]>(inicial);
  return <><SelectorMultiple etiqueta="Especialidades" opciones={opciones} seleccion={sel} alCambiar={setSel} agrupar={agrupar} /><output aria-label="valor">{sel.join(',')}</output></>;
}
const abrir = () => fireEvent.click(screen.getByRole('button', { name: /Seleccionar especialidades|seleccionad/ }));

describe('SelectorMultiple', () => {
  test('permite elegir varias opciones, agrupadas por categoría, y resume la selección con etiquetas que se pueden quitar', () => {
    render(<Prueba />);
    expect(screen.getByText('Ninguna seleccionada.')).toBeInTheDocument(); expect(screen.queryByRole('checkbox')).toBeNull();
    abrir();
    const grupo = screen.getByRole('group', { name: 'Construcción' });
    expect(within(grupo).getAllByRole('checkbox').map(c => c.parentElement?.textContent)).toEqual(['Construcción (toda la categoría)', 'Albañilería', 'Cimentación']);
    expect(screen.getByRole('group', { name: 'Acabados' })).toBeInTheDocument(); expect(screen.getByLabelText('Electricidad')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Albañilería')); fireEvent.click(screen.getByLabelText('Pintura')); fireEvent.click(screen.getByLabelText('Electricidad'));
    expect(screen.getByLabelText('valor')).toHaveTextContent('h1,h3,r3');
    expect(screen.getByRole('button', { name: '3 seleccionadas' })).toBeInTheDocument();
    const etiquetas = screen.getByRole('list', { name: 'Especialidades seleccionadas' });
    expect(within(etiquetas).getAllByRole('listitem').map(l => l.textContent)).toEqual(['Construcción › Albañilería', 'Acabados › Pintura', 'Electricidad']);
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Acabados › Pintura' }));
    expect(screen.getByLabelText('valor')).toHaveTextContent('h1,r3');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar todas' })); expect(screen.getByLabelText('valor')).toHaveTextContent('');
  });

  test('el buscador filtra sin tildes ni mayúsculas, conserva el contexto del grupo y avisa cuando no hay coincidencias', () => {
    render(<Prueba />); abrir();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en especialidades' }), { target: { value: 'CIMENTACION' } });
    expect(screen.getAllByRole('checkbox').map(c => c.parentElement?.textContent)).toEqual(['Cimentación']); expect(screen.getByRole('group', { name: 'Construcción' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en especialidades' }), { target: { value: 'zzz' } });
    expect(screen.queryByRole('checkbox')).toBeNull(); expect(screen.getByText('Ninguna opción coincide con la búsqueda.')).toBeInTheDocument();
  });

  test('la selección persiste al cerrar y Escape cierra el panel y devuelve el foco al botón', () => {
    render(<Prueba inicial={['h2']} />);
    expect(screen.getByRole('button', { name: '1 seleccionada' })).toBeInTheDocument(); expect(screen.getByText('Construcción › Cimentación')).toBeInTheDocument();
    abrir(); expect(screen.getByLabelText('Cimentación')).toBeChecked();
    fireEvent.keyDown(screen.getByRole('group', { name: 'Opciones de especialidades' }), { key: 'Escape' });
    expect(screen.queryByRole('checkbox')).toBeNull(); expect(screen.getByRole('button', { name: '1 seleccionada' })).toHaveFocus();
  });

  test('las flechas recorren las opciones: ↓ desde el buscador entra en la lista y ↑ desde la primera vuelve al buscador', () => {
    render(<Prueba />); abrir();
    const busqueda = screen.getByRole('searchbox', { name: 'Buscar en especialidades' }); expect(busqueda).toHaveFocus();
    fireEvent.keyDown(busqueda, { key: 'ArrowDown' }); const casillas = screen.getAllByRole('checkbox'); expect(casillas[0]).toHaveFocus();
    fireEvent.keyDown(casillas[0]!, { key: 'ArrowDown' }); expect(casillas[1]).toHaveFocus();
    fireEvent.keyDown(casillas[1]!, { key: 'End' }); expect(casillas[casillas.length - 1]).toHaveFocus();
    fireEvent.keyDown(casillas[casillas.length - 1]!, { key: 'Home' }); expect(casillas[0]).toHaveFocus();
    fireEvent.keyDown(casillas[0]!, { key: 'ArrowUp' }); expect(busqueda).toHaveFocus();
    expect(casillas.map(c => c.tabIndex)).toEqual([0, ...Array(casillas.length - 1).fill(-1)]);
  });

  test('sin jerarquía (zonas) no hay títulos de grupo y funciona con muchas opciones con desplazamiento', () => {
    const muchas = Array.from({ length: 60 }, (_, i) => ({ id: `z${i}`, nombre: `Zona ${i + 1}` }));
    render(<Prueba agrupar={false} opciones={muchas} />); abrir();
    expect(screen.getAllByRole('checkbox')).toHaveLength(60); expect(screen.queryAllByRole('group').map(g => g.getAttribute('aria-label'))).not.toContain('Zona 1');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zona 6' } });
    expect(screen.getAllByRole('checkbox').map(c => c.parentElement?.textContent)).toEqual(['Zona 6', 'Zona 60']);
  });
});

describe('BarraLateral', () => {
  const enlaces: EnlaceMenu[] = [{ href: '/buscar', texto: 'Buscar servicios', icono: 'buscar', actual: true }, { href: '/cuenta', texto: 'Mi cuenta', icono: 'cuenta', actual: false }];
  const montar = (ruta = '/buscar', alNavegar = vi.fn()) => render(<BarraLateral ruta={ruta} enlaces={enlaces} alNavegar={alNavegar} cierre={<button type="button">Cerrar sesión</button>} />);
  const simular = (escritorio: boolean) => vi.stubGlobal('matchMedia', (q: string) => ({ matches: escritorio, media: q, addEventListener: () => undefined, removeEventListener: () => undefined }));

  test('en escritorio el menú está siempre visible, con la opción activa marcada y el cierre de sesión dentro de la navegación', () => {
    simular(true); montar();
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getAllByRole('link').map(a => a.textContent)).toEqual(['Buscar servicios', 'Mi cuenta']);
    expect(within(nav).getByRole('link', { name: 'Buscar servicios' })).toHaveAttribute('aria-current', 'page'); expect(within(nav).getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Plataforma Ayacucho' })).toBeInTheDocument();
  });

  test('en celular el menú se abre y se cierra con el botón, con Escape y al elegir una opción; cerrado no es alcanzable', () => {
    simular(false); const alNavegar = vi.fn(); const { rerender } = montar('/buscar', alNavegar);
    const boton = screen.getByRole('button', { name: 'Menú' });
    expect(boton).toHaveAttribute('aria-expanded', 'false'); expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull();
    fireEvent.click(boton); expect(boton).toHaveAttribute('aria-expanded', 'true');
    const nav = screen.getByRole('navigation', { name: 'Navegación principal' }); expect(within(nav).getByRole('link', { name: 'Buscar servicios' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull(); expect(boton).toHaveFocus();
    fireEvent.click(boton); fireEvent.click(within(screen.getByRole('navigation', { name: 'Navegación principal' })).getByRole('link', { name: 'Mi cuenta' })); expect(alNavegar).toHaveBeenCalled();
    rerender(<BarraLateral ruta="/cuenta" enlaces={enlaces} alNavegar={alNavegar} />); expect(screen.queryByRole('navigation', { name: 'Navegación principal' })).toBeNull();
  });
});
