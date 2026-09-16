import { useEffect, useMemo, useRef, useState } from 'react';
import { useReglages } from '../../context/ReglagesContext';
import { useToast } from '../../components/ui/Toast';
import { Bandeau, Carte, SectionRepliable } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import { Bascule, CaseACocher, Champ, Liste, Saisie, ZoneTexte } from '../../components/ui/Champ';
import { IconeAlerte, IconeCheck } from '../../components/icons';
import { ModuleDocuments } from '../documents/ModuleDocuments';
import { ModuleSauvegarde } from './ModuleSauvegarde';
import { apercuNumero, optionsDepuisSettings } from '../../lib/numbering';
import {
  validerEmail,
  validerSiren,
  validerSiret,
  validerTelephone,
  validerTvaIntracom,
} from '../../lib/validation';
import { COULEURS_PREDEFINIES } from '../../lib/couleurs';
import type { RegimeTVA, Settings, TraitementPeages } from '../../types';

type Erreurs = Partial<Record<keyof Settings, string>>;

export function PageReglages() {
  const { settings, enregistrer } = useReglages();
  const toast = useToast();
  const [brouillon, setBrouillon] = useState<Settings | null>(settings);
  const [erreurs, setErreurs] = useState<Erreurs>({});
  const [apercuBon, setApercuBon] = useState('—');
  const [apercuFacture, setApercuFacture] = useState('—');
  const [enregistrement, setEnregistrement] = useState(false);
  const champLogo = useRef<HTMLInputElement>(null);
  const champSignature = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBrouillon(settings);
  }, [settings]);

  const modifie = useMemo(
    () => JSON.stringify(brouillon) !== JSON.stringify(settings),
    [brouillon, settings],
  );

  // Aperçu en direct du prochain numéro : évite toute surprise au moment de l'émission.
  useEffect(() => {
    if (!brouillon) return;
    const annee = new Date().getFullYear();
    let annule = false;
    void (async () => {
      const [bon, facture] = await Promise.all([
        apercuNumero(optionsDepuisSettings(brouillon, 'bon', annee)),
        apercuNumero(optionsDepuisSettings(brouillon, 'facture', annee)),
      ]);
      if (!annule) {
        setApercuBon(bon);
        setApercuFacture(facture);
      }
    })();
    return () => {
      annule = true;
    };
  }, [brouillon]);

  if (!brouillon) return null;

  const maj = <C extends keyof Settings>(champ: C, valeur: Settings[C]) => {
    setBrouillon((precedent) => (precedent ? { ...precedent, [champ]: valeur } : precedent));
  };

  const valider = (): Erreurs => {
    const trouvees: Erreurs = {};
    const siren = validerSiren(brouillon.siren);
    if (siren) trouvees.siren = siren;
    const siret = validerSiret(brouillon.siret);
    if (siret) trouvees.siret = siret;
    const tva = validerTvaIntracom(brouillon.numeroTVAIntracom);
    if (tva) trouvees.numeroTVAIntracom = tva;
    const telephone = validerTelephone(brouillon.telephone);
    if (telephone) trouvees.telephone = telephone;
    const email = validerEmail(brouillon.email);
    if (email) trouvees.email = email;
    if (brouillon.regimeTVA === 'assujetti' && !brouillon.numeroTVAIntracom.trim()) {
      trouvees.numeroTVAIntracom =
        'Vous êtes assujetti à la TVA : ce numéro est une mention obligatoire de vos factures.';
    }
    if (!brouillon.numeroREVTC.trim()) {
      trouvees.numeroREVTC =
        'Le numéro d’inscription au registre des VTC est exigé sur le justificatif de réservation.';
    }
    if (!brouillon.raisonSociale.trim()) {
      trouvees.raisonSociale = 'Indiquez votre nom ou votre raison sociale.';
    }
    return trouvees;
  };

  const sauvegarder = async () => {
    const trouvees = valider();
    setErreurs(trouvees);
    if (Object.keys(trouvees).length > 0) {
      toast.erreur('Corrigez les champs signalés avant d’enregistrer.');
      return;
    }
    setEnregistrement(true);
    try {
      await enregistrer(brouillon);
      toast.succes('Réglages enregistrés.');
    } finally {
      setEnregistrement(false);
    }
  };

  const lireImage = (fichier: File, champ: 'logo' | 'signature') => {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      if (typeof lecteur.result === 'string') maj(champ, lecteur.result);
    };
    lecteur.readAsDataURL(fichier);
  };

  return (
    <div className="space-y-4 pb-24">
      <header>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Réglages</h1>
        <p className="texte-muet">
          Renseignez ces informations une seule fois : elles seront reprises sur tous vos bons de
          commande et toutes vos factures.
        </p>
      </header>

      <SectionRepliable
        titre="Identité de l’exploitant"
        description="Mentions 1 à 3 du justificatif de réservation"
        ouvertParDefaut
      >
        <Champ label="Nom ou raison sociale" obligatoire erreur={erreurs.raisonSociale}>
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.raisonSociale}
              onChange={(evenement) => maj('raisonSociale', evenement.target.value)}
              placeholder="Ex. Jean Dupont ou Transports Dupont"
            />
          )}
        </Champ>
        <Champ label="Forme juridique">
          {(id) => (
            <Liste
              id={id}
              value={brouillon.formeJuridique}
              onChange={(evenement) => maj('formeJuridique', evenement.target.value)}
            >
              <option value="">—</option>
              <option value="Entreprise individuelle">Entreprise individuelle</option>
              <option value="Micro-entreprise">Micro-entreprise</option>
              <option value="EURL">EURL</option>
              <option value="SASU">SASU</option>
              <option value="SARL">SARL</option>
              <option value="SAS">SAS</option>
              <option value="Autre">Autre</option>
            </Liste>
          )}
        </Champ>
        <Champ label="Nom commercial">
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.nomCommercial}
              onChange={(evenement) => maj('nomCommercial', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ label="Adresse" mentionReglementaire>
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.adresse}
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
                value={brouillon.codePostal}
                onChange={(evenement) => maj('codePostal', evenement.target.value)}
              />
            )}
          </Champ>
          <Champ label="Ville">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.ville}
                onChange={(evenement) => maj('ville', evenement.target.value)}
              />
            )}
          </Champ>
        </div>
        <Champ label="Pays">
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.pays}
              onChange={(evenement) => maj('pays', evenement.target.value)}
            />
          )}
        </Champ>
        <div className="grid grid-cols-2 gap-3">
          <Champ
            label="Téléphone"
            obligatoire
            mentionReglementaire
            erreur={erreurs.telephone}
            aide="Mention 1 du justificatif de réservation."
          >
            {(id) => (
              <Saisie
                id={id}
                inputMode="tel"
                value={brouillon.telephone}
                onChange={(evenement) => maj('telephone', evenement.target.value)}
                placeholder="06 12 34 56 78"
              />
            )}
          </Champ>
          <Champ label="Email" erreur={erreurs.email}>
            {(id) => (
              <Saisie
                id={id}
                inputMode="email"
                value={brouillon.email}
                onChange={(evenement) => maj('email', evenement.target.value)}
              />
            )}
          </Champ>
        </div>
        <Champ
          label="SIREN"
          obligatoire
          mentionReglementaire
          erreur={erreurs.siren}
          aide="9 chiffres. Mention 3 du justificatif de réservation."
        >
          {(id) => (
            <Saisie
              id={id}
              inputMode="numeric"
              maxLength={11}
              value={brouillon.siren}
              onChange={(evenement) => maj('siren', evenement.target.value)}
              placeholder="123456789"
            />
          )}
        </Champ>
        <Champ label="SIRET" erreur={erreurs.siret} aide="14 chiffres, facultatif.">
          {(id) => (
            <Saisie
              id={id}
              inputMode="numeric"
              maxLength={17}
              value={brouillon.siret}
              onChange={(evenement) => maj('siret', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ
          label="Numéro d’inscription au registre des VTC (REVTC)"
          obligatoire
          mentionReglementaire
          erreur={erreurs.numeroREVTC}
          aide="Mention 2 du justificatif de réservation. C’est la mention la plus souvent oubliée, et celle qu’un agent vérifiera."
        >
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.numeroREVTC}
              onChange={(evenement) => maj('numeroREVTC', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ
          label="Numéro de TVA intracommunautaire"
          erreur={erreurs.numeroTVAIntracom}
          aide="Format FR + 2 caractères + 9 chiffres. Obligatoire si vous êtes assujetti."
        >
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.numeroTVAIntracom}
              onChange={(evenement) => maj('numeroTVAIntracom', evenement.target.value)}
              placeholder="FR12345678901"
            />
          )}
        </Champ>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Capital social">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.capitalSocial}
                onChange={(evenement) => maj('capitalSocial', evenement.target.value)}
              />
            )}
          </Champ>
          <Champ label="Code APE / NAF">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.codeAPE}
                onChange={(evenement) => maj('codeAPE', evenement.target.value)}
              />
            )}
          </Champ>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Ville du greffe (RCS)">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.rcsVille}
                onChange={(evenement) => maj('rcsVille', evenement.target.value)}
              />
            )}
          </Champ>
          <Champ label="Numéro RCS">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.rcsNumero}
                onChange={(evenement) => maj('rcsNumero', evenement.target.value)}
              />
            )}
          </Champ>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Régime de TVA" description="Taux, franchise en base, péages">
        <Bascule
          label="Régime"
          valeur={brouillon.regimeTVA}
          onChange={(valeur) => maj('regimeTVA', valeur as RegimeTVA)}
          options={[
            { valeur: 'assujetti', libelle: 'Assujetti à la TVA' },
            { valeur: 'franchise_en_base', libelle: 'Franchise en base' },
          ]}
        />
        {brouillon.regimeTVA === 'assujetti' ? (
          <Bandeau ton="neutre">
            Le transport de personnes par VTC relève du taux réduit de <strong>10 %</strong>
            (art. 279 du CGI). Les services annexes — attente, bagages, frais d’approche, prise en
            charge — suivent ce même taux et ne doivent pas être facturés à 20 %.
          </Bandeau>
        ) : (
          <Bandeau ton="attention">
            En franchise en base, aucune TVA n’est facturée et vos documents portent la mention
            « TVA non applicable, article 293 B du CGI ». Aucun numéro de TVA
            intracommunautaire ne doit y apparaître.
          </Bandeau>
        )}
        {brouillon.regimeTVA === 'assujetti' ? (
          <Champ label="Taux de TVA par défaut (%)" aide="Appliqué aux nouvelles lignes.">
            {(id) => (
              <Saisie
                id={id}
                type="number"
                step="0.1"
                value={brouillon.tauxTVADefaut}
                onChange={(evenement) => maj('tauxTVADefaut', Number(evenement.target.value))}
              />
            )}
          </Champ>
        ) : null}
        <Champ
          label="Seuil de franchise en base (€)"
          aide="Valeur indicative, à vérifier chaque année : les seuils évoluent. Elle sert uniquement à afficher une alerte de dépassement."
        >
          {(id) => (
            <Saisie
              id={id}
              type="number"
              value={brouillon.seuilFranchise}
              onChange={(evenement) => maj('seuilFranchise', Number(evenement.target.value))}
            />
          )}
        </Champ>
        <Bascule
          label="Péages et parkings refacturés"
          valeur={brouillon.traitementPeages}
          onChange={(valeur) => maj('traitementPeages', valeur as TraitementPeages)}
          options={[
            { valeur: 'dans_base', libelle: 'Dans la base à 10 %' },
            { valeur: 'debours', libelle: 'En débours (hors base)' },
          ]}
        />
        <p className="aide-champ">
          « Débours » ne convient que si la dépense est avancée au nom et pour le compte du client
          et refacturée à l’identique, sans marge.
        </p>
      </SectionRepliable>

      <SectionRepliable
        titre="Assurance professionnelle"
        description="Mention attendue sur les factures"
      >
        <Champ label="Assureur">
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.assureurNom}
              onChange={(evenement) => maj('assureurNom', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ label="Numéro de contrat">
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.assureurContrat}
              onChange={(evenement) => maj('assureurContrat', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ label="Couverture géographique">
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.assureurCouvertureGeographique}
              onChange={(evenement) => maj('assureurCouvertureGeographique', evenement.target.value)}
              placeholder="Union européenne"
            />
          )}
        </Champ>
      </SectionRepliable>

      <SectionRepliable titre="Coordonnées bancaires" description="Affichées si virement">
        <Champ label="Titulaire du compte">
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.titulaireCompte}
              onChange={(evenement) => maj('titulaireCompte', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ label="IBAN">
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.iban}
              onChange={(evenement) => maj('iban', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ label="BIC">
          {(id) => (
            <Saisie
              id={id}
              value={brouillon.bic}
              onChange={(evenement) => maj('bic', evenement.target.value)}
            />
          )}
        </Champ>
      </SectionRepliable>

      <SectionRepliable titre="Numérotation" description="Séquences continues, sans trou">
        <div className="grid grid-cols-3 gap-3">
          <Champ label="Préfixe bons">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.prefixeBon}
                onChange={(evenement) => maj('prefixeBon', evenement.target.value.toUpperCase())}
              />
            )}
          </Champ>
          <Champ label="Préfixe factures">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.prefixeFacture}
                onChange={(evenement) => maj('prefixeFacture', evenement.target.value.toUpperCase())}
              />
            )}
          </Champ>
          <Champ label="Préfixe avoirs">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.prefixeAvoir}
                onChange={(evenement) => maj('prefixeAvoir', evenement.target.value.toUpperCase())}
              />
            )}
          </Champ>
        </div>
        <CaseACocher
          label="Réinitialiser les compteurs chaque année"
          aide="Ex. FA-2026-0001 puis FA-2027-0001. Décochez pour une séquence continue."
          checked={brouillon.reinitialiserChaqueAnnee}
          onChange={(valeur) => maj('reinitialiserChaqueAnnee', valeur)}
        />
        <Bandeau ton="neutre" titre="Prochains numéros">
          Bon de commande : <strong>{apercuBon}</strong> — Facture : <strong>{apercuFacture}</strong>
        </Bandeau>
        <p className="aide-champ">
          Un brouillon ne consomme pas de numéro : il n’est attribué qu’à l’émission. Un document
          supprimé ne libère jamais son numéro, afin que la séquence reste continue.
        </p>
      </SectionRepliable>

      <SectionRepliable titre="Paiement et mentions" description="Échéance, pénalités, escompte">
        <Champ label="Délai de paiement (jours)">
          {(id) => (
            <Saisie
              id={id}
              type="number"
              value={brouillon.delaiPaiementJours}
              onChange={(evenement) => maj('delaiPaiementJours', Number(evenement.target.value))}
            />
          )}
        </Champ>
        <Champ label="Conditions de règlement">
          {(id) => (
            <ZoneTexte
              id={id}
              value={brouillon.conditionsPaiement}
              onChange={(evenement) => maj('conditionsPaiement', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ
          label="Pénalités de retard et indemnité de recouvrement"
          aide="Mention obligatoire sur la facture."
        >
          {(id) => (
            <ZoneTexte
              id={id}
              value={brouillon.penalitesRetard}
              onChange={(evenement) => maj('penalitesRetard', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ label="Escompte pour paiement anticipé">
          {(id) => (
            <ZoneTexte
              id={id}
              value={brouillon.escompteTexte}
              onChange={(evenement) => maj('escompteTexte', evenement.target.value)}
            />
          )}
        </Champ>
        <Champ
          label="Mention spécifique"
          aide="Texte libre imprimé sur la facture, pour un cas particulier."
        >
          {(id) => (
            <ZoneTexte
              id={id}
              value={brouillon.mentionSpecifique}
              onChange={(evenement) => maj('mentionSpecifique', evenement.target.value)}
            />
          )}
        </Champ>
      </SectionRepliable>

      <SectionRepliable titre="Véhicule habituel" description="Proposé automatiquement à la saisie">
        <div className="grid grid-cols-2 gap-3">
          <Champ label="Marque">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.vehiculeMarque}
                onChange={(evenement) => maj('vehiculeMarque', evenement.target.value)}
              />
            )}
          </Champ>
          <Champ label="Modèle">
            {(id) => (
              <Saisie
                id={id}
                value={brouillon.vehiculeModele}
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
                value={brouillon.vehiculeImmatriculation}
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
                value={brouillon.vehiculeCouleur}
                onChange={(evenement) => maj('vehiculeCouleur', evenement.target.value)}
              />
            )}
          </Champ>
        </div>
      </SectionRepliable>

      <SectionRepliable titre="Apparence" description="Logo, couleur, signature">
        <Champ label="Logo" aide="Affiché en haut à gauche de vos documents.">
          {() => (
            <div className="flex items-center gap-3">
              {brouillon.logo ? (
                <img
                  src={brouillon.logo}
                  alt="Logo"
                  className="h-14 w-14 rounded-lg border border-slate-200 object-contain p-1 dark:border-slate-700"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700">
                  vide
                </div>
              )}
              <div className="flex gap-2">
                <Bouton petit onClick={() => champLogo.current?.click()}>
                  Choisir
                </Bouton>
                {brouillon.logo ? (
                  <Bouton petit variante="fantome" onClick={() => maj('logo', '')}>
                    Retirer
                  </Bouton>
                ) : null}
              </div>
              <input
                ref={champLogo}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(evenement) => {
                  const fichier = evenement.target.files?.[0];
                  if (fichier) lireImage(fichier, 'logo');
                  evenement.target.value = '';
                }}
              />
            </div>
          )}
        </Champ>
        <Champ label="Signature" aide="Apposée en bas de vos documents.">
          {() => (
            <div className="flex items-center gap-3">
              {brouillon.signature ? (
                <img
                  src={brouillon.signature}
                  alt="Signature"
                  className="h-14 rounded-lg border border-slate-200 object-contain p-1 dark:border-slate-700"
                />
              ) : (
                <div className="flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700">
                  vide
                </div>
              )}
              <div className="flex gap-2">
                <Bouton petit onClick={() => champSignature.current?.click()}>
                  Choisir
                </Bouton>
                {brouillon.signature ? (
                  <Bouton petit variante="fantome" onClick={() => maj('signature', '')}>
                    Retirer
                  </Bouton>
                ) : null}
              </div>
              <input
                ref={champSignature}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(evenement) => {
                  const fichier = evenement.target.files?.[0];
                  if (fichier) lireImage(fichier, 'signature');
                  evenement.target.value = '';
                }}
              />
            </div>
          )}
        </Champ>
        <Champ label="Couleur d’accent">
          {() => (
            <div className="flex flex-wrap gap-2">
              {COULEURS_PREDEFINIES.map((couleur) => (
                <button
                  key={couleur.valeur}
                  type="button"
                  aria-label={couleur.nom}
                  onClick={() => maj('couleurAccent', couleur.valeur)}
                  className={`h-10 w-10 rounded-full border-2 transition-transform ${
                    brouillon.couleurAccent === couleur.valeur
                      ? 'scale-110 border-slate-900 dark:border-white'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: couleur.valeur }}
                />
              ))}
            </div>
          )}
        </Champ>
      </SectionRepliable>

      <SectionRepliable
        titre="Aide à la saisie d’adresse"
        description="Propositions, position actuelle, distance"
      >
        <CaseACocher
          label="Proposer des adresses et calculer la distance"
          aide="L’application interroge alors deux services externes gratuits, sans compte ni clé : Photon (Komoot, Allemagne) pour retrouver une adresse, et OSRM (FOSSGIS, Allemagne) pour la distance routière. Seules les adresses du trajet leur sont transmises — jamais le nom de vos clients, ni vos tarifs. Désactivé, plus aucune donnée ne quitte l’appareil et toute la saisie redevient manuelle."
          checked={brouillon.aideAdresse}
          onChange={(valeur) => maj('aideAdresse', valeur)}
        />
      </SectionRepliable>

      <Carte>
        <ModuleDocuments />
      </Carte>

      <Carte>
        <h3 className="section-titre mb-1">Sauvegarde et restauration</h3>
        <p className="texte-muet mb-3">
          Vos données ne vivent que sur cet appareil. Une sauvegarde régulière est votre seule
          assurance.
        </p>
        <ModuleSauvegarde />
      </Carte>

      {Object.keys(erreurs).length > 0 ? (
        <Bandeau ton="danger">
          <span className="flex items-start gap-2">
            <IconeAlerte className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              Certains champs doivent être corrigés. Ces informations figurent sur vos documents
              remis au client et présentés en contrôle.
            </span>
          </span>
        </Bandeau>
      ) : null}

      <div className="zone-sure-bas fixed inset-x-0 bottom-[56px] z-20 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3">
          <span className="texte-muet">
            {modifie ? 'Modifications non enregistrées' : 'Réglages à jour'}
          </span>
          <Bouton
            variante="primaire"
            onClick={() => void sauvegarder()}
            disabled={!modifie}
            chargement={enregistrement}
            icone={<IconeCheck className="h-4 w-4" />}
          >
            Enregistrer
          </Bouton>
        </div>
      </div>
    </div>
  );
}
