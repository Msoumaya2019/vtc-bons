import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { FournisseurToast } from './components/ui/Toast';
import { FournisseurReglages, useReglages } from './context/ReglagesContext';
import { FournisseurClients } from './context/ClientsContext';
import { NouveauBon } from './features/bons/NouveauBon';
import { PageInstantane } from './features/bons/PageInstantane';
import { ListeBons } from './features/bons/ListeBons';
import { DetailBon } from './features/bons/DetailBon';
import { ModeControle } from './features/bons/ModeControle';
import { ListeFactures } from './features/factures/ListeFactures';
import { DetailFacture } from './features/factures/DetailFacture';
import { PageClients } from './features/clients/PageClients';
import { PageReglages } from './features/reglages/PageReglages';
import { PageAide } from './pages/PageAide';

function Chargement() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-transparent"
          style={{ borderTopColor: 'var(--accent)' }}
          aria-hidden="true"
        />
        <p className="texte-muet">Ouverture de vos données locales…</p>
      </div>
    </div>
  );
}

function Application() {
  const { chargement, settings } = useReglages();
  if (chargement || !settings) return <Chargement />;

  return (
    <Routes>
      {/* Le mode contrôle est hors du gabarit : plein écran, sans barre d'onglets,
          pour que l'agent ne voie que la course concernée. */}
      <Route path="/controle/:bonId" element={<ModeControle />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/nouveau" replace />} />
        <Route path="/nouveau" element={<NouveauBon />} />
        <Route path="/instantane" element={<PageInstantane />} />
        <Route path="/bons" element={<ListeBons />} />
        <Route path="/bons/:bonId" element={<DetailBon />} />
        <Route path="/factures" element={<ListeFactures />} />
        <Route path="/factures/:factureId" element={<DetailFacture />} />
        <Route path="/clients" element={<PageClients />} />
        <Route path="/reglages" element={<PageReglages />} />
        <Route path="/aide" element={<PageAide />} />
        <Route path="*" element={<Navigate to="/nouveau" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <FournisseurToast>
      <FournisseurReglages>
        <FournisseurClients>
          {/* HashRouter : indispensable pour un déploiement dans un sous-répertoire
              GitHub Pages, où le serveur ne réécrit pas les routes. */}
          <HashRouter>
            <Application />
          </HashRouter>
        </FournisseurClients>
      </FournisseurReglages>
    </FournisseurToast>
  );
}
