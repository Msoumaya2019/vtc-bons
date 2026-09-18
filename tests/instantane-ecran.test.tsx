/**
 * Écran Instantané.
 *
 * Ce fichier vérifie le geste lui-même, et les deux moments où il peut décevoir :
 *
 *  • un profil incomplet doit être annoncé AVANT l'appui. Découvrir au moment où le
 *    client monte qu'il manque un téléphone, c'est exactement ce que cet onglet
 *    existe pour éviter ;
 *  • une réserve doit RESTER à l'écran. Quand le bon part avec l'adresse du profil
 *    plutôt qu'avec la position, l'information ne doit pas disparaître au bout de
 *    quatre secondes dans un message fugace.
 *
 * L'application entière n'est pas montée ici : on rend l'écran avec ses fournisseurs
 * et un routeur en mémoire, ce qui suffit à observer la navigation sans payer le coût
 * d'un démarrage complet.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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

const geoSimule = vi.hoisted(() => ({
  chercherAdresses: vi.fn(),
  calculerDistance: vi.fn(),
  geocoderAdresse: vi.fn(),
  adresseDepuisPosition: vi.fn(),
  positionActuelle: vi.fn(),
  messageEchecPosition: vi.fn(),
}));

vi.mock('../src/lib/geo', () => geoSimule);

import { db, effacerToutesLesDonnees, saveSettings } from '../src/lib/db';
import { FournisseurToast } from '../src/components/ui/Toast';
import { FournisseurReglages } from '../src/context/ReglagesContext';
import { FournisseurClients } from '../src/context/ClientsContext';
import { FournisseurAcces } from '../src/context/AccesContext';
import { PageInstantane } from '../src/features/bons/PageInstantane';
import { PageClients } from '../src/features/clients/PageClients';
import { clientInstantaneTest, clientTest, profilInstantane, reglagesTest } from './aides';
import type { Adresse } from '../src/lib/geo';

const DELAI = 5_000;

const ADRESSE_POSITION: Adresse = {
  libelle: '3 place du Château, 95300 Pontoise',
  longitude: 2.0975,
  latitude: 49.0508,
};

/** L'écran, avec ses fournisseurs et un routeur en mémoire. */
function Harnais() {
  return (
    <FournisseurToast>
      <FournisseurReglages>
        <FournisseurClients>
          <MemoryRouter initialEntries={['/instantane']}>
            <Routes>
              <Route path="/instantane" element={<PageInstantane />} />
              <Route path="/bons/:bonId" element={<p>Fiche du bon</p>} />
              <Route path="/clients" element={<p>Fiche des clients</p>} />
            </Routes>
          </MemoryRouter>
        </FournisseurClients>
      </FournisseurReglages>
    </FournisseurToast>
  );
}

/** Monte l'écran et attend que les réglages soient chargés. */
async function ouvrirEcran() {
  render(<Harnais />);
  await screen.findByRole('heading', { name: 'Instantané' }, { timeout: DELAI });
}

beforeEach(async () => {
  await effacerToutesLesDonnees();
  vi.clearAllMocks();

  geoSimule.messageEchecPosition.mockImplementation(
    (raison: string) => `Position indisponible (${raison}).`,
  );
  geoSimule.positionActuelle.mockResolvedValue({
    ok: true,
    position: { longitude: 2.0969, latitude: 49.0512 },
  });
  geoSimule.adresseDepuisPosition.mockResolvedValue(ADRESSE_POSITION);
  // Ces deux simulations doivent rendre une valeur, et surtout pas `undefined` : le champ
  // d'adresse appelle `.then()` sur le résultat de `chercherAdresses`, depuis une minuterie
  // de frappe. Un `vi.fn()` nu rend `undefined`, et la minuterie lève alors une exception
  // non rattrapée — souvent APRÈS la fin du test, si bien qu'elle est attribuée à un autre
  // fichier et passe pour du bruit sans conséquence.
  //
  // C'est la simulation qui ne ressemblait pas à l'application : en production ces deux
  // fonctions sont `async` et rendent toujours une promesse. `null` pour la distance est la
  // valeur prévue par l'application, qui affiche alors « Distance indisponible ».
  geoSimule.chercherAdresses.mockResolvedValue([]);
  geoSimule.calculerDistance.mockResolvedValue(null);
});

