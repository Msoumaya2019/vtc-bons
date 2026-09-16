import { useCallback, useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { identifiant, journaliser } from '../../lib/audit';
import { DOCUMENTS_CONTROLE } from '../../lib/mentions';
import { formatDate, joursRestants } from '../../lib/format';
import { Badge, Bandeau, Carte, EtatVide } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import { Champ, Saisie } from '../../components/ui/Champ';
import { DialogueConfirmation, Modale } from '../../components/ui/Modale';
import { IconeBouclier, IconePlus, IconePoubelle } from '../../components/icons';
import type { DocumentChauffeur } from '../../types';

function tonDepuisJours(jours: number | null): 'succes' | 'attention' | 'danger' | 'neutre' {
  if (jours === null) return 'neutre';
  if (jours < 0) return 'danger';
  if (jours <= 15) return 'danger';
  if (jours <= 60) return 'attention';
  return 'succes';
}

function libelleEcheance(jours: number | null): string {
  if (jours === null) return 'Date non renseignée';
  if (jours < 0) return `Expiré depuis ${Math.abs(jours)} jour${Math.abs(jours) > 1 ? 's' : ''}`;
  if (jours === 0) return 'Expire aujourd’hui';
  return `Expire dans ${jours} jour${jours > 1 ? 's' : ''}`;
}

/**
 * Aide-mémoire des documents à pouvoir présenter en contrôle.
 * Ce n'est PAS un document officiel : la liste est indicative et doit être vérifiée
 * auprès de l'autorité compétente.
 */
export function ModuleDocuments() {
  const [documents, setDocuments] = useState<DocumentChauffeur[]>([]);
  const [enEdition, setEnEdition] = useState<DocumentChauffeur | null>(null);
  const [aSupprimer, setASupprimer] = useState<DocumentChauffeur | null>(null);

  const recharger = useCallback(async () => {
    const existants = await db.documentsChauffeur.orderBy('ordre').toArray();
    if (existants.length === 0) {
      const parDefaut: DocumentChauffeur[] = DOCUMENTS_CONTROLE.map((libelle, index) => ({
        id: identifiant(),
        libelle,
        numero: '',
        dateDelivrance: '',
        dateExpiration: '',
        note: '',
        ordre: index,
      }));
      await db.documentsChauffeur.bulkPut(parDefaut);
      setDocuments(parDefaut);
      return;
    }
    setDocuments(existants);
  }, []);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  const enregistrer = async (document: DocumentChauffeur) => {
    await db.documentsChauffeur.put(document);
    await journaliser('document', document.id, 'modification', `Document : ${document.libelle}`);
    setEnEdition(null);
    await recharger();
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    await db.documentsChauffeur.delete(aSupprimer.id);
    await journaliser('document', aSupprimer.id, 'suppression', `Document retiré : ${aSupprimer.libelle}`);
    setASupprimer(null);
    await recharger();
  };

  const aRenouveler = documents.filter((document) => {
    const jours = joursRestants(document.dateExpiration);
    return jours !== null && jours <= 60;
  }).length;

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="section-titre">Documents du chauffeur</h3>
          <p className="texte-muet">
            Suivi des dates d’expiration, pour ne jamais être pris au dépourvu en contrôle.
          </p>
        </div>
        <Bouton
          petit
          icone={<IconePlus className="h-4 w-4" />}
          onClick={() =>
            setEnEdition({
              id: identifiant(),
              libelle: '',
              numero: '',
              dateDelivrance: '',
              dateExpiration: '',
              note: '',
              ordre: documents.length,
            })
          }
        >
          Ajouter
        </Bouton>
      </div>

      {aRenouveler > 0 ? (
        <Bandeau ton="attention" titre={`${aRenouveler} document(s) à renouveler`}>
          Vérifiez les échéances ci-dessous avant votre prochaine course.
        </Bandeau>
      ) : null}

      <Bandeau ton="neutre">
        Liste indicative. En contrôle, il faut pouvoir présenter le permis, la carte
        professionnelle VTC, les attestations d’assurance RC circulation et RC Pro, le macaron
        VTC, le contrôle technique, la carte grise, le certificat médical d’aptitude (Cerfa
        14880), l’inscription REVTC, et l’attestation de vigilance URSSAF si un contrat dépasse
        5 000 €. Vérifiez cette liste auprès de l’autorité compétente.
      </Bandeau>

      {documents.length === 0 ? (
        <EtatVide
          icone={<IconeBouclier className="h-10 w-10" />}
          titre="Aucun document suivi"
          description="Ajoutez vos documents professionnels pour suivre leurs dates d’expiration."
        />
      ) : (
        <div className="space-y-2">
          {documents.map((document) => {
            const jours = joursRestants(document.dateExpiration);
            return (
              <Carte key={document.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {document.libelle}
                  </p>
                  <p className="texte-muet">
                    {document.dateExpiration
                      ? `Expire le ${formatDate(document.dateExpiration)}`
                      : 'Aucune date d’expiration renseignée'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge ton={tonDepuisJours(jours)}>{libelleEcheance(jours)}</Badge>
                  <Bouton petit variante="fantome" onClick={() => setEnEdition(document)}>
                    Modifier
                  </Bouton>
                  <Bouton
                    petit
                    variante="fantome"
                    aria-label={`Supprimer ${document.libelle}`}
                    onClick={() => setASupprimer(document)}
                  >
                    <IconePoubelle className="h-4 w-4" />
                  </Bouton>
                </div>
              </Carte>
            );
          })}
        </div>
      )}

      <Modale
        ouverte={enEdition !== null}
        titre={enEdition?.libelle ? 'Modifier le document' : 'Ajouter un document'}
        onFermer={() => setEnEdition(null)}
        actions={
          <>
            <Bouton variante="secondaire" onClick={() => setEnEdition(null)}>
              Annuler
            </Bouton>
            <Bouton
              variante="primaire"
              onClick={() => {
                if (enEdition && enEdition.libelle.trim() !== '') void enregistrer(enEdition);
              }}
            >
              Enregistrer
            </Bouton>
          </>
        }
      >
        {enEdition ? (
          <>
            <Champ label="Libellé" obligatoire>
              {(id) => (
                <Saisie
                  id={id}
                  value={enEdition.libelle}
                  onChange={(evenement) =>
                    setEnEdition({ ...enEdition, libelle: evenement.target.value })
                  }
                />
              )}
            </Champ>
            <Champ label="Numéro du document">
              {(id) => (
                <Saisie
                  id={id}
                  value={enEdition.numero}
                  onChange={(evenement) =>
                    setEnEdition({ ...enEdition, numero: evenement.target.value })
                  }
                />
              )}
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Date de délivrance">
                {(id) => (
                  <Saisie
                    id={id}
                    type="date"
                    value={enEdition.dateDelivrance}
                    onChange={(evenement) =>
                      setEnEdition({ ...enEdition, dateDelivrance: evenement.target.value })
                    }
                  />
                )}
              </Champ>
              <Champ label="Date d’expiration">
                {(id) => (
                  <Saisie
                    id={id}
                    type="date"
                    value={enEdition.dateExpiration}
                    onChange={(evenement) =>
                      setEnEdition({ ...enEdition, dateExpiration: evenement.target.value })
                    }
                  />
                )}
              </Champ>
            </div>
            <Champ label="Note">
              {(id) => (
                <Saisie
                  id={id}
                  value={enEdition.note}
                  onChange={(evenement) => setEnEdition({ ...enEdition, note: evenement.target.value })}
                />
              )}
            </Champ>
          </>
        ) : null}
      </Modale>

      <DialogueConfirmation
        ouverte={aSupprimer !== null}
        titre="Retirer ce document ?"
        message={`« ${aSupprimer?.libelle ?? ''} » ne sera plus suivi dans l’application.`}
        libelleConfirmer="Retirer"
        danger
        onConfirmer={() => void supprimer()}
        onAnnuler={() => setASupprimer(null)}
      />
    </section>
  );
}
