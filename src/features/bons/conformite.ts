/**
 * Contrôle de conformité avant émission.
 *
 * Le bon de commande n'est pas un récapitulatif : c'est le JUSTIFICATIF DE RÉSERVATION
 * PRÉALABLE exigé par l'arrêté du 6 août 2025 (JO du 29 août 2025, en vigueur depuis le
 * 29 octobre 2025), pris en application de l'article L. 3120-2 du Code des transports.
 *
 * En cas de contrôle, c'est au chauffeur de prouver qu'il n'était pas en maraude.
 * Un justificatif incomplet ne remplit pas sa fonction : il ne sert à rien.
 *
 * Les 7 mentions obligatoires (support papier OU électronique) :
 *  1. nom ou raison sociale de l'exploitant, et ses coordonnées ;
 *  2. numéro d'inscription au registre des VTC (REVTC) — art. L. 3122-3 C. transports ;
 *  3. numéro unique d'identification (SIREN) — art. D. 123-235 C. commerce ;
 *  4. nom et coordonnées téléphoniques du client ;
 *  5. date et heure de la réservation ;
 *  6. date et heure de prise en charge souhaitées ;
 *  7. lieu de prise en charge indiqué par le client.
 */

import type { Bon, Client, Facture, Settings, SnapshotClient } from '../../types';
import { horodatage } from '../../lib/format';
import { validerSiren } from '../../lib/validation';
import { MENTIONS_ARRETE_2025 } from '../../lib/mentions';

export type NiveauProbleme = 'blocage' | 'avertissement';

export interface Probleme {
  niveau: NiveauProbleme;
  /** Identifiant du champ concerné, pour permettre un lien direct vers la correction. */
  champ: string;
  message: string;
}

export { MENTIONS_ARRETE_2025 };

function vide(valeur: string | null | undefined): boolean {
  return !valeur || valeur.trim() === '';
}

/**
 * Vérifie qu'un bon peut être émis.
 * Les blocages empêchent l'émission ; les avertissements signalent un risque sans bloquer.
 */
export function verifierConformiteBon(
  bon: Pick<
    Bon,
    | 'dateReservation'
    | 'heureReservation'
    | 'datePriseEnCharge'
    | 'heurePriseEnCharge'
    | 'lieuPriseEnCharge'
    | 'destination'
    | 'nombrePassagers'
    | 'vehiculeImmatriculation'
    | 'lignes'
  >,
  settings: Settings,
  client: Pick<SnapshotClient, 'nom' | 'telephone'> | null,
): Probleme[] {
  const problemes: Probleme[] = [];

  // — Mentions 1 à 3 : l'exploitant —
  if (vide(settings.raisonSociale)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'raisonSociale',
      message:
        'Renseignez votre nom ou raison sociale dans les Réglages : c’est la mention 1 du justificatif.',
    });
  }
  const erreurSiren = validerSiren(settings.siren);
  if (erreurSiren) {
    problemes.push({ niveau: 'blocage', champ: 'siren', message: erreurSiren });
  }
  if (vide(settings.telephone)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'telephone',
      message:
        'Renseignez le téléphone de l’exploitant dans les Réglages : les coordonnées sont la mention 1 du justificatif.',
    });
  }
  if (vide(settings.numeroREVTC)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'numeroREVTC',
      message:
        'Renseignez votre numéro d’inscription au registre des VTC : c’est la mention 2 du justificatif, et la plus souvent oubliée.',
    });
  }

  // — Mention 4 : le client —
  if (!client || vide(client.nom)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'client',
      message: 'Sélectionnez un client disposant d’un nom : c’est la mention 4 du justificatif.',
    });
  } else if (vide(client.telephone)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'client',
      message:
        'Ce client n’a pas de téléphone. C’est la mention 4 du justificatif, exigée par l’arrêté du 6 août 2025 : ajoutez-le sur la fiche client.',
    });
  }

  // — Mention 7 : le lieu de prise en charge —
  if (vide(bon.lieuPriseEnCharge)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'lieuPriseEnCharge',
      message:
        'Indiquez le lieu de prise en charge : c’est la mention 7 du justificatif, celle que l’agent vérifiera en premier.',
    });
  }

  // — Mentions 5 et 6 : les créneaux, et surtout leur CHRONOLOGIE —
  if (vide(bon.dateReservation) || vide(bon.heureReservation)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'dateReservation',
      message: 'La date et l’heure de la réservation sont la mention 5 du justificatif.',
    });
  }
  if (vide(bon.datePriseEnCharge) || vide(bon.heurePriseEnCharge)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'datePriseEnCharge',
      message: 'La date et l’heure de prise en charge sont la mention 6 du justificatif.',
    });
  }

  const instantReservation = horodatage(bon.dateReservation, bon.heureReservation);
  const instantPriseEnCharge = horodatage(bon.datePriseEnCharge, bon.heurePriseEnCharge);
  if (
    instantReservation !== null &&
    instantPriseEnCharge !== null &&
    instantReservation > instantPriseEnCharge
  ) {
    problemes.push({
      niveau: 'blocage',
      champ: 'dateReservation',
      message:
        'La réservation est datée APRÈS la prise en charge. Un justificatif daté après la course ne prouve pas qu’il y a eu réservation : il prouve le contraire. Corrigez la date ou l’heure de réservation.',
    });
  }

  // — Avertissements : utiles, mais non exigés par l'arrêté —
  if (vide(bon.vehiculeImmatriculation)) {
    problemes.push({
      niveau: 'avertissement',
      champ: 'vehiculeImmatriculation',
      message:
        'Aucune immatriculation renseignée. En contrôle, l’agent vérifie que le véhicule présenté est bien celui du justificatif.',
    });
  }
  if (vide(bon.destination)) {
    problemes.push({
      niveau: 'avertissement',
      champ: 'destination',
      message: 'Destination non renseignée. Elle n’est pas exigée, mais elle est utile en cas de litige.',
    });
  }
  if (bon.nombrePassagers == null) {
    problemes.push({
      niveau: 'avertissement',
      champ: 'nombrePassagers',
      message: 'Nombre de passagers non renseigné.',
    });
  }
  if (!bon.lignes || bon.lignes.length === 0) {
    problemes.push({
      niveau: 'avertissement',
      champ: 'lignes',
      message: 'Aucune ligne de prestation : le bon n’indiquera aucun montant.',
    });
  } else if (bon.lignes.every((ligne) => ligne.prixUnitaireCentimes === 0)) {
    // Le prix n'est PAS une des sept mentions de l'arrêté : un bon à 0 € est donc
    // légalement valable, et ce manque ne peut pas être un blocage ici. Il est signalé
    // tout de même, parce qu'un bon à 0 € reste un document faux — et parce que, dans
    // le flux manuel, le chauffeur peut légitimement ne pas encore connaître le montant
    // définitif (attente, péages). Le bloquer l'obligerait à inscrire un prix inventé,
    // qu'il ne pourrait plus corriger : le bon est figé à l'émission.
    //
    // L'onglet Instantané, lui, en fait un BLOCAGE (voir `manquesDuProfil`) : le prix y
    // vient d'un profil réglé à l'avance, que personne ne relit au moment du geste.
    // Deux sévérités pour un même fait, parce que deux contextes.
    problemes.push({
      niveau: 'avertissement',
      champ: 'montant',
      message:
        'Ce bon ne porte aucun montant : le total serait de 0 €. Vérifiez le prix de la course.',
    });
  }

  return problemes;
}

