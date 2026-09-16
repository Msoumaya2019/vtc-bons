import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Ton = 'succes' | 'erreur' | 'info';

interface Message {
  id: number;
  texte: string;
  ton: Ton;
}

interface ContexteToast {
  succes: (texte: string) => void;
  erreur: (texte: string) => void;
  info: (texte: string) => void;
}

const Contexte = createContext<ContexteToast | null>(null);

const classesTon: Record<Ton, string> = {
  succes: 'bg-emerald-600 text-white',
  erreur: 'bg-red-600 text-white',
  info: 'bg-slate-800 text-white',
};

export function FournisseurToast({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);

  const ajouter = useCallback((texte: string, ton: Ton) => {
    const id = Date.now() + Math.random();
    setMessages((precedents) => [...precedents, { id, texte, ton }]);
    setTimeout(() => {
      setMessages((precedents) => precedents.filter((message) => message.id !== id));
    }, 4000);
  }, []);

  const valeur = useMemo<ContexteToast>(
    () => ({
      succes: (texte: string) => ajouter(texte, 'succes'),
      erreur: (texte: string) => ajouter(texte, 'erreur'),
      info: (texte: string) => ajouter(texte, 'info'),
    }),
    [ajouter],
  );

  return (
    <Contexte.Provider value={valeur}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`pointer-events-auto max-w-md rounded-xl px-4 py-2 text-sm font-medium shadow-lg ${classesTon[message.ton]}`}
          >
            {message.texte}
          </div>
        ))}
      </div>
    </Contexte.Provider>
  );
}

export function useToast(): ContexteToast {
  const contexte = useContext(Contexte);
  if (!contexte) {
    // Repli silencieux : un toast manquant ne doit jamais faire planter l'application.
    return { succes: () => {}, erreur: () => {}, info: () => {} };
  }
  return contexte;
}
