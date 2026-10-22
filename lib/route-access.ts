import { units, type UnitId } from '@/lib/data';

const unitPrefixes: Array<[string, UnitId]> = [
  ['/stocks/attributions/poulets', 'poulets'],
  ['/stocks/attributions/chevrerie', 'chevrerie'],
  ['/stocks/attributions/provenderie', 'provenderie'],
  ['/stocks/attributions/bio', 'bio'],
  ['/stocks/attributions/pressoir', 'pressoir'],
  ['/stocks/attributions/stocks', 'stocks'],
  ['/stocks/caisses', 'poulets'],
  ['/stocks/ferme', 'poulets'],
  ['/caisse/ferme', 'poulets'],
  ['/comptabilite/ferme', 'poulets'],
  ['/stocks/central', 'stocks'],
  ['/stocks/machines', 'stocks'],
  ['/stocks/mouvements', 'stocks'],
  ['/stocks/inventaire', 'stocks'],
  ['/stocks', 'stocks'],
  ['/poulets/poussiniere', 'poulets'],
  ['/poulets', 'poulets'],
  ['/chevrerie', 'chevrerie'],
  ['/provenderie', 'provenderie'],
  ['/produits-bio', 'bio'],
  ['/pressoir', 'pressoir'],
  ['/rh', 'rh'],
  ['/clients/poulets', 'poulets'],
  ['/clients/chevrerie', 'chevrerie'],
  ['/clients/provenderie', 'provenderie'],
  ['/clients/bio', 'bio'],
  ['/clients/pressoir', 'pressoir'],
  ['/clients/stocks', 'stocks'],
  ['/clients/rh', 'rh'],
  ['/fournisseurs/poulets', 'poulets'],
  ['/fournisseurs/chevrerie', 'chevrerie'],
  ['/fournisseurs/provenderie', 'provenderie'],
  ['/fournisseurs/bio', 'bio'],
  ['/fournisseurs/pressoir', 'pressoir'],
  ['/fournisseurs/stocks', 'stocks'],
  ['/fournisseurs/rh', 'rh'],
  ['/chat/poulets', 'poulets'],
  ['/chat/chevrerie', 'chevrerie'],
  ['/chat/provenderie', 'provenderie'],
  ['/chat/bio', 'bio'],
  ['/chat/pressoir', 'pressoir'],
  ['/chat/stocks', 'stocks'],
  ['/chat/rh', 'rh'],
  ['/mouvements/commandes/poulets', 'poulets'],
  ['/mouvements/commandes/chevrerie', 'chevrerie'],
  ['/mouvements/commandes/provenderie', 'provenderie'],
  ['/mouvements/commandes/bio', 'bio'],
  ['/mouvements/commandes/pressoir', 'pressoir'],
  ['/mouvements/commandes/stocks', 'stocks'],
  ['/mouvements/ferme', 'poulets'],
  ['/mouvements/chevrerie', 'chevrerie'],
  ['/mouvements/provenderie', 'provenderie'],
  ['/mouvements/bio', 'bio'],
  ['/mouvements/pressoir', 'pressoir'],
  ['/mouvements/stocks', 'stocks'],
  ['/mouvements/rh', 'rh'],
  ['/factures/ferme', 'poulets'],
  ['/factures/chevrerie', 'chevrerie'],
  ['/factures/provenderie', 'provenderie'],
  ['/factures/bio', 'bio'],
  ['/factures/pressoir', 'pressoir'],
  ['/factures/stocks', 'stocks'],
  ['/factures/rh', 'rh'],
  ['/depenses/ferme', 'poulets'],
  ['/depenses/chevrerie', 'chevrerie'],
  ['/depenses/provenderie', 'provenderie'],
  ['/depenses/bio', 'bio'],
  ['/depenses/pressoir', 'pressoir'],
  ['/depenses/stocks', 'stocks'],
  ['/depenses/rh', 'rh'],
  ['/caisse/provenderie', 'provenderie'],
  ['/caisse/chevrerie', 'chevrerie'],
  ['/caisse/bio', 'bio'],
  ['/caisse/pressoir', 'pressoir'],
  ['/caisse/stocks', 'stocks'],
  ['/caisse/rh', 'rh'],
  ['/comptabilite/provenderie', 'provenderie'],
  ['/comptabilite/chevrerie', 'chevrerie'],
  ['/comptabilite/bio', 'bio'],
  ['/comptabilite/pressoir', 'pressoir'],
  ['/comptabilite/stocks', 'stocks'],
  ['/comptabilite/rh', 'rh'],
  ['/rapports/ferme', 'poulets'],
  ['/rapports/chevrerie', 'chevrerie'],
  ['/rapports/provenderie', 'provenderie'],
  ['/rapports/bio', 'bio'],
  ['/rapports/pressoir', 'pressoir'],
  ['/rapports/stocks', 'stocks'],
  ['/rapports/rh', 'rh'],
  ['/parametres/ferme', 'poulets'],
  ['/parametres/chevrerie', 'chevrerie'],
  ['/parametres/provenderie', 'provenderie'],
  ['/parametres/bio', 'bio'],
  ['/parametres/pressoir', 'pressoir'],
  ['/parametres/stocks', 'stocks'],
  ['/parametres/rh', 'rh'],
];

