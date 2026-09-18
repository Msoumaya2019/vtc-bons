/**
 * Écrans de la version d'essai : bandeau, plafond, licence.
 *
 * L'application COMPLÈTE est montée, et non un écran isolé, parce que ce qui est éprouvé
 * ici est justement le ROUTAGE : quelle route passe par la garde, et quelle route n'y
 * passe pas. Un écran monté à la main ne dirait rien de ce découpage — et c'est le
 * découpage qui porte la promesse faite au chauffeur : atteindre un plafond ne doit
 * jamais rendre inaccessible un document déjà émis.
 *
 * Ce qui n'est PAS éprouvé ici, et qu'il faut dire : l'acceptation d'une licence VALIDE.
 * Elle demande une signature par la clé privée, qui est écartée du dépôt — un test qui
 * en dépendrait échouerait au premier clone. Le chemin « une licence valide lève les
 * plafonds » est prouvé dans `tests/quota.test.ts`, au niveau du service, avec une paire
 * engendrée sur place. Ici, on éprouve le REFUS, qui ne demande aucune clé.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

/**
 * Les services externes sont remplacés : sans cela, monter l'application ferait partir
 * de vrais appels vers Photon et OSRM, et chargerait le moteur de rendu PDF.
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
import { db, effacerToutesLesDonnees, getSettings } from '../src/lib/db';
import { PLAFONDS } from '../src/lib/quota';
import { bonTest, clientTest } from './aides';

const DELAI = 15_000;
vi.setConfig({ testTimeout: 45_000 });

beforeEach(async () => {
  await effacerToutesLesDonnees();
  window.location.hash = '#/';
});

/**
 * Demande une route de façon SYNCHRONE.
 *
 * Écrire dans `location.hash` met l'adresse à jour, mais jsdom ne prévient le routeur que
 * par une `popstate` DIFFÉRÉE d'un `setTimeout(…, 0)`. En émettant l'événement nous-mêmes,
 * dans la même tâche, la fenêtre où une navigation concurrente peut s'intercaler se
 * referme — c'est la redirection « / » vers « /nouveau » qui s'y glissait.
 */
