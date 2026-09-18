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
 * Lève si la création demandée n'est pas permise. À appeler AVANT toute écriture : un
 * refus ne doit laisser aucun brouillon orphelin et ne doit consommer aucun numéro.
 *
 * Une licence valide lève tous les plafonds d'un coup — c'est tout l'objet de l'achat.
 */
export async function verifierAcces(type: TypeQuota, options: OptionsAcces = {}): Promise<void> {
  const licence = await etatLicence(options);
  if (licence.valide) return;
  await verifierPlafond(type);
}
