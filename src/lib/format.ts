/**
 * Formatage et calculs de dates, en français.
 *
 * ATTENTION : les dates sont manipulées en heure LOCALE, jamais via `toISOString()`,
 * qui convertit en UTC et peut décaler d'un jour selon le fuseau. Une date de
 * réservation fausse d'un jour rendrait le justificatif incohérent.
 */

import type {
  ModePaiement,
  StatutBon,
  StatutFacture,
  TypeClient,
  TypePrestation,
} from '../types';

const JOUR_EN_MS = 86_400_000;

/** Date du jour au format AAAA-MM-JJ, en heure locale. */
export function dateLocaleISO(reference: Date = new Date()): string {
  const annee = reference.getFullYear();
  const mois = String(reference.getMonth() + 1).padStart(2, '0');
  const jour = String(reference.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

/** Heure courante au format HH:mm, en heure locale. */
export function heureLocale(reference: Date = new Date()): string {
  const heures = String(reference.getHours()).padStart(2, '0');
  const minutes = String(reference.getMinutes()).padStart(2, '0');
  return `${heures}:${minutes}`;
}

/** AAAA-MM-JJ -> JJ/MM/AAAA */
export function formatDate(dateISO: string): string {
  if (!dateISO) return '—';
  const [annee, mois, jour] = dateISO.split('-');
  if (!annee || !mois || !jour) return dateISO;
  return `${jour}/${mois}/${annee}`;
}

export function formatDateHeure(dateISO: string, heure: string): string {
  if (!dateISO) return '—';
  return `${formatDate(dateISO)}${heure ? ` à ${heure}` : ''}`;
}

/** Convertit une date et une heure locales en horodatage. Renvoie null si la date est vide. */
export function horodatage(dateISO: string, heure: string): number | null {
  if (!dateISO) return null;
  const [annee, mois, jour] = dateISO.split('-').map(Number);
  if (!annee || !mois || !jour) return null;
  const [heures, minutes] = (heure || '00:00').split(':').map(Number);
  return new Date(annee, mois - 1, jour, heures || 0, minutes || 0, 0, 0).getTime();
}

/** Nombre de jours entre une date et une référence (négatif si la date est passée). */
export function joursRestants(dateISO: string, reference: Date = new Date()): number | null {
  if (!dateISO) return null;
  const [annee, mois, jour] = dateISO.split('-').map(Number);
  if (!annee || !mois || !jour) return null;
  const cible = new Date(annee, mois - 1, jour).getTime();
  const ref = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  return Math.round((cible - ref) / JOUR_EN_MS);
}

/** Ajoute (ou retire) des jours à une date AAAA-MM-JJ. */
export function ajouterJours(dateISO: string, nombre: number): string {
  const [annee, mois, jour] = dateISO.split('-').map(Number);
  if (!annee || !mois || !jour) return dateISO;
  const date = new Date(annee, mois - 1, jour);
  date.setDate(date.getDate() + nombre);
  return dateLocaleISO(date);
}

export function libelleStatutBon(statut: StatutBon): string {
  const libelles: Record<StatutBon, string> = {
    brouillon: 'Brouillon',
    emis: 'Émis',
    annule: 'Annulé',
    facture: 'Facturé',
  };
  return libelles[statut];
}

export function libelleStatutFacture(statut: StatutFacture): string {
  const libelles: Record<StatutFacture, string> = {
    emise: 'Émise',
    payee: 'Payée',
    en_retard: 'En retard',
    annulee: 'Annulée',
  };
  return libelles[statut];
}

export function libelleTypePrestation(type: TypePrestation): string {
  const libelles: Record<TypePrestation, string> = {
    course_simple: 'Course simple',
    transfert_aeroport: 'Transfert aéroport',
    transfert_gare: 'Transfert gare',
    mise_a_disposition: 'Mise à disposition',
    excursion: 'Excursion / longue distance',
    forfait: 'Forfait',
  };
  return libelles[type];
}

export function libelleModePaiement(mode: ModePaiement): string {
  const libelles: Record<ModePaiement, string> = {
    especes: 'Espèces',
    cb: 'Carte bancaire',
    virement: 'Virement',
    plateforme: 'Plateforme',
    facture: 'Facturé',
    autre: 'Autre',
  };
  return libelles[mode];
}

export function libelleTypeClient(type: TypeClient): string {
  return type === 'professionnel' ? 'Professionnel' : 'Particulier';
}

export function formatKilometres(km: number | null): string {
  if (km == null) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(km)} km`;
}

export function libelleTaux(taux: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(taux)} %`;
}
