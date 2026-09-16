import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useReglages } from '../../context/ReglagesContext';
import { useToast } from '../../components/ui/Toast';
import { Badge, Bandeau, Carte, EtatVide, type Ton } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import { Liste, Saisie } from '../../components/ui/Champ';
import { Modale } from '../../components/ui/Modale';
import { IconeFactures, IconeRecherche } from '../../components/icons';
import {
  calculerIndicateurs,
  lireFactures,
  marquerPayee,
  statutEffectif,
} from './service';
import { formatEuros } from '../../lib/money';
import { dateLocaleISO, formatDate, libelleModePaiement, libelleStatutFacture } from '../../lib/format';
import type { Facture, ModePaiement, StatutFacture } from '../../types';

const tonStatut: Record<StatutFacture, Ton> = {
  emise: 'neutre',
  payee: 'succes',
  en_retard: 'danger',
  annulee: 'attention',
};

export function ListeFactures() {
  const { settings } = useReglages();
  const toast = useToast();
  const navigate = useNavigate();
  const [factures, setFactures] = useState<Facture[]>([]);
  const [chargement, setChargement] = useState(true);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState<'toutes' | StatutFacture>('toutes');
  const [annee, setAnnee] = useState(new Date().getFullYear());
  const [aPayer, setAPayer] = useState<Facture | null>(null);
  const [datePaiement, setDatePaiement] = useState(dateLocaleISO());
  const [moyenPaiement, setMoyenPaiement] = useState<ModePaiement>('virement');

  const recharger = useCallback(async () => {
    setChargement(true);
    setFactures(await lireFactures());
    setChargement(false);
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const anneesDisponibles = useMemo(() => {
    const ensemble = new Set<number>(factures.map((facture) => Number(facture.dateEmission.slice(0, 4))));
    ensemble.add(new Date().getFullYear());
    return [...ensemble].sort((a, b) => b - a);
  }, [factures]);

  const indicateurs = useMemo(() => calculerIndicateurs(factures, annee), [factures, annee]);

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return factures.filter((facture) => {
      if (Number(facture.dateEmission.slice(0, 4)) !== annee) return false;
      if (filtre !== 'toutes' && statutEffectif(facture) !== filtre) return false;
      if (!terme) return true;
      return [facture.numero, facture.clientSnapshot.nom].join(' ').toLowerCase().includes(terme);
    });
  }, [factures, recherche, filtre, annee]);

  if (!settings) return null;

  const confirmerPaiement = async () => {
    if (!aPayer) return;
    await marquerPayee(aPayer.id, datePaiement, moyenPaiement, settings);
    setAPayer(null);
    toast.succes('Facture marquée payée.');
    await recharger();
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Mes factures</h1>
          <p className="texte-muet">
            Numérotation continue, statuts de paiement et chiffre d’affaires.
          </p>
        </div>
        <Liste
          value={String(annee)}
          onChange={(evenement) => setAnnee(Number(evenement.target.value))}
          aria-label="Choisir l’année"
          className="w-28"
        >
          {anneesDisponibles.map((valeur) => (
            <option key={valeur} value={valeur}>
              {valeur}
            </option>
          ))}
        </Liste>
      </header>

      <Carte className="grid grid-cols-2 gap-3">
        <Indicateur label="Chiffre d’affaires TTC" valeur={formatEuros(indicateurs.chiffreAffairesTTC)} />
        <Indicateur label="Total HT" valeur={formatEuros(indicateurs.totalHT)} />
        <Indicateur label="TVA collectée" valeur={formatEuros(indicateurs.totalTVA)} />
        <Indicateur label="En attente de paiement" valeur={formatEuros(indicateurs.enAttente)} />
        {indicateurs.nombreEnRetard > 0 ? (
          <div className="col-span-2">
            <Bandeau ton="danger">
              {indicateurs.nombreEnRetard} facture(s) en retard de paiement.
            </Bandeau>
          </div>
        ) : null}
      </Carte>

      {factures.length > 0 ? (
        <div className="space-y-2">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <IconeRecherche className="h-5 w-5" />
            </span>
            <Saisie
              className="pl-11"
              placeholder="Rechercher un numéro ou un client"
              value={recherche}
              onChange={(evenement) => setRecherche(evenement.target.value)}
              aria-label="Rechercher une facture"
            />
          </div>
          <Liste
            value={filtre}
            onChange={(evenement) => setFiltre(evenement.target.value as 'toutes' | StatutFacture)}
            aria-label="Filtrer par statut"
          >
            <option value="toutes">Tous les statuts</option>
            <option value="emise">Émises</option>
            <option value="payee">Payées</option>
            <option value="en_retard">En retard</option>
            <option value="annulee">Annulées</option>
          </Liste>
        </div>
      ) : null}

      {!chargement && factures.length === 0 ? (
        <EtatVide
          icone={<IconeFactures className="h-10 w-10" />}
          titre="Aucune facture"
          description="Transformez un bon de commande émis en facture : les montants et le client sont repris automatiquement."
          action={
            <Bouton variante="primaire" onClick={() => navigate('/bons')}>
              Voir mes bons de commande
            </Bouton>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtres.map((facture) => {
            const statut = statutEffectif(facture);
            return (
              <Carte key={facture.id} className="space-y-3">
                <Link to={`/factures/${facture.id}`} className="block">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-50">
                      {facture.numero}
                    </span>
                    {facture.type === 'avoir' ? <Badge ton="attention">Avoir</Badge> : null}
                    <Badge ton={tonStatut[statut]}>{libelleStatutFacture(statut)}</Badge>
                    <span className="ml-auto font-semibold text-slate-900 dark:text-slate-50">
                      {formatEuros(facture.montantTTC)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {facture.clientSnapshot.nom}
                  </p>
                  <p className="texte-muet">
                    Émise le {formatDate(facture.dateEmission)} · échéance{' '}
                    {formatDate(facture.dateEcheance)}
                  </p>
                </Link>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/factures/${facture.id}`}>
                    <Bouton petit>Ouvrir</Bouton>
                  </Link>
                  {statut === 'emise' || statut === 'en_retard' ? (
                    <Bouton
                      petit
                      variante="primaire"
                      onClick={() => {
                        setAPayer(facture);
                        setDatePaiement(dateLocaleISO());
                      }}
                    >
                      Marquer payée
                    </Bouton>
                  ) : null}
                </div>
              </Carte>
            );
          })}
          {filtres.length === 0 && factures.length > 0 ? (
            <p className="texte-muet py-6 text-center">
              Aucune facture ne correspond à ce filtre pour {annee}.
            </p>
          ) : null}
        </div>
      )}

      <Modale
        ouverte={aPayer !== null}
        titre="Marquer la facture payée"
        onFermer={() => setAPayer(null)}
        actions={
          <>
            <Bouton variante="secondaire" onClick={() => setAPayer(null)}>
              Annuler
            </Bouton>
            <Bouton variante="primaire" onClick={() => void confirmerPaiement()}>
              Confirmer le paiement
            </Bouton>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Facture {aPayer?.numero} — {formatEuros(aPayer?.montantTTC ?? 0)}
        </p>
        <label className="etiquette" htmlFor="date-paiement">
          Date du paiement
        </label>
        <Saisie
          id="date-paiement"
          type="date"
          value={datePaiement}
          onChange={(evenement) => setDatePaiement(evenement.target.value)}
        />
        <label className="etiquette mt-3 block" htmlFor="moyen-paiement">
          Moyen de paiement
        </label>
        <Liste
          id="moyen-paiement"
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
    </div>
  );
}

function Indicateur({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-base font-bold text-slate-900 dark:text-slate-50">{valeur}</p>
    </div>
  );
}
