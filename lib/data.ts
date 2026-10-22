export type InvoiceStatus = 'Payée' | 'Envoyée' | 'Brouillon' | 'En retard' | 'Impayée' | 'Partiellement payée';

export const units = [
  { id: 'poulets', label: 'Élevage de poulets bio', shortLabel: 'Poulets bio', color: '#9be789' },
  { id: 'provenderie', label: 'Provenderie', shortLabel: 'Provenderie', color: '#e9975c' },
  { id: 'bio', label: 'Produits bio', shortLabel: 'Produits bio', color: '#b99cde' },
  { id: 'pressoir', label: 'Pressoir à huile', shortLabel: 'Pressoir', color: '#f5cf67' },
  { id: 'stocks', label: 'Magasin central', shortLabel: 'Magasin', color: '#6f9fe8' },
  { id: 'chevrerie', label: 'Chèvrerie', shortLabel: 'Chèvrerie', color: '#9ab4a3' },
  { id: 'rh', label: 'RH & administration', shortLabel: 'RH', color: '#8b73b8' },
] as const;

export type UnitId = (typeof units)[number]['id'];

export type Invoice = {
  id: string;
  client: string;
  email: string;
  date: string;
  dueDate: string;
  amount: number;
  paid: number;
  status: InvoiceStatus;
  items: number;
  unit: UnitId;
  building?: string;
  paymentMethod?: string;
  customerType?: string;
  poultryCategory?: string;
  payments?: { date: string; amount: number; method: string }[];
  lines?: { id?: number; description: string; quantity: number; price?: number; unit: string; unitPrice?: number; total?: number }[];
  batchId?: string;
  deadBirdBatchId?: string;
  deadBirdStockId?: string;
  deadBirdQuantity?: number;
  saleType?: 'poulets-vivants' | 'poulets-morts' | string;
};

export const invoices: Invoice[] = [
  { id: 'FAC-2026-008', client: 'Hôtel La Falaise', email: 'achats@lafalaise.cm', date: '2026-08-09', dueDate: '2026-08-23', amount: 1845000, paid: 1845000, status: 'Payée', items: 3, unit: 'poulets', payments: [{ date: '2026-08-09T10:24:00', amount: 1845000, method: 'Mobile Money' }] },
  { id: 'FAC-2026-007', client: 'Ferme Nkolbisson', email: 'contact@nkolbisson.cm', date: '2026-08-07', dueDate: '2026-08-21', amount: 970000, paid: 485000, status: 'Partiellement payée', items: 2, unit: 'provenderie', payments: [{ date: '2026-08-07T14:05:00', amount: 485000, method: 'Virement bancaire' }] },
  { id: 'FAC-2026-006', client: 'Marché Central — Yaoundé', email: 'commerce@marche.cm', date: '2026-08-04', dueDate: '2026-08-11', amount: 625000, paid: 0, status: 'En retard', items: 1, unit: 'pressoir' },
  { id: 'FAC-2026-005', client: 'Coopérative Nsam', email: 'coop@nsam.cm', date: '2026-08-02', dueDate: '2026-08-16', amount: 1325000, paid: 0, status: 'Envoyée', items: 4, unit: 'bio' },
  { id: 'FAC-2026-004', client: 'Restaurant Le Safoutier', email: 'finance@safoutier.cm', date: '2026-07-29', dueDate: '2026-08-12', amount: 785000, paid: 0, status: 'Envoyée', items: 2, unit: 'poulets' },
  { id: 'FAC-2026-003', client: 'Agro Services Mfoundi', email: 'hello@agroservices.cm', date: '2026-07-25', dueDate: '2026-08-08', amount: 430000, paid: 430000, status: 'Payée', items: 1, unit: 'provenderie' },
  { id: 'FAC-2026-002', client: 'Éleveurs Réunis', email: 'admin@eleveursreunis.cm', date: '2026-07-20', dueDate: '2026-08-03', amount: 2280000, paid: 0, status: 'En retard', items: 5, unit: 'bio' },
  { id: 'FAC-2026-001', client: 'Brasserie du Centre', email: 'commandes@brasserie.cm', date: '2026-07-16', dueDate: '2026-07-30', amount: 560000, paid: 560000, status: 'Payée', items: 2, unit: 'pressoir' },
];

