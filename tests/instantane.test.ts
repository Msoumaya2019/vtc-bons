/**
 * Bon instantané.
 *
 * Ce que ce fichier protège, dans l'ordre d'importance :
 *
 *  1. Un bon instantané est un JUSTIFICATIF. Il doit donc porter les mentions de
 *     l'arrêté, et ne jamais être émis s'il en manque une — même si le chauffeur a
 *     appuyé sur le bouton.
 *  2. Un échec ne doit rien laisser derrière lui. Le chauffeur qui n'a pas de bon
 *     doit repartir avec zéro document, pas avec un brouillon qu'il n'a pas demandé
 *     et qu'il devra démêler plus tard.
 *  3. Une position qui n'a pas pu être convertie en adresse ne doit pas produire un
 *     lieu de prise en charge inventé : on se rabat sur le profil, et on le dit.
 *
 * La génération de PDF est neutralisée : elle est lente et sans rapport avec la
 * logique testée ici. Le service d'adresses est remplacé de la même façon.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { db, effacerToutesLesDonnees } from '../src/lib/db';
import {
  construireBonInstantane,
  genererBonInstantane,
  problemesInstantane,
} from '../src/features/bons/instantane';
import { blocages, verifierConformiteBon } from '../src/features/bons/conformite';
import { ErreurConformite } from '../src/features/bons/service';
import { horodatage } from '../src/lib/format';
import { clientInstantaneTest, clientTest, profilInstantane, reglagesTest } from './aides';
import type { Adresse } from '../src/lib/geo';

const REGLAGES = reglagesTest();

const POSITION = { longitude: 2.0969, latitude: 49.0512 };

const ADRESSE_POSITION: Adresse = {
  libelle: '3 place du Château, 95300 Pontoise',
  longitude: 2.0975,
  latitude: 49.0508,
};

beforeEach(async () => {
  await effacerToutesLesDonnees();
  vi.clearAllMocks();

  geoSimule.messageEchecPosition.mockImplementation(
    (raison: string) => `Échec de position (${raison}).`,
  );
  geoSimule.positionActuelle.mockResolvedValue({ ok: true, position: POSITION });
  geoSimule.adresseDepuisPosition.mockResolvedValue(ADRESSE_POSITION);
});

/**
 * L'horloge n'est figée que par les tests qui en ont besoin, et seulement pour `Date` :
 * geler aussi les minuteries ferait attendre indéfiniment les écritures en base, qui
 * sont asynchrones. On la remet en place après chaque test, sans quoi l'heure gelée
 * déteindrait sur les suivants.
 */
afterEach(() => {
  vi.useRealTimers();
});

