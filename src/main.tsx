import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const conteneur = document.getElementById('root');
if (!conteneur) {
  throw new Error('Élément racine introuvable dans index.html.');
}

createRoot(conteneur).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
