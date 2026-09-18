/**
 * L'application LIVRÉE : la vente est éteinte.
 *
 * Ce fichier est le seul qui n'ait aucun remplacement de `src/lib/vente.ts`. Il éprouve
 * donc ce que l'utilisateur a réellement entre les mains, et pas seulement le mécanisme :
 * aucun plafond ne s'applique, aucun bandeau d'essai ne s'affiche, aucune garde ne remplace
 * un formulaire.
 *
 * Sa raison d'être est la réversibilité. Partout ailleurs, les tests du plafond allument la
 * vente (`tests/quota.test.ts`, `tests/premium-ecran.test.tsx`) pour que le mécanisme reste
 * éprouvé pendant qu'il est éteint. Le risque, en procédant ainsi, est d'oublier de vérifier
 * l'autre face : un interrupteur laissé à `true` par inadvertance remettrait un plafond sur
 * une application qu'on voulait libre, et AUCUN autre test ne le dirait — tous l'ayant
 * remplacé par `true`.
 *
 * D'où le premier test, qui fige la valeur livrée. S'il tombe, ce n'est pas une régression
 * du mécanisme : c'est que la vente vient d'être rallumée, et qu'il faut alors décider
 * consciemment du sort de ce fichier — le supprimer, ou l'adapter à la nouvelle donne.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Les services externes sont remplacés, comme dans `tests/premium-ecran.test.tsx` : sans
 * cela, monter l'application ferait partir de vrais appels vers Photon et OSRM, et
 * chargerait le moteur de rendu PDF. `vente.ts` n'est PAS remplacé — c'est tout l'objet.
 */
const geoSimule = vi.hoisted(() => ({
  chercherAdresses: vi.fn(),
  calculerDistance: vi.fn(),
  geocoderAdresse: vi.fn(),
  adresseDepuisPosition: vi.fn(),
  positionActuelle: vi.fn(),
  messageEchecPosition: vi.fn(),
}));

vi.mock('../src/lib/geo', () => geoSimule);

vi.mock('../src/lib/pdf/generate', () => ({
  genererEtStockerPdfBon: vi.fn(async () => null),
  genererEtStockerPdfFacture: vi.fn(async () => null),
  creerPdfBon: vi.fn(),
  creerPdfFacture: vi.fn(),
  regenererPdfBon: vi.fn(),
  regenererPdfFacture: vi.fn(),
  estPdfValide: vi.fn(async () => true),
  partagerPdf: vi.fn(),
}));

import { App } from '../src/App';
import { etatAcces, verifierAcces } from '../src/lib/acces';
import { db, effacerToutesLesDonnees } from '../src/lib/db';
import { PLAFONDS } from '../src/lib/quota';
import { VENTE_ACTIVE } from '../src/lib/vente';
import { bonTest, clientTest, factureTest } from './aides';

const DELAI = 15_000;
vi.setConfig({ testTimeout: 45_000 });

beforeEach(async () => {
  await effacerToutesLesDonnees();
  window.location.hash = '#/';
});

/**
 * Demande une route de façon SYNCHRONE — même raison que dans `premium-ecran.test.tsx` :
 * jsdom ne prévient le routeur que par une `popstate` différée, et la redirection « / »
 * vers « /nouveau » se glisse dans cette fenêtre.
 */
async function allerA(chemin: string) {
  await waitFor(() => expect(window.location.hash).toBe('#/nouveau'), { timeout: DELAI });
  window.location.hash = chemin;
  window.dispatchEvent(new PopStateEvent('popstate'));
}

async function monterApplication() {
  render(<App />);
  await waitFor(() => expect(screen.queryByText('Ouverture de vos données locales…')).toBeNull(), {
    timeout: DELAI,
  });
}

/**
 * Attend que le fournisseur d'accès ait rendu son verdict.
 *
 * Rien à l'écran ne reflète cet état quand la vente est éteinte — c'est précisément ce que
 * ce fichier éprouve. Le seul témoin disponible est donc la GARDE de `/nouveau` : elle rend
 * `null` tant que la lecture n'est pas faite, si bien que le formulaire visible vaut preuve
 * du verdict. Le fournisseur ne remet jamais `chargement` à vrai, ni `etat` à `null` : une
 * fois obtenu, le verdict reste acquis pour la suite du test.
 *
 * Sans cette attente, `estBloque(null, …)` vaut FAUX et un clic part trop tôt. Mesuré : en
 * rallumant la vente, les deux tests de formulaire restaient verts — ils passaient donc
 * pour une mauvaise raison, et ne détectaient plus rien.
 */
async function attendreVerdictAcces() {
  await allerA('/nouveau');
  await screen.findByText('Nouveau bon de commande', {}, { timeout: DELAI });
}

