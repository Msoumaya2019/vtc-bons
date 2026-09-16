/**
 * Validation des identifiants administratifs.
 *
 * Principe directeur : on valide la FORME, jamais l'existence. Vérifier l'existence d'un
 * SIREN exigerait un appel réseau, ce que le projet s'interdit. Conséquence assumée :
 * aucune clé de Luhn n'est contrôlée, car elle rejetterait à tort des identifiants
 * parfaitement légitimes (La Poste, notamment).
 */

import { describe, expect, it } from 'vitest';
import {
  nettoyerNomFichier,
  validerEmail,
  validerObligatoire,
  validerSiren,
  validerSiret,
  validerTelephone,
  validerTvaIntracom,
} from '../src/lib/validation';

describe('validerSiren', () => {
  it('accepte 9 chiffres', () => {
    expect(validerSiren('123456789')).toBeNull();
  });

  it('tolère les espaces de présentation', () => {
    expect(validerSiren('123 456 789')).toBeNull();
  });

  it('refuse un SIREN vide et l’explique', () => {
    expect(validerSiren('')).toContain('obligatoire');
  });

  it('refuse une longueur incorrecte', () => {
    expect(validerSiren('12345678')).not.toBeNull();
    expect(validerSiren('1234567890')).not.toBeNull();
  });

  it('refuse les lettres', () => {
    expect(validerSiren('12345678A')).not.toBeNull();
  });
});

describe('validerSiret', () => {
  it('accepte 14 chiffres', () => {
    expect(validerSiret('12345678900012')).toBeNull();
  });

  it('reste facultatif : un SIRET vide n’est pas une erreur', () => {
    expect(validerSiret('')).toBeNull();
  });

  it('refuse une longueur incorrecte', () => {
    expect(validerSiret('123456789')).not.toBeNull();
  });
});

describe('validerTvaIntracom', () => {
  it('accepte le format FR + 2 caractères + 9 chiffres', () => {
    expect(validerTvaIntracom('FR12345678901')).toBeNull();
  });

  it('accepte les minuscules', () => {
    expect(validerTvaIntracom('fr12345678901')).toBeNull();
  });

  it('reste facultatif', () => {
    expect(validerTvaIntracom('')).toBeNull();
  });

  it('refuse un numéro qui ne commence pas par FR', () => {
    expect(validerTvaIntracom('DE12345678901')).not.toBeNull();
  });

  it('refuse un nombre de chiffres incorrect', () => {
    expect(validerTvaIntracom('FR1234567890')).not.toBeNull();
  });
});

describe('validerTelephone', () => {
  it('accepte un mobile français avec espaces', () => {
    expect(validerTelephone('06 12 34 56 78')).toBeNull();
  });

  it('accepte les points et tirets', () => {
    expect(validerTelephone('06.12.34.56.78')).toBeNull();
    expect(validerTelephone('06-12-34-56-78')).toBeNull();
  });

  it('accepte un numéro international', () => {
    expect(validerTelephone('+33612345678')).toBeNull();
  });

  it('refuse un numéro vide et rappelle l’enjeu du contrôle', () => {
    expect(validerTelephone('')).toContain('obligatoire');
  });

  it('refuse une saisie manifestement trop courte', () => {
    expect(validerTelephone('1234')).not.toBeNull();
  });
});

describe('validerEmail', () => {
  it('accepte une adresse ordinaire', () => {
    expect(validerEmail('contact@transports-dupont.fr')).toBeNull();
  });

  it('reste facultatif', () => {
    expect(validerEmail('')).toBeNull();
  });

  it('refuse une adresse sans domaine', () => {
    expect(validerEmail('contact@')).not.toBeNull();
  });

  it('refuse une adresse sans arobase', () => {
    expect(validerEmail('contact.transports.fr')).not.toBeNull();
  });
});

describe('validerObligatoire', () => {
  it('accepte une valeur renseignée', () => {
    expect(validerObligatoire('Paris', 'La ville')).toBeNull();
  });

  it('refuse le vide et le blanc, en nommant le champ', () => {
    expect(validerObligatoire('', 'La ville')).toContain('La ville');
    expect(validerObligatoire('   ', 'La ville')).toContain('La ville');
  });
});

describe('nettoyerNomFichier', () => {
  it('retire les accents', () => {
    expect(nettoyerNomFichier('Léa Muller')).toBe('Lea-Muller');
  });

  it('remplace les caractères interdits par des tirets', () => {
    expect(nettoyerNomFichier('Martin Leroy / Paris')).toBe('Martin-Leroy-Paris');
  });

  it('ne laisse ni tiret en tête ni tiret en queue', () => {
    expect(nettoyerNomFichier('  .Martin.  ')).toBe('Martin');
  });

  it('borne la longueur pour rester compatible avec tous les systèmes de fichiers', () => {
    const resultat = nettoyerNomFichier('a'.repeat(200));
    expect(resultat.length).toBeLessThanOrEqual(40);
  });
});
