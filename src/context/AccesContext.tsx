import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { etatAcces, enGrace, type EtatAcces } from '../lib/acces';
import type { TypeQuota } from '../lib/quota';

interface ContexteAcces {
  etat: EtatAcces | null;
  chargement: boolean;
  rafraichir: () => Promise<void>;
}

const Contexte = createContext<ContexteAcces | null>(null);

/**
 * L'état d'accès est relu À CHAQUE changement d'adresse.
 *
 * C'est ce qui évite d'avoir à prévenir qui que ce soit après une émission : le compteur
 * du bandeau se remet à jour parce que l'écran a changé, et non parce qu'un appelant a
 * pensé à le demander. Une remise à jour qu'il faut déclencher soi-même finit toujours
 * par être oubliée sur un chemin — et c'est ce chemin-là que le chauffeur emprunte.
 *
 * Le coût est de trois comptages sur quelques centaines d'enregistrements, à chaque
 * navigation : négligeable, et très en dessous de ce que coûterait un compteur faux.
 */
export function FournisseurAcces({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatAcces | null>(null);
  const [chargement, setChargement] = useState(true);
  const emplacement = useLocation();

  const rafraichir = useCallback(async () => {
    const courant = await etatAcces();
    setEtat(courant);
    setChargement(false);
  }, []);

  useEffect(() => {
    void rafraichir();
  }, [rafraichir, emplacement.pathname]);

  const valeur = useMemo<ContexteAcces>(
    () => ({ etat, chargement, rafraichir }),
    [etat, chargement, rafraichir],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAcces(): ContexteAcces {
  const contexte = useContext(Contexte);
  if (!contexte) throw new Error('useAcces doit être utilisé dans FournisseurAcces.');
  return contexte;
}

/**
 * Vrai quand la création de ce type est refusée.
 *
 * Pendant le chargement, on répond NON : mieux vaut laisser passer une création de trop
 * que d'afficher un refus qui n'en est pas un. C'est le service qui reste l'arbitre de
 * toute façon — l'écran ne fait qu'éviter d'y conduire.
 *
 * La grâce est lue ICI AUSSI, et pas seulement dans le service. Sans cette ligne, l'écran
 * annoncerait un plafond que la création ne rencontrerait pas : le chauffeur verrait le
 * panneau de refus, puis découvrirait en contournant que tout fonctionne. Deux règles pour
 * une même question finissent toujours par diverger ; celle-ci se lit à un seul endroit.
 */
export function estBloque(etat: EtatAcces | null, type: TypeQuota): boolean {
  if (!etat || etat.licence.valide) return false;
  if (enGrace(etat.licence)) return false;
  return etat.quotas[type].atteint;
}
