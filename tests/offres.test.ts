/**
 * Les formules vendues : leur arithmétique, et leur accord avec le script qui signe.
 *
 * Ce fichier éprouve deux choses de nature différente, et c'est délibéré :
 *
 *  • ce qui est CALCULÉ — le prix au mois équivalent de la formule annuelle, l'économie
 *    annoncée. Ces valeurs ne sont pas écrites dans l'écran, elles en sont dérivées ; les
 *    éprouver ici évite qu'un changement de tarif laisse un « −37 % » figé qui ne casse
 *    rien mais qui ment ;
 *
 *  • ce qui doit RESTER D'ACCORD — la durée qu'annonce l'application et celle que signe le
 *    script de délivrance. Ce sont deux endroits qui ne peuvent pas se lire, donc deux
 *    vérités qui dérivent si personne n'y pense. Le test les confronte pour de bon : il
 *    lit le fichier avec le lecteur du script, et compare au module évalué.
 */

import { describe, expect, it } from 'vitest';
import {
  OFFRES,
  economiePourcent,
  equivalentMensuel,
  libellePrix,
  offreDisponible,
  offreParId,
  offresDisponibles,
} from '../src/features/premium/offres';
import { lireFormules } from '../scripts/formules-licence.mjs';

describe('formules vendues', () => {
  it('annonce le prix de chaque formule', () => {
    expect(libellePrix(offreParId('mensuel')!)).toBe('3,99 € par mois');
    expect(libellePrix(offreParId('annuel')!)).toBe('29,99 € par an');
  });

  it('ramène la formule longue au mois, et se tait pour la courte', () => {
    expect(equivalentMensuel(offreParId('mensuel')!)).toBeNull();
    expect(equivalentMensuel(offreParId('annuel')!)).toBe('2,50 € par mois');
  });

  it('calcule l’économie plutôt que de l’écrire', () => {
    // 29,99 € pour douze mois, contre 3,99 € le mois : 47,88 € payés au mensuel.
    expect(economiePourcent()).toBe(37);
  });

  it('ne tient pas pour payable une formule sans lien de paiement', () => {
    const mensuel = offreParId('mensuel')!;
    expect(offreDisponible({ ...mensuel, lien: '' })).toBe(false);
    expect(offreDisponible({ ...mensuel, lien: 'REMPLACER' })).toBe(false);
    expect(offreDisponible({ ...mensuel, lien: 'https://buy.stripe.com/essai' })).toBe(true);
  });

  it('ne propose jamais une formule dont le lien n’en est pas un', () => {
    // Invariant qui tient que les liens soient renseignés ou non : un bouton d'achat qui
    // ne mène nulle part est pire qu'un bouton absent — il tombe au moment où le client a
    // sorti sa carte, et passe pour une panne.
    for (const offre of offresDisponibles()) {
      expect(offre.lien.startsWith('https://')).toBe(true);
    }
  });

  it('déclare deux formules, et une seule de chaque sorte', () => {
    expect(OFFRES.map((offre) => offre.id)).toEqual(['mensuel', 'annuel']);
    expect(OFFRES.filter((offre) => offre.mois === 1)).toHaveLength(1);
    expect(OFFRES.filter((offre) => offre.mois > 1)).toHaveLength(1);
  });
});

describe('accord entre l’application et le script de délivrance', () => {
  it('lit exactement les durées que l’application déclare', () => {
    const lues = lireFormules();
    const declarees = Object.fromEntries(OFFRES.map((offre) => [offre.id, offre.jours]));
    expect(lues).toEqual(declarees);
  });

  it('lève plutôt que de rendre un résultat vide quand la source a changé de forme', () => {
    // Falsification : un fichier qui ne contient aucune formule. Si la lecture rendait un
    // objet vide au lieu de lever, le script délivrerait une durée indéfinie en silence —
    // et personne ne s'en apercevrait avant le client.
    expect(() => lireFormules('package.json')).toThrow();
  });
});
