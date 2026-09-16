/**
 * Gabarit du BON DE COMMANDE.
 *
 * Ce document n'est pas un simple récapitulatif : c'est le JUSTIFICATIF DE RÉSERVATION
 * PRÉALABLE. L'encadré des 7 mentions est la partie la plus importante de la page.
 */

import { Document, Page, View } from '@react-pdf/renderer';
import { styles } from './theme';
import {
  BlocIdentite,
  BlocPaires,
  EncadreMentions,
  EnTete,
  MentionsLegales,
  PiedDePage,
  TableauLignes,
  Totaux,
  ZoneTitre,
} from './Commun';
import type { DonneesPdf } from './documentData';

export function BonDocument({ donnees }: { donnees: DonneesPdf }) {
  const franchise = donnees.totaux.detailTVA.length === 0;

  return (
    <Document
      title={`Bon de commande ${donnees.numero}`}
      author={donnees.emetteur.nom}
      subject="Justificatif de réservation préalable"
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

        {donnees.blocs[1] ? (
          <BlocPaires titre={donnees.blocs[1].titre} paires={donnees.blocs[1].paires} />
        ) : null}
        {donnees.blocs[2] ? (
          <BlocPaires titre={donnees.blocs[2].titre} paires={donnees.blocs[2].paires} />
        ) : null}

        <TableauLignes lignes={donnees.lignes} franchise={franchise} />
        <Totaux totaux={donnees.totaux} franchise={franchise} />

        <EncadreMentions mentions={donnees.mentionsJustificatif} />

        {donnees.blocs[3] ? (
          <BlocPaires titre={donnees.blocs[3].titre} paires={donnees.blocs[3].paires} large />
        ) : null}

        <MentionsLegales mentions={donnees.mentionsLegales} />

        <PiedDePage texte={donnees.piedDePage} />
      </Page>
    </Document>
  );
}
