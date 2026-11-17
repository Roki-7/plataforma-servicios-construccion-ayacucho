import { randomUUID } from 'node:crypto';
import { test, expect } from '../../soporte/validacion.js';
test.setTimeout(90000);
for(const perfiles of [['cliente'],['prestador'],['cliente','prestador']]){
test(`CA-AUT-02 ${perfiles.join('+')} lee/edita su cuenta; servidor rechaza petición manipulada`,async({page,browser,browserName},info)=>{
 info.annotations.push({type:'navegador',description:`${browserName} ${browser.version()}`});
  const correo=`${randomUUID()}@example.invalid`,contrasena=' clave ficticia de permisos ';
  const alta=await page.request.post('/api/v1/cuentas',{headers:{Origin:'https://localhost:8443','Idempotency-Key':randomUUID()},data:{correo,contrasena,confirmacionContrasena:contrasena,nombreMostrar:'Titular ficticio',perfiles,politicaPrivacidadAceptada:true,politicaPrivacidadVersion:'001-v1'}});expect(alta.status()).toBe(201);
  await page.goto('/acceso');await page.getByLabel('Correo',{exact:true}).fill(correo);await page.getByLabel('Contraseña',{exact:true}).fill(contrasena);const entrar=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/v1/sesiones');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();const sesion=await(await entrar).json();await page.getByRole('button',{name:'Cerrar sesión'}).waitFor();
  const consulta=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/v1/perfil');await page.goto('/cuenta');expect((await consulta).status()).toBe(200);await expect(page.getByLabel('Nombre para mostrar')).toHaveValue('Titular ficticio');await page.getByLabel('Nombre para mostrar').fill('Nombre permitido');const guardado=page.waitForResponse(r=>r.request().method()==='PATCH'&&new URL(r.url()).pathname==='/api/v1/perfil');await page.getByRole('button',{name:'Guardar cambios'}).click();const respuesta=await guardado;expect(respuesta.status()).toBe(200);const p=await respuesta.json();expect(p.perfiles).toEqual(perfiles);
  const actual=await page.request.post('/api/v1/sesiones',{headers:{Origin:'https://localhost:8443'},data:{correo,contrasena}});expect(actual.status()).toBe(200);const acceso=(await actual.json()).tokenAcceso;
  const manipulado=await page.request.patch('/api/v1/perfil',{headers:{Origin:'https://localhost:8443','Idempotency-Key':randomUUID(),Authorization:`Bearer ${acceso}`},data:{version:p.version,nombreMostrar:'No guardar',cuentaId:randomUUID(),administrador:true}});expect(manipulado.status()).toBe(400);const lectura=await page.request.get('/api/v1/perfil',{headers:{Authorization:`Bearer ${acceso}`}});expect(lectura.status()).toBe(200);expect((await lectura.json()).nombreMostrar).toBe('Nombre permitido');expect(sesion.tokenAcceso?true:false).toBe(true);
  await page.getByRole('button',{name:'Cerrar sesión'}).click();await page.getByRole('button',{name:'Iniciar sesión',exact:true}).waitFor();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
}
