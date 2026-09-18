import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge, Carte } from '../../components/ui/Carte';
import { libelleQuota, PLAFONDS, type TypeQuota } from '../../lib/quota';
import { estBloque, useAcces } from '../../context/AccesContext';

/**
 * Ce qui s'affiche à la place d'un formulaire de création quand le plafond est atteint.
 *
 * Le ton est délibéré. Il ne s'agit pas de faire honte au chauffeur ni de le menacer,
 * mais de lui dire trois choses : ce qu'il a fait, ce qui s'arrête, et ce qui continue.
 * La troisième est la plus importante — un écran qui laisse croire que tout est perdu
 * provoque une désinstallation, pas un achat.
 *
 * Ce qui continue n'est pas une faveur : les documents émis sont des pièces légales que
 * le chauffeur doit pouvoir produire. Les bloquer le mettrait en défaut devant son
 * comptable ou un contrôle, pour un différend commercial qui ne le concerne pas seul.
 */
export function EcranPlafond({ type }: { type: TypeQuota }) {
  const { etat } = useAcces();
  const quota = etat?.quotas[type];
  const plafond = quota?.plafond ?? PLAFONDS[type];

  return (
    <div data-testid="ecran-plafond" className="space-y-4">
      <Carte className="space-y-3">
        <Badge ton="attention">Version d’essai</Badge>
        <h2 className="section-titre">
          {quota
            ? `${quota.utilise} ${libelleQuota(type)} sur ${plafond}`
            : `Plafond de ${libelleQuota(type)} atteint`}
        </h2>
        <p className="texte-muet">
          La version d’essai permet {plafond} {libelleQuota(type)}. Ce plafond est atteint :
          l’application n’en créera plus tant qu’elle n’est pas débloquée.
        </p>
        <NavLink to="/licence" className="btn btn-primaire w-full">
          Débloquer l’application
        </NavLink>
      </Carte>

      <Carte className="space-y-2">
        <h3 className="section-titre">Ce qui reste possible, sans limite</h3>
        <ul className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <li>Consulter tous vos documents déjà émis, et les imprimer en PDF.</li>
          <li>Corriger un document déjà émis : une correction ne consomme rien.</li>
          <li>Exporter et sauvegarder l’intégralité de vos données.</li>
        </ul>
        <p className="texte-muet">
          Rien n’est supprimé. Vos documents vous appartiennent et restent accessibles.
        </p>
      </Carte>
    </div>
  );
}

/**
 * Garde d'une route de création.
 *
 * Elle ne fait qu'éviter de conduire le chauffeur jusqu'à un formulaire qu'il ne pourra
 * pas valider. L'arbitre reste le service métier, qui refuse l'écriture elle-même : un
 * écran ne protège rien, il explique.
 */
export function GardeCreation({ type, children }: { type: TypeQuota; children: ReactNode }) {
  const { etat, chargement } = useAcces();
  if (chargement) return null;
  if (estBloque(etat, type)) return <EcranPlafond type={type} />;
  return <>{children}</>;
}
