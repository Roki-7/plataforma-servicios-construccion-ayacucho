export function EstadoSesion({ cerrar, ocupado }: { cerrar: () => Promise<void>; ocupado: boolean }) {
  return <button type="button" className="accion-secundaria cierre-sesion" disabled={ocupado} onClick={() => { void cerrar(); }}>{ocupado ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>;
}
