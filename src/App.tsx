import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { EcouteLienProfond } from './components/EcouteLienProfond';
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
import { PageLicence } from './features/premium/PageLicence';
import { GardeCreation } from './features/premium/GardeCreation';
import { FournisseurAcces } from './context/AccesContext';
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
        {/* Les deux écrans de CRÉATION passent par la garde. Ceux de consultation —
            bons, factures, clients, réglages — n'y passent pas : atteindre un plafond
            ne doit jamais rendre inaccessible un document déjà émis. */}
        <Route
          path="/nouveau"
          element={
            <GardeCreation type="bons">
              <NouveauBon />
            </GardeCreation>
          }
        />
        <Route
          path="/instantane"
          element={
            <GardeCreation type="bons">
              <PageInstantane />
            </GardeCreation>
          }
        />
        <Route path="/bons" element={<ListeBons />} />
        <Route path="/bons/:bonId" element={<DetailBon />} />
        <Route path="/factures" element={<ListeFactures />} />
        <Route path="/factures/:factureId" element={<DetailFacture />} />
        <Route path="/clients" element={<PageClients />} />
        <Route path="/licence" element={<PageLicence />} />
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
            {/* Monté AVANT l'écran d'attente, et non dans les routes : un lien profond
                est alors traité pendant que la base s'ouvre. Placé plus bas, il
                arriverait après la redirection de la racine, et le chauffeur verrait
                apparaître l'assistant de création avant l'onglet qu'il a demandé. */}
            <EcouteLienProfond />
            {/* L'état d'accès est fourni ICI, à l'intérieur du routeur : il se relit à
                chaque changement d'adresse, ce qui dispense les écrans de prévenir
                qui que ce soit après une émission. */}
            <FournisseurAcces>
              <Application />
            </FournisseurAcces>
          </HashRouter>
        </FournisseurClients>
      </FournisseurReglages>
    </FournisseurToast>
  );
}
