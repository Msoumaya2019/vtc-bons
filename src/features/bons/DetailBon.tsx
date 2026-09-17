import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db } from '../../lib/db';
import { useReglages } from '../../context/ReglagesContext';
import { useClients } from '../../context/ClientsContext';
import { useToast } from '../../components/ui/Toast';
import { Badge, Bandeau, Carte, type Ton } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import { DialogueConfirmation } from '../../components/ui/Modale';
import {
  IconeOeil,
  IconePartager,
  IconeRetour,
  IconeSauvegarde,
  IconeTelecharger,
} from '../../components/icons';
import { dupliquerBon, mettreBonALaCorbeille } from './service';
import { creerFactureDepuisBon } from '../factures/service';
import { MENTIONS_ARRETE_2025 } from '../../lib/mentions';
import { construireMentionsJustificatif } from '../../lib/pdf/documentData';
import { snapshotEmetteur } from '../../lib/snapshots';
import { partagerPdf, regenererPdfBon, telechargerPdf } from '../../lib/pdf/generate';
import { calculerTotaux } from '../../lib/tva';
import { formatEuros } from '../../lib/money';
import { formatDate, libelleModePaiement, libelleStatutBon, libelleTypePrestation } from '../../lib/format';
import type { Bon, StatutBon } from '../../types';

const tonStatut: Record<StatutBon, Ton> = {
  brouillon: 'neutre',
  emis: 'accent',
  annule: 'danger',
  facture: 'succes',
};

