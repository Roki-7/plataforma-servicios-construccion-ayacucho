/** Solo patrones del contrato, nunca URL, query, cookies, cabeceras ni body. */
export function eventoPeticion(metodo: string, patron: string | undefined, http: number): string {
  const seguro = patron?.replace(/\{[^}]+\}/g, ':redactado') ?? 'ruta_no_catalogada';
  return JSON.stringify({ metodo: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'].includes(metodo) ? metodo : 'OTRO', ruta: seguro, http });
}
