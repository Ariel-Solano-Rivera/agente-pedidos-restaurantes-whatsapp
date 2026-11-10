import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Orden: estilos antiguos (páginas aún no rediseñadas), luego el sistema de diseño; los de cada página llegan con App.
import './styles.css';
import './design/tokens.css';
import './design/components.css';
import App from './App';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
