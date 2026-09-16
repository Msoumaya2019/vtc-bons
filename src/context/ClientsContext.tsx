import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { db } from '../lib/db';
import { identifiant, journaliser } from '../lib/audit';
import { clientVide } from '../lib/snapshots';
import type { Client } from '../types';

interface ContexteClients {
  clients: Client[];
  chargement: boolean;
  clientParDefaut: Client | null;
  recharger: () => Promise<void>;
  creer: (client: Omit<Client, 'id' | 'creeLe' | 'modifieLe' | 'supprime'>) => Promise<Client>;
  modifier: (client: Client) => Promise<void>;
  supprimer: (clientId: string) => Promise<void>;
  definirParDefaut: (clientId: string) => Promise<void>;
}

const Contexte = createContext<ContexteClients | null>(null);

export function FournisseurClients({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    setChargement(true);
    const tous = await db.clients.toArray();
    setClients(tous.filter((client) => !client.supprime));
    setChargement(false);
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  /**
   * Un seul client par défaut à la fois : l'ancien est décoché dans la MÊME transaction,
   * sinon un plantage en cours de route laisserait deux clients par défaut.
   */
  const definirParDefaut = useCallback(
    async (clientId: string) => {
      await db.transaction('rw', db.clients, async () => {
        const tous = await db.clients.toArray();
        for (const client of tous) {
          const doitEtreParDefaut = client.id === clientId;
          if (client.parDefaut !== doitEtreParDefaut) {
            await db.clients.update(client.id, { parDefaut: doitEtreParDefaut });
          }
        }
      });
      await journaliser('client', clientId, 'modification', 'Client défini par défaut');
      await recharger();
    },
    [recharger],
  );

  const creer = useCallback<ContexteClients['creer']>(
    async (donnees) => {
      const base = clientVide();
      const client: Client = {
        ...base,
        ...donnees,
        id: identifiant(),
        creeLe: new Date().toISOString(),
        modifieLe: new Date().toISOString(),
        supprime: false,
      };
      await db.clients.put(client);
      await journaliser('client', client.id, 'creation', `Client créé : ${client.nom}`);
      if (client.parDefaut) {
        await definirParDefaut(client.id);
      } else {
        await recharger();
      }
      return client;
    },
    [definirParDefaut, recharger],
  );

  const modifier = useCallback(
    async (client: Client) => {
      await db.clients.put({ ...client, modifieLe: new Date().toISOString() });
      await journaliser('client', client.id, 'modification', `Client modifié : ${client.nom}`);
      if (client.parDefaut) {
        await definirParDefaut(client.id);
      } else {
        await recharger();
      }
    },
    [definirParDefaut, recharger],
  );

  const supprimer = useCallback(
    async (clientId: string) => {
      // Suppression logique : les documents déjà émis conservent leur copie figée du client,
      // donc rien n'est perdu, et une suppression accidentelle reste réparable.
      await db.clients.update(clientId, { supprime: true });
      await journaliser('client', clientId, 'suppression', 'Client supprimé');
      await recharger();
    },
    [recharger],
  );

  const clientParDefaut = useMemo(
    () => clients.find((client) => client.parDefaut) ?? clients[0] ?? null,
    [clients],
  );

  const valeur = useMemo<ContexteClients>(
    () => ({
      clients,
      chargement,
      clientParDefaut,
      recharger,
      creer,
      modifier,
      supprimer,
      definirParDefaut,
    }),
    [clients, chargement, clientParDefaut, recharger, creer, modifier, supprimer, definirParDefaut],
  );

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useClients(): ContexteClients {
  const contexte = useContext(Contexte);
  if (!contexte) throw new Error('useClients doit être utilisé dans FournisseurClients.');
  return contexte;
}
