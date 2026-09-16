import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getSettings, saveSettings } from '../lib/db';
import { journaliser } from '../lib/audit';
import type { Settings } from '../types';

interface ContexteReglages {
  settings: Settings | null;
  chargement: boolean;
  enregistrer: (settings: Settings) => Promise<void>;
  recharger: () => Promise<void>;
}

const Contexte = createContext<ContexteReglages | null>(null);

/** Applique la couleur d'accent choisie dans les Réglages, via des variables CSS. */
function appliquerCharte(settings: Settings): void {
  if (typeof document === 'undefined') return;
  const racine = document.documentElement;
  const couleur = settings.couleurAccent || '#1d4ed8';
  racine.style.setProperty('--accent', couleur);
  racine.style.setProperty('--accent-soft', `${couleur}1a`);
}

export function FournisseurReglages({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    setChargement(true);
    const chargees = await getSettings();
    appliquerCharte(chargees);
    setSettings(chargees);
    setChargement(false);
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const enregistrer = useCallback(async (nouvelles: Settings) => {
    await saveSettings(nouvelles);
    appliquerCharte(nouvelles);
    setSettings(nouvelles);
    await journaliser('reglages', 'app', 'modification', 'Réglages enregistrés');
  }, []);

  const valeur = useMemo<ContexteReglages>(
    () => ({ settings, chargement, enregistrer, recharger }),
    [settings, chargement, enregistrer, recharger],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useReglages(): ContexteReglages {
  const contexte = useContext(Contexte);
  if (!contexte) throw new Error('useReglages doit être utilisé dans FournisseurReglages.');
  return contexte;
}
