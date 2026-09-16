import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variante = 'primaire' | 'secondaire' | 'danger' | 'fantome';

interface PropsBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  petit?: boolean;
  chargement?: boolean;
  icone?: ReactNode;
}

const classesVariante: Record<Variante, string> = {
  primaire: 'btn-primaire',
  secondaire: 'btn-secondaire',
  danger: 'btn-danger',
  fantome: 'btn-fantome',
};

export function Bouton({
  variante = 'secondaire',
  petit = false,
  chargement = false,
  icone,
  className = '',
  children,
  disabled,
  ...reste
}: PropsBouton) {
  return (
    <button
      type="button"
      {...reste}
      disabled={disabled || chargement}
      className={`btn ${classesVariante[variante]} ${petit ? 'btn-petit' : ''} ${className}`}
    >
      {chargement ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        icone
      )}
      {children}
    </button>
  );
}
