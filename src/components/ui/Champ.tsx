import { useId } from 'react';
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { formatSaisieEuros, parseSaisieEuros } from '../../lib/money';

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

type PropsSaisieLibre = {
  /** Texte affiché au premier rendu, tel quel. */
  valeurInitiale: string;
  onTexte: (texte: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'>;

/**
 * Saisie de texte NON CONTRÔLÉE, qui ne réécrit jamais ce que l'utilisateur tape.
 *
 * Ce n'est pas un détail de style, et c'est la raison d'être de ce composant : un champ
 * contrôlé qui reformate sa valeur à chaque frappe se réécrit sous le doigt. Le curseur
 * repart à la fin et le texte tapé est remplacé par sa version formatée. Deux symptômes
 * relevés sur un téléphone viennent de là, tous deux invisibles au clavier d'un ordinateur :
 *
 *   - le champ affiche « 0,00 » ; taper 7 place le curseur après la virgule, ce qui donne
 *     « 0,007 », soit 0,7 centime arrondi à 1 centime — le montant semble ne pas bouger ;
 *   - effacer un caractère de « 0,01 » donne « 0,0 », aussitôt réécrit « 0,00 » : la
 *     suppression semble sans effet.
 *
 * On garde donc le texte tel que l'utilisateur le tape, et on ne remonte que la valeur
 * analysée, par `onTexte`. Une saisie illisible — « 1,2,3 », une lettre — n'est jamais
 * effacée sous les yeux de l'utilisateur : elle reste à l'écran, et c'est à lui de la
 * corriger. La remplacer par l'ancienne valeur lui ferait croire que rien ne s'est passé.
 *
 * Le contenu est sélectionné au focus, pour qu'une valeur DÉJÀ saisie se remplace d'un
 * seul geste : « j'appuie et je tape ».
 *
 * La clé React doit rester stable pendant la frappe : remonter le champ ferait perdre le
 * focus et refermerait le clavier. Pour réamorcer le texte depuis la valeur — changement
 * de ligne, de mode HT/TTC —, c'est l'appelant qui change la clé.
 */
export function SaisieLibre({ valeurInitiale, onTexte, ...reste }: PropsSaisieLibre) {
  return (
    <Saisie
      defaultValue={valeurInitiale}
      onFocus={(evenement) => evenement.currentTarget.select()}
      onChange={(evenement) => onTexte(evenement.target.value)}
      {...reste}
    />
  );
}

type PropsSaisieEuros = {
  /** Montant courant, en centimes entiers. */
  centimes: number;
  onCentimes: (centimes: number) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'>;

/**
 * Saisie d'un montant en euros, appuyée sur `SaisieLibre` — lire son commentaire pour la
 * raison d'être du champ non contrôlé.
 *
 * Une seule précaution est propre au montant : un montant NUL s'affiche VIDE plutôt que
 * « 0,00 ». Un champ prérempli de zéros oblige à effacer avant de saisir, et c'est cette
 * obligation qui produisait le premier symptôme relevé sur le téléphone.
 */
export function SaisieEuros({ centimes, onCentimes, ...reste }: PropsSaisieEuros) {
  return (
    <SaisieLibre
      inputMode="decimal"
      valeurInitiale={centimes === 0 ? '' : formatSaisieEuros(centimes)}
      onTexte={(texte) => {
        const saisis = parseSaisieEuros(texte);
        if (saisis === null) return;
        onCentimes(saisis);
      }}
      {...reste}
    />
  );
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
  // Un identifiant est indispensable pour relier le libellé à la case. Sans lui, cliquer
  // sur le texte ne coche rien, et un lecteur d'écran annonce une case sans nom — deux
  // défauts invisibles à l'œil, mais qui rendent le réglage inutilisable autrement qu'à
  // la souris. `useId` en fournit un quand l'appelant n'en donne pas : la plupart des
  // usages n'ont aucune raison d'en inventer un.
  const idGenere = useId();
  const identifiant = id ?? idGenere;
  return (
    <div className="flex items-start gap-3 py-1">
      <input
        id={identifiant}
        type="checkbox"
        checked={checked}
        onChange={(evenement) => onChange(evenement.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-2 dark:border-slate-600"
        style={{ accentColor: 'var(--accent)' }}
      />
      <div>
        <label
          htmlFor={identifiant}
          className="text-sm font-medium text-slate-800 dark:text-slate-100"
        >
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