describe('PageInstantane', () => {
  it('explique quoi faire quand aucun profil n’est activé', async () => {
    await saveSettings(reglagesTest());
    await db.clients.put(clientTest());

    await ouvrirEcran();

    expect(await screen.findByText('Aucun profil instantané')).toBeInTheDocument();
  });

  it('résume le profil : destination, prix, paiement et départ', async () => {
    await saveSettings(reglagesTest());
    await db.clients.put(clientInstantaneTest());

    await ouvrirEcran();

    expect(await screen.findByText('Martin Leroy')).toBeInTheDocument();
    expect(
      screen.getByText('Aéroport Charles-de-Gaulle, terminal 2E'),
    ).toBeInTheDocument();
    expect(screen.getByText(/95,00/)).toBeInTheDocument();
    expect(screen.getByText('Départ : votre position')).toBeInTheDocument();
    expect(screen.getByText('Prêt')).toBeInTheDocument();
  });

  it('annonce un profil incomplet AVANT l’appui, et bloque le bouton', async () => {
    await saveSettings(reglagesTest());
    await db.clients.put(clientInstantaneTest({ telephone: '' }));

    await ouvrirEcran();

    expect(await screen.findByText('À compléter')).toBeInTheDocument();
    expect(
      screen.getByText('Ce profil ne peut pas encore générer un bon'),
    ).toBeInTheDocument();
    expect(screen.getByText(/téléphone/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Générer le bon instantané de Martin Leroy' }),
    ).toBeDisabled();
  });

  it('annonce un profil sans prix, et bloque le bouton', async () => {
    // Le prix n'est pas une des sept mentions de l'arrêté : rien, dans le contrôle
    // d'émission, ne s'oppose à un bon à 0 €. Sans une règle propre au profil, la
    // carte afficherait donc « Prêt » et l'appui émettrait un document faux.
    await saveSettings(reglagesTest());
    await db.clients.put(
      clientInstantaneTest({ instantane: profilInstantane({ prixTTCcentimes: 0 }) }),
    );

    await ouvrirEcran();

    expect(await screen.findByText('À compléter')).toBeInTheDocument();
    expect(screen.getByText(/Aucun prix habituel/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Générer le bon instantané de Martin Leroy' }),
    ).toBeDisabled();
  });

  it('génère le bon d’un seul clic et ouvre sa fiche', async () => {
    await saveSettings(reglagesTest());
    await db.clients.put(clientInstantaneTest());

    await ouvrirEcran();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Générer le bon instantané de Martin Leroy' }),
    );

    expect(await screen.findByText('Fiche du bon', {}, { timeout: DELAI })).toBeInTheDocument();

    const bons = await db.bons.toArray();
    expect(bons).toHaveLength(1);
    // Le geste unique tient sa promesse : la position du chauffeur est devenue le
    // lieu de prise en charge, sans qu'il ait rien saisi.
    expect(bons[0].lieuPriseEnCharge).toBe(ADRESSE_POSITION.libelle);
    expect(bons[0].destination).toBe('Aéroport Charles-de-Gaulle, terminal 2E');
    expect(bons[0].statut).toBe('emis');
    expect(bons[0].numero).toBeTruthy();
  });

  it('garde la réserve à l’écran quand la position n’a pas pu être obtenue', async () => {
    geoSimule.positionActuelle.mockResolvedValue({ ok: false, raison: 'refusee' });
    await saveSettings(reglagesTest());
    await db.clients.put(clientInstantaneTest());

    await ouvrirEcran();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Générer le bon instantané de Martin Leroy' }),
    );

    // On ne quitte pas l'écran : le chauffeur doit lire la réserve avant de passer à
    // autre chose. Un message qui s'efface au bout de quatre secondes serait perdu.
    expect(await screen.findByText(/émis, avec une réserve/)).toBeInTheDocument();
    expect(screen.getByText(/repris du profil/)).toBeInTheDocument();
    expect(screen.queryByText('Fiche du bon')).toBeNull();

    // Le bon existe malgré tout, avec le lieu de prise en charge du profil.
    const bons = await db.bons.toArray();
    expect(bons).toHaveLength(1);
    expect(bons[0].lieuPriseEnCharge).toBe('5 avenue Victor Hugo, 75016 Paris');

    // Et la réserve reste consultable : elle mène au bon.
    fireEvent.click(screen.getByRole('button', { name: 'Voir le bon' }));
    expect(await screen.findByText('Fiche du bon', {}, { timeout: DELAI })).toBeInTheDocument();
  });

  it('prévient que la position ne sera pas utilisée si l’aide est coupée', async () => {
    await saveSettings(reglagesTest({ aideAdresse: false }));
    await db.clients.put(clientInstantaneTest());

    await ouvrirEcran();

    expect(await screen.findByText('Aide à la saisie d’adresse coupée')).toBeInTheDocument();
    expect(await screen.findByText(/profils utiliseront leur lieu de prise en charge/)).toBeInTheDocument();
  });

  it('ne propose que les clients dont le profil est activé', async () => {
    await saveSettings(reglagesTest());
    await db.clients.put(clientInstantaneTest());
    await db.clients.put(clientTest({ id: 'client-2', nom: 'Durand Sophie' }));

    await ouvrirEcran();

    expect(await screen.findByText('Martin Leroy')).toBeInTheDocument();
    expect(screen.queryByText('Durand Sophie')).toBeNull();
  });

  it('affiche l’adresse enregistrée quand le profil refuse la position', async () => {
    await saveSettings(reglagesTest());
    await db.clients.put(
      clientInstantaneTest({
        instantane: profilInstantane({ utiliserMaPosition: false }),
      }),
    );

    await ouvrirEcran();

    expect(
      await screen.findByText('Départ : 5 avenue Victor Hugo, 75016 Paris'),
    ).toBeInTheDocument();
  });

  it('n’appelle pas la position quand le profil refuse de l’utiliser', async () => {
    await saveSettings(reglagesTest());
    await db.clients.put(
      clientInstantaneTest({
        instantane: profilInstantane({ utiliserMaPosition: false }),
      }),
    );

    await ouvrirEcran();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Générer le bon instantané de Martin Leroy' }),
    );

    await waitFor(async () => expect(await db.bons.count()).toBe(1), { timeout: DELAI });

    // On attend l'ABOUTISSEMENT, et pas seulement le compteur.
    //
    // `emettreBon` poursuit après l'écriture du brouillon : il numérote, journalise, puis
    // enregistre — un `put` sur le même identifiant. Un test qui s'arrête au compteur laisse
    // cette chaîne en vol, et ce `put` final arrive alors APRÈS l'`effacerToutesLesDonnees()`
    // du test suivant, où il RÉINSÈRE l'enregistrement effacé : `put` est un upsert, pas une
    // mise à jour conditionnelle.
    //
    // Éprouvé par une sonde isolée, puis observé : c'est ce qui faisait apparaître DEUX bons
    // dans le test du double appui, une fois sur trois en suite entière, alors que l'assertion
    // directe de ce test — `positionActuelle` appelé une fois — tenait. Attendre la navigation
    // garantit que toutes les écritures sont terminées avant la fin du test.
    await screen.findByText('Fiche du bon', {}, { timeout: DELAI });
    expect(geoSimule.positionActuelle).not.toHaveBeenCalled();
  });
  it('ne génère qu’un seul bon si le bouton est touché deux fois d’affilée', async () => {
    // Deux appuis traités dans la même passe : sans verrou, l'application émettrait
    // deux bons numérotés pour une seule course, et laisserait un trou dans la
    // séquence — ce que la réglementation interdit.
    await saveSettings(reglagesTest());
    await db.clients.put(clientInstantaneTest());

    await ouvrirEcran();
    const bouton = await screen.findByRole('button', {
      name: 'Générer le bon instantané de Martin Leroy',
    });

    await act(async () => {
      fireEvent.click(bouton);
      fireEvent.click(bouton);
    });

    // Le premier geste aboutit et ouvre la fiche du bon. On attend cet aboutissement
    // plutôt que de guetter un compteur : un compteur qui ne monte jamais au bon
    // chiffre ne produirait qu'un dépassement de délai, qui ne dit rien.
    expect(await screen.findByText('Fiche du bon', {}, { timeout: DELAI })).toBeInTheDocument();

    // La preuve la plus directe : le second geste n'a même pas commencé.
    expect(geoSimule.positionActuelle).toHaveBeenCalledTimes(1);
    expect(await db.bons.count()).toBe(1);
  });
});

