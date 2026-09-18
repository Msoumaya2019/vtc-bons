/**
 * Licence : la clé PRIVÉE signe, la clé PUBLIQUE vérifie.
 *
 * Tout le mécanisme tient dans cette asymétrie. L'application ne transporte que la clé
 * publique : elle est donc structurellement incapable de fabriquer une licence. Elle
 * peut seulement en reconnaître une. Une licence ne se crée pas, elle se vérifie.
 *
 * Le jeton porte une date d'expiration, et c'est ce qui rend un abonnement possible
 * sans que l'application soit dépendante du réseau : le serveur signe un droit court,
 * l'application le vérifie toute seule hors ligne, et n'a besoin de le renouveler
 * qu'à l'échéance. Une panne du serveur devient donc invisible pour un client à jour.
 *
 * Le jeton a la forme `<charge>.<signature>`, les deux en base64url. La signature
 * porte sur les OCTETS de la charge tels qu'ils ont été transmis, et non sur une
 * réécriture JSON : c'est la seule façon d'être sûr de vérifier ce qui a été signé.
 */

import { joursRestants } from './format';

/**
 * Clé publique de vérification : un point P-256 non compressé, 65 octets, en base64url.
 *
 * Publiée à dessein — c'est son rôle. Elle a été engendrée par
 * `scripts/generer-cles-licence.mjs`, qui a écrit la clé privée hors du dépôt.
 *
 * C'est une clé de DÉVELOPPEMENT. Le jour de la première vente, la paire de production
 * sera engendrée sur le serveur et cette valeur remplacée.
 */
export const CLE_PUBLIQUE =
  'BMba_amqN31T0pWJKpvt94XNl3aPvDpHkZXPMKshDaTbb9lCe_Ci--RDIaKXrZxq2dmNkj_EQUhuw08bBK5ZeoI';

export type TypeLicence = 'abonnement' | 'developpeur';

export interface ChargeLicence {
  /** Qui a payé. Sert à retrouver le client, jamais à décider du droit. */
  sujet: string;
  /** Dernier jour couvert, au format AAAA-MM-JJ. */
  expiration: string;
  type: TypeLicence;
}

export type MotifRefus = 'absente' | 'illisible' | 'signature' | 'expiree';

export interface LicenceRefusee {
  valide: false;
  motif: MotifRefus;
  /** Renseignée pour `expiree` : le jour où le droit s'est éteint. */
  expiration: string | null;
}

export interface LicenceValide {
  valide: true;
  charge: ChargeLicence;
  /** Jours restants avant extinction. Vaut 0 le dernier jour couvert. */
  joursRestants: number;
}

export type EtatLicence = LicenceValide | LicenceRefusee;

const FORMAT_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Décode du base64url. Renvoie null plutôt que de lever : un jeton de licence est une
 * saisie utilisateur, donc une donnée hostile par principe.
 */
function octetsDepuisBase64Url(texte: string): Uint8Array<ArrayBuffer> | null {
  // Une chaîne vide ne décode pas en « zéro octet » mais en rien du tout. Sans cette
  // ligne, elle passerait le contrôle de nullité — un `Uint8Array` vide reste un objet,
  // donc vrai — et le jeton « . » serait accusé d'avoir une mauvaise signature, ce qui
  // enverrait le chauffeur chercher une erreur de copie qui n'existe pas.
  if (texte === '') return null;
  if (!/^[A-Za-z0-9_-]*$/.test(texte)) return null;
  const normalise = texte.replace(/-/g, '+').replace(/_/g, '/');
  const reste = normalise.length % 4;
  if (reste === 1) return null;
  const complete = normalise + '='.repeat(reste === 0 ? 0 : 4 - reste);
  try {
    const binaire = atob(complete);
    const octets = new Uint8Array(binaire.length);
    for (let index = 0; index < binaire.length; index += 1) {
      octets[index] = binaire.charCodeAt(index);
    }
    return octets;
  } catch {
    return null;
  }
}

