/**
 * Construction des données imprimées sur les PDF.
 *
 * Ce module est PUR : il ne touche ni au DOM, ni à la base, ni au rendu.
 * Les composants PDF ne font ensuite que mettre en page ce qui est produit ici.
 * C'est ce qui rend les mentions réglementaires réellement testables : un test peut
 * vérifier que les 7 mentions de l'arrêté du 6 août 2025 sortent bien, avec une valeur.
 */

import type { Bon, Client, Facture, Settings, SnapshotClient, SnapshotEmetteur } from '../../types';
import { calculerTotaux, MENTION_FRANCHISE, montantLigne } from '../tva';
import { formatEuros, formatQuantite } from '../money';
import {
  formatDate,
  formatKilometres,
  libelleModePaiement,
  libelleTaux,
  libelleTypePrestation,
} from '../format';
import { adresseSurUneLigne, snapshotClient, snapshotEmetteur } from '../snapshots';
import { MENTIONS_ARRETE_2025 } from '../mentions';
import { nettoyerNomFichier } from '../validation';

export interface Paire {
  label: string;
  valeur: string;
}

export interface Bloc {
  titre: string;
  paires: Paire[];
}

export interface LignePdf {
  libelle: string;
  quantite: string;
  prixUnitaire: string;
  taux: string;
  total: string;
  debours: boolean;
}

export interface MentionPdf {
  numero: number;
  libelle: string;
  valeur: string;
}

export interface TotauxPdf {
  totalHT: string;
  totalDebours: string | null;
  totalTVA: string;
  totalTTC: string;
  remise: string | null;
  detailTVA: { taux: string; base: string; montant: string }[];
  mentionTVA: string;
}

export interface EmetteurPdf {
  nom: string;
  complement: string;
  adresse: string;
  contact: string;
  identifiants: string[];
  logo: string | null;
  couleur: string;
}

export interface ClientPdf {
  nom: string;
  adresse: string;
  contact: string;
  identifiants: string[];
}

export interface DonneesPdf {
  titre: string;
  sousTitre: string;
  numero: string;
  emetteur: EmetteurPdf;
  client: ClientPdf;
  blocs: Bloc[];
  mentionsJustificatif: MentionPdf[];
  lignes: LignePdf[];
  totaux: TotauxPdf;
  mentionsLegales: string[];
  piedDePage: string;
}

function construireEmetteur(
  emetteur: SnapshotEmetteur,
  charte?: { logo: string; couleurAccent: string },
): EmetteurPdf {
  const identifiants: string[] = [];
  if (emetteur.siren) identifiants.push(`SIREN ${emetteur.siren}`);
  if (emetteur.siret && emetteur.siret !== emetteur.siren) identifiants.push(`SIRET ${emetteur.siret}`);
  if (emetteur.numeroREVTC) identifiants.push(`REVTC ${emetteur.numeroREVTC}`);
  if (emetteur.numeroTVAIntracom) identifiants.push(`TVA ${emetteur.numeroTVAIntracom}`);

  const contact = [emetteur.telephone, emetteur.email].filter(Boolean).join(' · ');

  return {
    nom: emetteur.raisonSociale || '—',
    complement: [emetteur.formeJuridique, emetteur.nomCommercial].filter(Boolean).join(' · '),
    adresse: adresseSurUneLigne(emetteur),
    contact,
    identifiants,
    // La charte (logo, couleur) peut être réappliquée sans jamais toucher aux données
    // figées du document : c'est tout l'intérêt de la régénération.
    logo: (charte?.logo ?? emetteur.logo) || null,
    couleur: charte?.couleurAccent || emetteur.couleurAccent || '#1d4ed8',
  };
}

function construireClient(client: SnapshotClient): ClientPdf {
  const identifiants: string[] = [];
  if (client.type === 'professionnel') {
    if (client.siret) identifiants.push(`SIRET ${client.siret}`);
    if (client.numeroTVAIntracom) identifiants.push(`TVA ${client.numeroTVAIntracom}`);
  }
  const contact = [client.telephone, client.email].filter(Boolean).join(' · ');
  return {
    nom: [client.civilite, client.nom].filter(Boolean).join(' ') || '—',
    adresse: adresseSurUneLigne(client),
    contact,
    identifiants,
  };
}

function construireLignes(
  lignes: Bon['lignes'],
  regimeFranchise: boolean,
): LignePdf[] {
  return lignes.map((ligne) => ({
    libelle: ligne.libelle,
    quantite: formatQuantite(ligne.quantite),
    prixUnitaire: formatEuros(ligne.prixUnitaireCentimes),
    taux: regimeFranchise ? '—' : libelleTaux(ligne.tauxTVA),
    total: formatEuros(montantLigne(ligne)),
    debours: ligne.estDebours,
  }));
}

