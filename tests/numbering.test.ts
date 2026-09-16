/**
 * Numérotation : séquence continue, sans trou, sans doublon.
 *
 * C'est un point de conformité, pas un détail cosmétique : une facture dont la séquence
 * présente un trou est une facture non conforme. Ces tests verrouillent donc trois
 * propriétés : l'atomicité de l'incrément, la séparation des séquences, et le fait qu'un
 * document supprimé ne libère jamais son numéro.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { db, effacerToutesLesDonnees } from '../src/lib/db';
import {
  apercuNumero,
  cleCompteur,
  formatNumero,
  optionsDepuisSettings,
  prochainNumero,
} from '../src/lib/numbering';
import { bonTest, reglagesTest } from './aides';

const OPTIONS = { prefixe: 'BC', annee: 2026, reinitialiserChaqueAnnee: true };

beforeEach(async () => {
  await effacerToutesLesDonnees();
});

describe('formatNumero', () => {
  it('complète le rang sur 4 chiffres', () => {
    expect(formatNumero('BC', 2026, 1, true)).toBe('BC-2026-0001');
    expect(formatNumero('BC', 2026, 42, true)).toBe('BC-2026-0042');
    expect(formatNumero('BC', 2026, 999, true)).toBe('BC-2026-0999');
  });

  it('ne tronque pas au-delà de 9999 : le numéro reste unique', () => {
    expect(formatNumero('BC', 2026, 10000, true)).toBe('BC-2026-10000');
  });

  it('omet l’année quand la remise à zéro annuelle est désactivée', () => {
    expect(formatNumero('FA', 2026, 7, false)).toBe('FA-0007');
  });

  it('met le préfixe en majuscules', () => {
    expect(formatNumero('bc', 2026, 1, true)).toBe('bc-2026-0001');
  });
});

describe('cleCompteur', () => {
  it('sépare les compteurs par année quand la remise à zéro est active', () => {
    expect(cleCompteur(OPTIONS)).toBe('BC-2026');
    expect(cleCompteur({ ...OPTIONS, annee: 2027 })).toBe('BC-2027');
  });

  it('utilise un compteur unique sinon', () => {
    expect(cleCompteur({ ...OPTIONS, reinitialiserChaqueAnnee: false })).toBe('BC');
  });
});

describe('optionsDepuisSettings', () => {
  it('choisit le bon préfixe pour chaque type de document', () => {
    const reglages = reglagesTest();
    expect(optionsDepuisSettings(reglages, 'bon', 2026).prefixe).toBe('BC');
    expect(optionsDepuisSettings(reglages, 'facture', 2026).prefixe).toBe('FA');
    expect(optionsDepuisSettings(reglages, 'avoir', 2026).prefixe).toBe('AV');
  });

  it('se rabat sur DOC plutôt que de produire un numéro vide', () => {
    const reglages = reglagesTest({ prefixeBon: '   ' });
    expect(optionsDepuisSettings(reglages, 'bon', 2026).prefixe).toBe('DOC');
  });
});

describe('prochainNumero', () => {
  it('commence à 0001 sur une base vide', async () => {
    await expect(prochainNumero(OPTIONS)).resolves.toBe('BC-2026-0001');
  });

  it('incrémente de 1 à chaque appel, sans trou', async () => {
    const numeros: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      numeros.push(await prochainNumero(OPTIONS));
    }
    expect(numeros).toEqual([
      'BC-2026-0001',
      'BC-2026-0002',
      'BC-2026-0003',
      'BC-2026-0004',
      'BC-2026-0005',
    ]);
  });

  it('ne produit aucun doublon même sous 20 appels simultanés', async () => {
    const numeros = await Promise.all(
      Array.from({ length: 20 }, () => prochainNumero(OPTIONS)),
    );

    expect(new Set(numeros).size).toBe(20);

    // La séquence doit être complète : 1..20, sans trou.
    const rangs = numeros
      .map((numero) => Number(numero.slice(-4)))
      .sort((a, b) => a - b);
    expect(rangs).toEqual(Array.from({ length: 20 }, (_, index) => index + 1));
  });

  it('maintient des séquences indépendantes pour bon, facture et avoir', async () => {
    const bon = await prochainNumero({ prefixe: 'BC', annee: 2026, reinitialiserChaqueAnnee: true });
    const facture = await prochainNumero({
      prefixe: 'FA',
      annee: 2026,
      reinitialiserChaqueAnnee: true,
    });
    const avoir = await prochainNumero({ prefixe: 'AV', annee: 2026, reinitialiserChaqueAnnee: true });

    expect([bon, facture, avoir]).toEqual(['BC-2026-0001', 'FA-2026-0001', 'AV-2026-0001']);
  });

  it('repart à 0001 au changement d’année', async () => {
    await prochainNumero({ prefixe: 'BC', annee: 2026, reinitialiserChaqueAnnee: true });
    await prochainNumero({ prefixe: 'BC', annee: 2026, reinitialiserChaqueAnnee: true });
    const nouvelleAnnee = await prochainNumero({
      prefixe: 'BC',
      annee: 2027,
      reinitialiserChaqueAnnee: true,
    });
    expect(nouvelleAnnee).toBe('BC-2027-0001');
  });

  it('ne libère jamais le numéro d’un document supprimé', async () => {
    const premier = await prochainNumero(OPTIONS);
    await db.bons.put(bonTest({ numero: premier }));
    await db.bons.delete('bon-1');

    const suivant = await prochainNumero(OPTIONS);
    expect(suivant).toBe('BC-2026-0002');
    expect(suivant).not.toBe(premier);
  });
});

describe('apercuNumero', () => {
  it('annonce le prochain numéro sans le consommer', async () => {
    expect(await apercuNumero(OPTIONS)).toBe('BC-2026-0001');
    expect(await apercuNumero(OPTIONS)).toBe('BC-2026-0001');
  });

  it('suit la consommation réelle', async () => {
    await prochainNumero(OPTIONS);
    expect(await apercuNumero(OPTIONS)).toBe('BC-2026-0002');
  });
});