describe('construireBonInstantane', () => {
  it('recopie le profil sur le bon', () => {
    const client = clientInstantaneTest();

    const bon = construireBonInstantane(client, REGLAGES, '3 place du Château');

    expect(bon.clientId).toBe(client.id);
    expect(bon.lieuPriseEnCharge).toBe('3 place du Château');
    expect(bon.destination).toBe('Aéroport Charles-de-Gaulle, terminal 2E');
    expect(bon.distanceKm).toBe(32);
    expect(bon.typePrestation).toBe('transfert_aeroport');
    expect(bon.nombrePassagers).toBe(2);
    expect(bon.modePaiement).toBe('cb');
    expect(bon.notesInternes).toBe('Client habituel.');
    expect(bon.lignes).toHaveLength(1);
    expect(bon.lignes[0].libelle).toBe('Transfert aéroport');
  });

  it('convertit le prix TTC du profil en HT, selon le taux des réglages', () => {
    // Le chauffeur annonce 95 € à son client. À 10 % de TVA, le HT est de 86,36 €.
    // S'il était recopié tel quel, le bon afficherait 104,50 € TTC : 9,50 € de trop,
    // réclamés au client.
    const bon = construireBonInstantane(clientInstantaneTest(), REGLAGES, 'Départ');

    expect(bon.lignes[0].prixUnitaireCentimes).toBe(8636);
    expect(bon.lignes[0].tauxTVA).toBe(10);
  });

  it('laisse le prix TTC inchangé en franchise en base', () => {
    // Sans TVA, le HT et le TTC se confondent : convertir diviserait le prix par 1,1
    // et le chauffeur facturerait 86,36 € au lieu des 95 € annoncés.
    const bon = construireBonInstantane(
      clientInstantaneTest(),
      reglagesTest({ regimeTVA: 'franchise_en_base' }),
      'Départ',
    );

    expect(bon.lignes[0].prixUnitaireCentimes).toBe(9500);
    expect(bon.lignes[0].tauxTVA).toBe(0);
  });

  it('retombe sur la désignation par défaut si le profil n’en donne pas', () => {
    const client = clientInstantaneTest({
      instantane: profilInstantane({ libellePrestation: '   ' }),
    });

    const bon = construireBonInstantane(client, REGLAGES, 'Départ');

    expect(bon.lignes[0].libelle).toBe('Transport de personnes');
  });

  it('date la réservation et la prise en charge au même instant, sans antédatation', () => {
    // Comportement d'origine, et toujours celui par défaut : le bon est établi quand le
    // client monte, les deux horodatages valent alors l'instant présent, et la
    // réservation n'est pas antérieure à la prise en charge — elle lui est égale. Un
    // décalage INVERSE serait un blocage ; l'égalité, non.
    const bon = construireBonInstantane(clientInstantaneTest(), REGLAGES, 'Départ');

    expect(bon.dateReservation).toBe(bon.datePriseEnCharge);
    expect(bon.heureReservation).toBe(bon.heurePriseEnCharge);
    expect(bon.dateReservation).not.toBe('');
    expect(bon.heureReservation).not.toBe('');
  });

  it('recule la réservation seule, et laisse la prise en charge à l’instant du geste', () => {
    // Le point de tout le réglage, et il est contre-intuitif. Reculer les DEUX dates les
    // laisserait ÉGALES : le justificatif serait exactement aussi faible qu'avant,
    // simplement daté plus tôt — et il affirmerait une prise en charge déjà passée alors
    // que le client est en train de monter. C'est la SÉPARATION des deux dates qui en
    // fait un justificatif de réservation préalable.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 17, 14, 30));

    const bon = construireBonInstantane(
      clientInstantaneTest(),
      reglagesTest({ antedatationReservationMinutes: 30 }),
      'Départ',
    );

    expect(bon.dateReservation).toBe('2026-09-17');
    expect(bon.heureReservation).toBe('14:00');
    expect(bon.datePriseEnCharge).toBe('2026-09-17');
    expect(bon.heurePriseEnCharge).toBe('14:30');
  });

  it('passe à la veille quand le recul franchit minuit', () => {
    // Le piège classique : soustraire les minutes à l'HEURE seule donnerait « -00:15 »,
    // ou bien « 23:45 » sans changer de jour — un justificatif daté d'un jour trop tard.
    // Le recul porte donc sur un instant, et la date est relue ensuite.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 17, 0, 15));

    const bon = construireBonInstantane(
      clientInstantaneTest(),
      reglagesTest({ antedatationReservationMinutes: 30 }),
      'Départ',
    );

    expect(bon.dateReservation).toBe('2026-09-16');
    expect(bon.heureReservation).toBe('23:45');
    expect(bon.datePriseEnCharge).toBe('2026-09-17');
    expect(bon.heurePriseEnCharge).toBe('00:15');
  });

  it('ne produit pas une date invalide quand le réglage manque à l’appel', () => {
    // Une sauvegarde restaurée peut ne pas porter ce champ : `backup.ts` écrit les
    // réglages de l'archive tels quels. Sans garde-fou, la date deviendrait
    // « NaN-NaN-NaN » — que le contrôle de conformité ACCEPTE, puisqu'il ne juge pas la
    // forme des dates. Un justificatif daté du néant, et sans le moindre message.
    const bon = construireBonInstantane(
      clientInstantaneTest(),
      reglagesTest({ antedatationReservationMinutes: undefined as unknown as number }),
      'Départ',
    );

    expect(bon.dateReservation).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(bon.dateReservation).not.toContain('NaN');
    expect(bon.dateReservation).toBe(bon.datePriseEnCharge);
  });

  it('laisse l’horodatage de création à l’heure réelle', () => {
    // `creeLe` est la trace interne du moment où le document a été produit, et il sert à
    // ordonner la liste des bons. L'antédater aussi ferait mentir le journal d'audit sur
    // la seule chose qu'il doit garantir — et l'antédatation ne regarde que le
    // justificatif remis au client, pas ce que l'application sait de sa propre histoire.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 17, 14, 30));

    const bon = construireBonInstantane(
      clientInstantaneTest(),
      reglagesTest({ antedatationReservationMinutes: 120 }),
      'Départ',
    );

    expect(bon.creeLe).toBe(new Date(2026, 8, 17, 14, 30).toISOString());
    expect(bon.heureReservation).toBe('12:30');
    expect(bon.heurePriseEnCharge).toBe('14:30');
  });

  it('reprend la distance du profil sans interroger le réseau', () => {
    // Le calcul d'itinéraire peut prendre huit secondes. Le mettre dans le geste
    // ferait patienter le chauffeur devant son client : exactement ce que l'onglet
    // Instantané existe pour éviter.
    construireBonInstantane(clientInstantaneTest(), REGLAGES, 'Départ');

    expect(geoSimule.calculerDistance).not.toHaveBeenCalled();
  });
});

