import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db } from '../../lib/db';
import { useReglages } from '../../context/ReglagesContext';
import { useToast } from '../../components/ui/Toast';
import { Badge, Bandeau, Carte, type Ton } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import { DialogueConfirmation, Modale } from '../../components/ui/Modale';
import { Liste, Saisie } from '../../components/ui/Champ';
import { IconePartager, IconeRetour, IconeSauvegarde, IconeTelecharger } from '../../components/icons';
import {
  annulerPaiement,
  creerAvoir,
  marquerPayee,
  mettreFactureALaCorbeille,
  statutEffectif,
} from './service';
import { verifierConformiteFacture } from '../bons/conformite';
import { MENTIONS_OBLIGATOIRES_FACTURE } from '../../lib/mentions';
import { partagerPdf, regenererPdfFacture, telechargerPdf } from '../../lib/pdf/generate';
import { formatEuros } from '../../lib/money';
import {
  dateLocaleISO,
  formatDate,
  libelleModePaiement,
  libelleStatutFacture,
} from '../../lib/format';
import type { Facture, ModePaiement, StatutFacture } from '../../types';

const tonStatut: Record<StatutFacture, Ton> = {
  emise: 'neutre',
  payee: 'succes',
  en_retard: 'danger',
  annulee: 'attention',
};

