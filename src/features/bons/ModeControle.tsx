/**
 * MODE CONTRÔLE.
 *
 * Écran plein écran, hors du gabarit de navigation, destiné à être tendu à un agent
 * lors d'un contrôle routier. Trois principes :
 *
 *  1. UN SEUL bon est affiché. Un justificatif ne vaut que s'il ne divulgue que la course
 *     concernée : jamais de liste de courses, jamais d'autre nom, jamais d'autre téléphone.
 *  2. Les 7 mentions de l'arrêté du 6 août 2025 sont regroupées, numérotées et libellées
 *     explicitement, pour qu'un agent les trouve en quelques secondes.
 *  3. Contraste maximal sur fond clair, gros caractères : l'écran doit rester lisible en
 *     plein soleil, et ne dépend d'aucun appel réseau.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../lib/db';
import { useReglages } from '../../context/ReglagesContext';
import { Bouton } from '../../components/ui/Bouton';
import { IconeBouclier, IconeCroix, IconePartager } from '../../components/icons';
import { MENTIONS_ARRETE_2025 } from '../../lib/mentions';
import { construireMentionsJustificatif } from '../../lib/pdf/documentData';
import { snapshotEmetteur } from '../../lib/snapshots';
import { partagerPdf } from '../../lib/pdf/generate';
import { formatDate, joursRestants } from '../../lib/format';
import type { Bon, DocumentChauffeur } from '../../types';

export function ModeControle() {
  const { bonId = '' } = useParams();
  const navigate = useNavigate();
  const { settings } = useReglages();
  const [bon, setBon] = useState<Bon | null>(null);
  const [documents, setDocuments] = useState<DocumentChauffeur[]>([]);
  const [voirAssurances, setVoirAssurances] = useState(false);

  const charger = useCallback(async () => {
    const [charge, docs] = await Promise.all([
      db.bons.get(bonId),
      db.documentsChauffeur.orderBy('ordre').toArray(),
    ]);
    setBon(charge ?? null);
    setDocuments(
      docs.filter((document) =>
        /assurance|carte professionnelle|permis|macaron|contrôle technique|revtc/i.test(
          document.libelle,
        ),
      ),
    );
  }, [bonId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  useEffect(() => {
    const surTouche = (evenement: KeyboardEvent) => {
      if (evenement.key === 'Escape') navigate(-1);
    };
    document.addEventListener('keydown', surTouche);
    return () => document.removeEventListener('keydown', surTouche);
  }, [navigate]);

  if (!bon || !settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6 text-slate-900">
        <div className="text-center">
          <p className="text-lg font-semibold">Justificatif introuvable.</p>
          <Bouton className="mt-4" onClick={() => navigate('/bons')}>
            Revenir
          </Bouton>
        </div>
      </div>
    );
  }

  const mentions = construireMentionsJustificatif(
    bon,
    bon.emetteurSnapshot ?? snapshotEmetteur(settings),
    bon.clientSnapshot,
  );

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-slate-900 bg-white px-4 py-3">
        <span className="text-sm font-bold uppercase tracking-wide text-slate-500">
          Mode contrôle
        </span>
        <div className="flex gap-2">
          {bon.pdfBlob ? (
            <Bouton
              petit
              variante="secondaire"
              icone={<IconePartager className="h-4 w-4" />}
              onClick={() =>
                void partagerPdf(bon.pdfBlob!, `bon-${bon.numero ?? bon.id}.pdf`, 'Bon de commande')
              }
            >
              PDF
            </Bouton>
          ) : null}
          <Bouton
            petit
            variante="secondaire"
            icone={<IconeCroix className="h-4 w-4" />}
            onClick={() => navigate(-1)}
          >
            Quitter
          </Bouton>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-5">
        <header>
          <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Justificatif de réservation préalable
          </p>
          <p className="text-2xl font-bold">{bon.numero ?? 'Brouillon'}</p>
          <p className="text-sm text-slate-500">
            Arrêté du 6 août 2025 — art. L. 3120-2 du Code des transports
          </p>
        </header>

        <section className="rounded-2xl border-2 border-slate-900 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Lieu de prise en charge
          </p>
          <p className="mt-1 text-3xl font-bold leading-tight">{bon.lieuPriseEnCharge || '—'}</p>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-slate-300 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Réservation enregistrée le
            </p>
            <p className="mt-1 text-2xl font-bold">
              {formatDate(bon.dateReservation)} à {bon.heureReservation}
            </p>
          </div>
          <div className="rounded-2xl border-2 border-slate-300 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Prise en charge souhaitée
            </p>
            <p className="mt-1 text-2xl font-bold">
              {formatDate(bon.datePriseEnCharge)} à {bon.heurePriseEnCharge}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border-2 border-slate-300 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Client</p>
          <p className="mt-1 text-2xl font-bold">
            {bon.clientSnapshot?.nom ?? '—'}
          </p>
          <p className="text-xl">{bon.clientSnapshot?.telephone ?? '—'}</p>
        </section>

        <section className="rounded-2xl border-2 border-slate-900 p-4">
          <h2 className="text-sm font-bold uppercase tracking-wide">
            Justificatif de réservation préalable — arrêté du 6 août 2025
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Les 7 mentions obligatoires prévues par l’article 1er, applicables depuis le
            29 octobre 2025.
          </p>
          <ol className="mt-3 space-y-3">
            {mentions.map((mention) => (
              <li key={mention.numero} className="flex gap-3">
                <span className="w-8 shrink-0 text-xl font-bold text-slate-400">
                  {mention.numero}°
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-slate-500">
                    {MENTIONS_ARRETE_2025[mention.numero - 1]}
                  </span>
                  <span className="block text-xl font-bold leading-snug">
                    {mention.valeur || '— non renseigné —'}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border-2 border-slate-300 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Véhicule et conducteur
          </p>
          <p className="mt-1 text-xl font-bold">
            {[bon.vehiculeMarque, bon.vehiculeModele].filter(Boolean).join(' ') || '—'}
          </p>
          <p className="text-xl">{bon.vehiculeImmatriculation || '—'}</p>
          <p className="text-sm text-slate-500">
            Conducteur : {bon.nomConducteur || bon.emetteurSnapshot?.raisonSociale || '—'}
          </p>
        </section>

        <section className="rounded-2xl border-2 border-slate-300 p-4">
          <button
            type="button"
            onClick={() => setVoirAssurances((valeur) => !valeur)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="flex items-center gap-2">
              <IconeBouclier className="h-6 w-6" />
              <span className="text-lg font-bold">Assurances et carte professionnelle</span>
            </span>
            <span className="text-sm text-slate-500">{voirAssurances ? 'Masquer' : 'Afficher'}</span>
          </button>
          {voirAssurances ? (
            documents.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Aucun document suivi pour l’instant. Ajoutez-les dans Réglages → Documents du
                chauffeur.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {documents.map((document) => {
                  const jours = joursRestants(document.dateExpiration);
                  const expire = jours !== null && jours < 0;
                  return (
                    <li key={document.id} className="border-b border-slate-200 pb-2 last:border-0">
                      <p className="font-semibold">{document.libelle}</p>
                      <p className="text-sm text-slate-600">
                        {document.numero ? `N° ${document.numero} · ` : ''}
                        {document.dateExpiration
                          ? `Valable jusqu’au ${formatDate(document.dateExpiration)}`
                          : 'Aucune date renseignée'}
                      </p>
                      {expire ? (
                        <p className="text-sm font-bold text-red-700">
                          Document expiré depuis {Math.abs(jours!)} jour(s)
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )
          ) : null}
        </section>

        <p className="pb-8 text-xs text-slate-500">
          Ce justificatif doit être conservé avec la facture de la course. En cas de contrôle,
          l’absence de justificatif conforme expose à la contravention de 5ᵉ classe prévue à
          l’article R. 3124-11 du Code des transports.
        </p>
      </div>
    </div>
  );
}
