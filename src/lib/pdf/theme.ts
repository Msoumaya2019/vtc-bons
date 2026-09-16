import { StyleSheet } from '@react-pdf/renderer';

/**
 * Mise en page des PDF.
 *
 * Aucune police n'est enregistrée : @react-pdf/renderer utilise Helvetica, intégrée au
 * moteur. Charger une police depuis un CDN casserait le fonctionnement hors connexion et
 * introduirait un appel réseau tiers, tous deux exclus par le projet.
 *
 * Le document doit rester lisible en NOIR ET BLANC à l'impression : aucune information
 * ne repose sur la seule couleur.
 */
export const COULEUR_TEXTE = '#111827';
export const COULEUR_MUETTE = '#4b5563';
export const COULEUR_FILET = '#d1d5db';
export const COULEUR_FOND_DOUX = '#f3f4f6';
export const COULEUR_ALERTE = '#991b1b';

export const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 46,
    paddingHorizontal: 36,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: COULEUR_TEXTE,
    lineHeight: 1.4,
  },
  entete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  enteteGauche: { flexDirection: 'row', alignItems: 'flex-start', maxWidth: '52%' },
  logo: { width: 52, height: 52, marginRight: 10, objectFit: 'contain' },
  enteteDroite: { maxWidth: '48%', textAlign: 'right' },
  nomEmetteur: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  complementEmetteur: { fontSize: 8, color: COULEUR_MUETTE, marginBottom: 2 },
  ligneMue: { fontSize: 8, color: COULEUR_MUETTE },
  identifiant: { fontSize: 8, color: COULEUR_MUETTE },

  filet: { height: 2, marginTop: 8, marginBottom: 14 },

  titreZone: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  titre: { fontSize: 17, fontFamily: 'Helvetica-Bold', letterSpacing: 0.5 },
  sousTitre: { fontSize: 8.5, color: COULEUR_MUETTE, marginTop: 2 },
  numeroDocument: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  bloc: { marginBottom: 10 },
  blocTitre: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: COULEUR_MUETTE,
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COULEUR_FILET,
    paddingBottom: 2,
  },
  grillePaires: { flexDirection: 'row', flexWrap: 'wrap' },
  paire: { width: '50%', paddingRight: 8, marginBottom: 4 },
  paireLabel: { fontSize: 7.5, color: COULEUR_MUETTE },
  paireValeur: { fontSize: 9.5 },
  paireLarge: { width: '100%', paddingRight: 8, marginBottom: 4 },

  deuxColonnes: { flexDirection: 'row' },
  colonne: { flex: 1, paddingRight: 8 },
  colonneDerniere: { flex: 1 },

  tableauEntete: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: COULEUR_TEXTE,
    paddingBottom: 3,
    marginBottom: 3,
  },
  tableauLigne: {
    flexDirection: 'row',
    borderBottomWidth: 0.4,
    borderBottomColor: COULEUR_FILET,
    paddingVertical: 3,
  },
  colLibelle: { flex: 1, paddingRight: 6 },
  colQuantite: { width: 42, textAlign: 'right' },
  colPrix: { width: 68, textAlign: 'right' },
  colTaux: { width: 42, textAlign: 'right' },
  colTotal: { width: 72, textAlign: 'right' },
  enteteCellule: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: COULEUR_MUETTE },
  cellule: { fontSize: 9 },
  mentionDebours: { fontSize: 7, color: COULEUR_MUETTE },

  zoneTotaux: { marginTop: 10, alignItems: 'flex-end' },
  ligneTotal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: 220,
    paddingVertical: 2,
  },
  ligneTotalLabel: { width: 120, textAlign: 'right', paddingRight: 10, fontSize: 9 },
  ligneTotalValeur: { width: 100, textAlign: 'right', fontSize: 9 },
  ligneTotalTTC: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: 220,
    paddingVertical: 4,
    marginTop: 3,
    borderTopWidth: 0.8,
    borderTopColor: COULEUR_TEXTE,
  },
  totalTTCLabel: { width: 120, textAlign: 'right', paddingRight: 10, fontSize: 11, fontFamily: 'Helvetica-Bold' },
  totalTTCValeur: { width: 100, textAlign: 'right', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  mentionTVA: { fontSize: 7.5, color: COULEUR_MUETTE, marginTop: 4, textAlign: 'right', width: 220 },

  encadre: {
    marginTop: 12,
    borderWidth: 0.8,
    borderColor: COULEUR_TEXTE,
    borderRadius: 3,
    padding: 8,
  },
  encadreTitre: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  encadreSousTitre: { fontSize: 7, color: COULEUR_MUETTE, marginBottom: 6 },
  mentionLigne: { flexDirection: 'row', marginBottom: 2.5 },
  mentionNumero: { width: 14, fontFamily: 'Helvetica-Bold', fontSize: 8 },
  mentionCorps: { flex: 1 },
  mentionLibelle: { fontSize: 7.5, color: COULEUR_MUETTE },
  mentionValeur: { fontSize: 9 },

  mentionsLegales: { marginTop: 10, borderTopWidth: 0.5, borderTopColor: COULEUR_FILET, paddingTop: 6 },
  mentionLegale: { fontSize: 7, color: COULEUR_MUETTE, marginBottom: 2 },

  tamponPaye: {
    position: 'absolute',
    top: 150,
    right: 40,
    borderWidth: 2,
    borderColor: COULEUR_TEXTE,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 12,
    transform: 'rotate(-12deg)',
  },
  tamponTexte: { fontSize: 14, fontFamily: 'Helvetica-Bold', letterSpacing: 1.5 },

  piedDePage: {
    position: 'absolute',
    bottom: 22,
    left: 36,
    right: 36,
    borderTopWidth: 0.5,
    borderTopColor: COULEUR_FILET,
    paddingTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  piedTexte: { fontSize: 6.5, color: COULEUR_MUETTE, maxWidth: '78%' },
  piedPage: { fontSize: 6.5, color: COULEUR_MUETTE },
});
