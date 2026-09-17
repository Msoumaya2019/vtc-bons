/**
 * Traduction d'un lien profond en onglet.
 *
 * Ce qui est protégé ici n'est pas une conversion, c'est un REFUS. L'adresse vient de
 * l'extérieur de l'application, et une adresse non reconnue doit ne rien faire. Si elle
 * retombait sur la route « * », l'application ramènerait à l'assistant de création en
 * silence : un raccourci mal formé ouvrirait le mauvais écran sans le moindre message,
 * et personne ne saurait pourquoi.
 */

import { describe, expect, it } from 'vitest';
import { ongletDepuisLien } from '../src/lib/lienProfond';

describe('ongletDepuisLien', () => {
  it('reconnaît la cible dans l’hôte, forme « vtcbons://instantane »', () => {
    expect(ongletDepuisLien('vtcbons://instantane')).toBe('/instantane');
  });

  it('reconnaît la cible dans le chemin, forme « vtcbons:///instantane »', () => {
    expect(ongletDepuisLien('vtcbons:///instantane')).toBe('/instantane');
  });

  it('tolère une barre finale et une casse différente', () => {
    expect(ongletDepuisLien('vtcbons://Instantane/')).toBe('/instantane');
  });

  it('ignore ce qui suit la cible', () => {
    expect(ongletDepuisLien('vtcbons://instantane?depuis=raccourci')).toBe('/instantane');
  });

  it('refuse une cible inconnue plutôt que de retomber sur un écran par défaut', () => {
    expect(ongletDepuisLien('vtcbons://onglet-qui-nexiste-pas')).toBeNull();
  });

  it('refuse une adresse sans cible', () => {
    expect(ongletDepuisLien('vtcbons://')).toBeNull();
  });

  it('refuse un schéma qui commence comme le sien sans être le sien', () => {
    expect(ongletDepuisLien('vtcbons-ailleurs://instantane')).toBeNull();
  });

  it('refuse une adresse web, qui n’est pas un lien profond', () => {
    expect(ongletDepuisLien('https://msoumaya2019.github.io/vtc-bons/#/instantane')).toBeNull();
  });

  it('refuse une adresse illisible sans lever', () => {
    expect(ongletDepuisLien('pas une adresse')).toBeNull();
  });

  it('refuse l’absence d’adresse', () => {
    expect(ongletDepuisLien('')).toBeNull();
    expect(ongletDepuisLien(null)).toBeNull();
    expect(ongletDepuisLien(undefined)).toBeNull();
  });
});