export const poultryLots = [
  { id: 'LP-26-004', name: 'Lot Ross 308 — Bâtiment A', start: '2026-07-24', initial: 1200, alive: 1158, age: 18, weight: 0.96, mortality: 3.5, status: 'En cours', color: '#9be789' },
  { id: 'LP-26-003', name: 'Lot Cobb 500 — Bâtiment B', start: '2026-06-29', initial: 850, alive: 811, age: 43, weight: 2.12, mortality: 4.6, status: 'Prêt à vendre', color: '#f5cf67' },
  { id: 'LP-26-002', name: 'Lot Ross 308 — Bâtiment A', start: '2026-05-18', initial: 1000, alive: 0, age: 0, weight: 2.35, mortality: 3.2, status: 'Terminé', color: '#c8d2cb' },
];

export const poultryBuildings = [
  { id: 'BAT-A', name: 'Bâtiment A', capacity: 1500, current: 1158, status: 'Occupé', batch: 'LP-26-004', batchName: 'Ross 308', age: 18, cleanliness: 'À planifier', temperature: '27,4 °C', humidity: '64 %' },
  { id: 'BAT-B', name: 'Bâtiment B', capacity: 1000, current: 811, status: 'Occupé', batch: 'LP-26-003', batchName: 'Cobb 500', age: 43, cleanliness: 'Conforme', temperature: '24,1 °C', humidity: '61 %' },
  { id: 'BAT-C', name: 'Bâtiment C', capacity: 1200, current: 0, status: 'Vide sanitaire', batch: '—', batchName: 'Aucun lot', age: 0, cleanliness: 'J-5 avant disponibilité', temperature: '—', humidity: '—' },
];

export const poultryDailyRecords = [
  { id: 'SUIVI-0811-A', date: '2026-08-11', building: 'Bâtiment A', batch: 'LP-26-004', deaths: 3, expectedDeaths: 2, feed: 192, expectedFeed: 0, water: 348, sold: 0, averageWeight: 0.96, temperature: 27.4, humidity: 64, recordedBy: 'Estelle F.' },
  { id: 'SUIVI-0811-B', date: '2026-08-11', building: 'Bâtiment B', batch: 'LP-26-003', deaths: 2, expectedDeaths: 1, feed: 214, expectedFeed: 0, water: 392, sold: 0, averageWeight: 2.12, temperature: 24.1, humidity: 61, recordedBy: 'Paul N.' },
  { id: 'SUIVI-0810-A', date: '2026-08-10', building: 'Bâtiment A', batch: 'LP-26-004', deaths: 2, expectedDeaths: 2, feed: 188, expectedFeed: 0, water: 340, sold: 0, averageWeight: 0.93, temperature: 27.2, humidity: 63, recordedBy: 'Estelle F.' },
  { id: 'SUIVI-0810-B', date: '2026-08-10', building: 'Bâtiment B', batch: 'LP-26-003', deaths: 1, expectedDeaths: 1, feed: 210, expectedFeed: 0, water: 384, sold: 0, averageWeight: 2.08, temperature: 24.4, humidity: 60, recordedBy: 'Paul N.' }, 
];

export const poultryHealthEvents = [
  { id: 'SAN-012', date: '2026-08-09', batch: 'LP-26-004', building: 'Bâtiment A', type: 'Vaccination', product: 'Newcastle — rappel', operator: 'Dr. Nguema', status: 'Réalisée', note: 'Lot conforme' },
  { id: 'SAN-011', date: '2026-08-05', batch: 'LP-26-003', building: 'Bâtiment B', type: 'Traitement', product: 'Vitamines hydrosolubles', operator: 'Estelle F.', status: 'Terminé', note: 'Délai d’attente : aucun' },
  { id: 'SAN-010', date: '2026-07-31', batch: 'LP-26-003', building: 'Bâtiment B', type: 'Vaccination', product: 'Gumboro — dose 2', operator: 'Dr. Nguema', status: 'Réalisée', note: 'Prochaine échéance : J60' },
];

export const poultryTransfers = [
  { id: 'TRF-006', date: '2026-08-06', batch: 'LP-26-004', source: 'Bâtiment A', destination: 'Bâtiment B', quantity: 80, reason: 'Rééquilibrage de densité', status: 'Validé', recordedBy: 'Estelle F.' },
  { id: 'TRF-005', date: '2026-07-28', batch: 'LP-26-003', source: 'Bâtiment B', destination: 'Bâtiment A', quantity: 40, reason: 'Répartition de l’espace', status: 'Validé', recordedBy: 'Paul N.' },
];

