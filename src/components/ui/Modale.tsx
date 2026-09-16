import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Bouton } from './Bouton';
import { IconeCroix } from '../icons';

interface PropsModale {
  ouverte: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

export function Modale({ ouverte, titre, onFermer, children, actions }: PropsModale) {
  const reference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouverte) return;
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', surTouche);
    reference.current?.focus();
    return () => document.removeEventListener('keydown', surTouche);
  }, [ouverte, onFermer]);

  if (!ouverte) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={(evenement) => {
        if (evenement.target === evenement.currentTarget) onFermer();
      }}
    >
      <div
        ref={reference}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl outline-none dark:bg-slate-900 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <IconeCroix className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        {actions ? <div className="mt-5 flex flex-wrap justify-end gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

interface PropsConfirmation {
  ouverte: boolean;
  titre: string;
  message: ReactNode;
  libelleConfirmer?: string;
  libelleAnnuler?: string;
  danger?: boolean;
  onConfirmer: () => void;
  onAnnuler: () => void;
}

export function DialogueConfirmation({
  ouverte,
  titre,
  message,
  libelleConfirmer = 'Confirmer',
  libelleAnnuler = 'Annuler',
  danger = false,
  onConfirmer,
  onAnnuler,
}: PropsConfirmation) {
  return (
    <Modale
      ouverte={ouverte}
      titre={titre}
      onFermer={onAnnuler}
      actions={
        <>
          <Bouton variante="secondaire" onClick={onAnnuler}>
            {libelleAnnuler}
          </Bouton>
          <Bouton variante={danger ? 'danger' : 'primaire'} onClick={onConfirmer}>
            {libelleConfirmer}
          </Bouton>
        </>
      }
    >
      <div className="text-sm text-slate-600 dark:text-slate-300">{message}</div>
    </Modale>
  );
}
