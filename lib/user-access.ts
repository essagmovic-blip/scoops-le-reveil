import { units, type UnitId } from '@/lib/data';

/**
 * Droits opérationnels disponibles par unité.
 * Un droit appartient à une unité précise et les droits d'un profil sont
 * toujours calculés à partir de sa liste allowedUnits.
 */
export const UNIT_ACCESS_OPTIONS: Record<UnitId, readonly string[]> = {
  poulets: [
    'Tableau de bord',
    'Bandes',
    'Bâtiments',
    'Suivi quotidien',
    'Santé et traitement',
    'Articles de la ferme',
    'Ventes & factures',
    'Dépenses ferme',
    'Caisse & comptabilité',
    'Comptabilité',
    'Rapports',
    'Transferts internes',
    'Mouvements inter-unités',
    'Messagerie privée',
    'Paramètres',
    'Clients',
    'Fournisseurs',
    'Articles confiés',
    'Achats',
    'Statistiques',

    'Tâches quotidiennes',
    'Commandes inter-unités',

    'Commandes clients',
    'Livreur',
    'Courriers confidentiels',
    'Poulets morts',  ],
  chevrerie: [
    'Tableau de bord',
    'Animaux',
    'Reproduction',
    'Santé du cheptel',
    'Alimentation & rations',
    'Productions',
    'Stock produits',
    'Mouvements inter-unités',
    'Messagerie privée',
    'Factures chèvrerie',
    'Dépenses chèvrerie',
    'Caisse chèvrerie',
    'Comptabilité chèvrerie',
    'Rapports chèvrerie',
    'Paramètres',
    'Clients',
    'Fournisseurs',
    'Articles confiés',
    'Achats',
    'Statistiques',

    'Tâches quotidiennes',
    'Commandes inter-unités',
    'Gestion des caisses',

    'Commandes clients',
    'Livreur',
    'Courriers confidentiels',  ],
  provenderie: [
    'Tableau de bord',
    'Recettes',
    'Matières premières',
    'Productions',
    'Stock aliments finis',
    'Mouvements inter-unités',
    'Factures provenderie',
    'Dépenses provenderie',
    'Caisse provenderie',
    'Comptabilité provenderie',
    'Rapports provenderie',
    'Paramètres',
    'Clients',
    'Fournisseurs',
    'Articles confiés',
    'Achats',
    'Statistiques',

    'Tâches quotidiennes',
    'Commandes inter-unités',
    'Gestion des caisses',

    'Commandes clients',
    'Livreur',
    'Courriers confidentiels',  ],
  bio: [
    'Tableau de bord',
    'Préparations bio',
    'Plantes naturelles',
    'Productions',
    'Stock produits bio',
    'Mouvements inter-unités',
    'Factures produits bio',
    'Dépenses produits bio',
    'Caisse produits bio',
    'Comptabilité produits bio',
    'Rapports produits bio',
    'Paramètres',
    'Clients',
    'Fournisseurs',
    'Articles confiés',
    'Achats',
    'Statistiques',

    'Tâches quotidiennes',
    'Commandes inter-unités',
    'Gestion des caisses',

    'Commandes clients',
    'Livreur',
    'Courriers confidentiels',  ],
  pressoir: [
    'Tableau de bord',
    'Recettes de pressage',
    'Graines à presser',
    'Lots de pressage',
    'Stock huile et tourteaux',
    'Mouvements inter-unités',
    'Factures pressoir',
    'Dépenses pressoir',
    'Caisse pressoir',
    'Comptabilité pressoir',
    'Rapports pressoir',
    'Paramètres',
    'Clients',
    'Fournisseurs',
    'Articles confiés',
    'Achats',
    'Statistiques',

    'Tâches quotidiennes',
    'Commandes inter-unités',
    'Gestion des caisses',

    'Commandes clients',
    'Livreur',
    'Courriers confidentiels',  ],
  stocks: [
    'Tableau de bord',
    'Stock central',
    'Machines agricoles',
    'Mouvements magasin',
    'Mouvements inter-unités',
    'Inventaire général',
    'Factures magasin',
    'Dépenses magasin',
    'Caisse magasin',
    'Comptabilité magasin',
    'Rapports magasin',
    'Paramètres',
    'Clients',
    'Fournisseurs',
    'Articles confiés',
    'Achats',
    'Statistiques',

    'Tâches quotidiennes',
    'Commandes inter-unités',
    'Gestion des caisses',

    'Commandes clients',
    'Livreur',
    'Courriers confidentiels',  ],
  rh: [
    'Tableau de bord RH',
    'Personnel',
    'Présences',
    'Congés & permissions',
    'Paie & paiements',
    'Documents administratifs',
    'Rapports RH',
    'Messagerie privée',
    'Paramètres',
    'Clients',
    'Fournisseurs',
    'Articles confiés',
    'Achats',
    'Statistiques',

    'Courriers confidentiels',
    'Messages de contact',
    'Santé et traitement',
    'Poulets morts',  ],
};

