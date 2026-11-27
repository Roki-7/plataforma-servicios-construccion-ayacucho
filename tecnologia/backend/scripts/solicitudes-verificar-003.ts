// `solicitudes:verificar:003`: control de fechas de purga, inventario de objetos y contadores.
// Reutiliza el mismo programa que `solicitudes:limpiar:003` con el argumento `verificar`.
process.argv[2] = 'verificar';
await import('./solicitudes-limpiar-003.js');
