import { NavLink, Outlet } from 'react-router-dom';
import {
  IconeBons,
  IconeClients,
  IconeEclair,
  IconeFactures,
  IconeNouveau,
  IconeReglages,
} from './icons';

/**
 * Barre d'onglets.
 *
 * Les libellés « Mes bons » et « Mes factures » sont devenus « Bons » et
 * « Factures » en accueillant un sixième onglet : à six, la largeur d'un onglet sur
 * un téléphone ne permet plus de porter le possessif, et un libellé qui passe à la
 * ligne dans une barre de hauteur fixe est un libellé tronqué. Les pages, elles,
 * gardent leurs titres complets.
 */
const onglets = [
  { chemin: '/nouveau', libelle: 'Nouveau', Icone: IconeNouveau },
  { chemin: '/instantane', libelle: 'Instantané', Icone: IconeEclair },
  { chemin: '/bons', libelle: 'Bons', Icone: IconeBons },
  { chemin: '/factures', libelle: 'Factures', Icone: IconeFactures },
  { chemin: '/clients', libelle: 'Clients', Icone: IconeClients },
  { chemin: '/reglages', libelle: 'Réglages', Icone: IconeReglages },
];

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="zone-sure-haut sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-4 py-3">
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
            vtc-bons
          </span>
          <NavLink to="/aide" className="lien-accent text-sm">
            Aide et conformité
          </NavLink>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 pb-28">
        <Outlet />
      </main>

      {/*
        La hauteur est LUE depuis la variable, et non déduite du contenu.

        C'est elle que la barre « Enregistrer » des Réglages lit pour se poser juste
        au-dessus. La laisser s'auto-dimensionner rendrait cette hauteur imprévisible : elle
        valait 57 px et non 56, parce que la hauteur de ligne du libellé s'ajoutait à la
        hauteur minimale. Ce qui doit s'adosser à la barre ne peut pas dépendre d'un chiffre
        qui se déduit tout seul.
      */}
      <nav
        style={{ height: 'var(--hauteur-barre-onglets)' }}
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
        aria-label="Navigation principale"
      >
        <div className="mx-auto flex h-14 w-full max-w-2xl">
          {onglets.map(({ chemin, libelle, Icone }) => (
            <NavLink
              key={chemin}
              to={chemin}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition-colors ${
                  isActive ? '' : 'text-slate-500 dark:text-slate-400'
                }`
              }
              style={({ isActive }) => (isActive ? { color: 'var(--accent)' } : undefined)}
            >
              {({ isActive }) => (
                <>
                  <Icone className={`h-6 w-6 ${isActive ? '' : 'opacity-80'}`} />
                  <span>{libelle}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
