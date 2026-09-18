import { NavLink } from 'react-router-dom';
import { useAcces } from '../../context/AccesContext';
import { joursDeGraceRestants } from '../../lib/acces';
import { PLAFONDS, type TypeQuota } from '../../lib/quota';

const ORDRE: TypeQuota[] = ['bons', 'factures', 'clients'];

const LIBELLE_COURT: Record<TypeQuota, string> = {
  bons: 'Bons',
  factures: 'Factures',
  clients: 'Clients',
};

/**
 * Bandeau d'état, visible DÈS LE PREMIER document.
 *
 * Il existe pour une raison précise : un plafond qui tombe sans prévenir ressemble à une
 * panne. Le chauffeur ne se dit pas « j'ai atteint la limite », il se dit « l'application
 * s'est cassée » — et il la désinstalle. Annoncer le compte à l'avance transforme la
 * même limite en offre qu'on peut accepter ou refuser, ce qui est tout l'objet.
 *
 * Il sert aussi pendant la GRÂCE, et le message change alors complètement. Un abonné dont
 * le renouvellement est en route verrait sinon « Bons 47/10 · Factures 12/10 » : des
 * chiffres faux, et alarmants, alors que tous ses plafonds sont levés. Ce qu'il doit
 * savoir à ce moment-là est tout autre — son abonnement est échu, et il lui reste peu de
 * jours pour le renouveler avant que la création ne s'arrête.
 *
 * Disparaît dès qu'une licence est valide : plus rien à compter, plus rien à annoncer.
 */
export function BandeauEssai() {
  const { etat } = useAcces();
  if (!etat || etat.licence.valide) return null;

  const joursGrace = joursDeGraceRestants(etat.licence);
  const enGrace = joursGrace !== null;

  const texte = enGrace
    ? `Abonnement échu — ${joursGrace} jour${joursGrace > 1 ? 's' : ''} pour renouveler`
    : `Version d’essai — ${ORDRE.map(
        (type) => `${LIBELLE_COURT[type]} ${etat.quotas[type].utilise}/${PLAFONDS[type]}`,
      ).join(' · ')}`;

  return (
    <div
      data-testid={enGrace ? 'bandeau-grace' : 'bandeau-essai'}
      className={
        enGrace
          ? 'border-t border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
          : 'border-t border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
      }
    >
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-1.5">
        <span
          className={
            enGrace
              ? 'text-xs text-red-900 dark:text-red-200'
              : 'text-xs text-amber-900 dark:text-amber-200'
          }
        >
          {texte}
        </span>
        <NavLink
          to="/licence"
          className={
            enGrace
              ? 'shrink-0 text-xs font-semibold text-red-900 underline dark:text-red-200'
              : 'shrink-0 text-xs font-semibold text-amber-900 underline dark:text-amber-200'
          }
        >
          {enGrace ? 'Renouveler' : 'Débloquer'}
        </NavLink>
      </div>
    </div>
  );
}
