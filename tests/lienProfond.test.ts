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
import { ADRESSE_INSTANTANE, SCHEMA_LIEN_PROFOND, ongletDepuisLien } from '../src/lib/lienProfond';

describe('ADRESSE_INSTANTANE', () => {
  it('ouvre bien l’onglet Instantané', () => {
    // Cette adresse est recopiée à la main par le chauffeur dans l'application Raccourcis
    // d'iOS, et la liste blanche de `ongletDepuisLien` est ce qui la reconnaît. Les deux
    // sont écrites séparément, et ce test est le seul lien entre elles : sans lui, une
    // faute de frappe d'un côté ferait un raccourci qui ouvre l'application sans rien
    // faire — sans aucun message d'erreur, et sans que rien ne le signale.
    expect(ongletDepuisLien(ADRESSE_INSTANTANE)).toBe('/instantane');
  });

  it('porte le schéma déclaré dans les projets natifs', () => {
    // Le schéma est écrit en trois endroits qui ne se voient pas entre eux :
    // l'`intent-filter` d'AndroidManifest.xml, les CFBundleURLTypes d'Info.plist, et ici.
    // Un désaccord entre les deux premiers est contrôlé par le flux de travail ; celui-ci
    // l'est par ce test.
    expect(ADRESSE_INSTANTANE.startsWith(`${SCHEMA_LIEN_PROFOND}://`)).toBe(true);
  });
});

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
