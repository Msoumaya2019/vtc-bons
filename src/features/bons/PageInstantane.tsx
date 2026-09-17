/**
 * ONGLET INSTANTANÉ.
 *
 * Le chauffeur désigne un client, et le bon est émis. Rien d'autre : ni formulaire,
 * ni confirmation, ni choix de créneau. Tout a été décidé à l'avance dans le profil
 * rangé sur la fiche du client, et le lieu de prise en charge vient de la position
 * du chauffeur — il est sur place, c'est la définition même du moment.
 *
 * Deux précautions d'écran, qui viennent du domaine et non du goût :
 *
 *  • Un profil incomplet est signalé AVANT le geste, pas après. Découvrir au moment
 *    où le client monte qu'il manque un téléphone, et se retrouver avec un message
 *    d'erreur à lire, est exactement ce que cette fonctionnalité doit éviter.
 *  • Une réserve n'est jamais escamotée. Quand le bon part avec le lieu de prise en
 *    charge du profil plutôt qu'avec la position, l'information reste affichée tant
 *    que le chauffeur ne l'a pas lue. Un message fugace serait un message perdu.
 */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '../../context/ClientsContext';
import { useReglages } from '../../context/ReglagesContext';
import { useToast } from '../../components/ui/Toast';
import { Badge, Bandeau, Carte, EtatVide } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import { IconeEclair } from '../../components/icons';
import { blocages } from './conformite';
import { genererBonInstantane, problemesInstantane } from './instantane';
import { ErreurConformite } from './service';
import { libelleAntedatation, minutesAntedatation } from '../../lib/antedatation';
import { formatEuros } from '../../lib/money';
import { formatKilometres, libelleModePaiement, libelleTypePrestation } from '../../lib/format';
import type { Client } from '../../types';

interface Reserve {
  bonId: string;
  numero: string | null;
  messages: string[];
}