export function DetailFacture() {
  const { factureId = '' } = useParams();
  const { settings } = useReglages();
  const toast = useToast();
  const navigate = useNavigate();

  const [facture, setFacture] = useState<Facture | null>(null);
  const [chargement, setChargement] = useState(true);
  const [action, setAction] = useState(false);
  const [modalePaiement, setModalePaiement] = useState(false);
  const [datePaiement, setDatePaiement] = useState(dateLocaleISO());
  const [moyenPaiement, setMoyenPaiement] = useState<ModePaiement>('virement');
  const [confirmerAvoir, setConfirmerAvoir] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  const recharger = useCallback(async () => {
    setChargement(true);
    const chargee = await db.factures.get(factureId);
    setFacture(chargee ?? null);
    setChargement(false);
  }, [factureId]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  if (chargement) return <p className="texte-muet">Chargement…</p>;
  if (!facture || !settings) {
    return (
      <Carte>
        <p className="font-semibold">Cette facture est introuvable.</p>
        <Link to="/factures" className="lien-accent mt-2 inline-block">
          Revenir à mes factures
        </Link>
      </Carte>
    );
  }

  const statut = statutEffectif(facture);
  const problemes = verifierConformiteFacture(facture, settings);

  const regenerer = async () => {
    setAction(true);
    try {
      await regenererPdfFacture(facture.id, settings);
      toast.succes('PDF régénéré avec votre charte actuelle.');
      await recharger();
    } finally {
      setAction(false);
    }
  };

  const payer = async () => {
    await marquerPayee(facture.id, datePaiement, moyenPaiement, settings);
    setModalePaiement(false);
    toast.succes('Facture marquée payée.');
    await recharger();
  };

  const avoir = async () => {
    try {
      const cree = await creerAvoir(facture.id, settings);
      setConfirmerAvoir(false);
      toast.succes(`Avoir ${cree.numero} émis.`);
      navigate(`/factures/${cree.id}`);
    } catch (erreur) {
      toast.erreur(erreur instanceof Error ? erreur.message : 'Émission de l’avoir impossible.');
    }
  };

  const nomFichier = `${facture.numero}.pdf`;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/factures')}
        className="lien-accent flex items-center gap-1 text-sm"
      >
        <IconeRetour className="h-4 w-4" />
        Mes factures
      </button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-bold text-slate-900 dark:text-slate-50">
            {facture.numero}
          </h1>
          {facture.type === 'avoir' ? <Badge ton="attention">Avoir</Badge> : null}
          <Badge ton={tonStatut[statut]}>{libelleStatutFacture(statut)}</Badge>
        </div>
        <p className="texte-muet">
          {facture.clientSnapshot.nom} · émise le {formatDate(facture.dateEmission)} · échéance{' '}
          {formatDate(facture.dateEcheance)}
        </p>
        {facture.datePaiement ? (
          <p className="texte-muet">
            Payée le {formatDate(facture.datePaiement)}
            {facture.moyenPaiement ? ` par ${libelleModePaiement(facture.moyenPaiement)}` : ''}
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        {facture.pdfBlob ? (
          <>
            <Bouton
              variante="primaire"
              icone={<IconePartager className="h-4 w-4" />}
              onClick={() => void partagerPdf(facture.pdfBlob!, nomFichier, `Facture ${facture.numero}`)}
            >
              Partager
            </Bouton>
            <Bouton
              icone={<IconeTelecharger className="h-4 w-4" />}
              onClick={() => telechargerPdf(facture.pdfBlob!, nomFichier)}
            >
              Télécharger
            </Bouton>
          </>
        ) : (
          <Bouton onClick={() => void regenerer()} chargement={action}>
            Générer le PDF
          </Bouton>
        )}
        {statut === 'emise' || statut === 'en_retard' ? (
          <Bouton
            variante="primaire"
            onClick={() => {
              setDatePaiement(dateLocaleISO());
              setModalePaiement(true);
            }}
          >
            Marquer payée
          </Bouton>
        ) : null}
        {statut === 'payee' ? (
          <Bouton
            onClick={async () => {
              await annulerPaiement(facture.id, settings);
              toast.info('Paiement annulé.');
              await recharger();
            }}
          >
            Annuler le paiement
          </Bouton>
        ) : null}
        {facture.type === 'facture' && statut !== 'annulee' ? (
          <Bouton onClick={() => setConfirmerAvoir(true)}>Émettre un avoir</Bouton>
        ) : null}
        <Bouton variante="fantome" onClick={() => void regenerer()} chargement={action} icone={<IconeSauvegarde className="h-4 w-4" />}>
          Régénérer le PDF
        </Bouton>
        <Bouton variante="danger" onClick={() => setConfirmerSuppression(true)}>
          Supprimer
        </Bouton>
      </div>

      {facture.factureOrigineId ? (
        <Bandeau ton="attention">
          Cet avoir annule la facture d’origine. Le montant est négatif et vient en déduction du
          chiffre d’affaires.
        </Bandeau>
      ) : null}

      {facture.bonId ? (
        <Carte>
          <Link to={`/bons/${facture.bonId}`} className="lien-accent text-sm">
            Voir le bon de commande d’origine
          </Link>
        </Carte>
      ) : null}

      <Carte className="space-y-2">
        <h2 className="section-titre">Dates</h2>
        <Info label="Date d’émission" valeur={formatDate(facture.dateEmission)} />
        <Info label="Date de la prestation" valeur={formatDate(facture.datePrestation)} />
        <Info label="Date d’échéance" valeur={formatDate(facture.dateEcheance)} />
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">Détail</h2>
        {facture.lignes.map((ligne) => (
          <div key={ligne.id} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-slate-700 dark:text-slate-200">
              {ligne.libelle}
              <span className="texte-muet block">
                {ligne.quantite} × {formatEuros(ligne.prixUnitaireCentimes)}
                {ligne.estDebours ? ' · débours' : ` · TVA ${ligne.tauxTVA} %`}
              </span>
            </span>
            <span className="font-medium">
              {formatEuros(Math.round(ligne.quantite * ligne.prixUnitaireCentimes))}
            </span>
          </div>
        ))}
        <div className="mt-2 space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
          <Info label="Total HT" valeur={formatEuros(facture.montantHT)} />
          {facture.detailTVA.map((detail) => (
            <Info key={detail.taux} label={`TVA ${detail.taux} %`} valeur={formatEuros(detail.montantTVA)} />
          ))}
          {facture.montantDebours > 0 ? (
            <Info label="Débours" valeur={formatEuros(facture.montantDebours)} />
          ) : null}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold">Total TTC</span>
            <span className="text-lg font-bold">{formatEuros(facture.montantTTC)}</span>
          </div>
          {facture.mentionTVA ? <p className="aide-champ">{facture.mentionTVA}</p> : null}
        </div>
      </Carte>

      <Carte className="space-y-3">
        <h2 className="section-titre">Conformité de la facture</h2>
        {problemes.length === 0 ? (
          <Bandeau ton="succes">
            Toutes les mentions obligatoires sont renseignées sur cette facture.
          </Bandeau>
        ) : (
          <>
            {problemes
              .filter((probleme) => probleme.niveau === 'blocage')
              .map((probleme) => (
                <Bandeau key={probleme.champ} ton="danger" titre="À corriger">
                  {probleme.message}
                </Bandeau>
              ))}
            {problemes
              .filter((probleme) => probleme.niveau === 'avertissement')
              .map((probleme) => (
                <Bandeau key={probleme.champ} ton="attention">
                  {probleme.message}
                </Bandeau>
              ))}
          </>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-slate-600 dark:text-slate-300">
            Voir les mentions obligatoires d’une facture
          </summary>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600 dark:text-slate-300">
            {MENTIONS_OBLIGATOIRES_FACTURE.map((mention) => (
              <li key={mention}>{mention}</li>
            ))}
          </ul>
        </details>
      </Carte>

      {facture.historique.length > 0 ? (
        <Carte>
          <h2 className="section-titre mb-2">Historique</h2>
          <ul className="space-y-1">
            {facture.historique.map((entree, index) => (
              <li key={index} className="texte-muet">
                {new Date(entree.dateISO).toLocaleString('fr-FR')} — {entree.champ}
              </li>
            ))}
          </ul>
        </Carte>
      ) : null}

      <Modale
        ouverte={modalePaiement}
        titre="Marquer la facture payée"
        onFermer={() => setModalePaiement(false)}
        actions={
          <>
            <Bouton variante="secondaire" onClick={() => setModalePaiement(false)}>
              Annuler
            </Bouton>
            <Bouton variante="primaire" onClick={() => void payer()}>
              Confirmer
            </Bouton>
          </>
        }
      >
        <label className="etiquette" htmlFor="date-paiement-detail">
          Date du paiement
        </label>
        <Saisie
          id="date-paiement-detail"
          type="date"
          value={datePaiement}
          onChange={(evenement) => setDatePaiement(evenement.target.value)}
        />
        <label className="etiquette mt-3 block" htmlFor="moyen-paiement-detail">
          Moyen de paiement
        </label>
        <Liste
          id="moyen-paiement-detail"
          value={moyenPaiement}
          onChange={(evenement) => setMoyenPaiement(evenement.target.value as ModePaiement)}
        >
          {(['virement', 'cb', 'especes', 'plateforme', 'autre'] as ModePaiement[]).map((mode) => (
            <option key={mode} value={mode}>
              {libelleModePaiement(mode)}
            </option>
          ))}
        </Liste>
      </Modale>

      <DialogueConfirmation
        ouverte={confirmerAvoir}
        titre="Émettre un avoir ?"
        message="Un avoir sera créé avec sa propre numérotation, des montants négatifs, et une référence à cette facture. La facture d’origine passera au statut « annulée »."
        libelleConfirmer="Émettre l’avoir"
        onConfirmer={() => void avoir()}
        onAnnuler={() => setConfirmerAvoir(false)}
      />

      <DialogueConfirmation
        ouverte={confirmerSuppression}
        titre="Mettre cette facture à la corbeille ?"
        message="La facture sera placée dans la corbeille. Son numéro ne sera jamais réutilisé : la séquence reste continue. Une pièce comptable se conserve 10 ans."
        libelleConfirmer="Mettre à la corbeille"
        danger
        onConfirmer={async () => {
          await mettreFactureALaCorbeille(facture.id);
          setConfirmerSuppression(false);
          toast.succes('Facture placée dans la corbeille.');
          navigate('/factures');
        }}
        onAnnuler={() => setConfirmerSuppression(false)}
      />
    </div>
  );
}

function Info({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-900 dark:text-slate-50">{valeur}</span>
    </div>
  );
}