export function DetailBon() {
  const { bonId = '' } = useParams();
  const [parametres] = useSearchParams();
  const { settings } = useReglages();
  const { clients } = useClients();
  const toast = useToast();
  const navigate = useNavigate();

  const [bon, setBon] = useState<Bon | null>(null);
  const [chargement, setChargement] = useState(true);
  const [aSupprimer, setASupprimer] = useState(false);
  const [action, setAction] = useState(false);

  const recharger = useCallback(async () => {
    setChargement(true);
    const charge = await db.bons.get(bonId);
    setBon(charge ?? null);
    setChargement(false);
  }, [bonId]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const facturer = useCallback(async () => {
    if (!bon || !settings) return;
    try {
      const facture = await creerFactureDepuisBon(bon.id, settings);
      toast.succes(`Facture ${facture.numero} créée.`);
      navigate(`/factures/${facture.id}`);
    } catch (erreur) {
      toast.erreur(erreur instanceof Error ? erreur.message : 'Facturation impossible.');
    }
  }, [bon, settings, toast, navigate]);

  // Arrivée depuis l'assistant avec « créer aussi la facture ».
  useEffect(() => {
    if (parametres.get('facturer') === '1' && bon?.statut === 'emis' && !bon.factureId) {
      void facturer();
    }
  }, [parametres, bon, facturer]);

  if (chargement) return <p className="texte-muet">Chargement…</p>;
  if (!bon || !settings) {
    return (
      <Carte>
        <p className="font-semibold">Ce bon de commande est introuvable.</p>
        <Link to="/bons" className="lien-accent mt-2 inline-block">
          Revenir à mes bons
        </Link>
      </Carte>
    );
  }

  const clientEnregistre = clients.find((client) => client.id === bon.clientId) ?? null;
  const mentions = construireMentionsJustificatif(
    bon,
    bon.emetteurSnapshot ?? snapshotEmetteur(settings),
    bon.clientSnapshot,
  );

  const totaux = calculerTotaux(bon.lignes, {
    regimeTVA: settings.regimeTVA,
    traitementPeages: settings.traitementPeages,
    remiseGlobale: bon.remiseGlobale,
  });

  const regenerer = async () => {
    setAction(true);
    try {
      await regenererPdfBon(bon.id, settings, clientEnregistre);
      toast.succes('PDF régénéré avec votre charte actuelle.');
      await recharger();
    } finally {
      setAction(false);
    }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate('/bons')} className="lien-accent flex items-center gap-1 text-sm">
        <IconeRetour className="h-4 w-4" />
        Mes bons de commande
      </button>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-mono text-xl font-bold text-slate-900 dark:text-slate-50">
            {bon.numero ?? 'Brouillon'}
          </h1>
          <Badge ton={tonStatut[bon.statut]}>{libelleStatutBon(bon.statut)}</Badge>
        </div>
        <p className="texte-muet">
          {bon.clientSnapshot?.nom ?? clientEnregistre?.nom ?? 'Client non figé'} ·{' '}
          {formatDate(bon.datePriseEnCharge)} à {bon.heurePriseEnCharge}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link to={`/controle/${bon.id}`}>
          <Bouton variante="primaire" icone={<IconeOeil className="h-4 w-4" />}>
            Présenter le justificatif
          </Bouton>
        </Link>
        {bon.pdfBlob ? (
          <>
            <Bouton
              onClick={() => void partagerPdf(bon.pdfBlob!, `bon-${bon.numero}.pdf`, 'Bon de commande')}
              icone={<IconePartager className="h-4 w-4" />}
            >
              Partager
            </Bouton>
            <Bouton
              onClick={() => void telechargerPdf(bon.pdfBlob!, `bon-${bon.numero}.pdf`)}
              icone={<IconeTelecharger className="h-4 w-4" />}
            >
              Télécharger
            </Bouton>
          </>
        ) : (
          <Bouton onClick={() => void regenerer()} chargement={action} icone={<IconeSauvegarde className="h-4 w-4" />}>
            Générer le PDF
          </Bouton>
        )}
        {bon.statut === 'emis' ? (
          <Bouton onClick={() => void facturer()}>Transformer en facture</Bouton>
        ) : null}
        {bon.factureId ? (
          <Link to={`/factures/${bon.factureId}`}>
            <Bouton>Voir la facture</Bouton>
          </Link>
        ) : null}
        <Bouton
          variante="fantome"
          onClick={async () => {
            const copie = await dupliquerBon(bon.id);
            if (copie) navigate(`/bons/${copie.id}`);
          }}
        >
          Dupliquer
        </Bouton>
        <Bouton variante="danger" onClick={() => setASupprimer(true)}>
          Supprimer
        </Bouton>
      </div>

      {bon.statut === 'brouillon' ? (
        <Bandeau ton="attention">
          Ce bon est un brouillon : il n’a pas encore de numéro et ne peut pas être présenté en
          contrôle. Reprenez la saisie pour l’émettre.
        </Bandeau>
      ) : null}

      <Carte className="space-y-2">
        <h2 className="section-titre">Réservation et trajet</h2>
        <Info label="Date et heure de la réservation" valeur={`${formatDate(bon.dateReservation)} à ${bon.heureReservation}`} />
        <Info label="Prise en charge souhaitée" valeur={`${formatDate(bon.datePriseEnCharge)} à ${bon.heurePriseEnCharge}`} />
        <Info label="Lieu de prise en charge" valeur={bon.lieuPriseEnCharge || '—'} />
        <Info label="Destination" valeur={bon.destination || '—'} />
        <Info label="Prestation" valeur={libelleTypePrestation(bon.typePrestation)} />
        <Info label="Passagers" valeur={bon.nombrePassagers != null ? String(bon.nombrePassagers) : '—'} />
        <Info label="Vol / train" valeur={bon.numeroVolTrain || '—'} />
        <Info label="Bagages" valeur={bon.bagages || '—'} />
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">Véhicule</h2>
        <Info label="Véhicule" valeur={[bon.vehiculeMarque, bon.vehiculeModele].filter(Boolean).join(' ') || '—'} />
        <Info label="Immatriculation" valeur={bon.vehiculeImmatriculation || '—'} />
        <Info label="Conducteur" valeur={bon.nomConducteur || '—'} />
        <Info label="Mode de paiement" valeur={libelleModePaiement(bon.modePaiement)} />
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">Prestation</h2>
        {bon.lignes.map((ligne) => (
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
          <Info label="Total HT" valeur={formatEuros(totaux.totalHT)} />
          {totaux.detailTVA.map((detail) => (
            <Info
              key={detail.taux}
              label={`TVA ${detail.taux} %`}
              valeur={formatEuros(detail.montantTVA)}
            />
          ))}
          {totaux.totalDebours > 0 ? (
            <Info label="Débours" valeur={formatEuros(totaux.totalDebours)} />
          ) : null}
          <div className="flex items-center justify-between pt-1">
            <span className="font-bold">Total TTC</span>
            <span className="text-lg font-bold">{formatEuros(totaux.totalTTC)}</span>
          </div>
          {totaux.mentionTVA ? <p className="aide-champ">{totaux.mentionTVA}</p> : null}
        </div>
      </Carte>

      <Carte className="space-y-3">
        <h2 className="section-titre">
          Justificatif de réservation — arrêté du 6 août 2025
        </h2>
        <p className="texte-muet">
          Les 7 mentions exigées, telles qu’elles apparaissent sur le document.
        </p>
        <ol className="space-y-2">
          {mentions.map((mention) => (
            <li key={mention.numero} className="flex gap-3 text-sm">
              <span className="font-bold text-slate-400">{mention.numero}°</span>
              <span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {MENTIONS_ARRETE_2025[mention.numero - 1]}
                </span>
                <span
                  className={
                    mention.valeur
                      ? 'font-medium text-slate-900 dark:text-slate-50'
                      : 'font-medium text-red-600 dark:text-red-400'
                  }
                >
                  {mention.valeur || 'non renseigné'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Carte>

      {bon.notesClient ? (
        <Carte>
          <h2 className="section-titre mb-1">Précisions pour le client</h2>
          <p className="text-sm text-slate-700 dark:text-slate-200">{bon.notesClient}</p>
        </Carte>
      ) : null}

      {bon.historique.length > 0 ? (
        <Carte>
          <h2 className="section-titre mb-2">Historique</h2>
          <ul className="space-y-1">
            {bon.historique.map((entree, index) => (
              <li key={index} className="texte-muet">
                {new Date(entree.dateISO).toLocaleString('fr-FR')} — {entree.champ} :{' '}
                {entree.ancienneValeur} → {entree.nouvelleValeur}
              </li>
            ))}
          </ul>
        </Carte>
      ) : null}

      <DialogueConfirmation
        ouverte={aSupprimer}
        titre="Mettre ce bon à la corbeille ?"
        message="Le bon sera placé dans la corbeille. Son numéro ne sera jamais réutilisé."
        libelleConfirmer="Mettre à la corbeille"
        danger
        onConfirmer={async () => {
          await mettreBonALaCorbeille(bon.id);
          setASupprimer(false);
          toast.succes('Bon placé dans la corbeille.');
          navigate('/bons');
        }}
        onAnnuler={() => setASupprimer(false)}
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
