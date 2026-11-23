import { test, expect } from './soporte.js';

/**
 * T075 · Ejecutor de navegador 002. No cubre historias: comprueba que Chromium, Firefox y WebKit, en 360, 768 y 1366 píxeles,
 * llegan al origen HTTPS de la 002 con su CA como única confianza (sin `ignoreHTTPSErrors`), y que cada ejecución registra
 * dispositivo, ancho, versión y entorno sin secretos. Las series T076 a T079 parten de este mismo ejecutor.
 */
const rechazoPorMotor = {
  chromium: /\bERR_CERT_AUTHORITY_INVALID\b/,
  firefox: /\b(?:SEC_ERROR_UNKNOWN_ISSUER|SEC_ERROR_CA_CERT_INVALID|SSL_ERROR_UNKNOWN)\b/,
  webkit: /SSL peer certificate or SSH remote key was not OK|Unacceptable TLS certificate|The certificate for this server is invalid/i,
} as const;

test.describe('ejecutor de navegador 002', () => {
  test('abre la interfaz por HTTPS con la CA 002 y el ancho del proyecto', async ({ page, baseURL, registroDispositivo }) => {
    expect(baseURL).toBe('https://localhost:8444');
    const respuesta = await page.goto('/buscar');
    expect(respuesta?.ok()).toBe(true);
    expect(new URL(page.url()).origin).toBe('https://localhost:8444');
    // Cada motor informa un subconjunto distinto del certificado validado (WebKit no incluye el emisor); se exige todo lo que informe.
    // Que la navegación termine sin ignorar errores de certificado demuestra la confianza en los tres motores.
    const seguridad = await respuesta?.securityDetails();
    if (seguridad?.subjectName) expect(seguridad.subjectName).toBe('localhost');
    if (seguridad?.issuer) expect(seguridad.issuer).toContain('Ayacucho Validacion Local 002 CA');
    if (seguridad?.protocol) expect(seguridad.protocol).toMatch(/^TLS ?1\.[23]$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Plataforma Ayacucho' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Buscar servicios' })).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => window.innerWidth)).toBe(registroDispositivo.anchoViewport);
  });

  test('la API responde por el mismo origen HTTPS', async ({ request }) => {
    const salud = await request.get('/api/v1/salud');
    expect(salud.status()).toBe(200);
    expect(new URL(salud.url()).protocol).toBe('https:');
  });

  test('un certificado no confiable se rechaza (control negativo)', async ({ page, browserName }) => {
    test.skip(process.env['E2E_TLS_NEGATIVAS'] !== 'true', 'El control no confiable solo existe en el ejecutor aislado.');
    const error = await page.goto('https://localhost:9443/').then(() => undefined, (e: unknown) => e as Error);
    expect(error, 'la navegación a un certificado no confiable debe fallar').toBeDefined();
    if (!rechazoPorMotor[browserName].test(error!.message)) {
      // WebKit a veces cancela la navegación antes de informar el motivo; ningún otro motor puede hacerlo.
      expect(browserName).toBe('webkit');
      expect(error!.message).toMatch(/Operation was cancelled/);
    }
    // En cualquier caso el contenido del servidor no confiable nunca se carga (si el motor sigue navegando hacia su página de error, no hay contenido).
    expect(await page.content().catch(() => '')).not.toContain('Control técnico sin datos.');
  });

  test('registra navegador, versión, dispositivo, ancho y entorno sin secretos', async ({ registroDispositivo, browserName }, testInfo) => {
    expect(registroDispositivo.navegador).toBe(browserName);
    expect(registroDispositivo.versionNavegador).toMatch(/^\d+(\.\d+)*/);
    expect(registroDispositivo.dispositivo).toMatch(/^Desktop /);
    expect([360, 768, 1366]).toContain(registroDispositivo.anchoViewport);
    expect(testInfo.project.name).toBe(`${browserName}-${registroDispositivo.anchoViewport}`);
    expect(registroDispositivo.entorno).toMatchObject({ proyectoCompose: 'ayacucho-002-validacion', origen: 'https://localhost:8444', aislamiento: 'efimero' });
    // Recursos descartables propios de la ejecución: ni la base, ni el bucket, ni el espacio Redis de validación.
    expect(registroDispositivo.entorno).toMatchObject({
      baseDatos: expect.stringMatching(/^ayacucho_002_test_[0-9a-f]{32}$/), bucket: expect.stringMatching(/^e2e-[0-9a-f]{32}$/), espacioRedis: expect.stringMatching(/^ayacucho:002:e2e-[0-9a-f]{32}$/),
    });
    const texto = JSON.stringify(registroDispositivo);
    expect(texto).not.toMatch(/postgres(ql)?:\/\/|contrase|password|secret|token|clave|GK[0-9a-f]{16}/i);
  });
});
