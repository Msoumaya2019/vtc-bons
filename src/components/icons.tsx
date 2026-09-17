/**
 * Petit jeu d'icônes SVG, dessiné à la main.
 * Aucune librairie d'icônes n'est installée : le poids et les dépendances restent maîtrisés.
 */

import type { ReactNode } from 'react';

interface PropsIcone {
  className?: string;
}

const base = 'h-6 w-6';

function Svg({ className, children }: PropsIcone & { children: ReactNode }) {
  return (
    <svg
      className={className ?? base}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function IconeNouveau(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconePlus(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function IconeBons(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Svg>
  );
}

export function IconeFactures(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </Svg>
  );
}

export function IconeClients(p: PropsIcone) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Svg>
  );
}

export function IconeReglages(p: PropsIcone) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </Svg>
  );
}

export function IconeAlerte(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M12 3l9 16H3z" />
      <path d="M12 9v5M12 17h.01" />
    </Svg>
  );
}

export function IconeBouclier(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" />
      <path d="M9.5 12.5l1.8 1.8 3.4-3.6" />
    </Svg>
  );
}

export function IconeOeil(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  );
}

export function IconePartager(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
    </Svg>
  );
}

export function IconeTelecharger(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M12 4v12M8 12l4 4 4-4" />
      <path d="M5 20h14" />
    </Svg>
  );
}

export function IconePoubelle(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
    </Svg>
  );
}

export function IconeCroix(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function IconeCheck(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M4 12.5l5 5L20 6.5" />
    </Svg>
  );
}

export function IconeRetour(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}

export function IconeRecherche(p: PropsIcone) {
  return (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.5-4.5" />
    </Svg>
  );
}

export function IconeSauvegarde(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M9 4v5h6V4M9 20v-6h6v6" />
    </Svg>
  );
}

export function IconeCle(p: PropsIcone) {
  return (
    <Svg {...p}>
      <circle cx="8" cy="8" r="4" />
      <path d="M11 11l9 9M17 17l2-2M14 14l2-2" />
    </Svg>
  );
}

export function IconeVoiture(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M4 16v-3l2-5h12l2 5v3" />
      <path d="M4 16h16M7 16v2M17 16v2" />
    </Svg>
  );
}

/** Éclair : le bon instantané, généré d'un seul geste. */
export function IconeEclair(p: PropsIcone) {
  return (
    <Svg {...p}>
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </Svg>
  );
}

/** Deux feuilles superposées : copier dans le presse-papiers. */
export function IconeCopier(p: PropsIcone) {
  return (
    <Svg {...p}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </Svg>
  );
}
