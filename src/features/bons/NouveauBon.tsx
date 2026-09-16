import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReglages } from '../../context/ReglagesContext';
import { useClients } from '../../context/ClientsContext';
import { useToast } from '../../components/ui/Toast';
import { Badge, Bandeau, BarreProgression, Carte } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import { CaseACocher, Champ, Liste, Saisie, ZoneTexte } from '../../components/ui/Champ';
import { ChampAdresse } from '../../components/ui/ChampAdresse';
import { IconeAlerte, IconeCheck, IconePlus, IconePoubelle } from '../../components/icons';
import { bonVide, emettreBon, enregistrerBrouillon, ErreurConformite, ligneVide } from './service';
import { blocages, avertissements, verifierConformiteBon } from './conformite';
import { calculerTotaux, TAUX_PROPOSES, htDepuisTTC } from '../../lib/tva';
import { formatEuros, formatSaisieEuros, parseSaisieEuros } from '../../lib/money';
import { formatDate, libelleTypePrestation } from '../../lib/format';
import { calculerDistance, geocoderAdresse } from '../../lib/geo';
import type { Adresse } from '../../lib/geo';
import type { Bon, LignePrestation, ModePaiement, RemiseGlobale, TypePrestation } from '../../types';

const ETAPES = ['Client et créneau', 'Trajet', 'Prestation et prix', 'Récapitulatif'];