function totauxDepuisCalcul(
  totalHT: number,
  totalDebours: number,
  totalTVA: number,
  totalTTC: number,
  totalRemise: number,
  detailTVA: { taux: number; baseHT: number; montantTVA: number }[],
  mention: string,
): TotauxPdf {
  return {
    totalHT: formatEuros(totalHT),
    totalDebours: totalDebours > 0 ? formatEuros(totalDebours) : null,
    totalTVA: formatEuros(totalTVA),
    totalTTC: formatEuros(totalTTC),
    remise: totalRemise > 0 ? formatEuros(totalRemise) : null,
    detailTVA: detailTVA.map((detail) => ({
      taux: libelleTaux(detail.taux),
      base: formatEuros(detail.baseHT),
      montant: formatEuros(detail.montantTVA),
    })),
    mentionTVA: mention,
  };
}

/** Les 7 mentions du justificatif, avec la valeur réellement imprimée en regard. */
export function construireMentionsJustificatif(
  bon: Bon,
  emetteur: SnapshotEmetteur,
  client: SnapshotClient | null,
): MentionPdf[] {
  const valeurs: string[] = [
    [
      emetteur.raisonSociale,
      adresseSurUneLigne(emetteur),
      emetteur.telephone ? `Tél. ${emetteur.telephone}` : '',
    ]
      .filter(Boolean)
      .join(' — '),
    emetteur.numeroREVTC,
    emetteur.siren || emetteur.siret,
    client
      ? [client.nom, client.telephone ? `Tél. ${client.telephone}` : ''].filter(Boolean).join(' — ')
      : '',
    bon.dateReservation ? `${formatDate(bon.dateReservation)} à ${bon.heureReservation}` : '',
    bon.datePriseEnCharge ? `${formatDate(bon.datePriseEnCharge)} à ${bon.heurePriseEnCharge}` : '',
    bon.lieuPriseEnCharge,
  ];

  return MENTIONS_ARRETE_2025.map((libelle, index) => ({
    numero: index + 1,
    libelle,
    valeur: valeurs[index] ?? '',
  }));
}

export function construireDonneesBon(
  bon: Bon,
  settings: Settings,
  clientEnregistre: Client | null,
  charte?: { logo: string; couleurAccent: string },
): DonneesPdf {
  const emetteur = bon.emetteurSnapshot ?? snapshotEmetteur(settings);
  const client = bon.clientSnapshot ?? (clientEnregistre ? snapshotClient(clientEnregistre) : null);

  const totauxCalcul = calculerTotaux(bon.lignes, {
    regimeTVA: settings.regimeTVA,
    traitementPeages: settings.traitementPeages,
    remiseGlobale: bon.remiseGlobale,
  });

  const blocs: Bloc[] = [
    {
      titre: 'Réservation',
      paires: [
        {
          label: 'Date et heure de la réservation',
          valeur: `${formatDate(bon.dateReservation)} à ${bon.heureReservation}`,
        },
        {
          label: 'Prise en charge souhaitée',
          valeur: `${formatDate(bon.datePriseEnCharge)} à ${bon.heurePriseEnCharge}`,
        },
        { label: 'Prestation', valeur: libelleTypePrestation(bon.typePrestation) },
      ],
    },
    {
      titre: 'Trajet',
      paires: [
        { label: 'Lieu de prise en charge', valeur: bon.lieuPriseEnCharge || '—' },
        { label: 'Destination', valeur: bon.destination || '—' },
        { label: 'Distance estimée', valeur: formatKilometres(bon.distanceKm) },
        { label: 'Vol / train', valeur: bon.numeroVolTrain || '—' },
        { label: 'Terminal', valeur: bon.terminal || '—' },
        { label: 'Passagers', valeur: bon.nombrePassagers != null ? String(bon.nombrePassagers) : '—' },
        { label: 'Bagages', valeur: bon.bagages || '—' },
      ],
    },
    {
      titre: 'Véhicule et conducteur',
      paires: [
        {
          label: 'Véhicule',
          valeur: [bon.vehiculeMarque, bon.vehiculeModele].filter(Boolean).join(' ') || '—',
        },
        { label: 'Immatriculation', valeur: bon.vehiculeImmatriculation || '—' },
        { label: 'Couleur', valeur: bon.vehiculeCouleur || '—' },
        { label: 'Conducteur', valeur: bon.nomConducteur || emetteur.raisonSociale || '—' },
        { label: 'Mode de paiement', valeur: libelleModePaiement(bon.modePaiement) },
      ],
    },
  ];

  if (bon.notesClient) {
    blocs.push({ titre: 'Informations', paires: [{ label: 'Précisions', valeur: bon.notesClient }] });
  }

  const mentionsLegales: string[] = [];
  if (settings.regimeTVA === 'franchise_en_base') mentionsLegales.push(MENTION_FRANCHISE);

  return {
    titre: 'BON DE COMMANDE',
    sousTitre: 'Justificatif de réservation préalable',
    numero: bon.numero ?? 'BROUILLON',
    emetteur: construireEmetteur(emetteur, charte),
    client: client
      ? construireClient(client)
      : { nom: '—', adresse: '', contact: '', identifiants: [] },
    blocs,
    mentionsJustificatif: construireMentionsJustificatif(bon, emetteur, client),
    lignes: construireLignes(bon.lignes, settings.regimeTVA === 'franchise_en_base'),
    totaux: totauxDepuisCalcul(
      totauxCalcul.totalHT,
      totauxCalcul.totalDebours,
      totauxCalcul.totalTVA,
      totauxCalcul.totalTTC,
      totauxCalcul.totalRemise,
      totauxCalcul.detailTVA,
      totauxCalcul.mentionTVA,
    ),
    mentionsLegales,
    piedDePage:
      'Justificatif de réservation préalable établi en application de l’article L. 3120-2 du Code des transports. ' +
      'Ce justificatif doit être conservé avec la facture de la course.',
  };
}

