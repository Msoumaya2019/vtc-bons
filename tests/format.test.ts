import { describe, expect, it } from 'vitest';
import {
  ajouterJours,
  dateLocaleISO,
  formatDate,
  formatDateHeure,
  horodatage,
  joursRestants,
  libelleStatutFacture,
  libelleTypePrestation,
} from '../src/lib/format';

describe('format — dates en heure locale', () => {
  it('formate une date au format français', () => {
    expect(formatDate('2026-03-14')).toBe('14/03/2026');
    expect(formatDate('')).toBe('—');
  });

  it('formate une date et une heure', () => {
    expect(formatDateHeure('2026-03-14', '09:30')).toBe('14/03/2026 à 09:30');
  });

  it('ne décale jamais d’un jour, quel que soit le fuseau', () => {
    // Une implémentation basée sur toISOString() renverrait la veille ou le lendemain
    // selon le fuseau : c'est exactement ce qu'il faut éviter.
    const reference = new Date(2026, 0, 1, 23, 30);
    expect(dateLocaleISO(reference)).toBe('2026-01-01');
    const autre = new Date(2026, 11, 31, 0, 15);
    expect(dateLocaleISO(autre)).toBe('2026-12-31');
  });

  it('ajoute et retire des jours', () => {
    expect(ajouterJours('2026-03-14', 30)).toBe('2026-04-13');
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01');
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('calcule un horodatage exploitable', () => {
    const avant = horodatage('2026-03-14', '08:00');
    const apres = horodatage('2026-03-15', '09:30');
    expect(avant).not.toBeNull();
    expect(apres).not.toBeNull();
    expect(apres! > avant!).toBe(true);
    expect(horodatage('', '08:00')).toBeNull();
  });
});

describe('format — échéances', () => {
  it('calcule les jours restants à partir d’une date de référence', () => {
    const reference = new Date(2026, 2, 14);
    expect(joursRestants('2026-03-14', reference)).toBe(0);
    expect(joursRestants('2026-03-24', reference)).toBe(10);
    expect(joursRestants('2026-03-04', reference)).toBe(-10);
  });

  it('renvoie null quand la date est absente', () => {
    expect(joursRestants('')).toBeNull();
  });
});

describe('format — libellés', () => {
  it('traduit les statuts et les types de prestation', () => {
    expect(libelleStatutFacture('en_retard')).toBe('En retard');
    expect(libelleTypePrestation('transfert_aeroport')).toBe('Transfert aéroport');
  });
});