export function unitFromPath(pathname: string): UnitId | undefined {
  const dashboardUnit = pathname.match(/^\/dashboard\/([^/]+)/)?.[1];
  if (dashboardUnit && units.some((unit) => unit.id === dashboardUnit)) return dashboardUnit as UnitId;
  return unitPrefixes.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1];
}

function dashboardAccess(unitId: UnitId) {
  return unitId === 'rh' ? 'Tableau de bord RH' : 'Tableau de bord';
}

function financeAccess(unitId: UnitId, kind: 'factures' | 'depenses' | 'caisse' | 'comptabilite' | 'rapports') {
  if (unitId === 'poulets') {
    return { factures: 'Ventes & factures', depenses: 'Dépenses ferme', caisse: 'Caisse & comptabilité', comptabilite: 'Comptabilité', rapports: 'Rapports' }[kind];
  }
  const names: Record<UnitId, Record<typeof kind, string>> = {
    poulets: { factures: 'Ventes & factures', depenses: 'Dépenses ferme', caisse: 'Caisse & comptabilité', comptabilite: 'Comptabilité', rapports: 'Rapports' },
    chevrerie: { factures: 'Factures chèvrerie', depenses: 'Dépenses chèvrerie', caisse: 'Caisse chèvrerie', comptabilite: 'Comptabilité chèvrerie', rapports: 'Rapports chèvrerie' },
    provenderie: { factures: 'Factures provenderie', depenses: 'Dépenses provenderie', caisse: 'Caisse provenderie', comptabilite: 'Comptabilité provenderie', rapports: 'Rapports provenderie' },
    bio: { factures: 'Factures produits bio', depenses: 'Dépenses produits bio', caisse: 'Caisse produits bio', comptabilite: 'Comptabilité produits bio', rapports: 'Rapports produits bio' },
    pressoir: { factures: 'Factures pressoir', depenses: 'Dépenses pressoir', caisse: 'Caisse pressoir', comptabilite: 'Comptabilité pressoir', rapports: 'Rapports pressoir' },
    stocks: { factures: 'Factures magasin', depenses: 'Dépenses magasin', caisse: 'Caisse magasin', comptabilite: 'Comptabilité magasin', rapports: 'Rapports magasin' },
    rh: { factures: 'Factures RH', depenses: 'Dépenses RH', caisse: 'Caisse RH', comptabilite: 'Comptabilité RH', rapports: 'Rapports RH' },
  };
  return names[unitId][kind];
}