describe('problemesInstantane', () => {
  it('ne trouve aucun blocage sur un profil complet', () => {
    expect(blocages(problemesInstantane(clientInstantaneTest(), REGLAGES))).toEqual([]);
  });

  it('ne bloque pas un profil antédaté, et place la réservation avant la prise en charge', () => {
    // L'antédatation recule la réservation SANS toucher à la prise en charge : la
    // chronologie exigée par l'arrêté est donc respectée, et mieux qu'avant — la
    // réservation précède enfin la prise en charge au lieu de lui être égale. Si le
    // réglage reculait les deux dates, ce test passerait aussi ; c'est le suivant, qui
    // fixe l'écart, qui distingue les deux comportements.
    const settings = reglagesTest({ antedatationReservationMinutes: 120 });
    const client = clientInstantaneTest();

    expect(blocages(problemesInstantane(client, settings))).toEqual([]);

    const bon = construireBonInstantane(client, settings, client.instantane.lieuPriseEnCharge);
    const reservation = horodatage(bon.dateReservation, bon.heureReservation) ?? 0;
    const priseEnCharge = horodatage(bon.datePriseEnCharge, bon.heurePriseEnCharge) ?? 0;

    expect(priseEnCharge - reservation).toBe(120 * 60_000);
  });

  it('bloque un client sans téléphone', () => {
    // Mention 4 de l'arrêté. Le profil ne la porte pas : elle vient de la fiche
    // client, et c'est justement pour cela qu'elle doit être vérifiée ici.
    const client = clientInstantaneTest({ telephone: '' });

    const messages = blocages(problemesInstantane(client, REGLAGES)).map((p) => p.message);

    expect(messages.join(' ')).toContain('téléphone');
  });

  it('bloque un profil sans lieu de prise en charge', () => {
    // Même si la position doit le remplacer, le profil doit tenir sans elle : c'est
    // le seul moyen d'être sûr qu'un échec de localisation ne rende pas le bon
    // impossible à émettre.
    const client = clientInstantaneTest({
      instantane: profilInstantane({ lieuPriseEnCharge: '' }),
    });

    const messages = blocages(problemesInstantane(client, REGLAGES)).map((p) => p.message);

    expect(messages.join(' ')).toContain('lieu de prise en charge');
  });

  it('bloque un profil dont le prix n’a pas été renseigné', () => {
    // Le prix n'est PAS une des sept mentions de l'arrêté : un bon à 0 € est
    // légalement valable, et le contrôle de conformité ne le refuse donc pas. C'est
    // précisément pour cela que ce manque doit être signalé ailleurs. Sans cette
    // règle, l'écran annonce « Prêt », le chauffeur appuie devant son client, et
    // repart avec un bon numéroté à 0 €.
    const client = clientInstantaneTest({
      instantane: profilInstantane({ prixTTCcentimes: 0 }),
    });

    const messages = blocages(problemesInstantane(client, REGLAGES)).map((p) => p.message);

    expect(messages.join(' ')).toContain('0 €');
  });

  it('bloque un profil désactivé et vide', () => {
    const problemes = blocages(problemesInstantane(clientTest(), REGLAGES));

    expect(problemes.length).toBeGreaterThan(0);
  });
});

