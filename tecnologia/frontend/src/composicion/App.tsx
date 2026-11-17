import { useEffect, useState } from 'react';
import { Registro } from '../features/usuarios-acceso/presentacion/Registro.js';
import { HabilitarPerfil } from '../features/usuarios-acceso/presentacion/HabilitarPerfil.js';
import type { Perfil } from '../features/usuarios-acceso/modelos/contratos.js';
import { usuarios, sesionValidacion } from './usuarios-acceso.js';
import './estilos.css';
export function App() {
  const [perfil, setPerfil] = useState<Perfil>(); const habilitacion = location.pathname === '/habilitar-perfil';
  useEffect(() => { if (habilitacion) void sesionValidacion().then(setPerfil); }, [habilitacion]);
  return <main><header><h1>Plataforma Ayacucho</h1><nav><a href="/registro">Crear cuenta</a> · <a href="/habilitar-perfil">Mis perfiles</a></nav></header>{habilitacion ? perfil ? <><p className="aviso">Sesión ficticia de validación; no constituye inicio de sesión.</p><HabilitarPerfil perfilInicial={perfil} habilitar={usuarios.habilitar} /></> : <section><h2>Sesión requerida</h2><p>Necesita una sesión vigente para añadir perfiles. El inicio de sesión estará disponible en la próxima etapa.</p></section> : <Registro registrar={usuarios.registrar} />}</main>;
}
