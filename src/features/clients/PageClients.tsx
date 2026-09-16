import { useMemo, useState } from 'react';
import { useClients } from '../../context/ClientsContext';
import { useReglages } from '../../context/ReglagesContext';
import { useToast } from '../../components/ui/Toast';
import { Badge, Carte, EtatVide } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import {
  Bascule,
  CaseACocher,
  Champ,
  Liste,
  Saisie,
  SaisieEuros,
  ZoneTexte,
} from '../../components/ui/Champ';
import { ChampAdresse } from '../../components/ui/ChampAdresse';
import { DialogueConfirmation, Modale } from '../../components/ui/Modale';
import { IconeClients, IconePlus, IconePoubelle, IconeRecherche } from '../../components/icons';
import { adresseSurUneLigne, clientVide } from '../../lib/snapshots';
import { validerEmail, validerSiret, validerTelephone, validerTvaIntracom } from '../../lib/validation';
import { libelleModePaiement, libelleTypeClient, libelleTypePrestation } from '../../lib/format';
import type {
  Client,
  ModePaiement,
  PresetInstantane,
  TypeClient,
  TypePrestation,
} from '../../types';

const TYPES_PRESTATION: TypePrestation[] = [
  'course_simple',
  'transfert_aeroport',
  'transfert_gare',
  'mise_a_disposition',
  'excursion',
  'forfait',
];

const MODES_PAIEMENT: ModePaiement[] = ['cb', 'especes', 'virement', 'plateforme', 'facture', 'autre'];

type Erreurs = Partial<Record<'nom' | 'telephone' | 'email' | 'siret' | 'numeroTVAIntracom', string>>;

