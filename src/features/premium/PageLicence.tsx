import { useState } from 'react';
import { Bouton } from '../../components/ui/Bouton';
import { Badge, Carte } from '../../components/ui/Carte';
import { Champ, ZoneTexte } from '../../components/ui/Champ';
import { useReglages } from '../../context/ReglagesContext';
import { formatDate } from '../../lib/format';
import { messageRefus, verifierLicence } from '../../lib/licence';
import { PLAFONDS, libelleQuota, type TypeQuota } from '../../lib/quota';
import { useAcces } from '../../context/AccesContext';

const ORDRE: TypeQuota[] = ['bons', 'factures', 'clients'];

/**
 * Écran de licence : où l'on voit ce que vaut le droit en cours, et où l'on saisit un
 * code pour le renouveler.
 *
 * Le code est vérifié AVANT d'être enregistré. Enregistrer d'abord et vérifier ensuite
 * laisserait dans les réglages un jeton refusé, que le prochain lancement relirait sans
 * savoir d'où il vient — et le chauffeur croirait avoir débloqué l'application.
 */
export function PageLicence() {
  const { settings, enregistrer } = useReglages();
  const { etat, rafraichir } = useAcces();

  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const licence = etat?.licence ?? null;
  const valide = licence?.valide === true;

  const valider = async () => {
    if (!settings) return;
    setEnCours(true);
    setMessage(null);

    const resultat = await verifierLicence(code);
    if (!resultat.valide) {
      setMessage(messageRefus(resultat.motif));
      setEnCours(false);
      return;
    }

    await enregistrer({ ...settings, licence: code.trim() });
    await rafraichir();
    setCode('');
    setEnCours(false);
  };

  return (
    <div data-testid="page-licence" className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900 dark:text-slate-50">Licence</h1>

      {valide && licence?.valide ? (
        <Carte className="space-y-3">
          <Badge ton="succes">Licence active</Badge>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Tous les plafonds sont levés. Droit valable jusqu’au{' '}
            <strong>{formatDate(licence.charge.expiration)}</strong>
            {licence.charge.type === 'developpeur' ? ' (licence de développement)' : ''}.
          </p>
          <p className="texte-muet">
            {licence.joursRestants === 0
              ? 'Dernier jour couvert : le renouvellement doit être saisi aujourd’hui.'
              : `${licence.joursRestants} jour${licence.joursRestants > 1 ? 's' : ''} restant${licence.joursRestants > 1 ? 's' : ''}.`}
          </p>
        </Carte>
      ) : (
        <Carte className="space-y-3">
          <Badge ton="attention">Version d’essai</Badge>
          {licence && !licence.valide && licence.motif !== 'absente' ? (
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {messageRefus(licence.motif)}
              {licence.expiration ? ` (${formatDate(licence.expiration)})` : ''}
            </p>
          ) : null}
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
            {ORDRE.map((type) => {
              const quota = etat?.quotas[type];
              const utilise = quota?.utilise ?? 0;
              const plafond = quota?.plafond ?? PLAFONDS[type];
              return (
                <li key={type} className="flex items-center justify-between gap-3">
                  <span className="capitalize">{libelleQuota(type)}</span>
                  <span
                    className={
                      quota?.atteint ? 'font-semibold text-red-700 dark:text-red-400' : 'texte-muet'
                    }
                  >
                    {utilise} / {plafond}
                  </span>
                </li>
              );
            })}
          </ul>
        </Carte>
      )}

      <Carte className="space-y-3">
        <h2 className="section-titre">Saisir un code de licence</h2>
        <Champ label="Code reçu" aide="Collez le code tel qu’il vous a été transmis, en entier.">
          {(id) => (
            <ZoneTexte
              id={id}
              rows={3}
              value={code}
              onChange={(evenement) => setCode(evenement.target.value)}
              placeholder="eyJzdWpldCI6…"
              className="font-mono text-xs"
            />
          )}
        </Champ>
        {message ? (
          <p className="erreur-champ" role="alert">
            {message}
          </p>
        ) : null}
        <Bouton
          variante="primaire"
          className="w-full"
          chargement={enCours}
          disabled={code.trim() === ''}
          onClick={() => void valider()}
        >
          Enregistrer la licence
        </Bouton>
      </Carte>

      <Carte className="space-y-2">
        <h2 className="section-titre">Ce qui reste gratuit pour toujours</h2>
        <p className="texte-muet">
          Le plafond ne porte que sur la <strong>création</strong>. Consulter vos documents, les
          imprimer en PDF, corriger un document déjà émis, exporter et sauvegarder vos données
          restent possibles sans limite, licence ou pas. Rien n’est jamais supprimé.
        </p>
      </Carte>
    </div>
  );
}