async function allerA(chemin: string) {
  await waitFor(() => expect(window.location.hash).toBe('#/nouveau'), { timeout: DELAI });
  window.location.hash = chemin;
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/** L'application chargée : l'écran d'attente doit avoir disparu. */
async function attendreDemarrage() {
  await waitFor(() => expect(screen.queryByText('Ouverture de vos données locales…')).toBeNull(), {
    timeout: DELAI,
  });
}

/** Monte l'application et attend qu'elle soit prête à répondre. */
async function monterApplication() {
  render(<App />);
  await attendreDemarrage();
}

/** Des bons émis, écrits directement en base : leur nombre suffit à remplir un plafond. */
async function semerBons(nombre: number) {
  await db.bons.bulkPut(
    Array.from({ length: nombre }, (_, index) =>
      bonTest({
        id: `bon-${index + 1}`,
        numero: `BC-2026-${String(index + 1).padStart(4, '0')}`,
      }),
    ),
  );
}

/** Des clients, écrits directement en base : leur nombre suffit à remplir un plafond. */
async function semerClients(nombre: number) {
  await db.clients.bulkPut(
    Array.from({ length: nombre }, (_, index) =>
      clientTest({ id: `client-${index + 1}`, nom: `Client ${index + 1}`, parDefaut: false }),
    ),
  );
}

describe('bandeau d’essai', () => {
  it('annonce le décompte dès le premier document', async () => {
    await monterApplication();

    const bandeau = await screen.findByTestId('bandeau-essai', {}, { timeout: DELAI });
    expect(bandeau.textContent).toContain(`Bons 0/${PLAFONDS.bons}`);
    expect(bandeau.textContent).toContain(`Factures 0/${PLAFONDS.factures}`);
    expect(bandeau.textContent).toContain(`Clients 0/${PLAFONDS.clients}`);
  });

  it('compte les documents déjà émis', async () => {
    await semerBons(3);
    await monterApplication();

    const bandeau = await screen.findByTestId('bandeau-essai', {}, { timeout: DELAI });
    expect(bandeau.textContent).toContain(`Bons 3/${PLAFONDS.bons}`);
  });

  it('reste visible sur les autres onglets, car il ne sert que s’il est vu', async () => {
    await monterApplication();
    await allerA('/bons');

    await screen.findByRole('heading', { name: 'Mes bons de commande' }, { timeout: DELAI });
    expect(await screen.findByTestId('bandeau-essai', {}, { timeout: DELAI })).toBeTruthy();
  });
});

describe('plafond atteint', () => {
  it('remplace le formulaire de création par le panneau', async () => {
    await semerBons(PLAFONDS.bons);
    await monterApplication();

    await allerA('/nouveau');

    const panneau = await screen.findByTestId('ecran-plafond', {}, { timeout: DELAI });
    expect(panneau.textContent).toContain('10 bons de commande sur 10');
    // Le formulaire n'est pas seulement caché : il n'est pas monté.
    expect(screen.queryByText('Nouveau bon de commande')).toBeNull();
  });

  it('laisse les documents déjà émis consultables', async () => {
    await semerBons(PLAFONDS.bons);
    await monterApplication();

    await allerA('/bons');

    // C'est la promesse faite au chauffeur : une facture ou un bon émis doit pouvoir
    // être produit, même quand l'application refuse toute nouvelle création.
    await screen.findByRole('heading', { name: 'Mes bons de commande' }, { timeout: DELAI });
    expect(screen.queryByTestId('ecran-plafond')).toBeNull();
  });

  it('laisse les clients consultables', async () => {
    await semerBons(PLAFONDS.bons);
    await monterApplication();

    await allerA('/clients');

    await screen.findByRole('heading', { name: 'Clients' }, { timeout: DELAI });
    expect(screen.queryByTestId('ecran-plafond')).toBeNull();
  });

  /**
   * Le plafond des clients ne peut PAS se juger sur la route : `/clients` porte à la fois
   * la liste et le formulaire. Le juger là priverait le chauffeur de ses clients existants
   * — c'est-à-dire de ce qui doit rester libre à vie. Il se juge donc à l'ouverture du
   * formulaire, et c'est ce découpage précis que ce test fixe.
   */
  it('remplace le formulaire client par le panneau, sans masquer la liste', async () => {
    await semerClients(PLAFONDS.clients);
    await monterApplication();

    await allerA('/clients');
    await screen.findByRole('heading', { name: 'Clients' }, { timeout: DELAI });

    // La liste reste consultable : aucun panneau tant que rien n'est demandé.
    expect(screen.queryByTestId('ecran-plafond')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Modifier' })).toHaveLength(PLAFONDS.clients);

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    const panneau = await screen.findByTestId('ecran-plafond', {}, { timeout: DELAI });
    expect(panneau.textContent).toContain('10 clients sur 10');
    // Le formulaire n'est pas seulement caché : il n'est pas ouvert, donc « Enregistrer »
    // n'existe pas. Un bouton présent qui échoue à l'enregistrement n'explique rien.
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
  });

  it('laisse corriger un client existant malgré le plafond', async () => {
    await semerClients(PLAFONDS.clients);
    await monterApplication();

    await allerA('/clients');
    await screen.findByRole('heading', { name: 'Clients' }, { timeout: DELAI });

    // « Modifier » ne consomme rien : corriger une faute de frappe ne doit pas coûter
    // un rang sur le plafond, sans quoi le chauffeur cesserait de corriger ses erreurs.
    fireEvent.click(screen.getAllByRole('button', { name: 'Modifier' })[0]);

    await screen.findByText('Modifier le client', {}, { timeout: DELAI });
    expect(screen.queryByTestId('ecran-plafond')).toBeNull();
  });
});

describe('page de licence', () => {
  it('annonce les compteurs de l’essai', async () => {
    await semerBons(2);
    await monterApplication();
    await allerA('/licence');

    const page = await screen.findByTestId('page-licence', {}, { timeout: DELAI });
    expect(page.textContent).toContain(`2 / ${PLAFONDS.bons}`);
  });

  it('refuse un code illisible et n’enregistre RIEN', async () => {
    await monterApplication();
    await allerA('/licence');

    await screen.findByTestId('page-licence', {}, { timeout: DELAI });

    fireEvent.change(screen.getByLabelText('Code reçu'), {
      target: { value: 'ceci-n-est-pas-une-licence' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la licence' }));

    // Le message doit dire que la FORME est mauvaise, et non accuser la signature :
    // envoyer le chauffeur chercher une faute de copie qui n'existe pas serait pire
    // que de ne rien dire.
    await screen.findByText(/n’a pas la bonne forme/, {}, { timeout: DELAI });

    // Le point capital : rien n'a été écrit. Un jeton refusé laissé dans les réglages
    // serait relu au lancement suivant, et le chauffeur croirait avoir débloqué.
    expect((await getSettings()).licence).toBe('');
  });

  it('rappelle que la consultation et l’export restent libres', async () => {
    await monterApplication();
    await allerA('/licence');

    const page = await screen.findByTestId('page-licence', {}, { timeout: DELAI });
    expect(page.textContent).toContain('exporter et sauvegarder');
  });
});