export function PageClients() {
  const { clients, creer, modifier, supprimer, definirParDefaut, chargement } = useClients();
  const { settings } = useReglages();
  const toast = useToast();
  const [recherche, setRecherche] = useState('');
  const [enEdition, setEnEdition] = useState<Client | null>(null);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [aSupprimer, setASupprimer] = useState<Client | null>(null);

  const filtres = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return clients;
    return clients.filter((client) =>
      [client.nom, client.ville, client.email, client.telephone]
        .join(' ')
        .toLowerCase()
        .includes(terme),
    );
  }, [clients, recherche]);

  const ouvrirNouveau = () => {
    setErreurs({});
    setEnEdition(clientVide());
  };

  const valider = (client: Client): Erreurs => {
    const trouvees: Erreurs = {};
    if (!client.nom.trim()) trouvees.nom = 'Indiquez un nom ou une raison sociale.';
    const telephone = validerTelephone(client.telephone);
    if (telephone) trouvees.telephone = telephone;
    const email = validerEmail(client.email);
    if (email) trouvees.email = email;
    const siret = validerSiret(client.siret);
    if (siret) trouvees.siret = siret;
    const tva = validerTvaIntracom(client.numeroTVAIntracom);
    if (tva) trouvees.numeroTVAIntracom = tva;
    return trouvees;
  };

  const enregistrer = async () => {
    if (!enEdition) return;
    const trouvees = valider(enEdition);
    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) {
      toast.erreur('Corrigez les champs signalés.');
      return;
    }
    if (enEdition.id === '') {
      await creer(enEdition);
      toast.succes('Client créé.');
    } else {
      await modifier(enEdition);
      toast.succes('Client modifié.');
    }
    setEnEdition(null);
  };

  const confirmerSuppression = async () => {
    if (!aSupprimer) return;
    await supprimer(aSupprimer.id);
    setASupprimer(null);
    toast.succes('Client supprimé.');
  };

  const maj = <C extends keyof Client>(champ: C, valeur: Client[C]) => {
    setEnEdition((precedent) => (precedent ? { ...precedent, [champ]: valeur } : precedent));
  };

  const majInstantane = <C extends keyof PresetInstantane>(
    champ: C,
    valeur: PresetInstantane[C],
  ) => {
    setEnEdition((precedent) =>
      precedent
        ? { ...precedent, instantane: { ...precedent.instantane, [champ]: valeur } }
        : precedent,
    );
  };

  /**
   * Active ou désactive le profil instantané.
   *
   * À la première activation, le lieu de prise en charge est pré-rempli avec l'adresse
   * du client. C'est le plus souvent le bon endroit, et cela évite le champ vide qui
   * ferait échouer la génération au pire moment. Le chauffeur reste libre de le
   * corriger, et la position le remplacera de toute façon s'il l'a demandé.
   */
  const activerInstantane = (actif: boolean) => {
    setEnEdition((precedent) => {
      if (!precedent) return precedent;
      const instantane = { ...precedent.instantane, actif };
      if (actif && !instantane.lieuPriseEnCharge.trim()) {
        instantane.lieuPriseEnCharge = adresseSurUneLigne(precedent);
      }
      return { ...precedent, instantane };
    });
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Clients</h1>
          <p className="texte-muet">
            Vos clients habituels, saisis une seule fois. Le client par défaut est pré-sélectionné
            à chaque nouveau bon.
          </p>
        </div>
        <Bouton
          variante="primaire"
          icone={<IconePlus className="h-4 w-4" />}
          onClick={ouvrirNouveau}
        >
          Ajouter
        </Bouton>
      </header>

      {clients.length > 3 ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <IconeRecherche className="h-5 w-5" />
          </span>
          <Saisie
            className="pl-11"
            placeholder="Rechercher un client"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            aria-label="Rechercher un client"
          />
        </div>
      ) : null}

      {!chargement && clients.length === 0 ? (
        <EtatVide
          icone={<IconeClients className="h-10 w-10" />}
          titre="Aucun client enregistré"
          description="Ajoutez vos clients habituels pour créer un bon de commande en quelques secondes, sans rien ressaisir."
          action={
            <Bouton variante="primaire" onClick={ouvrirNouveau}>
              Ajouter mon premier client
            </Bouton>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtres.map((client) => (
            <Carte key={client.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-50">
                      {[client.civilite, client.nom].filter(Boolean).join(' ')}
                    </p>
                    <Badge ton="neutre">{libelleTypeClient(client.type)}</Badge>
                    {client.parDefaut ? <Badge ton="accent">Par défaut</Badge> : null}
                  </div>
                  <p className="texte-muet">
                    {[client.telephone, client.email].filter(Boolean).join(' · ') ||
                      'Aucune coordonnée'}
                  </p>
                  <p className="texte-muet">
                    {[[client.codePostal, client.ville].filter(Boolean).join(' '), client.adresse]
                      .filter(Boolean)
                      .join(' — ')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Bouton petit onClick={() => setEnEdition(client)}>
                  Modifier
                </Bouton>
                {!client.parDefaut ? (
                  <Bouton petit variante="fantome" onClick={() => void definirParDefaut(client.id)}>
                    Définir par défaut
                  </Bouton>
                ) : null}
                <Bouton
                  petit
                  variante="fantome"
                  aria-label={`Supprimer ${client.nom}`}
                  onClick={() => setASupprimer(client)}
                >
                  <IconePoubelle className="h-4 w-4" />
                </Bouton>
              </div>
            </Carte>
          ))}
        </div>
      )}

      <Modale
        ouverte={enEdition !== null}
        titre={enEdition?.id ? 'Modifier le client' : 'Nouveau client'}
        onFermer={() => setEnEdition(null)}
        actions={
          <>
            <Bouton variante="secondaire" onClick={() => setEnEdition(null)}>
              Annuler
            </Bouton>
            <Bouton variante="primaire" onClick={() => void enregistrer()}>
              Enregistrer
            </Bouton>
          </>
        }
      >
        {enEdition ? (
          <>
            <Bascule
              label="Type de client"
              valeur={enEdition.type}
              onChange={(valeur) => maj('type', valeur as TypeClient)}
              options={[
                { valeur: 'particulier', libelle: 'Particulier' },
                { valeur: 'professionnel', libelle: 'Professionnel' },
              ]}
            />
            <Champ label="Civilité">
              {(id) => (
                <Liste
                  id={id}
                  value={enEdition.civilite}
                  onChange={(evenement) => maj('civilite', evenement.target.value)}
                >
                  <option value="">—</option>
                  <option value="M.">M.</option>
                  <option value="Mme">Mme</option>
                  <option value="Autre">Autre</option>
                </Liste>
              )}
            </Champ>
            <Champ
              label={enEdition.type === 'professionnel' ? 'Raison sociale' : 'Nom'}
              obligatoire
              mentionReglementaire
              erreur={erreurs.nom}
              aide="Mention 4 du justificatif de réservation."
            >
              {(id) => (
                <Saisie
                  id={id}
                  value={enEdition.nom}
                  onChange={(evenement) => maj('nom', evenement.target.value)}
                />
              )}
            </Champ>
            <Champ
              label="Téléphone"
              obligatoire
              mentionReglementaire
              erreur={erreurs.telephone}
              aide="Sans téléphone, le bon ne peut pas être émis : l’arrêté du 6 août 2025 l’exige."
            >
              {(id) => (
                <Saisie
                  id={id}
                  inputMode="tel"
                  value={enEdition.telephone}
                  onChange={(evenement) => maj('telephone', evenement.target.value)}
                />
              )}
            </Champ>
            <Champ label="Email" erreur={erreurs.email}>
              {(id) => (
                <Saisie
                  id={id}
                  inputMode="email"
                  value={enEdition.email}
                  onChange={(evenement) => maj('email', evenement.target.value)}
                />
              )}
            </Champ>
            <Champ label="Adresse de facturation">
              {(id) => (
                <Saisie
                  id={id}
                  value={enEdition.adresse}
                  onChange={(evenement) => maj('adresse', evenement.target.value)}
                />
              )}
            </Champ>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Code postal">
                {(id) => (
                  <Saisie
                    id={id}
                    inputMode="numeric"
                    value={enEdition.codePostal}
                    onChange={(evenement) => maj('codePostal', evenement.target.value)}
                  />
                )}
              </Champ>
              <Champ label="Ville">
                {(id) => (
                  <Saisie
                    id={id}
                    value={enEdition.ville}
                    onChange={(evenement) => maj('ville', evenement.target.value)}
                  />
                )}
              </Champ>
            </div>
            {enEdition.type === 'professionnel' ? (
              <div className="grid grid-cols-1 gap-3">
                <Champ label="SIRET" erreur={erreurs.siret}>
                  {(id) => (
                    <Saisie
                      id={id}
                      inputMode="numeric"
                      value={enEdition.siret}
                      onChange={(evenement) => maj('siret', evenement.target.value)}
                    />
                  )}
                </Champ>
                <Champ label="Numéro de TVA intracommunautaire" erreur={erreurs.numeroTVAIntracom}>
                  {(id) => (
                    <Saisie
                      id={id}
                      value={enEdition.numeroTVAIntracom}
                      onChange={(evenement) => maj('numeroTVAIntracom', evenement.target.value)}
                    />
                  )}
                </Champ>
              </div>
            ) : null}
            <Champ label="Contact sur place" aide="Nom de la personne à joindre sur le lieu de prise en charge.">
              {(id) => (
                <Saisie
                  id={id}
                  value={enEdition.contactSurPlace}
                  onChange={(evenement) => maj('contactSurPlace', evenement.target.value)}
                />
              )}
            </Champ>
            <Champ label="Notes internes">
              {(id) => (
                <ZoneTexte
                  id={id}
                  value={enEdition.notes}
                  onChange={(evenement) => maj('notes', evenement.target.value)}
                />
              )}
            </Champ>
            <CaseACocher
              label="Client par défaut"
              aide="Pré-sélectionné à la création d’un bon de commande. Un seul client à la fois."
              checked={enEdition.parDefaut}
              onChange={(valeur) => maj('parDefaut', valeur)}
            />

            <CaseACocher
              label="Bon instantané"
              aide="Ce client apparaît dans l’onglet Instantané, où un seul geste génère son bon."
              checked={enEdition.instantane.actif}
              onChange={activerInstantane}
            />

            {enEdition.instantane.actif ? (
              <div className="space-y-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="aide-champ">
                  Ces informations ne figurent pas sur la fiche client : elles décrivent la course
                  habituelle, et sont recopiées sur le bon à chaque génération. Le nom et le
                  téléphone, eux, viennent de la fiche ci-dessus — ils ne sont pas répétés ici.
                </p>

                <CaseACocher
                  label="Prendre ma position comme lieu de prise en charge"
                  aide="À la génération, votre position est convertie en adresse. Décochez pour toujours utiliser l’adresse ci-dessous."
                  checked={enEdition.instantane.utiliserMaPosition}
                  onChange={(valeur) => majInstantane('utiliserMaPosition', valeur)}
                />

                <ChampAdresse
                  label={
                    enEdition.instantane.utiliserMaPosition
                      ? 'Lieu de prise en charge (secours)'
                      : 'Lieu de prise en charge'
                  }
                  aide={
                    enEdition.instantane.utiliserMaPosition
                      ? 'Utilisé si la position n’est pas obtenue : hors connexion, autorisation refusée, ou aide à la saisie coupée. Sans lui, un échec de localisation rendrait le bon impossible à émettre.'
                      : 'C’est la mention 7 du justificatif, celle qu’un agent vérifiera en premier.'
                  }
                  valeur={enEdition.instantane.lieuPriseEnCharge}
                  onChange={(valeur) => majInstantane('lieuPriseEnCharge', valeur)}
                  aideActive={settings?.aideAdresse ?? false}
                  obligatoire
                  mentionReglementaire
                  placeholder="Ex. 5 avenue Victor Hugo, 75016 Paris"
                />

                <ChampAdresse
                  label="Destination habituelle"
                  valeur={enEdition.instantane.destination}
                  onChange={(valeur) => majInstantane('destination', valeur)}
                  aideActive={settings?.aideAdresse ?? false}
                  placeholder="Ex. Aéroport Charles-de-Gaulle, terminal 2E"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Champ
                    label="Prix habituel TTC (€)"
                    aide="Le HT et la TVA sont recalculés selon votre régime. Sans lui, l’onglet Instantané refusera de générer : le bon serait émis à 0 €."
                    obligatoire
                  >
                    {(id) => (
                      <SaisieEuros
                        id={id}
                        centimes={enEdition.instantane.prixTTCcentimes}
                        onCentimes={(centimes) => majInstantane('prixTTCcentimes', centimes)}
                      />
                    )}
                  </Champ>
                  <Champ
                    label="Distance habituelle (km)"
                    aide="Évite un calcul au moment de générer."
                  >
                    {(id) => (
                      <Saisie
                        id={id}
                        type="number"
                        step="0.1"
                        min={0}
                        value={enEdition.instantane.distanceKm ?? ''}
                        onChange={(evenement) =>
                          majInstantane(
                            'distanceKm',
                            evenement.target.value === '' ? null : Number(evenement.target.value),
                          )
                        }
                      />
                    )}
                  </Champ>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Champ label="Nombre de passagers">
                    {(id) => (
                      <Saisie
                        id={id}
                        type="number"
                        min={1}
                        value={enEdition.instantane.nombrePassagers ?? ''}
                        onChange={(evenement) =>
                          majInstantane(
                            'nombrePassagers',
                            evenement.target.value === '' ? null : Number(evenement.target.value),
                          )
                        }
                      />
                    )}
                  </Champ>
                  <Champ label="Mode de paiement">
                    {(id) => (
                      <Liste
                        id={id}
                        value={enEdition.instantane.modePaiement}
                        onChange={(evenement) =>
                          majInstantane('modePaiement', evenement.target.value as ModePaiement)
                        }
                      >
                        {MODES_PAIEMENT.map((mode) => (
                          <option key={mode} value={mode}>
                            {libelleModePaiement(mode)}
                          </option>
                        ))}
                      </Liste>
                    )}
                  </Champ>
                </div>

                <Champ label="Type de prestation">
                  {(id) => (
                    <Liste
                      id={id}
                      value={enEdition.instantane.typePrestation}
                      onChange={(evenement) =>
                        majInstantane('typePrestation', evenement.target.value as TypePrestation)
                      }
                    >
                      {TYPES_PRESTATION.map((type) => (
                        <option key={type} value={type}>
                          {libelleTypePrestation(type)}
                        </option>
                      ))}
                    </Liste>
                  )}
                </Champ>

                <Champ label="Désignation sur le bon">
                  {(id) => (
                    <Saisie
                      id={id}
                      value={enEdition.instantane.libellePrestation}
                      onChange={(evenement) =>
                        majInstantane('libellePrestation', evenement.target.value)
                      }
                    />
                  )}
                </Champ>

                <Champ label="Notes internes" aide="Jamais imprimées.">
                  {(id) => (
                    <ZoneTexte
                      id={id}
                      value={enEdition.instantane.notesInternes}
                      onChange={(evenement) => majInstantane('notesInternes', evenement.target.value)}
                    />
                  )}
                </Champ>
              </div>
            ) : null}
          </>
        ) : null}
      </Modale>

      <DialogueConfirmation
        ouverte={aSupprimer !== null}
        titre="Supprimer ce client ?"
        message={`« ${aSupprimer?.nom ?? ''} » ne sera plus proposé à la saisie. Les documents déjà émis conservent ses coordonnées, rien n’est perdu.`}
        libelleConfirmer="Supprimer"
        danger
        onConfirmer={() => void confirmerSuppression()}
        onAnnuler={() => setASupprimer(null)}
      />
    </div>
  );
}
