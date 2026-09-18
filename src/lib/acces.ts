/**
 * Point de passage UNIQUE de la décision d'accès.
 *
 * La question « ai-je le droit de créer ? » se pose ici, et nulle part ailleurs. C'est
 * délibéré : un contrôle saupoudré finit toujours par manquer sur un chemin, et c'est
 * celui-là que le premier utilisateur trouve. Le jour où les boutiques ou le serveur de
 * licences arriveront, c'est cette fonction qui changera — pas ses appelants.
 *
 * Elle lit les réglages elle-même plutôt que de les recevoir. Une décision qui dépend
 * de ce qu'on lui passe finit par diverger selon l'appelant ; celle-ci ne le peut pas.
 *
 * Deux états distincts, et la nuance compte :
 *  - un PLAFOND atteint bloque SA catégorie, et elle seule. C'est ce qui permet à un bon
 *    déjà émis d'être facturé même si le plafond des bons est atteint — sans quoi le
 *    chauffeur se retrouverait avec des bons qu'il n'a pas le droit de facturer ;
 *  - l'application est VERROUILLÉE quand plus aucune création n'est possible.
 */

import { getSettings } from './db';
import { joursRestants } from './format';
import { verifierLicence, type EtatLicence } from './licence';
import { etatQuotaGlobal, verifierPlafond, type EtatQuota, type TypeQuota } from './quota';

export interface EtatAcces {
  licence: EtatLicence;
  quotas: Record<TypeQuota, EtatQuota>;
  /** Vrai quand PLUS AUCUNE création n'est possible. */
  verrouille: boolean;
  /** Vrai quand au moins un plafond est atteint : quelque chose est bloqué. */
  partiellementBloque: boolean;
}

/**
 * La clé publique et la date de référence sont injectables, exactement comme dans
 * `verifierLicence`. Ce n'est pas un crochet de test : c'est ce qui permettra de
 * remplacer la clé de développement par celle de production sans toucher à la logique,
 * et c'est ce qui rend le mécanisme éprouvable sans détenir la clé privée.
 */
export interface OptionsAcces {
  reference?: Date;
  clePublique?: string;
}

/** Lit la licence enregistrée dans les réglages et dit ce qu'elle vaut. */
export async function etatLicence(options: OptionsAcces = {}): Promise<EtatLicence> {
  const settings = await getSettings();
  return verifierLicence(settings.licence ?? '', options);
}

/** Réponse courte, pour les écrans qui n'ont besoin que d'un oui ou d'un non. */
export async function aUneLicence(options: OptionsAcces = {}): Promise<boolean> {
  return (await etatLicence(options)).valide;
}

export async function etatAcces(options: OptionsAcces = {}): Promise<EtatAcces> {
  const licence = await etatLicence(options);
  const quotas = await etatQuotaGlobal();
  const atteints = Object.values(quotas).filter((quota) => quota.atteint).length;
  return {
    licence,
    quotas,
    verrouille: atteints === Object.keys(quotas).length,
    partiellementBloque: atteints > 0,
  };
}

/**
 * Jours pendant lesquels l'application continue de fonctionner APRÈS l'échéance.
 *
 * Trois, et ce n'est pas un confort commercial : un abonnement mensuel se renouvelle par
 * un paiement qui met un à trois jours ouvrés à apparaître, et le jeton qui suit arrive
 * par courriel, pendant que le chauffeur conduit. Couper le jour même où la date passe
 * punirait un client à jour pour un retard qui ne vient pas de lui — et c'est précisément
 * le client qui paie qu'on perdrait.
 *
 * La grâce n'est PAS un retour à la version d'essai : pendant ces trois jours, tous les
 * plafonds restent levés. Le chauffeur a payé, il ne doit rien voir changer.
 */
export const JOURS_DE_GRACE = 3;

/**
 * Vrai quand le droit est échu mais que la grâce court encore.
 *
 * Ne dit rien d'une licence valide — celle-là n'a pas besoin de grâce — ni d'une licence
 * absente ou illisible, qui n'a jamais rien ouvert : seule une échéance donne droit à ce
 * délai, parce que seule une échéance s'explique par un renouvellement en route.
 */
export function enGrace(licence: EtatLicence, reference: Date = new Date()): boolean {
  if (licence.valide) return false;
  if (licence.motif !== 'expiree' || !licence.expiration) return false;

  const restants = joursRestants(licence.expiration, reference);
  // `joursRestants` vaut 0 le dernier jour couvert, puis -1, -2… : la grâce couvre donc
  // les trois jours qui SUIVENT l'échéance, et s'arrête au quatrième.
  return restants !== null && restants >= -JOURS_DE_GRACE;
}

/**
 * Jours de grâce encore disponibles, de 3 à 1, ou `null` hors grâce.
 *
 * Le calcul vit ici, avec la règle, et non dans l'écran qui l'affiche : c'est le genre de
 * soustraction qu'on réécrit de bonne foi ailleurs, et qui finit par annoncer un jour de
 * plus que le service n'en accorde.
 */
export function joursDeGraceRestants(
  licence: EtatLicence,
  reference: Date = new Date(),
): number | null {
  if (licence.valide || !licence.expiration) return null;
  if (!enGrace(licence, reference)) return null;

  const restants = joursRestants(licence.expiration, reference);
  if (restants === null) return null;
  return JOURS_DE_GRACE + restants + 1;
}

/**
 * Lève si la création demandée n'est pas permise. À appeler AVANT toute écriture : un
 * refus ne doit laisser aucun brouillon orphelin et ne doit consommer aucun numéro.
 *
 * Une licence valide lève tous les plafonds d'un coup — c'est tout l'objet de l'achat.
 */
export async function verifierAcces(type: TypeQuota, options: OptionsAcces = {}): Promise<void> {
  const licence = await etatLicence(options);
  if (licence.valide) return;
  if (enGrace(licence, options.reference)) return;
  await verifierPlafond(type);
}