function estUnTypeLicence(valeur: unknown): valeur is TypeLicence {
  return valeur === 'abonnement' || valeur === 'developpeur';
}

/**
 * Lit la charge utile sans rien décider. Séparée de la vérification pour une raison de
 * fond : on ne fait JAMAIS confiance à une charge avant que sa signature soit vérifiée.
 */
function lireCharge(octets: Uint8Array<ArrayBuffer>): ChargeLicence | null {
  let brut: unknown;
  try {
    brut = JSON.parse(new TextDecoder().decode(octets));
  } catch {
    return null;
  }
  if (typeof brut !== 'object' || brut === null) return null;

  const charge = brut as Record<string, unknown>;
  if (typeof charge.sujet !== 'string' || charge.sujet.trim() === '') return null;
  if (typeof charge.expiration !== 'string' || !FORMAT_DATE.test(charge.expiration)) return null;
  if (!estUnTypeLicence(charge.type)) return null;

  return { sujet: charge.sujet, expiration: charge.expiration, type: charge.type };
}

/** Vérifie la signature de la charge avec la clé publique. */
async function signatureValide(
  charge: Uint8Array<ArrayBuffer>,
  signature: Uint8Array<ArrayBuffer>,
  clePubliqueBase64Url: string,
): Promise<boolean> {
  const cleBrute = octetsDepuisBase64Url(clePubliqueBase64Url);
  // Un point P-256 non compressé commence par 0x04 et fait 65 octets. Le contrôler ici
  // évite de faire dire à `importKey` une erreur que personne ne saurait lire.
  if (!cleBrute || cleBrute.length !== 65 || cleBrute[0] !== 0x04) return false;

  try {
    const cle = await crypto.subtle.importKey(
      'raw',
      cleBrute,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, cle, signature, charge);
  } catch {
    return false;
  }
}

export interface OptionsVerification {
  clePublique?: string;
  reference?: Date;
}

/**
 * Décide de l'état d'une licence. L'ordre des contrôles n'est pas indifférent : la
 * signature est vérifiée AVANT que la charge soit lue, et l'expiration APRÈS. Lire la
 * charge d'abord reviendrait à croire une date écrite par n'importe qui.
 */
export async function verifierLicence(
  jeton: string,
  options: OptionsVerification = {},
): Promise<EtatLicence> {
  const texte = (jeton ?? '').trim();
  if (texte === '') return { valide: false, motif: 'absente', expiration: null };

  const morceaux = texte.split('.');
  if (morceaux.length !== 2) return { valide: false, motif: 'illisible', expiration: null };

  const chargeBrute = octetsDepuisBase64Url(morceaux[0] ?? '');
  const signatureBrute = octetsDepuisBase64Url(morceaux[1] ?? '');
  if (!chargeBrute || !signatureBrute) {
    return { valide: false, motif: 'illisible', expiration: null };
  }

  const clePublique = options.clePublique ?? CLE_PUBLIQUE;
  if (!(await signatureValide(chargeBrute, signatureBrute, clePublique))) {
    return { valide: false, motif: 'signature', expiration: null };
  }

  const charge = lireCharge(chargeBrute);
  if (!charge) return { valide: false, motif: 'illisible', expiration: null };

  const restants = joursRestants(charge.expiration, options.reference);
  if (restants === null) return { valide: false, motif: 'illisible', expiration: null };
  if (restants < 0) return { valide: false, motif: 'expiree', expiration: charge.expiration };

  return { valide: true, charge, joursRestants: restants };
}

/** Phrase à montrer au chauffeur. Un refus doit toujours pouvoir s'expliquer. */
export function messageRefus(motif: MotifRefus): string {
  switch (motif) {
    case 'absente':
      return 'Aucune licence n’est enregistrée sur cet appareil.';
    case 'illisible':
      return 'Ce code de licence n’a pas la bonne forme. Vérifiez la copie.';
    case 'signature':
      return 'Ce code de licence n’a pas été délivré par l’éditeur de l’application.';
    case 'expiree':
      return 'Cet abonnement est arrivé à son terme.';
  }
}