const unitByValue = new Map<string, UnitId>(
  units.flatMap((unit) => [
    [unit.id.toLowerCase(), unit.id],
    [unit.label.toLowerCase(), unit.id],
    [unit.shortLabel.toLowerCase(), unit.id],
  ]),
);

export function unitIdFromValue(value: string | null | undefined): UnitId | null {
  if (!value) return null;
  return unitByValue.get(value.trim().toLowerCase()) ?? null;
}

export function unitLabelFromValue(value: string | null | undefined): string {
  const id = unitIdFromValue(value);
  return units.find((unit) => unit.id === id)?.label ?? value?.trim() ?? '';
}

export function unitLabelsFromIds(allowedUnits: readonly string[] | null | undefined): string[] {
  return normalizeAllowedUnits(allowedUnits).map((unitId) => units.find((unit) => unit.id === unitId)?.label ?? unitId);
}

/** Normalise une simple liste d'unités autorisées, sans unité principale. */
export function normalizeAllowedUnits(allowedUnits: readonly string[] | null | undefined): UnitId[] {
  return Array.from(new Set((allowedUnits ?? []).map(unitIdFromValue).filter((value): value is UnitId => value !== null)));
}

export function accessOptionsForUnits(allowedUnits: readonly string[] | null | undefined): string[] {
  const normalizedUnits = normalizeAllowedUnits(allowedUnits);
  return Array.from(new Set(normalizedUnits.flatMap((unitId) => UNIT_ACCESS_OPTIONS[unitId])));
}

/** Nettoie les droits existants pour les unités autorisées du profil. */
export function sanitizeAccess(allowedUnits: readonly string[] | null | undefined, access: readonly string[] | null | undefined): string[] {
  const normalizedUnits = normalizeAllowedUnits(allowedUnits);
  const allowed = new Set(accessOptionsForUnits(normalizedUnits));
  const hasPoultryAccess = normalizedUnits.includes('poulets');
  const migrated = (access ?? []).map((item) => item === 'DAGO' ? 'Poulets morts' : item === 'Santé & biosécurité' || item === 'Santé et biosécurité' ? 'Santé et traitement' : item === 'Préparation poussinière' ? 'Préparation de la salle' : hasPoultryAccess && (item === 'Stock de la ferme' || item === 'Gestion des caisses') ? 'Articles de la ferme' : item);
  return Array.from(new Set(migrated.filter((item) => allowed.has(item))));
}

export function normalizeUserPermissions(allowedUnits: readonly string[] | null | undefined, access: readonly string[] | null | undefined) {
  const normalizedAllowedUnits = normalizeAllowedUnits(allowedUnits);
  return {
    allowedUnits: normalizedAllowedUnits,
    access: sanitizeAccess(normalizedAllowedUnits, access),
  };
}

export function unitIdsFromUser(allowedUnits: readonly string[] | null | undefined): UnitId[] {
  return normalizeAllowedUnits(allowedUnits);
}

export function hasSharedUnit(first: { allowedUnits?: readonly string[] | null }, second: { allowedUnits?: readonly string[] | null }): boolean {
  const firstUnits = new Set(unitIdsFromUser(first.allowedUnits));
  return unitIdsFromUser(second.allowedUnits).some((unitId) => firstUnits.has(unitId));
}
