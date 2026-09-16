/**
 * Gabarit de la FACTURE (et de l'AVOIR).
 *
 * Toutes les mentions obligatoires sont imprimées : identité complète du vendeur,
 * REVTC, identité de l'acheteur, dates d'émission / prestation / échéance, désignation
 * détaillée, taux de TVA par ligne, total HT, détail de la TVA par taux, total TTC,
 * conditions de règlement, pénalités de retard et indemnité de 40 €, escompte,
 * assurance professionnelle, coordonnées bancaires, et mention de franchise en base
 * le cas échéant.
 */

import { Document, Page, Text, View } from '@react-pdf/renderer';
import { styles } from './theme';
import {
  BlocIdentite,
  BlocPaires,
  EnTete,
  MentionsLegales,
  PiedDePage,
  TableauLignes,
  Totaux,
  ZoneTitre,
} from './Commun';
import { formatDate } from '../format';
import type { DonneesPdf } from './documentData';

export function FactureDocument({
  donnees,
  paiement,
}: {
  donnees: DonneesPdf;
  paiement: { date: string } | null;
}) {
  const franchise = donnees.totaux.detailTVA.length === 0;

  return (
    <Document
      title={`${donnees.titre} ${donnees.numero}`}
      author={donnees.emetteur.nom}
      subject={donnees.titre}
      creator="vtc-bons"
    >
      <Page size="A4" style={styles.page}>
        <EnTete emetteur={donnees.emetteur} />
        <ZoneTitre titre={donnees.titre} sousTitre={donnees.sousTitre} numero={donnees.numero} />

        <View style={styles.deuxColonnes}>
          <View style={styles.colonne}>
            <BlocIdentite titre="Client" entite={donnees.client} />
          </View>
          <View style={styles.colonneDerniere}>
            {donnees.blocs[0] ? (
              <BlocPaires titre={donnees.blocs[0].titre} paires={donnees.blocs[0].paires} large />
            ) : null}
          </View>
        </View>

        <TableauLignes lignes={donnees.lignes} franchise={franchise} />
        <Totaux totaux={donnees.totaux} franchise={franchise} />

        <View style={styles.deuxColonnes}>
          <View style={styles.colonne}>
            {donnees.blocs[1] ? (
              <BlocPaires titre={donnees.blocs[1].titre} paires={donnees.blocs[1].paires} large />
            ) : null}
          </View>
          <View style={styles.colonneDerniere}>
            {donnees.blocs[2] ? (
              <BlocPaires titre={donnees.blocs[2].titre} paires={donnees.blocs[2].paires} large />
            ) : null}
          </View>
        </View>

        <MentionsLegales mentions={donnees.mentionsLegales} />

        {paiement ? (
          <View style={styles.tamponPaye}>
            <Text style={styles.tamponTexte}>PAYÉE</Text>
            <Text style={{ fontSize: 7, textAlign: 'center' }}>{formatDate(paiement.date)}</Text>
          </View>
        ) : null}

        <PiedDePage texte={`${donnees.piedDePage}Facture à conserver 10 ans.`} />
      </Page>
    </Document>
  );
}
