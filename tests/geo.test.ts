/**
 * Tests de l'aide à la saisie d'adresse.
 *
 * Aucun appel réel ne part d'ici : `fetch` est remplacé. Ce qui est vérifié, c'est
 * d'abord la ROBUSTESSE — réseau coupé, service en panne, réponse illisible : dans
 * tous les cas la fonction doit rendre la main proprement, parce que le chauffeur
 * doit pouvoir continuer à travailler sans connexion.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCurrentPosition } = vi.hoisted(() => ({ getCurrentPosition: vi.fn() }));

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: { getCurrentPosition },
}));

import {
  adresseDepuisPosition,
  calculerDistance,
  chercherAdresses,
  geocoderAdresse,
  messageEchecPosition,
  positionActuelle,
  reinitialiserGeo,
} from '../src/lib/geo';

const fetchSimule = vi.fn();

/** Réponse Photon : une liste de « features » GeoJSON. */
function photon(features: unknown[]) {
  return { ok: true, json: async () => ({ features }) };
}

function json(donnees: unknown) {
  return { ok: true, json: async () => donnees };
}

/** Le point de Pontoise, réutilisé dans plusieurs tests. */
const PONTOISE = { geometry: { coordinates: [2.0969, 49.0512] } };

beforeEach(() => {
  reinitialiserGeo();
  fetchSimule.mockReset();
  getCurrentPosition.mockReset();
  vi.stubGlobal('fetch', fetchSimule);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chercherAdresses', () => {
  it('n’interroge pas le service pour un texte trop court', async () => {
    const resultat = await chercherAdresses('Pa');

    expect(resultat).toEqual([]);
    expect(fetchSimule).not.toHaveBeenCalled();
  });

  it('transforme une réponse de Photon en adresses utilisables', async () => {
    fetchSimule.mockResolvedValue(
      photon([
        {
          ...PONTOISE,
          properties: {
            housenumber: '12',
            street: 'Rue de la Gare',
            postcode: '95300',
            city: 'Pontoise',
          },
        },
      ]),
    );

    const resultat = await chercherAdresses('12 rue de la Gare Pontoise');

    expect(resultat).toEqual([
      { libelle: '12 Rue de la Gare, 95300 Pontoise', longitude: 2.0969, latitude: 49.0512 },
    ]);
  });

  it('se rabat sur « name » quand Photon n’a pas rempli « street »', async () => {
    // Cas réel : pour une voie, Photon met le nom dans `name` et laisse `street` vide.
    fetchSimule.mockResolvedValue(
      photon([
        {
          ...PONTOISE,
          properties: { name: 'Rue de la Gare', housenumber: '12', postcode: '95420', city: 'Nucourt' },
        },
      ]),
    );

    const [adresse] = await chercherAdresses('rue de la gare');

    expect(adresse.libelle).toBe('12 Rue de la Gare, 95420 Nucourt');
  });

  it('ne répète pas la ville quand elle tient déjà lieu de nom', async () => {
    fetchSimule.mockResolvedValue(
      photon([{ ...PONTOISE, properties: { name: 'Pontoise', postcode: '95300', city: 'Pontoise' } }]),
    );

    const [adresse] = await chercherAdresses('Pontoise');

    expect(adresse.libelle).toBe('95300 Pontoise');
  });

  it('écarte les résultats inexploitables plutôt que de rendre une adresse vide', async () => {
    fetchSimule.mockResolvedValue(
      photon([
        { properties: { name: 'Sans coordonnées' } },
        { geometry: { coordinates: [2.1] }, properties: { name: 'Coordonnées incomplètes' } },
        { ...PONTOISE, properties: { name: 'Pontoise', postcode: '95300', city: 'Pontoise' } },
      ]),
    );

    const resultat = await chercherAdresses('Pontoise');

    expect(resultat).toHaveLength(1);
    expect(resultat[0].libelle).toBe('95300 Pontoise');
  });

  it('renvoie une liste vide si le réseau est coupé', async () => {
    fetchSimule.mockRejectedValue(new Error('Failed to fetch'));

    expect(await chercherAdresses('12 rue de la Gare')).toEqual([]);
  });

  it('renvoie une liste vide si le service répond en erreur', async () => {
    fetchSimule.mockResolvedValue({ ok: false, json: async () => ({}) });

    expect(await chercherAdresses('12 rue de la Gare')).toEqual([]);
  });

  it('renvoie une liste vide si la réponse est illisible', async () => {
    fetchSimule.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('JSON invalide');
      },
    });

    expect(await chercherAdresses('12 rue de la Gare')).toEqual([]);
  });

  it('ne redemande pas au service ce qu’il vient de fournir', async () => {
    fetchSimule.mockResolvedValue(
      photon([{ ...PONTOISE, properties: { name: 'Pontoise', postcode: '95300', city: 'Pontoise' } }]),
    );

    await chercherAdresses('Pontoise');
    await chercherAdresses('Pontoise');

    expect(fetchSimule).toHaveBeenCalledTimes(1);
  });
});