export function construireDonneesFacture(
  facture: Facture,
  settings: Settings,
  charte?: { logo: string; couleurAccent: string },
): DonneesPdf {
  const emetteur = facture.emetteurSnapshot;
  const estAvoir = facture.type === 'avoir';
  const franchise = facture.detailTVA.length === 0 && facture.montantTVA === 0;

  const blocs: Bloc[] = [
    {
      titre: 'Dates',
      paires: [
        { label: 'Date d’émission', valeur: formatDate(facture.dateEmission) },
        { label: 'Date de la prestation', valeur: formatDate(facture.datePrestation) },
        { label: 'Date d’échéance', valeur: formatDate(facture.dateEcheance) },
      ],
    },
    {
      titre: 'Règlement',
      paires: [
        { label: 'Conditions', valeur: facture.conditionsPaiement || '—' },
        { label: 'Pénalités de retard', valeur: facture.penalitesRetard || '—' },
        { label: 'Escompte', valeur: facture.escompteTexte || '—' },
        { label: 'IBAN', valeur: emetteur.iban || '—' },
        { label: 'BIC', valeur: emetteur.bic || '—' },
        { label: 'Titulaire du compte', valeur: emetteur.titulaireCompte || '—' },
      ],
    },
    {
      titre: 'Assurance professionnelle',
      paires: [
        { label: 'Assureur', valeur: emetteur.assureurNom || '—' },
        { label: 'Contrat', valeur: emetteur.assureurContrat || '—' },
        { label: 'Couverture géographique', valeur: emetteur.assureurCouvertureGeographique || '—' },
      ],
    },
  ];

  if (facture.bonId) {
    blocs[0].paires.push({ label: 'Bon de commande', valeur: facture.bonId });
  }

  const mentionsLegales: string[] = [];
  const complementLegal: string[] = [];
  if (emetteur.formeJuridique) complementLegal.push(emetteur.formeJuridique);
  if (emetteur.capitalSocial) complementLegal.push(`Capital ${emetteur.capitalSocial}`);
  if (emetteur.rcsVille || emetteur.rcsNumero) {
    complementLegal.push(
      `RCS ${[emetteur.rcsVille, emetteur.rcsNumero].filter(Boolean).join(' ')}`.trim(),
    );
  }
  if (complementLegal.length > 0) mentionsLegales.push(complementLegal.join(' — '));
  mentionsLegales.push(facture.mentionTVA || `TVA au taux de ${settings.tauxTVADefaut} %`);
  if (franchise && !facture.mentionTVA) mentionsLegales.push(MENTION_FRANCHISE);
  if (facture.mentionSpecifique) mentionsLegales.push(facture.mentionSpecifique);

  return {
    titre: estAvoir ? 'AVOIR' : 'FACTURE',
    sousTitre: estAvoir ? 'Annule et remplace la facture d’origine' : 'Facture de transport de personnes',
    numero: facture.numero,
    emetteur: construireEmetteur(emetteur, charte),
    client: construireClient(facture.clientSnapshot),
    blocs,
    mentionsJustificatif: [],
    lignes: construireLignes(facture.lignes, franchise),
    totaux: totauxDepuisCalcul(
      facture.montantHT,
      facture.montantDebours ?? 0,
      facture.montantTVA,
      facture.montantTTC,
      0,
      facture.detailTVA,
      facture.mentionTVA,
    ),
    mentionsLegales,
    piedDePage: estAvoir
      ? `Avoir émis en référence à la facture annulée.`
      : `Facture à conserver 10 ans. Page `,
  };
}

/**
 * Nom du fichier exporté : `2026-03-14_BC-2026-0001_NomDuClient.pdf`.
 * La date en tête au format AAAA-MM-JJ garantit un tri chronologique correct.
 */
export function nomFichierPdf(dateISO: string, numero: string, nomClient: string): string {
  const parties = [dateISO, numero, nettoyerNomFichier(nomClient)].filter(
    (partie) => partie && partie !== '',
  );
  return `${parties.join('_')}.pdf`;
}
