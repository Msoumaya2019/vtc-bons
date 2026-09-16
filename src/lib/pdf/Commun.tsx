/**
 * Briques communes aux deux gabarits PDF.
 * Aucune logique métier ici : uniquement de la mise en page.
 */

import { Image, Text, View } from '@react-pdf/renderer';
import { styles } from './theme';
import type {
  Bloc,
  ClientPdf,
  EmetteurPdf,
  LignePdf,
  MentionPdf,
  Paire,
  TotauxPdf,
} from './documentData';

export function EnTete({ emetteur }: { emetteur: EmetteurPdf }) {
  return (
    <View>
      <View style={styles.entete}>
        <View style={styles.enteteGauche}>
          {emetteur.logo ? <Image style={styles.logo} src={emetteur.logo} /> : null}
          <View>
            <Text style={styles.nomEmetteur}>{emetteur.nom}</Text>
            {emetteur.complement ? (
              <Text style={styles.complementEmetteur}>{emetteur.complement}</Text>
            ) : null}
            {emetteur.adresse ? <Text style={styles.ligneMue}>{emetteur.adresse}</Text> : null}
            {emetteur.contact ? <Text style={styles.ligneMue}>{emetteur.contact}</Text> : null}
          </View>
        </View>
        <View style={styles.enteteDroite}>
          {emetteur.identifiants.map((identifiant) => (
            <Text key={identifiant} style={styles.identifiant}>
              {identifiant}
            </Text>
          ))}
        </View>
      </View>
      <View style={[styles.filet, { backgroundColor: emetteur.couleur }]} />
    </View>
  );
}

export function ZoneTitre({
  titre,
  sousTitre,
  numero,
}: {
  titre: string;
  sousTitre: string;
  numero: string;
}) {
  return (
    <View style={styles.titreZone}>
      <View>
        <Text style={styles.titre}>{titre}</Text>
        <Text style={styles.sousTitre}>{sousTitre}</Text>
      </View>
      <Text style={styles.numeroDocument}>{numero}</Text>
    </View>
  );
}