describe('adresseDepuisPosition', () => {
  it('déduit une adresse d’une position, via le géocodage inverse', async () => {
    fetchSimule.mockResolvedValue(
      photon([
        {
          ...PONTOISE,
          properties: {
            name: 'Place du Petit Martroy',
            housenumber: '19',
            postcode: '95300',
            city: 'Pontoise',
          },
        },
      ]),
    );

    const adresse = await adresseDepuisPosition({ longitude: 2.0969, latitude: 49.0512 });

    expect(adresse?.libelle).toBe('19 Place du Petit Martroy, 95300 Pontoise');
    expect(String(fetchSimule.mock.calls[0][0])).toContain('/reverse');
  });

  it('renvoie null quand aucun lieu ne correspond', async () => {
    fetchSimule.mockResolvedValue(photon([]));

    expect(await adresseDepuisPosition({ longitude: 0, latitude: 0 })).toBeNull();
  });
});

describe('geocoderAdresse', () => {
  it('résout une adresse écrite à la main', async () => {
    fetchSimule.mockResolvedValue(
      photon([{ ...PONTOISE, properties: { name: 'Pontoise', postcode: '95300', city: 'Pontoise' } }]),
    );

    const adresse = await geocoderAdresse('Pontoise');

    expect(adresse).toEqual({ libelle: '95300 Pontoise', longitude: 2.0969, latitude: 49.0512 });
  });
});

describe('calculerDistance', () => {
  const depart = { longitude: 2.0969, latitude: 49.0512 };
  const arrivee = { longitude: 2.55, latitude: 49.0097 };

  it('renvoie une distance routière arrondie au dixième de kilomètre', async () => {
    fetchSimule.mockResolvedValue(
      json({ code: 'Ok', routes: [{ distance: 42_234.7, duration: 2_220 }] }),
    );

    expect(await calculerDistance(depart, arrivee)).toEqual({ km: 42.2, minutes: 37 });
  });

  it('construit la trace dans l’ordre longitude, latitude', async () => {
    // OSRM attend « lon,lat;lon,lat ». Inverser les deux donne un point au milieu de
    // l'océan, et une distance absurde plutôt qu'une erreur.
    fetchSimule.mockResolvedValue(json({ code: 'Ok', routes: [{ distance: 1_000, duration: 60 }] }));

    await calculerDistance(depart, arrivee);

    expect(String(fetchSimule.mock.calls[0][0])).toContain('2.0969,49.0512;2.55,49.0097');
  });

  it('renvoie null quand aucun itinéraire n’est trouvé', async () => {
    fetchSimule.mockResolvedValue(json({ code: 'NoRoute' }));

    expect(await calculerDistance(depart, arrivee)).toBeNull();
  });

  it('renvoie null si le service est injoignable', async () => {
    fetchSimule.mockRejectedValue(new Error('Failed to fetch'));

    expect(await calculerDistance(depart, arrivee)).toBeNull();
  });
});

describe('positionActuelle', () => {
  it('renvoie la position quand elle est disponible', async () => {
    getCurrentPosition.mockResolvedValue({ coords: { longitude: 2.0969, latitude: 49.0512 } });

    expect(await positionActuelle()).toEqual({
      ok: true,
      position: { longitude: 2.0969, latitude: 49.0512 },
    });
  });

  it('distingue un refus d’autorisation d’une position indisponible', async () => {
    getCurrentPosition.mockRejectedValue(new Error('User denied Geolocation'));
    expect(await positionActuelle()).toEqual({ ok: false, raison: 'refusee' });

    getCurrentPosition.mockRejectedValue(new Error('Location services are disabled'));
    expect(await positionActuelle()).toEqual({ ok: false, raison: 'indisponible' });

    getCurrentPosition.mockRejectedValue(new Error('Timeout expired'));
    expect(await positionActuelle()).toEqual({ ok: false, raison: 'delai' });
  });
});

describe('messageEchecPosition', () => {
  it('donne un message distinct pour chaque cause', () => {
    const messages = [
      messageEchecPosition('refusee'),
      messageEchecPosition('delai'),
      messageEchecPosition('indisponible'),
    ];

    expect(new Set(messages).size).toBe(3);
    // Le refus est le seul cas où l'utilisateur doit agir dans les réglages du téléphone.
    expect(messages[0]).toContain('réglages');
  });
});
