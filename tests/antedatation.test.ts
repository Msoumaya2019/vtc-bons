/**
 * Antédatation de la réservation.
 *
 * Ce fichier protège une seule chose, mais elle est décisive : la LECTURE du réglage.
 *
 * Le chemin normal est couvert par la fusion des valeurs par défaut au chargement. La
 * restauration d'une sauvegarde, non — `src/lib/backup.ts` écrit les réglages de
 * l'archive tels quels. Un export fait avant l'existence de ce réglage le ramène donc à
 * `undefined`, et l'expression naïve `maintenant - undefined * 60_000` vaut alors `NaN`.
 *
 * Le bon partirait avec « NaN-NaN-NaN » comme date de réservation, et il PASSERAIT le
 * contrôle de conformité : celui-ci vérifie que les dates sont renseignées et ordonnées,
 * jamais qu'elles sont des dates. Un justificatif daté du néant, sans aucun message.
 */

import { describe, expect, it } from 'vitest';
import {
  ANTEDATATIONS_PROPOSEES,
  libelleAntedatation,
  minutesAntedatation,
} from '../src/lib/antedatation';

describe('minutesAntedatation', () => {
  it('ramène un réglage absent à zéro, là où le calcul direct donnerait NaN', () => {
    // Ce que produirait le code sans garde-fou. L'assertion est faite ici, et non
    // seulement décrite en commentaire : elle établit que le défaut est bien réel, et
    // donc que la garde protège de quelque chose.
    const sansGarde = new Date(Date.now() - (undefined as unknown as number) * 60_000);
    expect(Number.isNaN(sansGarde.getTime())).toBe(true);

    expect(minutesAntedatation(undefined)).toBe(0);
    expect(Number.isNaN(minutesAntedatation(undefined))).toBe(false);
  });

  it('accepte une durée positive et l’arrondit', () => {
    expect(minutesAntedatation(30)).toBe(30);
    expect(minutesAntedatation(120)).toBe(120);
    expect(minutesAntedatation(45.6)).toBe(46);
  });

  it('refuse tout ce qui n’est pas un nombre utilisable', () => {
    // Une chaîne viendrait d'une sauvegarde éditée à la main, `NaN` d'un calcul raté,
    // et un négatif avancerait la réservation APRÈS la prise en charge — ce que le
    // contrôle de conformité refuse, mais autant ne pas le produire.
    expect(minutesAntedatation('30')).toBe(0);
    expect(minutesAntedatation(Number.NaN)).toBe(0);
    expect(minutesAntedatation(Number.POSITIVE_INFINITY)).toBe(0);
    expect(minutesAntedatation(-30)).toBe(0);
    expect(minutesAntedatation(0)).toBe(0);
    expect(minutesAntedatation(null)).toBe(0);
  });
});

describe('libelleAntedatation', () => {
  it('nomme chaque durée telle qu’elle s’affiche dans les Réglages', () => {
    expect(libelleAntedatation(0)).toBe('Aucune');
    expect(libelleAntedatation(5)).toBe('5 min');
    expect(libelleAntedatation(10)).toBe('10 min');
    expect(libelleAntedatation(30)).toBe('30 min');
    expect(libelleAntedatation(60)).toBe('1 heure');
    expect(libelleAntedatation(120)).toBe('2 heures');
  });

  it('donne un libellé à chacune des durées proposées', () => {
    // Sinon une option de la liste s'afficherait vide, sans que rien ne le signale.
    for (const minutes of ANTEDATATIONS_PROPOSEES) {
      expect(libelleAntedatation(minutes)).not.toBe('');
    }
  });

  it('propose zéro en premier, et zéro veut dire « aucune »', () => {
    // L'ordre compte : c'est la valeur par défaut, et le chauffeur doit pouvoir revenir
    // au comportement d'origine sans chercher.
    expect(ANTEDATATIONS_PROPOSEES[0]).toBe(0);
    expect(libelleAntedatation(ANTEDATATIONS_PROPOSEES[0])).toBe('Aucune');
  });
});
