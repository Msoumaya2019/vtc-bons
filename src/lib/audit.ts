/**
 * Journal d'audit local.
 *
 * Il reste sur l'appareil, il est exporté avec la sauvegarde, et il sert de trace en cas
 * de litige ou de contrôle (notamment URSSAF, qui peut remonter loin dans le temps).
 */

import { db } from './db';
import type { ActionAudit, EntreeAudit } from '../types';

export function identifiant(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function journaliser(
  entite: EntreeAudit['entite'],
  entiteId: string,
  action: ActionAudit,
  details: string,
): Promise<void> {
  try {
    await db.audit.add({
      id: identifiant(),
      dateISO: new Date().toISOString(),
      entite,
      entiteId,
      action,
      details,
    });
  } catch {
    // Le journal ne doit jamais faire échouer une action métier : une écriture de trace
    // ratée est préférable à une création de bon bloquée.
  }
}

export async function lireJournal(limite = 200): Promise<EntreeAudit[]> {
  const entrees = await db.audit.orderBy('dateISO').reverse().limit(limite).toArray();
  return entrees;
}
