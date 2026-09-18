/**
 * Plafonds de la version d'essai.
 *
 * Un plafond n'est PAS une serrure. L'application ne parle à personne : rien ne peut
 * donc vérifier de l'extérieur qu'un droit a été payé. C'est une règle de bonne foi,
 * et il faut le savoir avant d'y consacrer du temps — le contournement le moins cher
 * étant d'éditer une sauvegarde, qui est du JSON lisible.
 *
 * Trois décisions de comptage, chacune pour une raison précise :
 *
 *  1. On compte les DOCUMENTS PORTANT UN NUMÉRO, jamais les brouillons. `numbering.ts`
 *     établit qu'un brouillon n'a pas de numéro : le décompte naît donc au même instant
 *     que le numéro, et un brouillon abandonné ne consomme rien.
 *
 *  2. On ne compte PAS depuis `db.compteurs`, même si le total y est déjà écrit. Le
 *     réglage `reinitialiserChaqueAnnee` vaut `true` PAR DÉFAUT : un plafond lu là se
 *     rechargerait tout seul chaque 1er janvier, et l'essai serait éternel.
 *
 *  3. On ne compte ni par statut, ni en bloc :
 *     — `StatutBon` vaut 'brouillon' | 'emis' | 'annule' | 'facture'. Un bon facturé
 *       QUITTE 'emis' : compter par statut le ferait sortir du total, et le chauffeur
 *       pourrait émettre sans fin ;
 *     — la table `factures` contient aussi les AVOIRS (`TypeFacture`), qui ne sont pas
 *       des factures mais la correction d'une facture. Les compter punirait la
 *       correction d'une erreur, ce qui est intenable.
 *
 * Un document mis à la corbeille compte encore, et c'est cohérent : son numéro est
 * consommé et la séquence a avancé, définitivement. Un client supprimé, lui, ne compte
 * plus : ce n'est pas un document numéroté, et perdre un rang pour une fiche saisie par
 * erreur serait une punition sans rapport avec ce qui est vendu.
 *
 * Enfin, ce plafond peut être ÉTEINT : `VENTE_ACTIVE` dans `./vente.ts` décide si
 * l'application est vendue ou libre. Éteint, le plafond reste ANNONCÉ — ce qui a été
 * consommé reste vrai — mais il n'est jamais ATTEINT, et `atteint` est le seul champ sur
 * lequel se règlent `verifierPlafond`, `estBloque` et la garde des routes. Une seule
 * valeur décide donc, et il n'existe pas deux lectures de la même règle à faire diverger.
 */

import { db } from './db';
import { VENTE_ACTIVE } from './vente';

export type TypeQuota = 'bons' | 'factures' | 'clients';

export const PLAFONDS: Record<TypeQuota, number> = {
  bons: 10,
  factures: 10,
  clients: 10,
};

export interface EtatQuota {
  type: TypeQuota;
  utilise: number;
  plafond: number;
  restant: number;
  atteint: boolean;
}

/**
 * L'interrupteur est injectable, comme la clé publique et la date de référence le sont
 * dans `acces.ts`. Ce n'est pas un crochet de test : c'est ce qui permet d'éprouver le
 * plafond sans rallumer la vente pour tout le monde.
 */
export interface OptionsQuota {
  venteActive?: boolean;
}

/** Compte ce qui a été consommé. Voir l'en-tête pour le détail des trois règles. */
export async function compterConsomme(type: TypeQuota): Promise<number> {
  switch (type) {
    case 'bons':
      return db.bons.filter((bon) => bon.numero !== null).count();
    case 'factures':
      return db.factures.filter((facture) => facture.type === 'facture').count();
    case 'clients':
      return db.clients.filter((client) => !client.supprime).count();
  }
}

export async function etatQuota(type: TypeQuota, options: OptionsQuota = {}): Promise<EtatQuota> {
  const plafond = PLAFONDS[type];
  const utilise = await compterConsomme(type);
  return {
    type,
    utilise,
    plafond,
    restant: Math.max(0, plafond - utilise),
    // Le seul champ qui décide. `restant` continue de dire la vérité sur ce qui a été
    // consommé, même éteint : c'est l'ATTEINTE qui est éteinte, pas le compte.
    atteint: (options.venteActive ?? VENTE_ACTIVE) && utilise >= plafond,
  };
}

export async function etatQuotaGlobal(
  options: OptionsQuota = {},
): Promise<Record<TypeQuota, EtatQuota>> {
  const [bons, factures, clients] = await Promise.all([
    etatQuota('bons', options),
    etatQuota('factures', options),
    etatQuota('clients', options),
  ]);
  return { bons, factures, clients };
}

/**
 * Refus opposé à une création. Porte le type concerné, pour que l'écran sache quoi
 * dire au chauffeur sans avoir à deviner.
 */
export class ErreurQuota extends Error {
  readonly type: TypeQuota;

  constructor(type: TypeQuota, message: string) {
    super(message);
    this.name = 'ErreurQuota';
    this.type = type;
  }
}

export function libelleQuota(type: TypeQuota): string {
  switch (type) {
    case 'bons':
      return 'bons de commande';
    case 'factures':
      return 'factures';
    case 'clients':
      return 'clients';
  }
}

/** Lève si le plafond est atteint. À appeler AVANT toute écriture. */
export async function verifierPlafond(type: TypeQuota, options: OptionsQuota = {}): Promise<void> {
  const etat = await etatQuota(type, options);
  if (etat.atteint) {
    throw new ErreurQuota(
      type,
      `La version d’essai est limitée à ${etat.plafond} ${libelleQuota(type)}. ` +
        `Vous en avez ${etat.utilise}. Débloquez l’application pour continuer.`,
    );
  }
}
