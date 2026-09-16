/**
 * BON INSTANTANÉ.
 *
 * Un seul geste : le chauffeur désigne le client, et le bon est émis. Tout le reste
 * a été décidé à l'avance, dans le profil rangé sur la fiche du client.
 *
 * Trois choix gouvernent ce module, et chacun mérite d'être explicité parce qu'il
 * s'écarte d'un réflexe naturel :
 *
 *  1. AUCUN APPEL RÉSEAU N'EST ATTENDU POUR LA DISTANCE. Le calcul d'itinéraire
 *     demande jusqu'à huit secondes. Les mettre au milieu du geste reviendrait à
 *     faire patienter le chauffeur devant son client, ce qui est exactement ce que
 *     cette fonctionnalité existe pour éviter. La distance est donc celle du profil,
 *     saisie une fois. Elle reste un avertissement, jamais un blocage.
 *
 *  2. LA POSITION NE REMPLACE JAMAIS LE LIEU DE PRISE EN CHARGE SANS ADRESSE.
 *     Une position est une paire de coordonnées. Le justificatif exige une adresse
 *     LISIBLE, que l'agent puisse comparer au lieu où il contrôle. Si l'adresse ne
 *     peut pas être obtenue, on se rabat sur celle du profil et on le DIT : un bon
 *     silencieusement approximatif serait pire qu'un message d'avertissement.
 *
 *  3. RIEN N'EST ÉCRIT SI LE BON NE PEUT PAS ÊTRE ÉMIS. Le contrôle passe avant la
 *     moindre écriture. Une génération instantanée qui échoue ne doit pas laisser
 *     derrière elle un brouillon que le chauffeur n'a pas demandé — il repartirait
 *     avec deux documents là où il en attendait un.
 */

import { adresseDepuisPosition, messageEchecPosition, positionActuelle } from '../../lib/geo';
import { htDepuisTTC } from '../../lib/tva';
import { blocages, verifierConformiteBon } from './conformite';
import type { Probleme } from './conformite';
import { bonVide, emettreBon, enregistrerBrouillon, ErreurConformite, ligneVide } from './service';
import type { Bon, Client, Settings } from '../../types';

/**
 * Assemble le bon décrit par le profil, sans rien écrire.
 *
 * `lieuPriseEnCharge` est fourni par l'appelant plutôt que lu dans le profil : la
 * position du chauffeur peut le remplacer au dernier moment, et c'est précisément
 * cette substitution qui est la raison d'être de l'onglet.
 *
 * Les dates de réservation et de prise en charge valent toutes deux l'instant
 * présent. La réservation n'est donc PAS antérieure à la prise en charge, elle lui
 * est égale — ce que le contrôle accepte. C'est la vérité de ce geste : le bon est
 * établi au moment où le client monte. Il doit donc être généré à ce moment-là, et
 * non après la course : un justificatif daté d'après la course ne prouve rien.
 */
export function construireBonInstantane(
  client: Client,
  settings: Settings,
  lieuPriseEnCharge: string,
): Bon {
  const profil = client.instantane;
  const base = bonVide(settings, client);
  const ligne = ligneVide(settings);

  return {
    ...base,
    lieuPriseEnCharge,
    destination: profil.destination,
    distanceKm: profil.distanceKm,
    typePrestation: profil.typePrestation,
    nombrePassagers: profil.nombrePassagers,
    modePaiement: profil.modePaiement,
    notesInternes: profil.notesInternes,
    // Le profil porte une seule ligne : c'est un prix habituel, pas une facturation
    // détaillée. Le chauffeur peut toujours l'affiner ensuite sur la fiche du bon.
    //
    // Le taux vient de `ligneVide`, donc des Réglages : en franchise en base il vaut
    // zéro, et la conversion ci-dessous rend alors le montant inchangé. Le prix TTC
    // annoncé au client est ainsi exact dans les deux régimes.
    lignes: [
      {
        ...ligne,
        libelle: profil.libellePrestation.trim() || ligne.libelle,
        prixUnitaireCentimes: htDepuisTTC(profil.prixTTCcentimes, ligne.tauxTVA).ht,
      },
    ],
  };
}

/**
 * Ce qui empêcherait ce profil de produire un bon conforme.
 *
 * On interroge le contrôle d'émission lui-même, avec le lieu de prise en charge de
 * SECOURS : si le profil ne tient pas sans position, il ne tient pas tout court, et
 * l'écran doit le dire avant que le chauffeur ne compte dessus. Une seconde liste de
 * règles, écrite pour cet écran, finirait par diverger de la première.
 */
export function problemesInstantane(client: Client, settings: Settings): Probleme[] {
  return verifierConformiteBon(
    construireBonInstantane(client, settings, client.instantane.lieuPriseEnCharge),
    settings,
    client,
  );
}

export interface ResultatInstantane {
  bon: Bon;
  /**
   * Ce qui n'a pas pu être obtenu automatiquement et qui mérite d'être signalé.
   * Vide dans le cas nominal. Un avertissement n'empêche pas l'émission : le bon est
   * conforme, il est seulement moins précis que prévu, et le chauffeur doit le savoir.
   */
  reserves: string[];
}

/**
 * Émet le bon décrit par le profil du client.
 *
 * Lève `ErreurConformite` si un blocage subsiste — sans avoir rien écrit.
 */
export async function genererBonInstantane(
  client: Client,
  settings: Settings,
): Promise<ResultatInstantane> {
  const profil = client.instantane;
  const reserves: string[] = [];
  let lieuPriseEnCharge = profil.lieuPriseEnCharge;

  if (profil.utiliserMaPosition) {
    if (!settings.aideAdresse) {
      // Le réglage coupe les appels sortants. Le géocodage inverse en fait partie :
      // une position ne devient une adresse lisible qu'en interrogeant un service.
      // On ne contourne donc pas le réglage en silence — ce serait le rendre faux.
      reserves.push(
        'Aide à la saisie d’adresse coupée dans les Réglages : le lieu de prise en charge est celui du profil.',
      );
    } else {
      const resultat = await positionActuelle();
      if (!resultat.ok) {
        reserves.push(
          `${messageEchecPosition(resultat.raison)} Lieu de prise en charge repris du profil.`,
        );
      } else {
        const adresse = await adresseDepuisPosition(resultat.position);
        if (!adresse) {
          reserves.push(
            'Position obtenue, mais son adresse n’a pas pu être déterminée. Lieu de prise en charge repris du profil.',
          );
        } else {
          lieuPriseEnCharge = adresse.libelle;
        }
      }
    }
  }

  const bon = construireBonInstantane(client, settings, lieuPriseEnCharge);

  // Contrôle AVANT écriture : un échec ne doit rien laisser derrière lui.
  const bloquants = blocages(verifierConformiteBon(bon, settings, client));
  if (bloquants.length > 0) {
    throw new ErreurConformite(bloquants.map((probleme) => probleme.message));
  }

  await enregistrerBrouillon(bon);
  const emis = await emettreBon(bon.id, settings, client);
  return { bon: emis, reserves };
}