/**
 * De quoi dépasser les trois plafonds nominaux d'un coup.
 *
 * Le dépassement est volontaire : c'est la seule façon de distinguer « le plafond est
 * éteint » de « le plafond n'est pas encore atteint ». Une application libre et une
 * application d'essai se comportent identiquement en dessous de dix documents.
 */
async function semerAuDelaDesPlafonds() {
  const auDela = PLAFONDS.bons + 5;
  await db.bons.bulkPut(
    Array.from({ length: auDela }, (_, index) =>
      bonTest({
        id: `bon-${index + 1}`,
        numero: `BC-2026-${String(index + 1).padStart(4, '0')}`,
      }),
    ),
  );
  await db.factures.bulkPut(
    Array.from({ length: auDela }, (_, index) =>
      factureTest({
        id: `facture-${index + 1}`,
        numero: `FA-2026-${String(index + 1).padStart(4, '0')}`,
      }),
    ),
  );
  await db.clients.bulkPut(
    Array.from({ length: auDela }, (_, index) =>
      clientTest({ id: `client-${index + 1}`, nom: `Client ${index + 1}`, parDefaut: false }),
    ),
  );
}

describe('vente éteinte', () => {
  it('est la valeur livrée, et non un réglage qu’on aurait oublié', () => {
    // Voir l'en-tête : si cette ligne tombe, la vente vient d'être rallumée, et ce fichier
    // doit être revu consciemment plutôt que réparé machinalement.
    expect(VENTE_ACTIVE).toBe(false);
  });

  it('ne refuse plus aucune création, même au-delà des plafonds', async () => {
    await semerAuDelaDesPlafonds();

    await expect(verifierAcces('bons')).resolves.toBeUndefined();
    await expect(verifierAcces('factures')).resolves.toBeUndefined();
    await expect(verifierAcces('clients')).resolves.toBeUndefined();
  });

  it('annonce un état d’accès sans blocage ni verrouillage', async () => {
    await semerAuDelaDesPlafonds();
    const etat = await etatAcces();

    expect(etat.venteActive).toBe(false);
    expect(etat.partiellementBloque).toBe(false);
    expect(etat.verrouille).toBe(false);

    // Le compte reste ANNONCÉ, et c'est voulu : c'est ce qui a été consommé, et cela reste
    // vrai. C'est l'atteinte du plafond qui est éteinte, pas le comptage.
    expect(etat.quotas.bons.utilise).toBeGreaterThan(PLAFONDS.bons);
    expect(etat.quotas.bons.atteint).toBe(false);
  });

  it('n’affiche aucun bandeau d’essai, même au-delà des plafonds', async () => {
    await semerAuDelaDesPlafonds();
    await monterApplication();
    await attendreVerdictAcces();

    // Le bandeau est le seul endroit qui annonçait des chiffres au chauffeur. S'il
    // apparaissait ici, il annoncerait « Bons 15/10 » à quelqu'un que rien ne limite.
    expect(screen.queryByTestId('bandeau-essai')).toBeNull();
    expect(screen.queryByTestId('bandeau-grace')).toBeNull();
  });

  it('ouvre le formulaire de création au lieu du panneau de plafond', async () => {
    await semerAuDelaDesPlafonds();
    await monterApplication();
    await attendreVerdictAcces();

    expect(screen.queryByTestId('ecran-plafond')).toBeNull();
  });

  it('ouvre le formulaire client, sans masquer la liste', async () => {
    await semerAuDelaDesPlafonds();
    await monterApplication();
    // Le verdict est obtenu AVANT de naviguer : la fiche client juge le plafond à
    // l'ouverture du formulaire, et un clic parti trop tôt ne prouverait rien.
    await attendreVerdictAcces();

    await allerA('/clients');
    await screen.findByRole('heading', { name: 'Clients' }, { timeout: DELAI });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await screen.findByRole('dialog', { name: 'Nouveau client' }, { timeout: DELAI });
    expect(screen.queryByTestId('ecran-plafond')).toBeNull();
  });

  /**
   * « Éteinte » et non « effacée ».
   *
   * Plus aucun lien de l'application ne mène à la page de licence — le bandeau qui y
   * renvoyait et le panneau de plafond ont disparu avec le plafond. La page, elle, est
   * toujours là, et toujours capable d'enregistrer une licence : c'est ce qui rend le
   * rallumage de la vente sans chantier. Ce test fixe les deux moitiés à la fois.
   */
  it('laisse la page de licence en place, quoique plus atteignable par l’interface', async () => {
    await monterApplication();
    await allerA('/licence');

    const page = await screen.findByTestId('page-licence', {}, { timeout: DELAI });
    expect(page).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enregistrer la licence' })).toBeTruthy();
  });
});
