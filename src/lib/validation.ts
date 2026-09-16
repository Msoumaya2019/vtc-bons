/**
 * Validation des identifiants administratifs.
 *
 * On valide la FORME, pas l'existence : vérifier l'existence d'un SIREN exigerait un appel
 * réseau à l'INSEE, ce qui est exclu par le principe « 100 % local, aucune donnée ne sort ».
 * On ne fait donc pas de contrôle de clé de Luhn, qui rejetterait à tort certains
 * identifiants légitimes (La Poste notamment).
 */

export function validerSiren(valeur: string): string | null {
  const propre = valeur.replace(/\s/g, '');
  if (!propre) return 'Le SIREN est obligatoire : il identifie votre entreprise sur le justificatif.';
  if (!/^\d{9}$/.test(propre)) return 'Le SIREN doit comporter exactement 9 chiffres.';
  return null;
}

export function validerSiret(valeur: string): string | null {
  const propre = valeur.replace(/\s/g, '');
  if (!propre) return null;
  if (!/^\d{14}$/.test(propre)) return 'Le SIRET doit comporter exactement 14 chiffres.';
  return null;
}

export function validerTvaIntracom(valeur: string): string | null {
  const propre = valeur.replace(/\s/g, '').toUpperCase();
  if (!propre) return null;
  if (!/^FR[0-9A-Z]{2}\d{9}$/.test(propre)) {
    return 'Le numéro de TVA intracommunautaire doit être au format FR + 2 caractères + 9 chiffres.';
  }
  return null;
}

export function validerTelephone(valeur: string): string | null {
  const propre = valeur.replace(/[\s.\-()]/g, '');
  if (!propre) return 'Le téléphone est obligatoire : c’est une mention exigée en cas de contrôle.';
  if (!/^(\+?\d{8,15})$/.test(propre)) return 'Le numéro de téléphone ne semble pas valide.';
  return null;
}

export function validerEmail(valeur: string): string | null {
  const propre = valeur.trim();
  if (!propre) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(propre)) return 'L’adresse email ne semble pas valide.';
  return null;
}

export function validerObligatoire(valeur: string, libelle: string): string | null {
  if (!valeur || valeur.trim() === '') return `${libelle} est obligatoire.`;
  return null;
}

/** Nettoie une chaîne destinée à un nom de fichier. */
export function nettoyerNomFichier(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
