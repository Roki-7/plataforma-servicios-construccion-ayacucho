import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { BuscarOferta } from '../../../src/features/prestadores-catalogo/presentacion/BuscarOferta.js';
import type { BusquedaWeb } from '../../../src/features/prestadores-catalogo/aplicacion/busqueda.js';

/** T080 · Las tarjetas de resultados muestran categoría, subcategoría, zona y especialidades solo con datos que la consulta pública ya entrega. */
afterEach(cleanup);
const categorias = [{ id: 'c1', nombre: 'Construcción' }, { id: 'c2', nombre: 'Construcción › Albañilería' }, { id: 'c3', nombre: 'Acabados' }];
const pagina = <T,>(elementos: T[]) => ({ elementos, total: elementos.length, pagina: 1, tamano: 20 });
const servicio = (id: string, categoriaId: string) => ({ servicioId: id, prestadorId: 'p1', titulo: `Servicio ${id}`, descripcion: 'Descripción', categoriaId, estado: 'PUBLICADO' as const });
const prestador = (id: string, especialidadesIds: string[]) => ({ prestadorId: id, nombrePublico: `Prestador ${id}`, tipo: 'TECNICO' as const, especialidadesIds, distritos: ['ayacucho' as const], disponibilidadDeclarada: true });
function montar() {
  const buscar = vi.fn(async (tipo: string) => (tipo === 'servicios' ? pagina([servicio('a', 'c2'), servicio('b', 'c3'), servicio('c', 'desconocida')]) : pagina([prestador('x', ['c2', 'c3', 'inactiva']), prestador('y', ['inactiva'])])));
  render(<BuscarOferta busqueda={{ buscar } as unknown as BusquedaWeb} categorias={categorias} alVerPrestador={() => undefined} />);
}

test('cada servicio muestra su categoría y, si la tiene, su subcategoría; sin nombre conocido no muestra nada', async () => {
  montar();
  const a = await screen.findByRole('article', { name: 'Servicio: Servicio a' }); expect(a).toHaveTextContent('Categoría: Construcción'); expect(a).toHaveTextContent('Subcategoría: Albañilería');
  const b = screen.getByRole('article', { name: 'Servicio: Servicio b' }); expect(b).toHaveTextContent('Categoría: Acabados'); expect(b).not.toHaveTextContent('Subcategoría');
  const c = screen.getByRole('article', { name: 'Servicio: Servicio c' }); expect(c).not.toHaveTextContent('Categoría'); expect(c).not.toHaveTextContent('Zona');
});

test('la zona del servicio solo se muestra cuando hay un filtro de zona (el servicio ya cumple ese filtro)', async () => {
  montar(); const a = await screen.findByRole('article', { name: 'Servicio: Servicio a' }); expect(a).not.toHaveTextContent('Zona:');
  fireEvent.change(screen.getByLabelText('Zona de atención'), { target: { value: 'carmen-alto' } }); fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  expect(await within(await screen.findByRole('article', { name: 'Servicio: Servicio a' })).findByText('Zona: Carmen Alto')).toBeInTheDocument();
});

test('cada prestador muestra sus especialidades concretas con nombre conocido y omite las que no se pueden nombrar', async () => {
  montar(); fireEvent.click(await screen.findByRole('radio', { name: 'Prestadores' }));
  const lista = await screen.findByRole('list', { name: 'Especialidades de Prestador x' });
  expect(within(lista).getAllByRole('listitem').map(l => l.textContent)).toEqual(['Construcción › Albañilería', 'Acabados']);
  expect(screen.queryByRole('list', { name: 'Especialidades de Prestador y' })).toBeNull();
});
