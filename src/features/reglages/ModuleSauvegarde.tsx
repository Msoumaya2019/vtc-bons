import { useRef, useState } from 'react';
import {
  exporterJson,
  exporterZip,
  fautIlRappelerSauvegarde,
  lireArchiveZip,
  lireFichierSauvegarde,
  nomFichierSauvegarde,
  restaurerSauvegarde,
  type ResultatValidation,
} from '../../lib/backup';
import { effacerToutesLesDonnees } from '../../lib/db';
import { telechargerBlob } from '../../lib/fichiers';
import { useReglages } from '../../context/ReglagesContext';
import { useClients } from '../../context/ClientsContext';
import { useToast } from '../../components/ui/Toast';
import { Bandeau, Carte } from '../../components/ui/Carte';
import { Bouton } from '../../components/ui/Bouton';
import { DialogueConfirmation, Modale } from '../../components/ui/Modale';
import { IconeAlerte, IconeSauvegarde } from '../../components/icons';
import type { Sauvegarde } from '../../types';

export function ModuleSauvegarde() {
  const { settings, recharger } = useReglages();
  const { recharger: rechargerClients } = useClients();
  const toast = useToast();
  const champFichier = useRef<HTMLInputElement>(null);

  const [enCours, setEnCours] = useState(false);
  const [sauvegardeAImporter, setSauvegardeAImporter] = useState<Sauvegarde | null>(null);
  const [validation, setValidation] = useState<ResultatValidation | null>(null);
  const [confirmerImport, setConfirmerImport] = useState(false);
  const [confirmerEffacement, setConfirmerEffacement] = useState(false);
  const [doubleConfirmation, setDoubleConfirmation] = useState(false);

  const rappel = fautIlRappelerSauvegarde(settings?.derniereSauvegarde ?? null);

  const exporter = async (format: 'json' | 'zip') => {
    setEnCours(true);
    try {
      const blob = format === 'zip' ? await exporterZip() : await exporterJson();
      telechargerBlob(blob, nomFichierSauvegarde(format));
      await recharger();
      toast.succes(
        format === 'zip'
          ? 'Sauvegarde complète exportée, PDF compris.'
          : 'Sauvegarde des données exportée.',
      );
    } catch (erreur) {
      toast.erreur(
        `Export impossible : ${erreur instanceof Error ? erreur.message : 'erreur inconnue'}`,
      );
    } finally {
      setEnCours(false);
    }
  };

  const choisirFichier = async (fichier: File) => {
    setEnCours(true);
    try {
      const estArchive = fichier.name.toLowerCase().endsWith('.zip');
      const resultat = estArchive
        ? await lireArchiveZip(fichier)
        : await lireFichierSauvegarde(fichier);
      setValidation(resultat.validation);
      setSauvegardeAImporter(resultat.sauvegarde);
    } finally {
      setEnCours(false);
    }
  };

  const importer = async () => {
    if (!sauvegardeAImporter) return;
    setEnCours(true);
    try {
      await restaurerSauvegarde(sauvegardeAImporter);
      await recharger();
      await rechargerClients();
      setConfirmerImport(false);
      setSauvegardeAImporter(null);
      setValidation(null);
      toast.succes('Sauvegarde restaurée.');
    } catch (erreur) {
      toast.erreur(
        `Restauration impossible : ${erreur instanceof Error ? erreur.message : 'erreur inconnue'}`,
      );
    } finally {
      setEnCours(false);
    }
  };

  const effacerTout = async () => {
    setEnCours(true);
    try {
      await effacerToutesLesDonnees();
      await recharger();
      await rechargerClients();
      setDoubleConfirmation(false);
      toast.succes('Toutes les données locales ont été effacées.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="space-y-3">
      {rappel ? (
        <Bandeau ton="attention">
          <span className="flex items-start gap-2">
            <IconeAlerte className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              {settings?.derniereSauvegarde
                ? 'Votre dernière sauvegarde date de plus de 15 jours.'
                : 'Aucune sauvegarde n’a encore été faite.'}{' '}
              Vos données ne vivent que sur cet appareil : exportez une sauvegarde et gardez-la
              ailleurs que sur le téléphone.
            </span>
          </span>
        </Bandeau>
      ) : (
        <Bandeau ton="succes">
          Dernière sauvegarde :{' '}
          {settings?.derniereSauvegarde
            ? new Date(settings.derniereSauvegarde).toLocaleString('fr-FR')
            : '—'}
        </Bandeau>
      )}

      <Carte className="space-y-3">
        <div className="flex items-start gap-2">
          <IconeSauvegarde className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Sauvegarde complète (ZIP)
            </p>
            <p className="texte-muet">
              Contient vos données et tous vos PDF. C’est le format à conserver.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Bouton
            variante="primaire"
            chargement={enCours}
            onClick={() => void exporter('zip')}
            icone={<IconeSauvegarde className="h-4 w-4" />}
          >
            Exporter la sauvegarde
          </Bouton>
          <Bouton variante="secondaire" onClick={() => void exporter('json')} disabled={enCours}>
            Export JSON seul
          </Bouton>
          <Bouton variante="secondaire" onClick={() => champFichier.current?.click()} disabled={enCours}>
            Restaurer un fichier
          </Bouton>
        </div>
        <input
          ref={champFichier}
          type="file"
          accept=".json,.zip,application/json,application/zip"
          className="hidden"
          onChange={(evenement) => {
            const fichier = evenement.target.files?.[0];
            if (fichier) void choisirFichier(fichier);
            evenement.target.value = '';
          }}
        />
        <p className="aide-champ">
          La restauration ÉCRASE toutes les données présentes sur cet appareil. Un aperçu du
          contenu vous est présenté avant confirmation.
        </p>
      </Carte>

      <Carte className="space-y-3 border-red-200 dark:border-red-900">
        <p className="text-sm font-semibold text-red-700 dark:text-red-300">
          Effacer toutes les données
        </p>
        <p className="texte-muet">
          Supprime définitivement réglages, clients, bons de commande, factures et PDF de cet
          appareil. Pensez à exporter une sauvegarde avant.
        </p>
        <Bouton
          variante="danger"
          onClick={() => setConfirmerEffacement(true)}
          disabled={enCours}
        >
          Effacer toutes les données
        </Bouton>
      </Carte>

      <Modale
        ouverte={validation !== null}
        titre="Contenu de la sauvegarde"
        onFermer={() => {
          setValidation(null);
          setSauvegardeAImporter(null);
        }}
        actions={
          <>
            <Bouton
              variante="secondaire"
              onClick={() => {
                setValidation(null);
                setSauvegardeAImporter(null);
              }}
            >
              Annuler
            </Bouton>
            <Bouton
              variante="danger"
              disabled={!validation?.valide}
              onClick={() => setConfirmerImport(true)}
            >
              Restaurer ces données
            </Bouton>
          </>
        }
      >
        {validation ? (
          validation.valide ? (
            <div className="space-y-2 text-sm">
              <Bandeau ton="attention" titre="Cette opération remplacera vos données actuelles.">
                Vérifiez le contenu avant de continuer.
              </Bandeau>
              <ul className="list-inside list-disc text-slate-600 dark:text-slate-300">
                <li>{validation.resume?.clients ?? 0} client(s)</li>
                <li>{validation.resume?.bons ?? 0} bon(s) de commande</li>
                <li>{validation.resume?.factures ?? 0} facture(s)</li>
                <li>{validation.resume?.documents ?? 0} document(s) de chauffeur</li>
              </ul>
            </div>
          ) : (
            <Bandeau ton="danger" titre="Fichier refusé">
              <ul className="mt-1 list-inside list-disc">
                {validation.erreurs.map((erreur) => (
                  <li key={erreur}>{erreur}</li>
                ))}
              </ul>
            </Bandeau>
          )
        ) : null}
      </Modale>

      <DialogueConfirmation
        ouverte={confirmerImport}
        titre="Remplacer toutes les données ?"
        message="Vos réglages, clients, bons et factures actuels seront définitivement remplacés par le contenu de la sauvegarde. Cette action est irréversible."
        libelleConfirmer="Oui, remplacer"
        danger
        onConfirmer={() => void importer()}
        onAnnuler={() => setConfirmerImport(false)}
      />

      <DialogueConfirmation
        ouverte={confirmerEffacement}
        titre="Effacer toutes les données ?"
        message="Toutes vos données locales seront supprimées. Sans sauvegarde préalable, elles seront définitivement perdues."
        libelleConfirmer="Continuer"
        danger
        onConfirmer={() => {
          setConfirmerEffacement(false);
          setDoubleConfirmation(true);
        }}
        onAnnuler={() => setConfirmerEffacement(false)}
      />

      <DialogueConfirmation
        ouverte={doubleConfirmation}
        titre="Confirmation définitive"
        message="Dernière vérification : avez-vous exporté une sauvegarde ? Cette suppression ne pourra pas être annulée."
        libelleConfirmer="Effacer définitivement"
        danger
        onConfirmer={() => void effacerTout()}
        onAnnuler={() => setDoubleConfirmation(false)}
      />
    </div>
  );
}