export function BlocPaires({
  titre,
  paires,
  large = false,
}: {
  titre: string;
  paires: Paire[];
  large?: boolean;
}) {
  if (paires.length === 0) return null;
  return (
    <View style={styles.bloc}>
      <Text style={styles.blocTitre}>{titre}</Text>
      <View style={styles.grillePaires}>
        {paires.map((paire) => (
          <View key={`${titre}-${paire.label}`} style={large ? styles.paireLarge : styles.paire}>
            <Text style={styles.paireLabel}>{paire.label}</Text>
            <Text style={styles.paireValeur}>{paire.valeur || '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function BlocIdentite({ titre, entite }: { titre: string; entite: ClientPdf }) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.blocTitre}>{titre}</Text>
      <Text style={styles.paireValeur}>{entite.nom}</Text>
      {entite.adresse ? <Text style={styles.ligneMue}>{entite.adresse}</Text> : null}
      {entite.contact ? <Text style={styles.ligneMue}>{entite.contact}</Text> : null}
      {entite.identifiants.map((identifiant) => (
        <Text key={identifiant} style={styles.ligneMue}>
          {identifiant}
        </Text>
      ))}
    </View>
  );
}

function LigneTableau({ ligne, franchise }: { ligne: LignePdf; franchise: boolean }) {
  return (
    <View style={styles.tableauLigne} wrap={false}>
      <View style={styles.colLibelle}>
        <Text style={styles.cellule}>{ligne.libelle || '—'}</Text>
        {ligne.debours ? (
          <Text style={styles.mentionDebours}>Débours — refacturé à l’identique</Text>
        ) : null}
      </View>
      <Text style={[styles.colQuantite, styles.cellule]}>{ligne.quantite}</Text>
      <Text style={[styles.colPrix, styles.cellule]}>{ligne.prixUnitaire}</Text>
      {franchise ? null : <Text style={[styles.colTaux, styles.cellule]}>{ligne.taux}</Text>}
      <Text style={[styles.colTotal, styles.cellule]}>{ligne.total}</Text>
    </View>
  );
}

export function TableauLignes({ lignes, franchise }: { lignes: LignePdf[]; franchise: boolean }) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.blocTitre}>Prestation</Text>
      <View style={styles.tableauEntete}>
        <Text style={[styles.colLibelle, styles.enteteCellule]}>Désignation</Text>
        <Text style={[styles.colQuantite, styles.enteteCellule]}>Qté</Text>
        <Text style={[styles.colPrix, styles.enteteCellule]}>P.U. HT</Text>
        {franchise ? null : <Text style={[styles.colTaux, styles.enteteCellule]}>TVA</Text>}
        <Text style={[styles.colTotal, styles.enteteCellule]}>Total HT</Text>
      </View>
      {lignes.length === 0 ? (
        <Text style={styles.cellule}>Aucune ligne de prestation.</Text>
      ) : null}
      {lignes.map((ligne, index) => (
        <LigneTableau key={`ligne-${index}`} ligne={ligne} franchise={franchise} />
      ))}
    </View>
  );
}

function LigneTotalTVA({ taux, base, montant }: { taux: string; base: string; montant: string }) {
  return (
    <View style={styles.ligneTotal}>
      <Text style={styles.ligneTotalLabel}>
        TVA {taux} sur {base}
      </Text>
      <Text style={styles.ligneTotalValeur}>{montant}</Text>
    </View>
  );
}

export function Totaux({ totaux, franchise }: { totaux: TotauxPdf; franchise: boolean }) {
  const lignesTVA = franchise ? [] : totaux.detailTVA;
  return (
    <View style={styles.zoneTotaux}>
      {totaux.remise ? (
        <View style={styles.ligneTotal}>
          <Text style={styles.ligneTotalLabel}>Remise</Text>
          <Text style={styles.ligneTotalValeur}>- {totaux.remise}</Text>
        </View>
      ) : null}
      <View style={styles.ligneTotal}>
        <Text style={styles.ligneTotalLabel}>Total HT</Text>
        <Text style={styles.ligneTotalValeur}>{totaux.totalHT}</Text>
      </View>
      {lignesTVA.map((detail) => (
        <LigneTotalTVA
          key={`tva-${detail.taux}`}
          taux={detail.taux}
          base={detail.base}
          montant={detail.montant}
        />
      ))}
      {totaux.totalDebours ? (
        <View style={styles.ligneTotal}>
          <Text style={styles.ligneTotalLabel}>Débours refacturés</Text>
          <Text style={styles.ligneTotalValeur}>{totaux.totalDebours}</Text>
        </View>
      ) : null}
      <View style={styles.ligneTotalTTC}>
        <Text style={styles.totalTTCLabel}>Total TTC</Text>
        <Text style={styles.totalTTCValeur}>{totaux.totalTTC}</Text>
      </View>
      {franchise && totaux.mentionTVA ? (
        <Text style={styles.mentionTVA}>{totaux.mentionTVA}</Text>
      ) : null}
    </View>
  );
}

/**
 * Encadré du justificatif de réservation.
 * C'est LA pièce qu'un agent lira en premier : les 7 mentions de l'arrêté du
 * 6 août 2025 doivent y être regroupées, numérotées et immédiatement identifiables.
 */
export function EncadreMentions({ mentions }: { mentions: MentionPdf[] }) {
  if (mentions.length === 0) return null;
  return (
    <View style={styles.encadre} wrap={false}>
      <Text style={styles.encadreTitre}>
        Justificatif de réservation préalable — arrêté du 6 août 2025
      </Text>
      <Text style={styles.encadreSousTitre}>
        Mentions obligatoires prévues par l’article 1er de l’arrêté, applicables depuis le
        29 octobre 2025 (art. L. 3120-2 du Code des transports).
      </Text>
      {mentions.map((mention) => (
        <View key={mention.numero} style={styles.mentionLigne}>
          <Text style={styles.mentionNumero}>{mention.numero}°</Text>
          <View style={styles.mentionCorps}>
            <Text style={styles.mentionLibelle}>{mention.libelle}</Text>
            <Text style={styles.mentionValeur}>{mention.valeur || '— non renseigné —'}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function MentionsLegales({ mentions }: { mentions: string[] }) {
  if (mentions.length === 0) return null;
  return (
    <View style={styles.mentionsLegales} wrap={false}>
      {mentions.map((mention, index) => (
        <Text key={`mention-${index}`} style={styles.mentionLegale}>
          {mention}
        </Text>
      ))}
    </View>
  );
}

export function PiedDePage({ texte }: { texte: string }) {
  return (
    <View style={styles.piedDePage} fixed>
      <Text style={styles.piedTexte}>{texte}</Text>
      <Text
        style={styles.piedPage}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

export function BlocsDeuxColonnes({ blocs }: { blocs: Bloc[] }) {
  return (
    <View style={styles.deuxColonnes}>
      <View style={styles.colonne}>
        {blocs[0] ? <BlocPaires titre={blocs[0].titre} paires={blocs[0].paires} large /> : null}
      </View>
      <View style={styles.colonneDerniere}>
        {blocs[1] ? <BlocPaires titre={blocs[1].titre} paires={blocs[1].paires} large /> : null}
      </View>
    </View>
  );
}
