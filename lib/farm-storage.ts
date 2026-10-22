export const FARM_STORAGE_KEYS = {
  lots: 'agroflux-poultry-lots',
  buildings: 'agroflux-poultry-buildings',
  strains: 'agroflux-poultry-strains',
  daily: 'agroflux-poultry-daily',
  health: 'agroflux-poultry-health',
  sanitaryChecks: 'agroflux-poultry-sanitary-checks',
  dagoReports: 'agroflux-poultry-dago-reports',
  deadBirdStock: 'agroflux-poultry-dead-bird-stock',
  deadBirdStockMovements: 'agroflux-poultry-dead-bird-stock-movements',
  transfers: 'agroflux-poultry-transfers',
  archives: 'agroflux-poultry-archives',
  stock: 'agroflux-farm-stock',
  movements: 'agroflux-farm-movements',
  orders: 'agroflux-farm-orders',
  invoices: 'agroflux-invoices',
  expenses: 'agroflux-farm-expenses',
  unitExpenses: 'agroflux-unit-expenses',
  expenseCategories: 'agroflux-farm-expense-categories',
  stockCategories: 'agroflux-farm-categories',
  sales: 'agroflux-farm-sales',
  cashEntries: 'agroflux-farm-cash-entries',
  users: 'agroflux-managed-users',
  managedRoles: 'agroflux-managed-roles',
  currentUserRole: 'agroflux-current-user-role',
  adminUnits: 'agroflux-admin-units',
  notificationReads: 'agroflux-notification-reads',
  calculationVersion: 'agroflux-farm-calculation-version',
  feedRecipes: 'agroflux-provenderie-recipes',
  feedMaterials: 'agroflux-provenderie-materials',
  feedProductions: 'agroflux-provenderie-productions',
  feedFinishedStock: 'agroflux-provenderie-finished-stock',
  feedMovements: 'agroflux-provenderie-movements',
  bioRecipes: 'agroflux-bio-recipes',
  bioMaterials: 'agroflux-bio-materials',
  bioProductions: 'agroflux-bio-productions',
  bioFinishedStock: 'agroflux-bio-finished-stock',
  bioMovements: 'agroflux-bio-movements',
  pressRecipes: 'agroflux-pressoir-recipes',
  pressMaterials: 'agroflux-pressoir-materials',
  pressProductions: 'agroflux-pressoir-productions',
  pressFinishedStock: 'agroflux-pressoir-finished-stock',
  pressMovements: 'agroflux-pressoir-movements',
  goatAnimals: 'agroflux-chevrerie-animals',
  goatReproduction: 'agroflux-chevrerie-reproduction',
  goatHealth: 'agroflux-chevrerie-health',
  goatFeeding: 'agroflux-chevrerie-feeding',
  goatRations: 'agroflux-chevrerie-rations',
  goatProductions: 'agroflux-chevrerie-productions',
  goatFinishedStock: 'agroflux-chevrerie-finished-stock',
  goatMovements: 'agroflux-chevrerie-movements',
  unitClients: 'agroflux-unit-clients',
  unitSuppliers: 'agroflux-unit-suppliers',
  unitCommercialSettings: 'agroflux-unit-commercial-settings',
  stockCustodies: 'agroflux-stock-custodies',
  publicEvents: 'agroflux-public-events',
  publicPromoVideos: 'agroflux-public-promo-videos',
  publicSiteContent: 'agroflux-public-site-content',
  chatMessages: 'agroflux-chat-messages',
  rhEmployees: 'agroflux-rh-employees',
  rhAttendance: 'agroflux-rh-attendance',
  rhLeave: 'agroflux-rh-leave',
  rhPayroll: 'agroflux-rh-payroll',
  rhDocuments: 'agroflux-rh-documents',
  rhPersonnelRecords: 'agroflux-rh-personnel-records',
  rhSettings: 'agroflux-rh-settings',
  dailyTaskTemplates: 'agroflux-daily-task-templates',
  dailyTaskDeletedTemplates: 'agroflux-daily-task-deleted-templates',
  dailyTaskRoster: 'agroflux-daily-task-roster',
  dailyTaskInstances: 'agroflux-daily-task-instances',
  internalOrders: 'agroflux-internal-orders',
  customerOrders: 'agroflux-customer-orders',
  crateCustodies: 'agroflux-crate-custodies',
  crateNotifications: 'agroflux-crate-notifications',
  logisticsNotifications: 'agroflux-logistics-notifications',
  centralStock: 'agroflux-magasin-central-stock',
  centralMovements: 'agroflux-magasin-central-movements',
  centralCategories: 'agroflux-magasin-central-categories',
  centralOrders: 'agroflux-magasin-central-orders',
  interUnitMovements: 'agroflux-inter-unit-movements',
  activeUnit: 'agroflux-active-unit',
  nurserySettings: 'agroflux-poultry-nursery-settings',
  sanitarySettings: 'agroflux-poultry-sanitary-settings',
  poultryProtocols: 'agroflux-poultry-protocols',
  roomPreparations: 'agroflux-poultry-room-preparations',
  chickReceptions: 'agroflux-poultry-chick-receptions',
  poultryHandovers: 'agroflux-poultry-handovers',
  poultryHandoverStarts: 'agroflux-poultry-handover-starts',
  serviceReports: 'agroflux-service-reports',
  poultryFeedStock: 'agroflux-poultry-feed-stock',
  poultryFeedStockMovements: 'agroflux-poultry-feed-stock-movements',
  poultryCategoryAssignments: 'agroflux-poultry-category-assignments',
  poultrySubjectLocations: 'agroflux-poultry-subject-locations',
  poultrySubjectLocationMovements: 'agroflux-poultry-subject-location-movements',
} as const;

export type FarmStorageKey = (typeof FARM_STORAGE_KEYS)[keyof typeof FARM_STORAGE_KEYS];

export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocal<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('agroflux-data-updated', { detail: key }));
  } catch {
    // Le stockage local peut être indisponible en mode privé ou si le quota est atteint.
  }
}

/**
 * Abonnement aux changements locaux : CustomEvent pour le même onglet et
 * StorageEvent pour les autres onglets. Cela permet aux dashboards de rester
 * synchronisés sans réintroduire des données de démonstration.
 */
export function subscribeToFarmData(keys: readonly string[], onChange: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  const matches = (key: string | null) => key === null || keys.includes(key) || Boolean(key && keys.some((baseKey) => key.startsWith(`${baseKey}:`)));
  const handleCustom = (event: Event) => {
    const key = (event as CustomEvent<string>).detail;
    if (matches(key)) onChange();
  };
  const handleStorage = (event: StorageEvent) => {
    if (matches(event.key)) onChange();
  };
  window.addEventListener('agroflux-data-updated', handleCustom);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener('agroflux-data-updated', handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}
