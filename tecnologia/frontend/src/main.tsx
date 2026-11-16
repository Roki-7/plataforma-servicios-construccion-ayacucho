import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el contenedor de la aplicación.');
createRoot(root).render(<StrictMode><main><h1>Plataforma Ayacucho</h1><p>Preparación técnica. Los recorridos de usuarios todavía no están habilitados.</p></main></StrictMode>);