/**
 * La fiche client, avec ses fournisseurs.
 *
 * Le routeur n'est pas décoratif. La fiche juge désormais le plafond À L'OUVERTURE du
 * formulaire, et ce verdict vient du fournisseur d'accès, qui relit l'état à chaque
 * changement d'adresse — il lui faut donc une adresse. Le montage échouait sans lui,
 * et c'est une bonne nouvelle : le harnais disait « pas de routeur » du temps où la
 * fiche ne jugeait rien, et il fallait que cela se voie tout de suite plutôt que de
 * laisser croire que la fiche se teste seule.
 */
function HarnaisClients() {
  return (
    <MemoryRouter>
      <FournisseurToast>
        <FournisseurReglages>
          <FournisseurAcces>
            <FournisseurClients>
              <PageClients />
            </FournisseurClients>
          </FournisseurAcces>
        </FournisseurReglages>
      </FournisseurToast>
    </MemoryRouter>
  );
}

describe('profil instantané, depuis la fiche client', () => {
  it('active le profil, pré-remplit le départ et enregistre la course habituelle', async () => {
    await saveSettings(reglagesTest());

    render(<HarnaisClients />);
    await screen.findByRole('heading', { name: 'Clients' }, { timeout: DELAI });

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await screen.findByRole('dialog', { name: 'Nouveau client' });

    // Les champs obligatoires portent l'astérisque et le badge « contrôle » DANS leur
    // balise `label` : leur texte accessible n'est donc pas le libellé seul. D'où les
    // expressions régulières ancrées au début, qui visent le libellé sans l'exiger nu.
    fireEvent.change(screen.getByLabelText(/^Nom/), { target: { value: 'Martin Leroy' } });
    fireEvent.change(screen.getByLabelText(/^Téléphone/), {
      target: { value: '07 98 76 54 32' },
    });
    // L'adresse est saisie AVANT d'activer le profil : c'est elle qui pré-remplit le
    // lieu de prise en charge, et un champ vide ferait échouer la génération.
    fireEvent.change(screen.getByLabelText('Adresse de facturation'), {
      target: { value: '5 avenue Victor Hugo' },
    });
    fireEvent.change(screen.getByLabelText('Code postal'), { target: { value: '75016' } });
    fireEvent.change(screen.getByLabelText('Ville'), { target: { value: 'Paris' } });

    fireEvent.click(screen.getByLabelText('Bon instantané'));

    // Le lieu de prise en charge est repris de la fiche, sans ressaisie.
    const depart = screen.getByLabelText(
      /Lieu de prise en charge \(secours\)/,
    ) as HTMLInputElement;
    expect(depart.value).toContain('5 avenue Victor Hugo');
    expect(depart.value).toContain('75016 Paris');

    fireEvent.change(screen.getByLabelText('Destination habituelle'), {
      target: { value: 'Aéroport Charles-de-Gaulle, terminal 2E' },
    });
    // Requête ancrée : le champ étant obligatoire, son libellé accessible porte un
    // astérisque, et une correspondance exacte ne le trouverait plus.
    fireEvent.change(screen.getByLabelText(/^Prix habituel TTC/), {
      target: { value: '95' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () => expect(await db.clients.count()).toBe(1), { timeout: DELAI });

    const enregistre = (await db.clients.toArray())[0];
    expect(enregistre.nom).toBe('Martin Leroy');
    expect(enregistre.instantane.actif).toBe(true);
    expect(enregistre.instantane.utiliserMaPosition).toBe(true);
    expect(enregistre.instantane.lieuPriseEnCharge).toContain('5 avenue Victor Hugo');
    expect(enregistre.instantane.destination).toBe(
      'Aéroport Charles-de-Gaulle, terminal 2E',
    );
    // Le prix est saisi en TTC — comme le chauffeur l'annonce — et conservé tel quel.
    expect(enregistre.instantane.prixTTCcentimes).toBe(9500);
  });

  it('ne réécrit pas le montant sous les doigts du chauffeur', async () => {
    // Relevé sur un téléphone. Les deux symptômes signalés viennent du même défaut : le
    // champ se réécrivait à chaque frappe, donc le curseur repartait à la fin et le texte
    // tapé était remplacé par sa version formatée.
    //
    //   - taper un chiffre après « 0,00 » donnait « 0,007 », soit 0,7 centime arrondi à
    //     1 centime : le montant semblait ne pas bouger ;
    //   - effacer un caractère de « 0,01 » donnait « 0,0 », aussitôt réécrit « 0,00 » :
    //     la suppression semblait sans effet.
    //
    // Ce test mesure le COMPORTEMENT DU CHAMP, pas la conversion : les valeurs employées
    // n'ont pas besoin d'être des montants plausibles, seulement d'être retapées telles
    // quelles.
    await saveSettings(reglagesTest());

    render(<HarnaisClients />);
    await screen.findByRole('heading', { name: 'Clients' }, { timeout: DELAI });

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await screen.findByRole('dialog', { name: 'Nouveau client' });
    fireEvent.click(screen.getByLabelText('Bon instantané'));

    const prix = screen.getByLabelText(/^Prix habituel TTC/) as HTMLInputElement;

    // Effacer un caractère doit laisser « 0,0 » à l'écran, et non le réécrire « 0,00 ».
    fireEvent.change(prix, { target: { value: '0,0' } });
    expect(prix.value).toBe('0,0');

    // Et un montant en cours de frappe doit rester tel quel, chiffre après chiffre.
    fireEvent.change(prix, { target: { value: '9' } });
    expect(prix.value).toBe('9');
    fireEvent.change(prix, { target: { value: '95' } });
    expect(prix.value).toBe('95');
  });

  it('n’affiche pas les champs du profil tant qu’il n’est pas activé', async () => {
    await saveSettings(reglagesTest());

    render(<HarnaisClients />);
    await screen.findByRole('heading', { name: 'Clients' }, { timeout: DELAI });

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await screen.findByRole('dialog', { name: 'Nouveau client' });

    expect(screen.getByLabelText('Bon instantané')).not.toBeChecked();
    expect(screen.queryByLabelText('Destination habituelle')).toBeNull();
  });

  it('complète un profil ancien, enregistré avant cette fonctionnalité', async () => {
    // Les fiches déjà présentes sur l'appareil n'ont pas de champ `instantane`. Sans
    // normalisation à la lecture, l'onglet Instantané planterait sur les données
    // existantes — c'est-à-dire là où une régression coûte le plus cher.
    await saveSettings(reglagesTest());
    const ancien = clientTest();
    const sansProfil = { ...ancien } as Record<string, unknown>;
    delete sansProfil.instantane;
    await db.clients.put(sansProfil as never);

    await ouvrirEcran();

    expect(await screen.findByText('Aucun profil instantané')).toBeInTheDocument();
  });
});
