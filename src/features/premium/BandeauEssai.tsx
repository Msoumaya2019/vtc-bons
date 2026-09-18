import { NavLink } from 'react-router-dom';
import { useAcces } from '../../context/AccesContext';
import { PLAFONDS, type TypeQuota } from '../../lib/quota';

const ORDRE: TypeQuota[] = ['bons', 'factures', 'clients'];

const LIBELLE_COURT: Record<TypeQuota, string> = {
  bons: 'Bons',
  factures: 'Factures',
  clients: 'Clients',
};

/**
 * Décompte de la version d'essai, visible DÈS LE PREMIER document.
 *
 * Il existe pour une raison précise : un plafond qui tombe sans prévenir ressemble à une
 * panne. Le chauffeur ne se dit pas « j'ai atteint la limite », il se dit « l'application
 * s'est cassée » — et il la désinstalle. Annoncer le compte à l'avance transforme la
 * même limite en offre qu'on peut accepter ou refuser, ce qui est tout l'objet.
 *
 * Disparaît dès qu'une licence est valide : plus rien à compter.
 */
export function BandeauEssai() {
  const { etat } = useAcces();
  if (!etat || etat.licence.valide) return null;

  const comptes = ORDRE.map((type) => {
    const quota = etat.quotas[type];
    return `${LIBELLE_COURT[type]} ${quota.utilise}/${PLAFONDS[type]}`;
  });

  return (
    <div
      data-testid="bandeau-essai"
      className="border-t border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
    >
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-1.5">
        <span className="text-xs text-amber-900 dark:text-amber-200">
          Version d’essai — {comptes.join(' · ')}
        </span>
        <NavLink
          to="/licence"
          className="shrink-0 text-xs font-semibold text-amber-900 underline dark:text-amber-200"
        >
          Débloquer
        </NavLink>
      </div>
    </div>
  );
}
