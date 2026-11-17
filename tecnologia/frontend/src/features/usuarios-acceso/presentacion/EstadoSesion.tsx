export function EstadoSesion({ cerrar, ocupado }: { cerrar: () => Promise<void>; ocupado: boolean }) {
  return <section aria-label="Estado de sesión"><p>Sesión iniciada.</p><button disabled={ocupado} onClick={() => { void cerrar(); }}>{ocupado ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></section>;
}