export const goats = [
  { id: 'CH-024', name: 'Naya', breed: 'Naine de l’Ouest', sex: 'Femelle', age: '2 ans', weight: 31, health: 'Bon', status: 'Reproductrice' },
  { id: 'CH-023', name: 'Sango', breed: 'Naine de l’Ouest', sex: 'Mâle', age: '3 ans', weight: 42, health: 'Bon', status: 'Reproducteur' },
  { id: 'CH-022', name: 'Kenzi', breed: 'Alpine', sex: 'Femelle', age: '1 an', weight: 27, health: 'Suivi', status: 'En observation' },
  { id: 'CH-021', name: 'Mina', breed: 'Naine de l’Ouest', sex: 'Femelle', age: '8 mois', weight: 18, health: 'Bon', status: 'Croissance' },
  { id: 'CH-020', name: 'Tao', breed: 'Alpine', sex: 'Mâle', age: '6 mois', weight: 21, health: 'Bon', status: 'Croissance' },
];

export const feedProductions = [
  { id: 'PROV-026', recipe: 'Poulet croissance', date: '2026-08-10', quantity: 2400, unit: 'kg', cost: 1380000, status: 'Disponible' },
  { id: 'PROV-025', recipe: 'Démarrage poulet', date: '2026-08-06', quantity: 1200, unit: 'kg', cost: 756000, status: 'Consommé à 72%' },
  { id: 'PROV-024', recipe: 'Caprin entretien', date: '2026-08-01', quantity: 600, unit: 'kg', cost: 292000, status: 'Disponible' },
];

export const bioProductions = [
  { id: 'BIO-026', product: 'Complément végétal poulet', date: '2026-08-09', quantity: 450, unit: 'kg', target: 'Lots poulets', ingredients: 'Moringa · curcuma · ail', cost: 284000, status: 'Disponible' },
  { id: 'BIO-025', product: 'Solution de litière fermentée', date: '2026-08-05', quantity: 320, unit: 'L', target: 'Bâtiments A & B', ingredients: 'Mélasse · son · ferments', cost: 176000, status: 'En production' },
  { id: 'BIO-024', product: 'Mélange minéral naturel', date: '2026-07-28', quantity: 180, unit: 'kg', target: 'Lot LP-26-003', ingredients: 'Coquilles · argile · minéraux', cost: 118000, status: 'Disponible' },
];

export const oilProductions = [
  { id: 'HUILE-014', seed: 'Soja', date: '2026-08-08', input: 1800, oil: 612, cake: 1035, yield: 34, status: 'Stocké' },
  { id: 'HUILE-013', seed: 'Coton', date: '2026-08-02', input: 2500, oil: 785, cake: 1510, yield: 31.4, status: 'Partiellement vendu' },
  { id: 'HUILE-012', seed: 'Soja', date: '2026-07-25', input: 1600, oil: 544, cake: 920, yield: 34, status: 'Terminé' },
];

export const inventory = [
  { id: 'ST-001', name: 'Aliment poulet croissance', category: 'Aliments', quantity: 2400, unit: 'kg', unitId: 'poulets' as UnitId, min: 800, location: 'Magasin A', expiryDate: '', status: 'Normal', color: '#6f9fe8' },
  { id: 'ST-002', name: 'Maïs grain', category: 'Matières premières', quantity: 420, unit: 'kg', unitId: 'provenderie' as UnitId, min: 1000, location: 'Magasin A', expiryDate: '2026-09-20', status: 'Critique', color: '#e9975c' },
  { id: 'ST-003', name: 'Huile de soja', category: 'Produits finis', quantity: 612, unit: 'L', unitId: 'pressoir' as UnitId, min: 150, location: 'Magasin B', expiryDate: '2027-02-15', status: 'Normal', color: '#f5cf67' },
  { id: 'ST-004', name: 'Tourteaux de soja', category: 'Sous-produits', quantity: 1035, unit: 'kg', unitId: 'provenderie' as UnitId, min: 400, location: 'Provenderie', expiryDate: '', status: 'Normal', color: '#9be789' },
  { id: 'ST-005', name: 'Vaccin Newcastle', category: 'Santé animale', quantity: 18, unit: 'flacons', unitId: 'poulets' as UnitId, min: 24, location: 'Pharmacie', expiryDate: '2026-08-28', status: 'Faible', color: '#d9706b' },
  { id: 'ST-006', name: 'Sacs 50 kg', category: 'Emballages', quantity: 88, unit: 'sacs', unitId: 'stocks' as UnitId, min: 50, location: 'Magasin B', expiryDate: '', status: 'Normal', color: '#9ab4a3' }, 
];