/** Vérifie qu'une facture peut être émise. */
export function verifierConformiteFacture(
  facture: Pick<
    Facture,
    'dateEmission' | 'datePrestation' | 'dateEcheance' | 'lignes' | 'clientSnapshot'
  >,
  settings: Settings,
): Probleme[] {
  const problemes: Probleme[] = [];

  if (vide(facture.dateEmission)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'dateEmission',
      message: 'La date d’émission est une mention obligatoire de la facture.',
    });
  }
  if (vide(facture.datePrestation)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'datePrestation',
      message:
        'La date de la prestation est une mention obligatoire, distincte de la date d’émission.',
    });
  }
  if (vide(facture.dateEcheance)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'dateEcheance',
      message: 'La date d’échéance et les conditions de règlement sont des mentions obligatoires.',
    });
  }
  if (!facture.clientSnapshot || vide(facture.clientSnapshot.nom)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'client',
      message: 'L’identité de l’acheteur est une mention obligatoire de la facture.',
    });
  }
  if (!facture.lignes || facture.lignes.length === 0) {
    problemes.push({
      niveau: 'blocage',
      champ: 'lignes',
      message: 'La désignation détaillée des prestations est une mention obligatoire.',
    });
  }
  if (settings.regimeTVA === 'assujetti' && vide(settings.numeroTVAIntracom)) {
    problemes.push({
      niveau: 'blocage',
      champ: 'numeroTVAIntracom',
      message:
        'Vous êtes assujetti à la TVA : votre numéro de TVA intracommunautaire est une mention obligatoire de la facture.',
    });
  }
  if (vide(settings.assureurNom)) {
    problemes.push({
      niveau: 'avertissement',
      champ: 'assureurNom',
      message:
        'Nom de l’assureur professionnel non renseigné : cette mention est attendue sur la facture.',
    });
  }

  return problemes;
}

export function blocages(problemes: Probleme[]): Probleme[] {
  return problemes.filter((probleme) => probleme.niveau === 'blocage');
}

export function avertissements(problemes: Probleme[]): Probleme[] {
  return problemes.filter((probleme) => probleme.niveau === 'avertissement');
}

/** Utilitaire pratique : le client associé à un bon, dans la liste des clients. */
export function trouverClient(clients: Client[], clientId: string): Client | null {
  return clients.find((client) => client.id === clientId) ?? null;
}