export function NouveauBon() {
  const { settings } = useReglages();
  const { clients, clientParDefaut } = useClients();
  const toast = useToast();
  const navigate = useNavigate();

  const [etape, setEtape] = useState(1);
  const [bon, setBon] = useState<Bon>(() => bonVide(settings!, clientParDefaut));
  const [plusDOptions, setPlusDOptions] = useState(false);
  const [saisieTTC, setSaisieTTC] = useState(true);
  const [corrigerReservation, setCorrigerReservation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurEmission, setErreurEmission] = useState<string[]>([]);

  // Coordonnées retenues pour les deux adresses du trajet. Elles ne sont pas
  // enregistrées avec le bon : seule la distance l'est. Elles servent au calcul,
  // puis disparaissent avec l'écran.
  const [coordonneesDepart, setCoordonneesDepart] = useState<Adresse | null>(null);
  const [coordonneesArrivee, setCoordonneesArrivee] = useState<Adresse | null>(null);
  const [distanceEnCours, setDistanceEnCours] = useState(false);
  const [messageDistance, setMessageDistance] = useState<string | null>(null);

  /**
   * Retient si la distance affichée vient du calcul ou de la main du chauffeur.
   *
   * La distinction compte au moment de l'invalidation : une distance calculée ne décrit
   * plus rien dès qu'une adresse est retouchée, et doit donc disparaître. Une distance
   * saisie à la main, elle, n'appartenait pas au calcul — l'effacer reviendrait à
   * détruire une saisie.
   *
   * Un `ref` et non un état : un état placé dans les dépendances de l'effet ci-dessous
   * relancerait le calcul au moment même où il vient de réussir.
   */
  const distanceCalculee = useRef(false);

  const clientSelectionne = useMemo(
    () => clients.find((client) => client.id === bon.clientId) ?? null,
    [clients, bon.clientId],
  );

  const totaux = useMemo(
    () =>
      calculerTotaux(bon.lignes, {
        regimeTVA: settings!.regimeTVA,
        traitementPeages: settings!.traitementPeages,
        remiseGlobale: bon.remiseGlobale,
      }),
    [bon.lignes, bon.remiseGlobale, settings],
  );

  const problemes = useMemo(
    () => verifierConformiteBon(bon, settings!, clientSelectionne),
    [bon, settings, clientSelectionne],
  );
  const bloquants = blocages(problemes);
  const avis = avertissements(problemes);

  // Distance routière réelle, recalculée dès que les deux adresses sont connues.
  // Déclaré avant la sortie anticipée ci-dessous : un effet ne peut pas être appelé
  // sous condition, sous peine de casser l'ordre des crochets d'un rendu à l'autre.
  useEffect(() => {
    // Aide coupée, ou une des deux adresses retouchée à la main : ce qui est affiché ne
    // décrit plus le trajet. On efface le message — et la distance, si elle provenait du
    // calcul — plutôt que de laisser sur le bon un chiffre qui ne correspond à rien.
    if (!settings?.aideAdresse || !coordonneesDepart || !coordonneesArrivee) {
      setMessageDistance(null);
      if (distanceCalculee.current) {
        distanceCalculee.current = false;
        setBon((precedent) => ({ ...precedent, distanceKm: null }));
      }
      return;
    }

    const controleur = new AbortController();
    setDistanceEnCours(true);
    setMessageDistance(null);

    void calculerDistance(coordonneesDepart, coordonneesArrivee, {
      signal: controleur.signal,
    }).then((distance) => {
      if (controleur.signal.aborted) return;
      setDistanceEnCours(false);

      if (!distance) {
        setMessageDistance('Distance indisponible. Saisissez-la à la main.');
        return;
      }
      distanceCalculee.current = true;
      setBon((precedent) => ({ ...precedent, distanceKm: distance.km }));
      setMessageDistance(`≈ ${String(distance.minutes)} min par la route.`);
    });

    return () => controleur.abort();
  }, [coordonneesDepart, coordonneesArrivee, settings?.aideAdresse]);

  if (!settings) return null;

  const maj = <C extends keyof Bon>(champ: C, valeur: Bon[C]) => {
    setBon((precedent) => ({ ...precedent, [champ]: valeur }));
  };

  /**
   * Résout les adresses écrites à la main, pour les cas où le chauffeur n'a rien
   * retenu dans les propositions. Poser les coordonnées déclenche le calcul par
   * l'effet ci-dessus, qui se charge d'éteindre l'indicateur.
   */
  const resoudreAdresses = async () => {
    setDistanceEnCours(true);
    setMessageDistance(null);

    const depart = coordonneesDepart ?? (await geocoderAdresse(bon.lieuPriseEnCharge));
    const arrivee = coordonneesArrivee ?? (await geocoderAdresse(bon.destination));

    if (!depart || !arrivee) {
      setDistanceEnCours(false);
      setMessageDistance('Adresse introuvable. Précisez-la, ou saisissez la distance à la main.');
      return;
    }

    setCoordonneesDepart(depart);
    setCoordonneesArrivee(arrivee);
  };

  const majLigne = (id: string, champs: Partial<LignePrestation>) => {
    setBon((precedent) => ({
      ...precedent,
      lignes: precedent.lignes.map((ligne) => (ligne.id === id ? { ...ligne, ...champs } : ligne)),
    }));
  };

  const enregistrerEtEmettre = async (facturer: boolean) => {
    setEnCours(true);
    setErreurEmission([]);
    try {
      await enregistrerBrouillon(bon);
      const emis = await emettreBon(bon.id, settings, clientSelectionne);
      toast.succes(`Bon ${emis.numero} généré.`);
      if (facturer) {
        navigate(`/bons/${emis.id}?facturer=1`);
      } else {
        navigate(`/bons/${emis.id}`);
      }
    } catch (erreur) {
      if (erreur instanceof ErreurConformite) {
        setErreurEmission(erreur.problemes);
        toast.erreur('Émission impossible : le justificatif serait non conforme.');
      } else {
        setErreurEmission([erreur instanceof Error ? erreur.message : 'Erreur inconnue.']);
      }
    } finally {
      setEnCours(false);
    }
  };

  const enregistrerBrouillonSeul = async () => {
    setEnCours(true);
    try {
      await enregistrerBrouillon(bon);
      toast.succes('Brouillon enregistré.');
      navigate('/bons');
    } finally {
      setEnCours(false);
    }
  };

  const remise = bon.remiseGlobale;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
          Nouveau bon de commande
        </h1>
        <p className="texte-muet">{ETAPES[etape - 1]}</p>
      </header>

      <BarreProgression etape={etape} total={ETAPES.length} />

      {etape === 1 ? (
        <div className="space-y-4">
          <Carte className="space-y-3">
            <h2 className="section-titre">Client</h2>
            {clients.length === 0 ? (
              <Bandeau ton="attention">
                Aucun client enregistré.{' '}
                <button
                  type="button"
                  className="lien-accent"
                  onClick={() => navigate('/clients')}
                >
                  Créez-en un
                </button>{' '}
                pour ne plus ressaisir ses coordonnées.
              </Bandeau>
            ) : (
              <div className="space-y-2">
                {clients.map((client) => {
                  const actif = client.id === bon.clientId;
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => maj('clientId', client.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors ${
                        actif
                          ? 'border-transparent'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                      style={actif ? { backgroundColor: 'var(--accent-soft)' } : undefined}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-semibold text-slate-900 dark:text-slate-50">
                            {client.nom}
                          </span>
                          {client.parDefaut ? <Badge ton="neutre">par défaut</Badge> : null}
                        </span>
                        <span className="texte-muet block">{client.telephone || 'Sans téléphone'}</span>
                      </span>
                      {actif ? <IconeCheck className="h-5 w-5 shrink-0" /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </Carte>

          <Carte className="space-y-3">
            <h2 className="section-titre">Créneau</h2>
            <Bandeau ton="neutre">
              La date et l’heure de réservation sont enregistrées automatiquement maintenant
              ({formatDate(bon.dateReservation)} à {bon.heureReservation}). C’est la mention 5 du
              justificatif : elle doit être antérieure à la prise en charge.
            </Bandeau>
            <CaseACocher
              label="Corriger l’horodatage de réservation"
              aide="À n’utiliser que pour régulariser une réservation prise par téléphone plus tôt. La valeur d’origine est conservée dans l’historique."
              checked={corrigerReservation}
              onChange={setCorrigerReservation}
            />
            {corrigerReservation ? (
              <div className="grid grid-cols-2 gap-3">
                <Champ label="Date de réservation" mentionReglementaire>
                  {(id) => (
                    <Saisie
                      id={id}
                      type="date"
                      value={bon.dateReservation}
                      onChange={(evenement) => maj('dateReservation', evenement.target.value)}
                    />
                  )}
                </Champ>
                <Champ label="Heure de réservation" mentionReglementaire>
                  {(id) => (
                    <Saisie
                      id={id}
                      type="time"
                      value={bon.heureReservation}
                      onChange={(evenement) => maj('heureReservation', evenement.target.value)}
                    />
                  )}
                </Champ>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Date de prise en charge" obligatoire mentionReglementaire>
                {(id) => (
                  <Saisie
                    id={id}
                    type="date"
                    value={bon.datePriseEnCharge}
                    onChange={(evenement) => maj('datePriseEnCharge', evenement.target.value)}
                  />
                )}
              </Champ>
              <Champ label="Heure de prise en charge" obligatoire mentionReglementaire>
                {(id) => (
                  <Saisie
                    id={id}
                    type="time"
                    value={bon.heurePriseEnCharge}
                    onChange={(evenement) => maj('heurePriseEnCharge', evenement.target.value)}
                  />
                )}
              </Champ>
            </div>
            <Champ label="Type de prestation">
              {(id) => (
                <Liste
                  id={id}
                  value={bon.typePrestation}
                  onChange={(evenement) => maj('typePrestation', evenement.target.value as TypePrestation)}
                >
                  {(
                    [
                      'course_simple',
                      'transfert_aeroport',
                      'transfert_gare',
                      'mise_a_disposition',
                      'excursion',
                      'forfait',
                    ] as TypePrestation[]
                  ).map((type) => (
                    <option key={type} value={type}>
                      {libelleTypePrestation(type)}
                    </option>
                  ))}
                </Liste>
              )}
            </Champ>
          </Carte>
        </div>
      ) : null}

      {etape === 2 ? (
        <div className="space-y-4">
          <Carte className="space-y-3">
            <h2 className="section-titre">Trajet</h2>
            <ChampAdresse
              label="Lieu de prise en charge"
              obligatoire
              mentionReglementaire
              aide="Adresse indiquée par le client. C’est la mention 7 du justificatif, celle qu’un agent vérifiera en premier."
              valeur={bon.lieuPriseEnCharge}
              onChange={(valeur) => maj('lieuPriseEnCharge', valeur)}
              onCoordonnees={setCoordonneesDepart}
              aideActive={settings.aideAdresse}
              positionProposee
              placeholder="Ex. 12 rue de la Gare, 95300 Pontoise"
            />
            <ChampAdresse
              label="Destination"
              aide="Non exigée par l’arrêté, mais utile en cas de litige."
              valeur={bon.destination}
              onChange={(valeur) => maj('destination', valeur)}
              onCoordonnees={setCoordonneesArrivee}
              aideActive={settings.aideAdresse}
              placeholder="Ex. Aéroport Charles-de-Gaulle, terminal 2E"
            />
            <div className="grid grid-cols-2 gap-3">
              <Champ
                label="Distance estimée (km)"
                aide={
                  distanceEnCours
                    ? 'Calcul de la distance en cours…'
                    : (messageDistance ??
                      'Calculée automatiquement dès que les deux adresses sont connues.')
                }
              >
                {(id) => (
                  <Saisie
                    id={id}
                    type="number"
                    step="0.1"
                    value={bon.distanceKm ?? ''}
                    onChange={(evenement) => {
                      // Distance tapée à la main : elle ne vient plus du calcul, donc
                      // elle ne doit plus être effacée avec lui.
                      distanceCalculee.current = false;
                      maj(
                        'distanceKm',
                        evenement.target.value === '' ? null : Number(evenement.target.value),
                      );
                    }}
                  />
                )}
              </Champ>
              <Champ label="Nombre de passagers">
                {(id) => (
                  <Saisie
                    id={id}
                    type="number"
                    min={1}
                    value={bon.nombrePassagers ?? ''}
                    onChange={(evenement) =>
                      maj(
                        'nombrePassagers',
                        evenement.target.value === '' ? null : Number(evenement.target.value),
                      )
                    }
                  />
                )}
              </Champ>
            </div>
            {settings.aideAdresse &&
            !distanceEnCours &&
            (!coordonneesDepart || !coordonneesArrivee) &&
            bon.lieuPriseEnCharge.trim().length > 0 &&
            bon.destination.trim().length > 0 ? (
              // Cas où le chauffeur a tout écrit à la main, sans retenir de proposition :
              // on lui laisse demander le calcul explicitement plutôt que d'interroger
              // le service à son insu.
              <Bouton petit variante="secondaire" onClick={() => void resoudreAdresses()}>
                Calculer la distance
              </Bouton>
            ) : null}
            <button
              type="button"
              onClick={() => setPlusDOptions((valeur) => !valeur)}
              className="lien-accent text-sm"
            >
              {plusDOptions ? 'Masquer les options' : 'Plus d’options'}
            </button>
            {plusDOptions ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Champ label="N° de vol ou de train">
                    {(id) => (
                      <Saisie
                        id={id}
                        value={bon.numeroVolTrain}
                        onChange={(evenement) => maj('numeroVolTrain', evenement.target.value)}
                        placeholder="AF1234"
                      />
                    )}
                  </Champ>
                  <Champ label="Terminal">
                    {(id) => (
                      <Saisie
                        id={id}
                        value={bon.terminal}
                        onChange={(evenement) => maj('terminal', evenement.target.value)}
                      />
                    )}
                  </Champ>
                </div>
                <Champ label="Bagages">
                  {(id) => (
                    <Saisie
                      id={id}
                      value={bon.bagages}
                      onChange={(evenement) => maj('bagages', evenement.target.value)}
                      placeholder="Ex. 2 valises, 1 poussette"
                    />
                  )}
                </Champ>
              </div>
            ) : null}
          </Carte>
        </div>
      ) : null}

      {etape === 3 ? (
        <div className="space-y-4">
          <Carte className="space-y-3">
            <h2 className="section-titre">Véhicule et conducteur</h2>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Marque">
                {(id) => (
                  <Saisie
                    id={id}
                    value={bon.vehiculeMarque}
                    onChange={(evenement) => maj('vehiculeMarque', evenement.target.value)}
                  />
                )}
              </Champ>
              <Champ label="Modèle">
                {(id) => (
                  <Saisie
                    id={id}
                    value={bon.vehiculeModele}
                    onChange={(evenement) => maj('vehiculeModele', evenement.target.value)}
                  />
                )}
              </Champ>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Immatriculation">
                {(id) => (
                  <Saisie
                    id={id}
                    value={bon.vehiculeImmatriculation}
                    onChange={(evenement) =>
                      maj('vehiculeImmatriculation', evenement.target.value.toUpperCase())
                    }
                    placeholder="AB-123-CD"
                  />
                )}
              </Champ>
              <Champ label="Couleur">
                {(id) => (
                  <Saisie
                    id={id}
                    value={bon.vehiculeCouleur}
                    onChange={(evenement) => maj('vehiculeCouleur', evenement.target.value)}
                  />
                )}
              </Champ>
            </div>
            <Champ label="Conducteur" aide="À renseigner si différent de l’exploitant.">
              {(id) => (
                <Saisie
                  id={id}
                  value={bon.nomConducteur}
                  onChange={(evenement) => maj('nomConducteur', evenement.target.value)}
                />
              )}
            </Champ>
          </Carte>

          <Carte className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-titre">Prestation</h2>
              <div className="flex gap-1 rounded-lg border border-slate-300 p-1 dark:border-slate-700">
                {(
                  [
                    { valeur: true, libelle: 'TTC' },
                    { valeur: false, libelle: 'HT' },
                  ] as { valeur: boolean; libelle: string }[]
                ).map((option) => (
                  <button
                    key={option.libelle}
                    type="button"
                    onClick={() => setSaisieTTC(option.valeur)}
                    className={`min-h-[32px] rounded-md px-3 text-xs font-semibold ${
                      saisieTTC === option.valeur ? 'text-white' : 'text-slate-600 dark:text-slate-300'
                    }`}
                    style={saisieTTC === option.valeur ? { backgroundColor: 'var(--accent)' } : undefined}
                  >
                    Saisie en {option.libelle}
                  </button>
                ))}
              </div>
            </div>
            <p className="aide-champ">
              {saisieTTC
                ? 'Vous saisissez le prix client TTC : le HT et la TVA sont calculés automatiquement.'
                : 'Vous saisissez le prix HT : la TVA et le TTC sont calculés automatiquement.'}
            </p>

            {bon.lignes.map((ligne) => {
              // Prix unitaire TTC équivalent, pour l'affichage quand la saisie est en TTC.
              const unitaireTTC = Math.round(
                ligne.prixUnitaireCentimes * (1 + ligne.tauxTVA / 100),
              );
              const prixAffiche = formatSaisieEuros(
                saisieTTC ? unitaireTTC : ligne.prixUnitaireCentimes,
              );
              return (
                <div
                  key={ligne.id}
                  className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                >
                  <Champ label="Désignation">
                    {(id) => (
                      <Saisie
                        id={id}
                        value={ligne.libelle}
                        onChange={(evenement) => majLigne(ligne.id, { libelle: evenement.target.value })}
                      />
                    )}
                  </Champ>
                  <div className="grid grid-cols-3 gap-2">
                    <Champ label="Quantité">
                      {(id) => (
                        <Saisie
                          id={id}
                          type="number"
                          step="0.01"
                          min={0}
                          value={ligne.quantite}
                          onChange={(evenement) =>
                            majLigne(ligne.id, { quantite: Number(evenement.target.value) })
                          }
                        />
                      )}
                    </Champ>
                    <Champ label={saisieTTC ? 'Prix unitaire TTC' : 'Prix unitaire HT'}>
                      {(id) => (
                        <Saisie
                          id={id}
                          inputMode="decimal"
                          defaultValue={prixAffiche}
                          /* La clé ne dépend que de la ligne et du mode de saisie : le champ
                             n'est jamais remonté pendant la frappe, ce qui évite de perdre le
                             focus et permet de taper une virgule décimale. */
                          key={`${ligne.id}-${saisieTTC}`}
                          onChange={(evenement) => {
                            const centimes = parseSaisieEuros(evenement.target.value);
                            if (centimes === null) return;
                            const ht = saisieTTC
                              ? htDepuisTTC(centimes, ligne.tauxTVA).ht
                              : centimes;
                            majLigne(ligne.id, { prixUnitaireCentimes: ht });
                          }}
                        />
                      )}
                    </Champ>
                    <Champ label="Taux de TVA">
                      {(id) => (
                        <Liste
                          id={id}
                          value={String(ligne.tauxTVA)}
                          onChange={(evenement) =>
                            majLigne(ligne.id, { tauxTVA: Number(evenement.target.value) })
                          }
                        >
                          {TAUX_PROPOSES.map((taux) => (
                            <option key={taux} value={taux}>
                              {taux} %
                            </option>
                          ))}
                        </Liste>
                      )}
                    </Champ>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <CaseACocher
                      label="Débours (péage, parking)"
                      aide="Hors base TVA, refacturé à l’identique."
                      checked={ligne.estDebours}
                      onChange={(valeur) => majLigne(ligne.id, { estDebours: valeur })}
                    />
                    {bon.lignes.length > 1 ? (
                      <Bouton
                        petit
                        variante="fantome"
                        aria-label="Supprimer la ligne"
                        onClick={() =>
                          setBon((precedent) => ({
                            ...precedent,
                            lignes: precedent.lignes.filter((l) => l.id !== ligne.id),
                          }))
                        }
                      >
                        <IconePoubelle className="h-4 w-4" />
                      </Bouton>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <Bouton
              petit
              icone={<IconePlus className="h-4 w-4" />}
              onClick={() =>
                setBon((precedent) => ({
                  ...precedent,
                  lignes: [...precedent.lignes, ligneVide(settings)],
                }))
              }
            >
              Ajouter une ligne
            </Bouton>
          </Carte>

          <Carte className="space-y-3">
            <h2 className="section-titre">Remise et paiement</h2>
            <div className="grid grid-cols-2 gap-3">
              <Champ label="Type de remise">
                {(id) => (
                  <Liste
                    id={id}
                    value={remise?.type ?? 'aucune'}
                    onChange={(evenement) => {
                      const valeur = evenement.target.value;
                      if (valeur === 'aucune') {
                        maj('remiseGlobale', null);
                      } else {
                        maj('remiseGlobale', {
                          type: valeur as RemiseGlobale['type'],
                          valeur: remise?.valeur ?? 0,
                        });
                      }
                    }}
                  >
                    <option value="aucune">Aucune</option>
                    <option value="pourcentage">Pourcentage</option>
                    <option value="montant">Montant</option>
                  </Liste>
                )}
              </Champ>
              {remise ? (
                <Champ
                  label={remise.type === 'pourcentage' ? 'Remise (%)' : 'Remise (€)'}
                >
                  {(id) => (
                    <Saisie
                      id={id}
                      inputMode="decimal"
                      value={
                        remise.type === 'pourcentage'
                          ? String(remise.valeur)
                          : formatSaisieEuros(remise.valeur)
                      }
                      onChange={(evenement) => {
                        const brut = evenement.target.value;
                        if (remise.type === 'pourcentage') {
                          maj('remiseGlobale', { type: 'pourcentage', valeur: Number(brut) || 0 });
                        } else {
                          const centimes = parseSaisieEuros(brut);
                          maj('remiseGlobale', { type: 'montant', valeur: centimes ?? 0 });
                        }
                      }}
                    />
                  )}
                </Champ>
              ) : null}
            </div>
            <Champ label="Mode de paiement">
              {(id) => (
                <Liste
                  id={id}
                  value={bon.modePaiement}
                  onChange={(evenement) => maj('modePaiement', evenement.target.value as ModePaiement)}
                >
                  <option value="cb">Carte bancaire</option>
                  <option value="especes">Espèces</option>
                  <option value="virement">Virement</option>
                  <option value="plateforme">Plateforme</option>
                  <option value="facture">Facturé</option>
                  <option value="autre">Autre</option>
                </Liste>
              )}
            </Champ>
          </Carte>

          <Carte>
            <h2 className="section-titre mb-2">Totaux</h2>
            <LigneTotal label="Total HT" valeur={formatEuros(totaux.totalHT)} />
            {totaux.detailTVA.map((detail) => (
              <LigneTotal
                key={detail.taux}
                label={`TVA ${detail.taux} % sur ${formatEuros(detail.baseHT)}`}
                valeur={formatEuros(detail.montantTVA)}
              />
            ))}
            {totaux.totalDebours > 0 ? (
              <LigneTotal label="Débours refacturés" valeur={formatEuros(totaux.totalDebours)} />
            ) : null}
            <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
              <span className="font-bold">Total TTC</span>
              <span className="text-lg font-bold">{formatEuros(totaux.totalTTC)}</span>
            </div>
            {totaux.mentionTVA ? (
              <p className="aide-champ mt-1">{totaux.mentionTVA}</p>
            ) : null}
          </Carte>
        </div>
      ) : null}

      {etape === 4 ? (
        <div className="space-y-4">
          <Carte className="space-y-2">
            <h2 className="section-titre">Récapitulatif</h2>
            <LigneTotal label="Client" valeur={clientSelectionne?.nom ?? '—'} />
            <LigneTotal
              label="Réservation"
              valeur={`${formatDate(bon.dateReservation)} à ${bon.heureReservation}`}
            />
            <LigneTotal
              label="Prise en charge"
              valeur={`${formatDate(bon.datePriseEnCharge)} à ${bon.heurePriseEnCharge}`}
            />
            <LigneTotal label="Départ" valeur={bon.lieuPriseEnCharge || '—'} />
            <LigneTotal label="Destination" valeur={bon.destination || '—'} />
            <LigneTotal label="Véhicule" valeur={bon.vehiculeImmatriculation || '—'} />
            <LigneTotal label="Total TTC" valeur={formatEuros(totaux.totalTTC)} />
          </Carte>

          {bloquants.length > 0 ? (
            <Bandeau ton="danger" titre="Émission impossible en l’état">
              <ul className="mt-1 list-inside list-disc space-y-1">
                {bloquants.map((probleme) => (
                  <li key={probleme.champ + probleme.message}>{probleme.message}</li>
                ))}
              </ul>
            </Bandeau>
          ) : (
            <Bandeau ton="succes" titre="Justificatif conforme">
              Les 7 mentions de l’arrêté du 6 août 2025 sont présentes. Le bon pourra être présenté
              en contrôle.
            </Bandeau>
          )}

          {avis.length > 0 ? (
            <Bandeau ton="attention" titre="Points à vérifier (non bloquants)">
              <ul className="mt-1 list-inside list-disc space-y-1">
                {avis.map((probleme) => (
                  <li key={probleme.champ + probleme.message}>{probleme.message}</li>
                ))}
              </ul>
            </Bandeau>
          ) : null}

          {erreurEmission.length > 0 ? (
            <Bandeau ton="danger" titre="L’émission a échoué">
              <ul className="mt-1 list-inside list-disc">
                {erreurEmission.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </Bandeau>
          ) : null}

          <Carte className="space-y-3">
            <h2 className="section-titre">Notes</h2>
            <Champ label="Précisions pour le client" aide="Imprimées sur le bon.">
              {(id) => (
                <ZoneTexte
                  id={id}
                  value={bon.notesClient}
                  onChange={(evenement) => maj('notesClient', evenement.target.value)}
                />
              )}
            </Champ>
            <Champ label="Notes internes" aide="Jamais imprimées.">
              {(id) => (
                <ZoneTexte
                  id={id}
                  value={bon.notesInternes}
                  onChange={(evenement) => maj('notesInternes', evenement.target.value)}
                />
              )}
            </Champ>
          </Carte>

          <Carte className="space-y-2">
            <CaseACocher
              label="Créer aussi la facture après l’émission"
              aide="La facture reprendra les mêmes lignes et les mêmes montants, avec sa propre numérotation."
              checked={bon.modePaiement === 'facture'}
              onChange={(valeur) => maj('modePaiement', valeur ? 'facture' : 'cb')}
            />
          </Carte>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-between gap-2 pb-4">
        <Bouton
          variante="secondaire"
          disabled={etape === 1}
          onClick={() => setEtape((valeur) => Math.max(1, valeur - 1))}
        >
          Retour
        </Bouton>
        {etape < ETAPES.length ? (
          <Bouton variante="primaire" onClick={() => setEtape((valeur) => valeur + 1)}>
            Continuer
          </Bouton>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Bouton variante="secondaire" onClick={() => void enregistrerBrouillonSeul()} disabled={enCours}>
              Enregistrer en brouillon
            </Bouton>
            <Bouton
              variante="primaire"
              chargement={enCours}
              disabled={bloquants.length > 0}
              icone={<IconeCheck className="h-4 w-4" />}
              onClick={() => void enregistrerEtEmettre(bon.modePaiement === 'facture')}
            >
              Générer le bon de commande
            </Bouton>
          </div>
        )}
      </div>

      {bloquants.length > 0 && etape < ETAPES.length ? (
        <Bandeau ton="attention">
          <span className="flex items-start gap-2">
            <IconeAlerte className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              {bloquants.length} point(s) à compléter avant de pouvoir émettre le bon.
            </span>
          </span>
        </Bandeau>
      ) : null}
    </div>
  );
}

function LigneTotal({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-900 dark:text-slate-50">{valeur}</span>
    </div>
  );
}