describe('genererBonInstantane', () => {
  it('prend la position du chauffeur comme lieu de prise en charge', async () => {
    const client = clientInstantaneTest();

    const { bon, reserves } = await genererBonInstantane(client, REGLAGES);

    expect(bon.lieuPriseEnCharge).toBe(ADRESSE_POSITION.libelle);
    expect(bon.destination).toBe('Aéroport Charles-de-Gaulle, terminal 2E');
    expect(reserves).toEqual([]);
  });

  it('émet un bon numéroté, figé et muni de son PDF', async () => {
    const { bon } = await genererBonInstantane(clientInstantaneTest(), REGLAGES);

    expect(bon.statut).toBe('emis');
    expect(bon.numero).toBeTruthy();
    // Les copies figées sont prises à l'émission : c'est ce qui garantit qu'un
    // document émis ne changera plus, même si la fiche client est modifiée ensuite.
    expect(bon.clientSnapshot?.nom).toBe('Martin Leroy');
    expect(bon.emetteurSnapshot?.raisonSociale).toBe('Transports Dupont');
    expect(await db.bons.count()).toBe(1);
  });

  it('se rabat sur le profil quand la position est refusée, et le signale', async () => {
    geoSimule.positionActuelle.mockResolvedValue({ ok: false, raison: 'refusee' });

    const { bon, reserves } = await genererBonInstantane(clientInstantaneTest(), REGLAGES);

    expect(bon.lieuPriseEnCharge).toBe('5 avenue Victor Hugo, 75016 Paris');
    expect(reserves.join(' ')).toContain('repris du profil');
    // Le bon part quand même : le chauffeur est devant son client, et le justificatif
    // est conforme. C'est la précision qui manque, pas la validité.
    expect(bon.statut).toBe('emis');
  });

  it('se rabat sur le profil quand l’adresse de la position reste introuvable', async () => {
    // Position obtenue, mais géocodage inverse en échec : c'est le cas hors connexion.
    // Une paire de coordonnées ne peut pas figurer comme lieu de prise en charge, que
    // l'agent doit pouvoir comparer à l'endroit où il contrôle.
    geoSimule.adresseDepuisPosition.mockResolvedValue(null);

    const { bon, reserves } = await genererBonInstantane(clientInstantaneTest(), REGLAGES);

    expect(bon.lieuPriseEnCharge).toBe('5 avenue Victor Hugo, 75016 Paris');
    expect(reserves.join(' ')).toContain('repris du profil');
  });

  it('n’interroge pas la position quand l’aide à la saisie est coupée', async () => {
    // Le réglage promet qu'aucune donnée ne sort de l'appareil. Le géocodage inverse
    // en fait partie : le contourner rendrait ce réglage faux.
    const { bon, reserves } = await genererBonInstantane(
      clientInstantaneTest(),
      reglagesTest({ aideAdresse: false }),
    );

    expect(geoSimule.positionActuelle).not.toHaveBeenCalled();
    expect(geoSimule.adresseDepuisPosition).not.toHaveBeenCalled();
    expect(bon.lieuPriseEnCharge).toBe('5 avenue Victor Hugo, 75016 Paris');
    expect(reserves.join(' ')).toContain('coupée');
  });

  it('n’interroge pas la position quand le profil la refuse', async () => {
    const client = clientInstantaneTest({
      instantane: profilInstantane({ utiliserMaPosition: false }),
    });

    const { bon, reserves } = await genererBonInstantane(client, REGLAGES);

    expect(geoSimule.positionActuelle).not.toHaveBeenCalled();
    expect(bon.lieuPriseEnCharge).toBe('5 avenue Victor Hugo, 75016 Paris');
    expect(reserves).toEqual([]);
  });

  it('n’écrit rien quand le bon ne peut pas être émis', async () => {
    // Le point qui compte le plus : un échec ne doit pas laisser de brouillon. Sinon
    // le chauffeur, croyant n'avoir rien créé, repartirait avec deux documents.
    const client = clientInstantaneTest({ telephone: '' });

    await expect(genererBonInstantane(client, REGLAGES)).rejects.toBeInstanceOf(ErreurConformite);
    expect(await db.bons.count()).toBe(0);
  });

  it('refuse d’émettre un bon à 0 €, sans rien écrire ni numéroter', async () => {
    // Le garde-fou du bouton grisé ne suffit pas : c'est ici que la règle doit tenir.
    // Un numéro consommé pour un document faux laisserait de plus une trace dans une
    // séquence que la réglementation veut continue.
    const client = clientInstantaneTest({
      instantane: profilInstantane({ prixTTCcentimes: 0 }),
    });

    await expect(genererBonInstantane(client, REGLAGES)).rejects.toMatchObject({
      problemes: expect.arrayContaining([expect.stringContaining('0 €')]),
    });
    expect(await db.bons.count()).toBe(0);
  });

  it('dit précisément ce qui manque quand l’émission échoue', async () => {
    const client = clientInstantaneTest({ telephone: '' });

    await expect(genererBonInstantane(client, REGLAGES)).rejects.toMatchObject({
      problemes: expect.arrayContaining([expect.stringContaining('téléphone')]),
    });
  });

  it('produit un bon qui passe le contrôle d’émission, relu depuis la base', async () => {
    // Le contrôle qui compte est celui que subira le bon en cas de contrôle routier.
    // On le rejoue donc sur le document réellement écrit, et non sur l'objet rendu :
    // c'est la seule version qui existe pour l'agent.
    const { bon } = await genererBonInstantane(clientInstantaneTest(), REGLAGES);
    const enBase = await db.bons.get(bon.id);

    expect(enBase).toBeDefined();
    expect(blocages(verifierConformiteBon(enBase!, REGLAGES, clientInstantaneTest()))).toEqual([]);
  });

  it('conserve l’antédatation jusqu’au bon émis, relu depuis la base', async () => {
    // Le réglage doit survivre au chemin complet — position, contrôle, écriture,
    // numérotation, copies figées — et pas seulement à la construction en mémoire.
    // L'écart est mesuré sur le document réellement écrit : c'est la seule version qui
    // existe pour l'agent qui le contrôlera.
    const settings = reglagesTest({ antedatationReservationMinutes: 30 });
    const { bon } = await genererBonInstantane(clientInstantaneTest(), settings);
    const enBase = await db.bons.get(bon.id);

    expect(enBase).toBeDefined();
    const reservation = horodatage(enBase!.dateReservation, enBase!.heureReservation) ?? 0;
    const priseEnCharge = horodatage(enBase!.datePriseEnCharge, enBase!.heurePriseEnCharge) ?? 0;

    expect(priseEnCharge - reservation).toBe(30 * 60_000);
    expect(blocages(verifierConformiteBon(enBase!, settings, clientInstantaneTest()))).toEqual([]);
  });
});
