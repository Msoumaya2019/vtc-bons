import { useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Les attributs restants sont TRANSMIS au `div`, et non avalés.
 *
 * Ce n'est pas du confort. Un attribut à tiret — `data-*`, `aria-*` — échappe au contrôle
 * de type de TypeScript : la règle du langage est qu'un nom d'attribut qui n'est pas un
 * identifiant valide n'est pas cherché dans le type des propriétés. Mesuré, plutôt que
 * supposé : `<Carte data-testid="x">` compile sans un mot, alors que `<Carte truc="x">`
 * donne un TS2322.
 *
 * Autrement dit, ce composant pouvait avaler un `data-testid` en silence — et un test qui
 * l'aurait cherché aurait échoué sur un écran pourtant correct, ou pire, un test qui ne
 * l'aurait pas cherché aurait laissé passer un écran faux sans rien dire.
 */
export function Carte({ children, className = '', ...reste }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`carte ${className}`} {...reste}>
      {children}
    </div>
  );
}

export type Ton = 'neutre' | 'succes' | 'attention' | 'danger' | 'accent';

const classesTon: Record<Ton, string> = {
  neutre: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  succes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  attention: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  accent: 'text-white',
};

export function Badge({ ton = 'neutre', children }: { ton?: Ton; children: ReactNode }) {
  return (
    <span
      className={`badge ${classesTon[ton]}`}
      style={ton === 'accent' ? { backgroundColor: 'var(--accent)' } : undefined}
    >
      {children}
    </span>
  );
}

export function EtatVide({
  titre,
  description,
  action,
  icone,
}: {
  titre: string;
  description: string;
  action?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="text-slate-400 dark:text-slate-500">{icone}</div>
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">{titre}</h3>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>
      {action}
    </div>
  );
}

export function BarreProgression({ etape, total }: { etape: number; total: number }) {
  const pourcentage = Math.round((etape / total) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
        <span>
          Étape {etape} sur {total}
        </span>
        <span>{pourcentage} %</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={etape}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{ width: `${pourcentage}%`, backgroundColor: 'var(--accent)' }}
        />
      </div>
    </div>
  );
}

export function SectionRepliable({
  titre,
  description,
  ouvertParDefaut = false,
  children,
}: {
  titre: string;
  description?: string;
  ouvertParDefaut?: boolean;
  children: ReactNode;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  return (
    <section className="carte">
      <button
        type="button"
        onClick={() => setOuvert((valeur) => !valeur)}
        aria-expanded={ouvert}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span>
          <span className="section-titre block">{titre}</span>
          {description ? <span className="texte-muet block">{description}</span> : null}
        </span>
        <span
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${ouvert ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {ouvert ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  );
}

export function Bandeau({
  ton = 'neutre',
  titre,
  children,
}: {
  ton?: Ton;
  titre?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl px-3 py-2 text-sm ${classesTon[ton]}`}>
      {titre ? <p className="font-semibold">{titre}</p> : null}
      <div>{children}</div>
    </div>
  );
}
