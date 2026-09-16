import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReglages } from '../../context/ReglagesContext';
import { useToast } from '../../components/ui/Toast';
import { Badge, Carte, EtatVide, type Ton } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import { Liste, Saisie } from '../../components/ui/Champ';
import { DialogueConfirmation } from '../../components/ui/Modale';
import { IconeBons, IconeOeil, IconeRecherche } from '../../components/icons';
import { dupliquerBon, lireBons, mettreBonALaCorbeille } from './service';
import { creerFactureDepuisBon } from '../factures/service';
import { calculerTotaux } from '../../lib/tva';
import { formatEuros } from '../../lib/money';
import { formatDate, libelleStatutBon } from '../../lib/format';
import type { Bon, StatutBon } from '../../types';

const tonStatut: Record<StatutBon, Ton> = {
  brouillon: 'neutre',
  emis: 'accent',
  annule: 'danger',
  facture: 'succes',
};

export function ListeBons() {
  const { settings } = useReglages();
  const toast = useToast();
  const navigate = useNavigate();
  const [bons, setBons] = useState<Bon[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState<'tous' | StatutBon>('tous');
  const [aSupprimer, setASupprimer] = useState<Bon | null>(null);

  const recharger = useCallback(async () => {
    setChargement(true);
    setBons(await lireBons());
    setChargement(false);
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const montantTTC = useCallback(
    (bon: Bon) => {
      if (!settings) return 0;
      return calculerTotaux(bon.lignes, {
        regimeTVA: settings.regimeTVA,
        traitementPeages: settings.traitementPeages,
        remiseGlobale: bon.remiseGlobale,
      }).totalTTC;
    },
    [settings],
  );

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return bons.filter((bon) => {
      if (filtreStatut !== 'tous' && bon.statut !== filtreStatut) return false;
      if (!terme) return true;
      return [
        bon.numero ?? 'brouillon',
        bon.clientSnapshot?.nom ?? '',
        bon.lieuPriseEnCharge,
        bon.destination,
      ]
        .join(' ')
        .toLowerCase()
        .includes(terme);
    });
  }, [bons, recherche, filtreStatut]);

  if (!settings) return null;

  const supprimer = async () => {
    if (!aSupprimer) return;
    await mettreBonALaCorbeille(aSupprimer.id);
    setASupprimer(null);
    toast.succes('Bon placé dans la corbeille.');
    await recharger();
  };

  const facturer = async (bon: Bon) => {
    try {
      const facture = await creerFactureDepuisBon(bon.id, settings);
      toast.succes(`Facture ${facture.numero} créée.`);
      navigate(`/factures/${facture.id}`);
    } catch (erreur) {
      toast.erreur(erreur instanceof Error ? erreur.message : 'Facturation impossible.');
    }
  };

  const dupliquer = async (bon: Bon) => {
    const copie = await dupliquerBon(bon.id);
    if (copie) {
      toast.succes('Bon dupliqué en brouillon.');
      navigate(`/bons/${copie.id}`);
    }
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
            Mes bons de commande
          </h1>
          <p className="texte-muet">
            Chaque bon est un justificatif de réservation préalable, présentable en contrôle.
          </p>
        </div>
        <Bouton variante="primaire" onClick={() => navigate('/nouveau')}>
          Nouveau
        </Bouton>
      </header>

      {bons.length > 0 ? (
        <div className="space-y-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <IconeRecherche className="h-5 w-5" />
            </span>
            <Saisie
              className="pl-11"
              placeholder="Rechercher un numéro, un client, un lieu"
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
              aria-label="Rechercher un bon"
            />
          </div>
          <Liste
            value={filtreStatut}
            onChange={(evenement) => setFiltreStatut(evenement.target.value as 'tous' | StatutBon)}
            aria-label="Filtrer par statut"
          >
            <option value="tous">Tous les statuts</option>
            <option value="brouillon">Brouillons</option>
            <option value="emis">Émis</option>
            <option value="facture">Facturés</option>
            <option value="annule">Annulés</option>
          </Liste>
        </div>
      ) : null}

      {!chargement && bons.length === 0 ? (
        <EtatVide
          icone={<IconeBons className="h-10 w-10" />}
          titre="Aucun bon de commande"
          description="Créez votre premier bon : il vous faudra moins d’une minute avec un client déjà enregistré."
          action={
            <Bouton variante="primaire" onClick={() => navigate('/nouveau')}>
              Créer un bon de commande
            </Bouton>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtres.map((bon) => (
            <Carte key={bon.id} className="space-y-3">
              <Link to={`/bons/${bon.id}`} className="block">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-50">
                    {bon.numero ?? 'Brouillon'}
                  </span>
                  <Badge ton={tonStatut[bon.statut]}>{libelleStatutBon(bon.statut)}</Badge>
                  <span className="ml-auto font-semibold text-slate-900 dark:text-slate-50">
                    {formatEuros(montantTTC(bon))}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {bon.clientSnapshot?.nom ?? 'Client non figé (brouillon)'}
                </p>
                <p className="texte-muet">
                  {formatDate(bon.datePriseEnCharge)} à {bon.heurePriseEnCharge} ·{' '}
                  {bon.lieuPriseEnCharge || 'lieu non renseigné'}
                </p>
                {bon.destination ? (
                  <p className="texte-muet">→ {bon.destination}</p>
                ) : null}
              </Link>

              <div className="flex flex-wrap gap-2">
                <Link to={`/controle/${bon.id}`}>
                  <Bouton petit variante="primaire" icone={<IconeOeil className="h-4 w-4" />}>
                    Présenter le justificatif
                  </Bouton>
                </Link>
                {bon.statut === 'emis' ? (
                  <Bouton petit onClick={() => void facturer(bon)}>
                    Transformer en facture
                  </Bouton>
                ) : null}
                <Bouton petit variante="fantome" onClick={() => void dupliquer(bon)}>
                  Dupliquer
                </Bouton>
                <Bouton petit variante="fantome" onClick={() => setASupprimer(bon)}>
                  Supprimer
                </Bouton>
              </div>
            </Carte>
          ))}
          {filtres.length === 0 && bons.length > 0 ? (
            <p className="texte-muet text-center py-6">Aucun bon ne correspond à cette recherche.</p>
          ) : null}
        </div>
      )}

      <DialogueConfirmation
        ouverte={aSupprimer !== null}
        titre="Mettre ce bon à la corbeille ?"
        message={
          aSupprimer?.numero
            ? `Le bon ${aSupprimer.numero} sera placé dans la corbeille. Son numéro ne sera jamais réutilisé : la séquence reste continue.`
            : 'Ce brouillon sera placé dans la corbeille.'
        }
        libelleConfirmer="Mettre à la corbeille"
        danger
        onConfirmer={() => void supprimer()}
        onAnnuler={() => setASupprimer(null)}
      />
    </div>
  );
}
