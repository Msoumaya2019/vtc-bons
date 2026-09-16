import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

interface PropsChamp {
  label: string;
  aide?: string;
  erreur?: string | null;
  /** Affiche l'infobulle « mention exigée en cas de contrôle ». */
  mentionReglementaire?: boolean;
  obligatoire?: boolean;
  children: (id: string) => ReactNode;
}

export function Champ({
  label,
  aide,
  erreur,
  mentionReglementaire = false,
  obligatoire = false,
  children,
}: PropsChamp) {
  const id = useId();
  return (
    <div>
      <label className="etiquette" htmlFor={id}>
        {label}
        {obligatoire ? <span className="ml-0.5 text-red-600 dark:text-red-400">*</span> : null}
        {mentionReglementaire ? (
          <span
            className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            title="Mention exigée en cas de contrôle"
          >
            contrôle
          </span>
        ) : null}
      </label>
      {children(id)}
      {aide ? <p className="aide-champ">{aide}</p> : null}
      {erreur ? (
        <p className="erreur-champ" role="alert">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

export function Saisie({ className = '', ...reste }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...reste} className={`champ ${className}`} />;
}

export function ZoneTexte({
  className = '',
  ...reste
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...reste} className={`champ ${className}`} />;
}

export function Liste({ className = '', children, ...reste }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...reste} className={`champ ${className}`}>
      {children}
    </select>
  );
}

interface PropsCase {
  label: string;
  aide?: string;
  checked: boolean;
  onChange: (valeur: boolean) => void;
  id?: string;
}

export function CaseACocher({ label, aide, checked, onChange, id }: PropsCase) {
  return (
    <div className="flex items-start gap-3 py-1">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(evenement) => onChange(evenement.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-2 dark:border-slate-600"
        style={{ accentColor: 'var(--accent)' }}
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800 dark:text-slate-100">
          {label}
        </label>
        {aide ? <p className="aide-champ">{aide}</p> : null}
      </div>
    </div>
  );
}

interface PropsBascule {
  label: string;
  options: { valeur: string; libelle: string }[];
  valeur: string;
  onChange: (valeur: string) => void;
}

export function Bascule({ label, options, valeur, onChange }: PropsBascule) {
  return (
    <div>
      <span className="etiquette">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex w-full rounded-xl border border-slate-300 p-1 dark:border-slate-700"
      >
        {options.map((option) => {
          const actif = option.valeur === valeur;
          return (
            <button
              key={option.valeur}
              type="button"
              role="radio"
              aria-checked={actif}
              onClick={() => onChange(option.valeur)}
              className={`min-h-[38px] flex-1 rounded-lg px-3 text-sm font-semibold transition-colors ${
                actif ? 'text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
              style={actif ? { backgroundColor: 'var(--accent)' } : undefined}
            >
              {option.libelle}
            </button>
          );
        })}
      </div>
    </div>
  );
}