/** Droits nécessaires à une route. Plusieurs valeurs signifient « l'une ou l'autre ». */
export function accessRequirementsForPath(pathname: string, unitId?: UnitId): string[] {
  if (pathname.startsWith('/rh/messages-contact')) return ['Messages de contact'];
  if (pathname.startsWith('/rh/taches')) return ['Personnel'];
  if (pathname.startsWith('/rh/rapports-service')) return ['Personnel', 'Rapports RH', 'Rapports'];
  if (pathname.startsWith('/rh/dago')) return ['Poulets morts', 'DAGO'];
  if (pathname.startsWith('/rh/sante')) return ['Santé et traitement'];
  if (pathname.startsWith('/poulets/dago')) return ['Poulets morts', 'DAGO'];
  if (pathname.startsWith('/commandes-clients/scanner')) return ['Commandes clients', 'Livreur'];
  if (pathname === '/commandes-clients' || pathname.startsWith('/commandes-clients/')) return ['Commandes clients'];
  if (pathname === '/courriers-confidentiels' || pathname.startsWith('/courriers-confidentiels/')) return ['Courriers confidentiels'];
  if ((unitId && pathname.startsWith(`/${unitId}/taches`)) || pathname.startsWith('/provenderie/taches') || pathname.startsWith('/produits-bio/taches') || pathname.startsWith('/pressoir/taches') || pathname.startsWith('/chevrerie/taches')) return ['Tâches quotidiennes'];
  if (pathname.startsWith('/mouvements/commandes')) return ['Commandes inter-unités'];
  if (pathname.startsWith('/stocks/caisses')) return ['Articles de la ferme', 'Gestion des caisses'];
  if (pathname === '/achats' || pathname.startsWith('/achats/')) return ['Achats'];
  if (pathname.startsWith('/parametres')) return ['Paramètres'];
  if (pathname.startsWith('/chat')) return ['Messagerie privée'];
  if (pathname.startsWith('/clients')) return ['Clients'];
  if (pathname.startsWith('/fournisseurs')) return ['Fournisseurs'];

  if (pathname.startsWith('/factures')) return unitId ? [financeAccess(unitId, 'factures')] : ['Ventes & factures', ...units.map((unit) => financeAccess(unit.id, 'factures'))];
  if (pathname.startsWith('/depenses')) return unitId ? [financeAccess(unitId, 'depenses')] : units.map((unit) => financeAccess(unit.id, 'depenses'));
  if (pathname.startsWith('/caisse')) return unitId ? [financeAccess(unitId, 'caisse')] : units.map((unit) => financeAccess(unit.id, 'caisse'));
  if (pathname.startsWith('/comptabilite')) return unitId ? [financeAccess(unitId, 'comptabilite')] : units.map((unit) => financeAccess(unit.id, 'comptabilite'));
  if (pathname.startsWith('/rapports')) return unitId ? [financeAccess(unitId, 'rapports')] : units.map((unit) => financeAccess(unit.id, 'rapports'));

  if (pathname.startsWith('/mouvements')) return ['Mouvements inter-unités'];
  if (pathname.startsWith('/stocks/attributions')) return ['Articles confiés'];
  if (pathname.startsWith('/stocks')) {
    if (unitId === 'poulets') return ['Articles de la ferme'];
    if (unitId === 'stocks') return ['Stock central'];
    return ['Stock central', 'Articles de la ferme', 'Stock produits', 'Stock aliments finis', 'Stock huile et tourteaux'];
  }

  if (unitId) {
    if (pathname === `/dashboard/${unitId}` || pathname === `/${unitId}`) return [dashboardAccess(unitId)];
    if (unitId === 'poulets') {
      if (pathname.startsWith('/poulets/poussiniere')) return ['Préparation de la salle'];
      if (pathname.startsWith('/poulets/batiments')) return ['Bâtiments'];
      if (pathname.startsWith('/poulets/suivi')) return ['Suivi quotidien'];
      if (pathname.startsWith('/poulets/sante')) return ['Santé et traitement'];
      if (pathname.startsWith('/poulets/statistiques')) return ['Statistiques', 'Rapports'];
      if (pathname.startsWith('/poulets/transferts')) return ['Transferts internes'];
      if (pathname.startsWith('/poulets/bandes') || /^\/poulets\/[^/]+/.test(pathname)) return ['Bandes'];
    }
    if (unitId === 'chevrerie') {
      if (pathname.startsWith('/chevrerie/animaux')) return ['Animaux'];
      if (pathname.startsWith('/chevrerie/reproduction')) return ['Reproduction'];
      if (pathname.startsWith('/chevrerie/sante')) return ['Santé du cheptel'];
      if (pathname.startsWith('/chevrerie/alimentation') || pathname.startsWith('/chevrerie/rations')) return ['Alimentation & rations'];
      if (pathname.startsWith('/chevrerie/productions')) return ['Productions'];
      if (pathname.startsWith('/chevrerie/stocks')) return ['Stock produits'];
      if (pathname.startsWith('/chevrerie/transferts')) return ['Mouvements inter-unités'];
    }
    if (unitId === 'provenderie') {
      if (pathname.startsWith('/provenderie/recettes')) return ['Recettes'];
      if (pathname.startsWith('/provenderie/matieres')) return ['Matières premières'];
      if (pathname.startsWith('/provenderie/productions')) return ['Productions'];
      if (pathname.startsWith('/provenderie/stocks')) return ['Stock aliments finis'];
      if (pathname.startsWith('/provenderie/transferts')) return ['Mouvements inter-unités'];
    }
    if (unitId === 'bio') {
      if (pathname.startsWith('/produits-bio/recettes')) return ['Préparations bio'];
      if (pathname.startsWith('/produits-bio/matieres')) return ['Plantes naturelles'];
      if (pathname.startsWith('/produits-bio/productions')) return ['Productions'];
      if (pathname.startsWith('/produits-bio/stocks')) return ['Stock produits bio'];
      if (pathname.startsWith('/produits-bio/transferts')) return ['Mouvements inter-unités'];
    }
    if (unitId === 'pressoir') {
      if (pathname.startsWith('/pressoir/recettes')) return ['Recettes de pressage'];
      if (pathname.startsWith('/pressoir/matieres')) return ['Graines à presser'];
      if (pathname.startsWith('/pressoir/productions')) return ['Lots de pressage'];
      if (pathname.startsWith('/pressoir/stocks')) return ['Stock huile et tourteaux'];
      if (pathname.startsWith('/pressoir/transferts')) return ['Mouvements inter-unités'];
    }
    if (unitId === 'rh') {
      if (pathname.startsWith('/rh/personnel')) return ['Personnel'];
      if (pathname.startsWith('/rh/presences')) return ['Présences'];
      if (pathname.startsWith('/rh/conges')) return ['Congés & permissions'];
      if (pathname.startsWith('/rh/paie')) return ['Paie & paiements'];
      if (pathname.startsWith('/rh/documents')) return ['Documents administratifs'];
    }
  }

  return [];
}

export function hasAccessToRequirements(access: readonly string[], requirements: readonly string[], role?: string) {
  if (requirements.length === 0) return true;
  const normalizedRole = role?.trim().toLowerCase() ?? '';
  const normalizedAccess = new Set(access.map((item) => item === 'Santé & biosécurité' || item === 'Santé et biosécurité' ? 'Santé et traitement' : item === 'Préparation poussinière' ? 'Préparation de la salle' : item === 'Stock de la ferme' || item === 'Gestion des caisses' ? 'Articles de la ferme' : item));
  return requirements.some((required) => normalizedAccess.has(required) || (required === 'Livreur' && normalizedRole.includes('livreur')));
}

export function canAccessPath(pathname: string, allowedUnits: readonly string[], access: readonly string[], admin: boolean, role?: string) {
  if (admin) return true;
  const unitId = unitFromPath(pathname);
  if (unitId && !allowedUnits.includes(unitId)) return false;
  return hasAccessToRequirements(access, accessRequirementsForPath(pathname, unitId), role);
}

export function accessForNavigation(href: string, activeUnitId?: UnitId) {
  return accessRequirementsForPath(href, unitFromPath(href) ?? activeUnitId);
}

export function unitForNavigation(href: string) {
  return unitFromPath(href);
}

