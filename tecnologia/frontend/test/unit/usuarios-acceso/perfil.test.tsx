import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PerfilWeb } from '../../../src/features/usuarios-acceso/aplicacion/perfil.js';
import { EditarPerfil } from '../../../src/features/usuarios-acceso/presentacion/EditarPerfil.js';
import { FotoPerfil } from '../../../src/features/usuarios-acceso/presentacion/Perfil.js';
import { ErrorApi, type ApiUsuarios } from '../../../src/features/usuarios-acceso/aplicacion/puertos.js';
import type { Perfil } from '../../../src/features/usuarios-acceso/modelos/contratos.js';
const perfil:Perfil={cuentaId:'ficticia',nombreMostrar:'Persona ficticia',correo:'ficticio@example.invalid',telefono:'111111',distrito:null,fotografiaId:null,perfiles:['cliente'],telefonoCompartible:true,version:2};
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals()});
test('CA-PER-02 guarda empresa y opcionales sin modificar correo, foto ni consentimiento implícitamente',async()=>{const guardar=vi.fn().mockResolvedValue({...perfil,version:3});render(<EditarPerfil perfil={perfil} guardar={guardar} subir={vi.fn()} actualizado={vi.fn()} recargar={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Nombre para mostrar'),{target:{value:'Empresa ficticia'}});fireEvent.change(screen.getByLabelText('Distrito (opcional)'),{target:{value:'Ayacucho'}});fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));await screen.findByText('Perfil actualizado.');expect(guardar).toHaveBeenCalledWith({version:2,nombreMostrar:'Empresa ficticia',distrito:'Ayacucho'});});
test('CA-PER-03 conflicto conserva borrador y no reintenta ni sobrescribe automáticamente',async()=>{const guardar=vi.fn().mockRejectedValue(new ErrorApi(409,'VERSION_DESACTUALIZADA','El perfil cambió.'));const recargar=vi.fn();render(<EditarPerfil perfil={perfil} guardar={guardar} subir={vi.fn()} actualizado={vi.fn()} recargar={recargar}/>);fireEvent.change(screen.getByLabelText('Nombre para mostrar'),{target:{value:'Mi borrador'}});fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));await screen.findByText(/Recargue para revisar/);expect(screen.getByLabelText('Nombre para mostrar')).toHaveValue('Mi borrador');expect(guardar).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Guardar cambios'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Recargar perfil'}));expect(recargar).toHaveBeenCalledTimes(1);});
test('CA-PER-03 errores por campo y límites por puntos de código, sin éxito ante rechazo',async()=>{const guardar=vi.fn();render(<EditarPerfil perfil={perfil} guardar={guardar} subir={vi.fn()} actualizado={vi.fn()} recargar={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Nombre para mostrar'),{target:{value:' '}});fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));expect(await screen.findByText(/Ingrese su nombre para mostrar/i)).toBeVisible();expect(guardar).not.toHaveBeenCalled();expect(screen.getByLabelText('Nombre para mostrar')).not.toHaveAttribute('maxlength');});
test('CA-PER-02 cambiar teléfono retira checkbox heredado; solo decisión explícita autoriza',async()=>{const guardar=vi.fn().mockResolvedValue({...perfil,version:3});render(<EditarPerfil perfil={perfil} guardar={guardar} subir={vi.fn()} actualizado={vi.fn()} recargar={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Teléfono (opcional)'),{target:{value:'222222'}});expect(screen.getByLabelText('Autorizo compartir este teléfono.')).not.toBeChecked();fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));await screen.findByText('Perfil actualizado.');expect(guardar).toHaveBeenCalledWith({version:2,telefono:'222222'});});
test('CA-PER-02 foto temporal no implica guardar perfil y muestra fallo de carga',async()=>{const guardar=vi.fn(),subir=vi.fn().mockRejectedValue(new Error('No se pudo cargar.'));render(<EditarPerfil perfil={perfil} guardar={guardar} subir={subir} actualizado={vi.fn()} recargar={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Fotografía (opcional)'),{target:{files:[new File(['imagen'],'ficticia.png',{type:'image/png'})]}});expect(await screen.findByText('No se pudo cargar.')).toBeVisible();expect(guardar).not.toHaveBeenCalled();});
test('CA-PER-03 web conserva clave del mismo envío y versión obsoleta tras 409',async()=>{let n=0;const enviar=vi.fn().mockRejectedValue(new ErrorApi(409,'VERSION_DESACTUALIZADA','Conflicto'));const r=new PerfilWeb({enviar}as ApiUsuarios,()=>`clave-${++n}`);const d={version:2,nombreMostrar:'Borrador'};await expect(r.guardar(d)).rejects.toThrow();await expect(r.guardar(d)).rejects.toThrow();expect(enviar.mock.calls[0]?.[2].clave).toBe(enviar.mock.calls[1]?.[2].clave);expect(enviar.mock.calls.every(v=>v[1].version===2)).toBe(true);});
test('CA-PER-02 fotografía por API revoca object URL al desmontar',async()=>{const crear=vi.fn().mockReturnValue('blob:ficticio'),revocar=vi.fn();vi.stubGlobal('URL',class extends URL{static createObjectURL=crear;static revokeObjectURL=revocar});const v=render(<FotoPerfil id="foto" leer={vi.fn().mockResolvedValue({fotografiaId:'foto',tipoContenido:'image/png',contenidoBase64:'YQ=='})}/>);await screen.findByRole('img',{name:'Fotografía de mi cuenta'});v.unmount();expect(revocar).toHaveBeenCalledWith('blob:ficticio');});
test('CA-PER-02 foto cargada solo se vincula al guardar explícitamente',async()=>{const guardar=vi.fn().mockResolvedValue({...perfil,fotografiaId:'temporal',version:3});render(<EditarPerfil perfil={perfil} guardar={guardar} subir={vi.fn().mockResolvedValue({fotografiaId:'temporal',tipoContenido:'image/png',bytes:6})} actualizado={vi.fn()} recargar={vi.fn()}/>);fireEvent.change(screen.getByLabelText('Fotografía (opcional)'),{target:{files:[new File(['imagen'],'ficticia.png',{type:'image/png'})]}});expect(await screen.findByText(/Fotografía cargada/)).toBeVisible();expect(guardar).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));await screen.findByText('Perfil actualizado.');expect(guardar).toHaveBeenCalledWith({version:2,fotografiaId:'temporal'});});
import { validarPerfilWeb } from '../../../src/features/usuarios-acceso/aplicacion/perfil.js';
import { AYUDA_TELEFONO } from '../../../src/features/usuarios-acceso/aplicacion/validacion-contacto.js';
// Enmienda controlada de 001 (T080): CA-PER-07 teléfono, CA-PER-08 vacíos a null, CA-PER-09 caracteres de control, CA-PER-10 distrito libre (FR-033).
const MOTIVO_CARACTERES = 'Use solo dígitos, espacios y los signos + - . ( ).';
const montar = (guardar = vi.fn().mockResolvedValue({ ...perfil, version: 3 })) => { render(<EditarPerfil perfil={perfil} guardar={guardar} subir={vi.fn()} actualizado={vi.fn()} recargar={vi.fn()} />); return guardar; };
const guardarCambios = () => fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
test('CA-PER-07 teléfono con letras: error junto al campo, accesible y sin llamar al servidor; al corregirlo se guarda', async () => {
  const guardar = montar(); const campo = screen.getByLabelText('Teléfono (opcional)');
  expect(campo).toHaveAttribute('type', 'tel'); expect(campo).toHaveAttribute('inputmode', 'tel'); expect(screen.getByText(AYUDA_TELEFONO)).toBeVisible();
  fireEvent.change(campo, { target: { value: '984-ABC-1234' } }); guardarCambios();
  const error = await screen.findByText(MOTIVO_CARACTERES);
  expect(error).toBeVisible(); expect(campo).toHaveAttribute('aria-invalid', 'true'); expect(campo.getAttribute('aria-describedby')).toContain(error.id);
  expect(guardar).not.toHaveBeenCalled(); expect(screen.queryByText('Perfil actualizado.')).toBeNull();
  fireEvent.change(campo, { target: { value: '+51 (984) 123-456' } }); guardarCambios();
  await screen.findByText('Perfil actualizado.'); expect(guardar).toHaveBeenCalledWith({ version: 2, telefono: '+51 (984) 123-456' });
});
test.each([['12345', 'Ingrese entre 6 y 15 dígitos.'], ['1234567890123456', 'Ingrese entre 6 y 15 dígitos.'], ['<script>123456', MOTIVO_CARACTERES], ['123456'.padEnd(33), 'Use hasta 32 caracteres.']])('CA-PER-07 teléfono %j se rechaza con su motivo', async (valor, motivo) => {
  const guardar = montar(); fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: valor } }); guardarCambios();
  expect(await screen.findByText(motivo)).toBeVisible(); expect(guardar).not.toHaveBeenCalled();
});
test.each(['984123456', '+51 984 123 456', '(01) 234-5678', '123456', '123456789012345', '123456'.padEnd(32)])('CA-PER-07 teléfono válido %j se envía', async (valor) => {
  const guardar = montar(); fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: valor } }); guardarCambios();
  await screen.findByText('Perfil actualizado.'); expect(guardar).toHaveBeenCalledWith({ version: 2, telefono: valor });
});
test('CA-PER-08 teléfono y distrito vacíos o de solo espacios se envían como null', async () => {
  const guardar = vi.fn().mockResolvedValue({ ...perfil, telefono: null, distrito: null, version: 3 });
  render(<EditarPerfil perfil={{ ...perfil, distrito: 'Huamanga' }} guardar={guardar} subir={vi.fn()} actualizado={vi.fn()} recargar={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '   ' } }); fireEvent.change(screen.getByLabelText('Distrito (opcional)'), { target: { value: '' } }); guardarCambios();
  await screen.findByText('Perfil actualizado.'); expect(guardar).toHaveBeenCalledWith({ version: 2, telefono: null, distrito: null });
});
test('CA-PER-08 un teléfono de solo espacios cuando no había teléfono no envía ningún cambio de ese campo', async () => {
  const guardar = vi.fn().mockResolvedValue({ ...perfil, telefono: null, version: 2 });
  render(<EditarPerfil perfil={{ ...perfil, telefono: null }} guardar={guardar} subir={vi.fn()} actualizado={vi.fn()} recargar={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Teléfono (opcional)'), { target: { value: '    ' } }); guardarCambios();
  await screen.findByText('Perfil actualizado.'); expect(guardar).toHaveBeenCalledWith({ version: 2 });
});
test('CA-PER-09 un tabulador en el nombre o el distrito se rechaza con su motivo, accesible, sin llamar al servidor', async () => {
  const guardar = montar();
  fireEvent.change(screen.getByLabelText('Nombre para mostrar'), { target: { value: 'Ana\tPérez' } }); fireEvent.change(screen.getByLabelText('Distrito (opcional)'), { target: { value: 'Ayacucho\u2028' } }); guardarCambios();
  const nombre = await screen.findByText('El nombre no puede incluir saltos de línea, tabuladores ni otros caracteres de control.');
  const distrito = await screen.findByText('El distrito no puede incluir saltos de línea, tabuladores ni otros caracteres de control.');
  expect(screen.getByLabelText('Nombre para mostrar')).toHaveAttribute('aria-invalid', 'true'); expect(screen.getByLabelText('Nombre para mostrar').getAttribute('aria-describedby')).toContain(nombre.id);
  expect(screen.getByLabelText('Distrito (opcional)').getAttribute('aria-describedby')).toContain(distrito.id); expect(guardar).not.toHaveBeenCalled();
});
test('CA-PER-09 validación de caracteres de control en los tres campos (NUL, saltos de línea, tabuladores, DEL y separadores Unicode) y nombres válidos de personas y empresas', () => {
  const NUL = String.fromCharCode(0);
  for (const c of [NUL, '\n', '\r', '\t', '\u007f', '\u0085', '\u2028', '\u2029']) {
    for (const campo of ['nombreMostrar', 'telefono', 'distrito'] as const) expect(validarPerfilWeb({ version: 1, [campo]: `98${c}1234` })).toHaveProperty(campo);
  }
  for (const nombre of ['María Ñañez-Quispe', "Constructora O'Brien & Hijos S.A.C.", 'Ferretería "Los Andes" (2024)', '𠮷野家 建設']) expect(validarPerfilWeb({ version: 1, nombreMostrar: nombre })).toEqual({});
  expect(validarPerfilWeb({ version: 1, nombreMostrar: '   ' })).toEqual({ nombreMostrar: 'Ingrese su nombre para mostrar.' });
  expect(validarPerfilWeb({ version: 1, nombreMostrar: '𠮷'.repeat(201) })).toHaveProperty('nombreMostrar');
});
test('CA-PER-10 el distrito es texto libre de hasta 100 caracteres: se envía tal cual, sin lista cerrada', async () => {
  for (const distrito of ['Huamanga', 'Distrito que no existe 123 !@#', 'Ñuñoa']) {
    cleanup(); const guardar = montar(); fireEvent.change(screen.getByLabelText('Distrito (opcional)'), { target: { value: distrito } }); guardarCambios();
    await screen.findByText('Perfil actualizado.'); expect(guardar).toHaveBeenCalledWith({ version: 2, distrito });
  }
  expect(validarPerfilWeb({ version: 1, distrito: 'a'.repeat(100) })).toEqual({}); expect(validarPerfilWeb({ version: 1, distrito: 'a'.repeat(101) })).toEqual({ distrito: 'Use hasta 100 caracteres.' });
  expect(screen.queryByRole('combobox')).toBeNull();
});
