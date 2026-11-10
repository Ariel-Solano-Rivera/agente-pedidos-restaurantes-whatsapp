import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Sistema de diseño primero; los estilos de cada página llegan con App.
import './design/tokens.css';
import './design/components.css';
import App from './App';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
