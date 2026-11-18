import { X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { get } from 'node:https';
import type { TLSSocket } from 'node:tls';
import type { Page, Request } from '@playwright/test';
import { test, expect } from '../soporte/validacion.js';

const urlControl = 'https://localhost:9443/';
const rechazoPorMotor = {
  chromium: /\bERR_CERT_AUTHORITY_INVALID\b/,
  firefox: /\b(?:SEC_ERROR_UNKNOWN_ISSUER|SEC_ERROR_CA_CERT_INVALID|SSL_ERROR_UNKNOWN)\b/,
  webkit: /SSL peer certificate or SSH remote key was not OK|Unacceptable TLS certificate|The certificate for this server is invalid/i,
};

function consultarControl(host: string, ca: Buffer): Promise<{ http: number | undefined; huella: string }> {
  return new Promise((resolver, rechazar) => {
    const solicitud = get({ host, port: 9443, servername: 'localhost', ca, rejectUnauthorized: true, agent: false }, respuesta => {
      const huella = (respuesta.socket as TLSSocket).getPeerCertificate().fingerprint256;
      respuesta.once('error', rechazar);
      respuesta.once('end', () => resolver({ http: respuesta.statusCode, huella }));
      respuesta.resume();
    });
    solicitud.once('error', rechazar);
    solicitud.setTimeout(5000, () => solicitud.destroy(new Error(`El control 9443 en ${host} no respondió`)));
  });
}

async function comprobarControl(): Promise<string> {
  const rutaControl = process.env['E2E_TLS_CONTROL_CERT'];
  const rutaCA = process.env['NODE_EXTRA_CA_CERTS'];
  if (!rutaControl || !rutaCA) throw new Error('El ejecutor de Fundación debe indicar el certificado de control y la CA de validación.');
  const [control, ca] = await Promise.all([readFile(rutaControl), readFile(rutaCA)]);
  const huella = new X509Certificate(control).fingerprint256;
  // Solo la sonda Node confía en el certificado efímero para comprobar el servicio y su identidad.
  for (const direccion of ['127.0.0.1', '::1']) {
    expect(await consultarControl(direccion, control)).toEqual({ http: 200, huella });
  }
  await expect(consultarControl('127.0.0.1', ca)).rejects.toMatchObject({ code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  return huella;
}

async function comprobarRechazo(pagina: Page, motor: keyof typeof rechazoPorMotor): Promise<string> {
  let falloPeticion: string | undefined;
  const registrarFallo = (peticion: Request) => {
    if (peticion.isNavigationRequest() && peticion.url() === urlControl) falloPeticion = peticion.failure()?.errorText;
  };
  pagina.on('requestfailed', registrarFallo);
  try {
    await pagina.goto(urlControl, { waitUntil: 'commit' });
  } catch (error) {
    const patron = rechazoPorMotor[motor];
    const mensaje = error instanceof Error ? error.message.split('\n')[0]! : '';
    const motivo = patron.exec(falloPeticion ?? '')?.[0] ?? patron.exec(mensaje)?.[0];
    if (motivo) return motivo;
    throw error;
  } finally {
    pagina.off('requestfailed', registrarFallo);
  }
  throw new Error('El navegador aceptó el certificado no confiable del control 9443.');
}

test('Fundación: aplicación base, salud técnica y confianza TLS', async ({ page, request, browser, browserName, correoApi }, info) => {
  info.annotations.push({ type: 'navegador', description: `${browserName} ${browser.version()}` });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Plataforma Ayacucho' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crear cuenta', exact: true })).toBeVisible();
  const salud = await request.get('/api/v1/salud');
  expect(salud.status()).toBe(200);
  expect(await salud.json()).toEqual({ estado: 'disponible' });
  expect((await request.get(correoApi + '/api/v1/messages')).status()).toBe(200);
  if (process.env['E2E_TLS_NEGATIVAS'] === 'true') {
    const huella = await comprobarControl();
    let motivo: string;
    try {
      motivo = await comprobarRechazo(page, browserName);
    } catch (error) {
      if (browserName !== 'webkit' || !(error instanceof Error) || !error.message.includes('Operation was cancelled; maybe frame was detached?')) throw error;
      info.annotations.push({ type: 'tls', description: 'WebKit canceló la primera navegación. Se repitió el control en otra página.' });
      const control = await page.context().newPage();
      try {
        await control.goto('/');
        motivo = await comprobarRechazo(control, browserName);
      } finally { await control.close(); }
    }
    info.annotations.push({ type: 'tls', description: `Control 9443 disponible en IPv4 e IPv6. SHA-256 ${huella}. Rechazo del navegador ${motivo}.` });
  }
});
