import { randomUUID } from 'node:crypto';
import { test, expect } from '../../soporte/validacion.js';
import type { Page } from '@playwright/test';
test.setTimeout(90000);
// La navegación termina antes que bootstrap y la consulta de perfil. Esperar la
// respuesta real distingue un fallo HTTP de una pantalla que todavía está cargando.
async function consultarCuenta(pagina: Page, accion: () => Promise<unknown>) {
 const lectura=pagina.waitForResponse(r=>r.request().method()==='GET' && new URL(r.url()).pathname==='/api/v1/perfil');
 await accion();expect((await lectura).status()).toBe(200);
 await expect(pagina.getByRole('heading',{name:'Mi cuenta',exact:true})).toBeVisible();
}
test('CA-PER-01 CA-PER-02 CA-PER-05 CA-PER-06 consulta, foto, dos editores y consentimiento del valor',async({page,browser,browserName},info)=>{
 info.annotations.push({type:'navegador',description:`${browserName} ${browser.version()}`});
 const correo=`${randomUUID()}@example.invalid`,contrasena=' clave ficticia de perfil ';
 await page.request.post('/api/v1/cuentas',{headers:{Origin:'https://localhost:8443','Idempotency-Key':randomUUID()},data:{correo,contrasena,confirmacionContrasena:contrasena,nombreMostrar:'Persona ficticia',perfiles:['cliente','prestador'],politicaPrivacidadAceptada:true,politicaPrivacidadVersion:'001-v1'}}).then(r=>expect(r.status()).toBe(201));
 await page.goto('/acceso');await page.getByLabel('Correo',{exact:true}).fill(correo);await page.getByLabel('Contraseña',{exact:true}).fill(contrasena);
 await consultarCuenta(page,()=>page.getByRole('button',{name:'Iniciar sesión',exact:true}).click());
 await expect(page.getByText(correo,{exact:true})).toBeVisible();
 await page.getByLabel('Nombre para mostrar').fill('Empresa ficticia S.A.');
 await page.getByLabel('Teléfono (opcional)').fill('111');
 await page.getByLabel('Distrito (opcional)').fill('Ayacucho');
 const carga = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/v1/perfil/fotografias');
 await page.getByLabel('Fotografía (opcional)').setInputFiles({name:'ficticia.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jS1cAAAAASUVORK5CYII=','base64')});
 expect((await carga).status()).toBe(201);
 await expect(page.getByRole('status')).toContainText('Fotografía cargada');
 await page.getByRole('button',{name:'Guardar cambios'}).click();
 await expect(page.getByRole('img',{name:'Fotografía de mi cuenta'})).toBeVisible();
 await consultarCuenta(page,()=>page.reload());
 await expect(page.getByLabel('Nombre para mostrar')).toHaveValue('Empresa ficticia S.A.');
 await expect(page.getByLabel('Teléfono (opcional)')).toHaveValue('111');
 await expect(page.getByLabel('Distrito (opcional)')).toHaveValue('Ayacucho');
 await expect(page.getByLabel('Autorizo compartir este teléfono.')).not.toBeChecked();
 const otroContexto=await browser.newContext({baseURL:'https://localhost:8443',ignoreHTTPSErrors:false});const segunda=await otroContexto.newPage();try{await segunda.goto('/acceso');await segunda.getByLabel('Correo',{exact:true}).fill(correo);await segunda.getByLabel('Contraseña',{exact:true}).fill(contrasena);await consultarCuenta(segunda,()=>segunda.getByRole('button',{name:'Iniciar sesión',exact:true}).click());await segunda.getByLabel('Nombre para mostrar').waitFor();await page.getByLabel('Autorizo compartir este teléfono.').check();await page.getByRole('button',{name:'Guardar cambios'}).click();await expect(page.getByText('El teléfono está autorizado para compartir.')).toBeVisible();await segunda.getByLabel('Nombre para mostrar').fill('Borrador obsoleto');await segunda.getByRole('button',{name:'Guardar cambios'}).click();await expect(segunda.getByRole('status')).toContainText('Recargue para revisar');await expect(segunda.getByLabel('Nombre para mostrar')).toHaveValue('Borrador obsoleto');await consultarCuenta(segunda,()=>segunda.getByRole('button',{name:'Recargar perfil'}).click());await expect(segunda.getByLabel('Nombre para mostrar')).toHaveValue('Empresa ficticia S.A.');}finally{await otroContexto.close()}
 await page.getByLabel('Teléfono (opcional)').fill('222');await page.getByRole('button',{name:'Guardar cambios'}).click();await expect(page.getByText('El teléfono es privado.')).toBeVisible();await page.getByLabel('Autorizo compartir este teléfono.').check();await page.getByRole('button',{name:'Guardar cambios'}).click();await expect(page.getByText('El teléfono está autorizado para compartir.')).toBeVisible();await page.getByLabel('Autorizo compartir este teléfono.').uncheck();await page.getByRole('button',{name:'Guardar cambios'}).click();await expect(page.getByText('El teléfono es privado.')).toBeVisible();await page.getByRole('button',{name:'Quitar fotografía'}).click();await page.getByRole('button',{name:'Guardar cambios'}).click();await expect(page.getByRole('img',{name:'Fotografía de mi cuenta'})).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
