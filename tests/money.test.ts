import { describe, expect, it } from 'vitest';
import {
  arrondiCentimes,
  centimesVersEuros,
  eurosVersCentimes,
  formatEuros,
  formatSaisieEuros,
  parseSaisieEuros,
  pourcentageDe,
} from '../src/lib/money';

describe('money — conversions', () => {
  it('convertit des euros en centimes entiers', () => {
    expect(eurosVersCentimes(10)).toBe(1000);
    expect(eurosVersCentimes(110.5)).toBe(11050);
    expect(Number.isInteger(eurosVersCentimes(0.07))).toBe(true);
  });

  it('convertit des centimes en euros', () => {
    expect(centimesVersEuros(1234)).toBe(12.34);
  });

  it('arrondit au centime le plus proche', () => {
    expect(arrondiCentimes(0.4)).toBe(0);
    expect(arrondiCentimes(0.5)).toBe(1);
    expect(arrondiCentimes(1.5)).toBe(2);
    expect(arrondiCentimes(-0.5)).toBe(-1);
  });

  it('calcule un pourcentage arrondi', () => {
    expect(pourcentageDe(10000, 10)).toBe(1000);
    expect(pourcentageDe(3333, 10)).toBe(333);
  });
});

describe('money — formatage français', () => {
  it('formate avec virgule décimale et séparateur de milliers', () => {
    expect(formatEuros(123456)).toBe('1 234,56 €');
    expect(formatEuros(0)).toBe('0,00 €');
    expect(formatEuros(5)).toBe('0,05 €');
    expect(formatEuros(-123456)).toBe('-1 234,56 €');
  });

  it('formate une saisie sans symbole', () => {
    expect(formatSaisieEuros(123456)).toBe('1234,56');
    expect(formatSaisieEuros(10000)).toBe('100,00');
  });
});

describe('money — analyse de saisie', () => {
  it('accepte la virgule et le point', () => {
    expect(parseSaisieEuros('110,50')).toBe(11050);
    expect(parseSaisieEuros('110.50')).toBe(11050);
  });

  it('accepte les espaces de milliers et le symbole euro', () => {
    expect(parseSaisieEuros('1 234,56 €')).toBe(123456);
  });

  it('renvoie null sur une saisie non numérique', () => {
    expect(parseSaisieEuros('abc')).toBeNull();
    expect(parseSaisieEuros('12,3,4')).toBeNull();
  });

  it('traite une saisie vide comme zéro', () => {
    expect(parseSaisieEuros('')).toBe(0);
  });

  it('ne produit jamais de nombre à virgule flottante', () => {
    expect(Number.isInteger(parseSaisieEuros('0,07') ?? 0)).toBe(true);
  });
});