export const customers = [
  { id: 'CLI-001', name: 'Hôtel La Falaise', contact: 'achats@lafalaise.cm', phone: '+237 6 90 12 45 60', total: 1845000, balance: 0, tag: 'Hôtellerie' },
  { id: 'CLI-002', name: 'Ferme Nkolbisson', contact: 'contact@nkolbisson.cm', phone: '+237 6 77 28 91 03', total: 970000, balance: 485000, tag: 'Élevage' },
  { id: 'CLI-003', name: 'Marché Central — Yaoundé', contact: 'commerce@marche.cm', phone: '+237 6 99 42 13 87', total: 625000, balance: 625000, tag: 'Distribution' },
  { id: 'CLI-004', name: 'Coopérative Nsam', contact: 'coop@nsam.cm', phone: '+237 6 75 33 18 24', total: 1325000, balance: 1325000, tag: 'Coopérative' },
];

export const suppliers = [
  { id: 'FOU-001', name: 'Cameroun Grains', contact: 'contact@cameroungrain.cm', phone: '+237 6 78 44 11 92', category: 'Matières premières', balance: 640000 },
  { id: 'FOU-002', name: 'VetPro Distribution', contact: 'sales@vetpro.cm', phone: '+237 6 90 32 07 15', category: 'Santé animale', balance: 185000 },
  { id: 'FOU-003', name: 'EquipAgri Services', contact: 'atelier@equipagri.cm', phone: '+237 6 96 14 55 80', category: 'Équipements', balance: 0 },
];

export const interUnitMovements = [
  { id: 'MVT-026', date: '2026-08-10', from: 'pressoir', to: 'provenderie', product: 'Tourteaux de soja', quantity: 420, unit: 'kg', status: 'Réceptionné', requestedBy: 'Paul N.', note: 'Matière première pour aliment croissance' },
  { id: 'MVT-025', date: '2026-08-09', from: 'bio', to: 'poulets', product: 'Complément végétal poulet', quantity: 120, unit: 'kg', status: 'Réceptionné', requestedBy: 'MOVIC', note: 'Lot LP-26-004' },
  { id: 'MVT-024', date: '2026-08-08', from: 'provenderie', to: 'poulets', product: 'Aliment poulet croissance', quantity: 680, unit: 'kg', status: 'En transit', requestedBy: 'Estelle F.', note: 'Bâtiment A' },
  { id: 'MVT-023', date: '2026-08-06', from: 'stocks', to: 'pressoir', product: 'Sacs 50 kg', quantity: 30, unit: 'sacs', status: 'Réceptionné', requestedBy: 'Paul N.', note: 'Conditionnement huile' },
  { id: 'MVT-022', date: '2026-08-04', from: 'poulets', to: 'stocks', product: 'Poulets prêts à vendre', quantity: 220, unit: 'têtes', status: 'Réceptionné', requestedBy: 'MOVIC', note: 'Mise à disposition pour vente' },
];

export const activities = [
  { id: 1, icon: 'package', title: 'Production enregistrée', description: '2 400 kg de Poulet croissance', time: 'Il y a 28 min', tone: 'green' },
  { id: 2, icon: 'receipt', title: 'Paiement reçu', description: 'Hôtel La Falaise · 1 845 000 FCFA', time: 'Il y a 2 h', tone: 'blue' },
  { id: 3, icon: 'alert', title: 'Stock faible', description: 'Maïs grain · 420 kg restants', time: 'Il y a 3 h', tone: 'orange' },
  { id: 4, icon: 'sprout', title: 'Nouveau lot créé', description: 'Ross 308 · Bâtiment A', time: 'Hier, 16:42', tone: 'purple' },
];

export const chartData = [
  { month: 'Mars', income: 6.1, expense: 3.4 },
  { month: 'Avr.', income: 7.4, expense: 4.1 },
  { month: 'Mai', income: 8.1, expense: 4.8 },
  { month: 'Juin', income: 9.8, expense: 5.2 },
  { month: 'Juil.', income: 10.2, expense: 6.1 },
  { month: 'Août', income: 12.5, expense: 6.8 },
];