export function PageInstantane() {
  const { clients, chargement } = useClients();
  const { settings } = useReglages();
  const toast = useToast();
  const navigate = useNavigate();

  /** Identifiant du client en cours de génération : un seul geste à la fois. */
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [reserve, setReserve] = useState<Reserve | null>(null);

  /**
   * Verrou du geste en cours.
   *
   * L'état ci-dessus désactive le bouton, mais il ne suffit pas : deux appuis traités
   * dans la même passe verraient tous deux l'ancien état, et l'application émettrait
   * DEUX bons numérotés pour une seule course. Une référence est lue immédiatement, et
   * ferme cette fenêtre. Le numéro consommé en trop laisserait un trou dans la
   * séquence, ce que la réglementation interdit.
   */
  const gesteEnCours = useRef(false);

  if (!settings) return null;

  const profils = clients.filter((client) => client.instantane.actif);

  // La lecture est défensive : une sauvegarde restaurée peut ne pas porter ce champ.
  // Voir `minutesAntedatation`, qui explique ce qu'un `undefined` produirait ici.
  const recul = minutesAntedatation(settings.antedatationReservationMinutes);

  const generer = async (client: Client) => {
    if (gesteEnCours.current) return;
    gesteEnCours.current = true;
    setEnCours(client.id);
    setErreurs([]);
    setReserve(null);
    try {
      const resultat = await genererBonInstantane(client, settings);

      if (resultat.reserves.length === 0) {
        toast.succes(`Bon ${resultat.bon.numero ?? ''} généré pour ${client.nom}.`);
        navigate(`/bons/${resultat.bon.id}`);
        return;
      }

      // Réserves à lire : on ne quitte pas l'écran, sinon l'avertissement
      // disparaîtrait avant d'avoir été lu. Le bon, lui, est déjà émis.
      toast.info(`Bon ${resultat.bon.numero ?? ''} généré.`);
      setReserve({
        bonId: resultat.bon.id,
        numero: resultat.bon.numero,
        messages: resultat.reserves,
      });
    } catch (erreur) {
      if (erreur instanceof ErreurConformite) {
        setErreurs(erreur.problemes);
        toast.erreur('Émission impossible : le justificatif serait non conforme.');
      } else {
        setErreurs([erreur instanceof Error ? erreur.message : 'Erreur inconnue.']);
        toast.erreur('La génération du bon a échoué.');
      }
    } finally {
      gesteEnCours.current = false;
      setEnCours(null);
    }
  };

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Instantané</h1>
        <p className="texte-muet">
          Un client, un geste, un bon. Le lieu de prise en charge est votre position au moment où
          vous appuyez.
        </p>
      </header>

      <Bandeau ton="neutre">
        {recul > 0
          ? `La réservation sera datée de ${libelleAntedatation(recul)} avant la prise en charge, qui reste à l’heure du geste.`
          : 'La réservation et la prise en charge seront datées au moment où vous générez le bon.'}{' '}
        Générez-le donc avant que le client ne monte : un justificatif daté d’après la course ne
        prouve pas qu’il y a eu réservation.
      </Bandeau>

      {!settings.aideAdresse ? (
        <Bandeau ton="attention" titre="Aide à la saisie d’adresse coupée">
          La position ne peut pas être transformée en adresse : les profils utiliseront leur lieu de
          prise en charge enregistré. Réactivez l’aide dans les Réglages pour que votre position soit
          prise en compte.
        </Bandeau>
      ) : null}

      {erreurs.length > 0 ? (
        <Bandeau ton="danger" titre="Le bon n’a pas été généré">
          <ul className="mt-1 list-inside list-disc space-y-1">
            {erreurs.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Bandeau>
      ) : null}

      {reserve ? (
        <Bandeau ton="attention" titre={`Bon ${reserve.numero ?? ''} émis, avec une réserve`}>
          <ul className="mt-1 list-inside list-disc space-y-1">
            {reserve.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <div className="mt-2">
            <Bouton petit onClick={() => navigate(`/bons/${reserve.bonId}`)}>
              Voir le bon
            </Bouton>
          </div>
        </Bandeau>
      ) : null}

      {!chargement && profils.length === 0 ? (
        <EtatVide
          icone={<IconeEclair className="h-10 w-10" />}
          titre="Aucun profil instantané"
          description="Ouvrez une fiche client, cochez « Bon instantané », puis renseignez sa destination et son prix habituels. Il apparaîtra alors ici, prêt à générer son bon d’un seul geste."
          action={
            <Bouton variante="primaire" onClick={() => navigate('/clients')}>
              Ouvrir les clients
            </Bouton>
          }
        />
      ) : null}

      <div className="space-y-2">
        {profils.map((client) => {
          const bloquants = blocages(problemesInstantane(client, settings));
          const pret = bloquants.length === 0;
          const profil = client.instantane;
          return (
            <Carte key={client.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-50">
                    {client.nom}
                  </p>
                  <p className="texte-muet">{profil.destination || 'Destination non renseignée'}</p>
                  <p className="texte-muet">
                    {[
                      libelleTypePrestation(profil.typePrestation),
                      formatEuros(profil.prixTTCcentimes),
                      libelleModePaiement(profil.modePaiement),
                      formatKilometres(profil.distanceKm),
                    ].join(' · ')}
                  </p>
                  <p className="texte-muet">
                    {profil.utiliserMaPosition
                      ? 'Départ : votre position'
                      : `Départ : ${profil.lieuPriseEnCharge || 'non renseigné'}`}
                  </p>
                </div>
                <Badge ton={pret ? 'succes' : 'attention'}>{pret ? 'Prêt' : 'À compléter'}</Badge>
              </div>

              {!pret ? (
                <Bandeau ton="attention" titre="Ce profil ne peut pas encore générer un bon">
                  <ul className="mt-1 list-inside list-disc space-y-1">
                    {bloquants.map((probleme) => (
                      <li key={probleme.champ + probleme.message}>{probleme.message}</li>
                    ))}
                  </ul>
                </Bandeau>
              ) : null}

              <Bouton
                variante={pret ? 'primaire' : 'secondaire'}
                className="w-full"
                icone={<IconeEclair className="h-4 w-4" />}
                chargement={enCours === client.id}
                // Un seul geste à la fois : deux émissions simultanées
                // consommeraient deux numéros pour une seule course.
                disabled={!pret || enCours !== null}
                onClick={() => void generer(client)}
                aria-label={`Générer le bon instantané de ${client.nom}`}
              >
                {pret ? 'Générer le bon' : 'Profil à compléter'}
              </Bouton>
            </Carte>
          );
        })}
      </div>

      {profils.length > 0 ? (
        <Bouton variante="fantome" onClick={() => navigate('/clients')}>
          Modifier les profils
        </Bouton>
      ) : null}
    </div>
  );
}
