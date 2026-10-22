'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowDownRight, ArrowLeftRight, ArrowUpRight, Boxes, Check, ClipboardList, Download,
  Edit3, Factory, Package, PawPrint, Plus, Search, ShieldCheck, Sprout, Trash2, Truck, Wheat,
} from 'lucide-react';
import { formatDate, formatFCFA, formatNumber } from '@/lib/format';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { EmptyState } from '@/components/empty-state';
import { Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { LogisticsSummary } from '@/components/logistics-summary';
import { DailyTasksReport } from '@/components/daily-tasks-report';

const BUSINESS_DATE = '2026-08-13';

type GoatTab = 'dashboard' | 'animals' | 'reproduction' | 'health' | 'feeding' | 'productions' | 'finished' | 'movements' | 'reports';
type AnimalSex = 'Femelle' | 'Mâle';
type AnimalStatus = 'Actif' | 'Quarantaine' | 'Vendu' | 'Mort';
type GoatUnit = 'kg' | 'sac' | 'litre' | 'unité';

type GoatAnimal = {
  id: string;
  name: string;
  tag: string;
  sex: AnimalSex;
  breed: string;
  birthDate: string;
  role: string;
  status: AnimalStatus;
  weight: number;
  supplier: string;
  note: string;
};

type GoatReproduction = {
  id: string;
  femaleId: string;
  femaleName: string;
  maleId: string;
  maleName: string;
  matingDate: string;
  expectedBirth: string;
  actualBirth?: string;
  kidsCount: number;
  status: 'Planifiée' | 'Saillie' | 'Mise bas' | 'Terminée';
  note: string;
};

type GoatHealth = {
  id: string;
  date: string;
  animalId: string;
  animalName: string;
  type: 'Vaccination' | 'Traitement' | 'Contrôle';
  product: string;
  operator: string;
  status: 'Planifié' | 'Réalisé' | 'À surveiller';
  note: string;
};

type GoatFeed = {
  id: string;
  name: string;
  unit: GoatUnit;
  quantity: number;
  min: number;
  purchasePrice: number;
  supplier: string;
  location: string;
};

type GoatRation = {
  id: string;
  name: string;
  target: string;
  feedName: string;
  quantityPerAnimal: number;
  unit: GoatUnit;
  status: 'Active' | 'Archivée';
  note: string;
};

type GoatProduction = {
  id: string;
  date: string;
  type: 'Lait' | 'Chevreaux' | 'Fumier' | 'Autre';
  productName: string;
  quantity: number;
  unit: 'litre' | 'kg' | 'unité';
  source: string;
  operator: string;
  status: 'Enregistrée' | 'Validée';
  note: string;
};

type GoatFinishedStock = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: 'litre' | 'kg' | 'unité';
  sellable: boolean;
  salePrice: number;
  lastProduction: string;
};

type GoatMovement = {
  id: string;
  date: string;
  type: 'Entrée aliment' | 'Consommation aliment' | 'Production' | 'Transfert inter-unités' | 'Ajustement';
  itemName: string;
  quantity: number;
  unit: string;
  source?: string;
  destination?: string;
  reference: string;
  operator: string;
};

export function GoatFarmView({ initialTab = 'dashboard' }: { initialTab?: GoatTab }) {
  const tab = initialTab;
  const [animals, setAnimals] = useState<GoatAnimal[]>([]);
  const [reproduction, setReproduction] = useState<GoatReproduction[]>([]);
  const [health, setHealth] = useState<GoatHealth[]>([]);
  const [feeds, setFeeds] = useState<GoatFeed[]>([]);
  const [rations, setRations] = useState<GoatRation[]>([]);
  const [productions, setProductions] = useState<GoatProduction[]>([]);
  const [finishedStock, setFinishedStock] = useState<GoatFinishedStock[]>([]);
  const [movements, setMovements] = useState<GoatMovement[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [animalOpen, setAnimalOpen] = useState(false);
  const [reproductionOpen, setReproductionOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [rationOpen, setRationOpen] = useState(false);
  const [productionOpen, setProductionOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementStockType, setMovementStockType] = useState<'Aliment' | 'Produit fini'>('Aliment');
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingAnimal, setEditingAnimal] = useState<GoatAnimal | null>(null);
  const [editingFeed, setEditingFeed] = useState<GoatFeed | null>(null);
  const [editingRation, setEditingRation] = useState<GoatRation | null>(null);

  useEffect(() => {
    const load = () => {
      setAnimals(readLocal(FARM_STORAGE_KEYS.goatAnimals, [] as GoatAnimal[]));
      setReproduction(readLocal(FARM_STORAGE_KEYS.goatReproduction, [] as GoatReproduction[]));
      setHealth(readLocal(FARM_STORAGE_KEYS.goatHealth, [] as GoatHealth[]));
      setFeeds(readLocal(FARM_STORAGE_KEYS.goatFeeding, [] as GoatFeed[]));
      setRations(readLocal(FARM_STORAGE_KEYS.goatRations, [] as GoatRation[]));
      setProductions(readLocal(FARM_STORAGE_KEYS.goatProductions, [] as GoatProduction[]));
      setFinishedStock(readLocal(FARM_STORAGE_KEYS.goatFinishedStock, [] as GoatFinishedStock[]));
      setMovements(readLocal(FARM_STORAGE_KEYS.goatMovements, [] as GoatMovement[]));
      setHydrated(true);
    };
    load();
  }, []);

  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.goatAnimals, animals); }, [animals, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.goatReproduction, reproduction); }, [reproduction, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.goatHealth, health); }, [health, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.goatFeeding, feeds); }, [feeds, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.goatRations, rations); }, [rations, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.goatProductions, productions); }, [productions, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.goatFinishedStock, finishedStock); }, [finishedStock, hydrated]);
  useEffect(() => { if (hydrated) writeLocal(FARM_STORAGE_KEYS.goatMovements, movements); }, [movements, hydrated]);

  const activeAnimals = animals.filter((animal) => animal.status === 'Actif');
  const females = activeAnimals.filter((animal) => animal.sex === 'Femelle');
  const males = activeAnimals.filter((animal) => animal.sex === 'Mâle');
  const breeders = activeAnimals.filter((animal) => ['Reproductrice', 'Reproducteur'].includes(animal.role));
  const lowFeeds = feeds.filter((feed) => feed.quantity <= feed.min);
  const currentProductions = productions.filter((production) => production.date.startsWith('2026-08'));
  const milkTotal = currentProductions.filter((production) => production.type === 'Lait').reduce((sum, production) => sum + production.quantity, 0);
  const finishedTotal = finishedStock.reduce((sum, item) => sum + item.quantity, 0);
  const pendingHealth = health.filter((event) => event.status === 'À surveiller' || event.status === 'Planifié');
  const visibleAnimals = animals.filter((animal) => `${animal.id} ${animal.name} ${animal.tag} ${animal.breed} ${animal.role} ${animal.status}`.toLowerCase().includes(query.toLowerCase()));
  const visibleHealth = health.filter((event) => `${event.id} ${event.animalName} ${event.type} ${event.product}`.toLowerCase().includes(query.toLowerCase()));
  const visibleReproduction = reproduction.filter((event) => `${event.id} ${event.femaleName} ${event.maleName} ${event.status}`.toLowerCase().includes(query.toLowerCase()));
  const visibleFeeds = feeds.filter((feed) => `${feed.id} ${feed.name} ${feed.supplier}`.toLowerCase().includes(query.toLowerCase()));
  const visibleRations = rations.filter((ration) => `${ration.id} ${ration.name} ${ration.target} ${ration.feedName}`.toLowerCase().includes(query.toLowerCase()));
  const visibleProductions = productions.filter((production) => `${production.id} ${production.productName} ${production.type} ${production.source}`.toLowerCase().includes(query.toLowerCase()));
  const visibleMovements = movements.filter((movement) => `${movement.id} ${movement.itemName} ${movement.type} ${movement.destination}`.toLowerCase().includes(query.toLowerCase()));

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4200);
  }

  function saveAnimal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const animal: GoatAnimal = {
      id: editingAnimal?.id ?? `CH-${Date.now()}`,
      name: String(form.get('name') ?? '').trim(),
      tag: String(form.get('tag') ?? '').trim(),
      sex: String(form.get('sex') ?? 'Femelle') as AnimalSex,
      breed: String(form.get('breed') ?? '').trim(),
      birthDate: String(form.get('birthDate') ?? ''),
      role: String(form.get('role') ?? 'Croissance'),
      status: String(form.get('status') ?? 'Actif') as AnimalStatus,
      weight: Number(form.get('weight') ?? 0),
      supplier: String(form.get('supplier') ?? '').trim(),
      note: String(form.get('note') ?? '').trim(),
    };
    if (!animal.name || !animal.tag || !animal.breed || animal.weight < 0) return;
    setAnimals((current) => editingAnimal ? current.map((item) => item.id === animal.id ? animal : item) : [animal, ...current]);
    setAnimalOpen(false);
    notify(`${animal.name} a été ${editingAnimal ? 'modifiée' : 'ajoutée'} à la chèvrerie.`);
    setEditingAnimal(null);
  }

  function deleteAnimal(animal: GoatAnimal) {
    if (!window.confirm(`Supprimer définitivement ${animal.name} (${animal.tag}) ?`)) return;
    setAnimals((current) => current.filter((item) => item.id !== animal.id));
    notify(`${animal.name} a été supprimée de l’annuaire.`);
  }

  function saveReproduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const female = animals.find((animal) => animal.id === String(form.get('femaleId') ?? ''));
    const male = animals.find((animal) => animal.id === String(form.get('maleId') ?? ''));
    const record: GoatReproduction = {
      id: `REP-${Date.now()}`,
      femaleId: female?.id ?? '',
      femaleName: female?.name ?? '',
      maleId: male?.id ?? '',
      maleName: male?.name ?? '',
      matingDate: String(form.get('matingDate') ?? BUSINESS_DATE),
      expectedBirth: String(form.get('expectedBirth') ?? ''),
      actualBirth: String(form.get('actualBirth') ?? '') || undefined,
      kidsCount: Number(form.get('kidsCount') ?? 0),
      status: String(form.get('status') ?? 'Planifiée') as GoatReproduction['status'],
      note: String(form.get('note') ?? '').trim(),
    };
    if (!female || !male || female.sex !== 'Femelle' || male.sex !== 'Mâle' || !record.expectedBirth) {
      notify('Sélectionnez une femelle, un mâle et une date prévue de mise bas.');
      return;
    }
    setReproduction((current) => [record, ...current]);
    setReproductionOpen(false);
    notify(`Le suivi de reproduction ${record.id} a été enregistré.`);
  }

  function saveHealth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const animal = animals.find((item) => item.id === String(form.get('animalId') ?? ''));
    const record: GoatHealth = {
      id: `SAN-CH-${Date.now()}`,
      date: String(form.get('date') ?? BUSINESS_DATE),
      animalId: animal?.id ?? '',
      animalName: animal?.name ?? 'Animal',
      type: String(form.get('type') ?? 'Contrôle') as GoatHealth['type'],
      product: String(form.get('product') ?? '').trim(),
      operator: String(form.get('operator') ?? '').trim(),
      status: String(form.get('status') ?? 'Réalisé') as GoatHealth['status'],
      note: String(form.get('note') ?? '').trim(),
    };
    if (!animal || !record.product || !record.operator) return;
    setHealth((current) => [record, ...current]);
    setHealthOpen(false);
    notify(`Le suivi santé de ${animal.name} a été enregistré.`);
  }

  function saveFeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const feed: GoatFeed = {
      id: editingFeed?.id ?? `ALIM-CH-${Date.now()}`,
      name: String(form.get('name') ?? '').trim(),
      unit: String(form.get('unit') ?? 'kg') as GoatUnit,
      quantity: Number(form.get('quantity') ?? 0),
      min: Number(form.get('min') ?? 0),
      purchasePrice: Number(form.get('purchasePrice') ?? 0),
      supplier: String(form.get('supplier') ?? '').trim(),
      location: String(form.get('location') ?? 'Chèvrerie').trim(),
    };
    if (!feed.name || feed.quantity < 0 || feed.min < 0 || feed.purchasePrice < 0) return;
    setFeeds((current) => editingFeed ? current.map((item) => item.id === feed.id ? feed : item) : [feed, ...current]);
    setFeedOpen(false);
    notify(`${feed.name} a été ${editingFeed ? 'modifié' : 'ajouté'} au stock d’aliments.`);
    setEditingFeed(null);
  }

  function saveRation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ration: GoatRation = {
      id: editingRation?.id ?? `RAT-CH-${Date.now()}`,
      name: String(form.get('name') ?? '').trim(),
      target: String(form.get('target') ?? 'Tout le cheptel'),
      feedName: String(form.get('feedName') ?? '').trim(),
      quantityPerAnimal: Number(form.get('quantityPerAnimal') ?? 0),
      unit: String(form.get('unit') ?? 'kg') as GoatUnit,
      status: String(form.get('status') ?? 'Active') as GoatRation['status'],
      note: String(form.get('note') ?? '').trim(),
    };
    if (!ration.name || !ration.feedName || ration.quantityPerAnimal <= 0) return;
    setRations((current) => editingRation ? current.map((item) => item.id === ration.id ? ration : item) : [ration, ...current]);
    setRationOpen(false);
    notify(`La ration « ${ration.name} » a été ${editingRation ? 'modifiée' : 'créée'}.`);
    setEditingRation(null);
  }

  function archiveRation(ration: GoatRation) {
    setRations((current) => current.map((item) => item.id === ration.id ? { ...item, status: 'Archivée' } : item));
    notify(`La ration « ${ration.name} » a été archivée.`);
  }

  function saveProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = String(form.get('type') ?? 'Lait') as GoatProduction['type'];
    const production: GoatProduction = {
      id: `PROD-CH-${Date.now()}`,
      date: String(form.get('date') ?? BUSINESS_DATE),
      type,
      productName: String(form.get('productName') ?? '').trim(),
      quantity: Number(form.get('quantity') ?? 0),
      unit: String(form.get('unit') ?? 'litre') as GoatProduction['unit'],
      source: String(form.get('source') ?? 'Cheptel entier').trim(),
      operator: String(form.get('operator') ?? '').trim(),
      status: String(form.get('status') ?? 'Enregistrée') as GoatProduction['status'],
      note: String(form.get('note') ?? '').trim(),
    };
    if (!production.productName || production.quantity <= 0 || !production.operator) return;
    setProductions((current) => [production, ...current]);
    setFinishedStock((current) => {
      const existing = current.find((item) => item.name.toLowerCase() === production.productName.toLowerCase() && item.unit === production.unit);
      if (!existing) return [{ id: `FIN-CH-${Date.now()}`, name: production.productName, category: production.type, quantity: production.quantity, unit: production.unit, sellable: production.type !== 'Fumier', salePrice: 0, lastProduction: production.date }, ...current];
      return current.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + production.quantity, lastProduction: production.date } : item);
    });
    setMovements((current) => [{ id: `MVT-CH-${Date.now()}`, date: production.date, type: 'Production', itemName: production.productName, quantity: production.quantity, unit: production.unit, source: production.source, destination: 'Stock produits', reference: production.id, operator: production.operator }, ...current]);
    setProductionOpen(false);
    notify(`${formatNumber(production.quantity)} ${production.unit} de ${production.productName} ont été enregistrés.`);
  }

  function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stockType = String(form.get('stockType') ?? 'Aliment');
    const itemId = String(form.get('itemId') ?? '');
    const type = String(form.get('type') ?? 'Entrée') as 'Entrée' | 'Sortie' | 'Ajustement';
    const quantity = Number(form.get('quantity') ?? 0);
    const feed = feeds.find((item) => item.id === itemId);
    const product = finishedStock.find((item) => item.id === itemId);
    if ((!feed && stockType === 'Aliment') || (!product && stockType === 'Produit fini') || quantity <= 0) return;
    const currentQuantity = stockType === 'Aliment' ? feed!.quantity : product!.quantity;
    const nextQuantity = type === 'Entrée' ? currentQuantity + quantity : type === 'Sortie' ? currentQuantity - quantity : quantity;
    if (nextQuantity < 0) { notify(`Stock insuffisant : il reste ${formatNumber(currentQuantity)} ${stockType === 'Aliment' ? feed!.unit : product!.unit}.`); return; }
    if (stockType === 'Aliment') setFeeds((current) => current.map((item) => item.id === itemId ? { ...item, quantity: nextQuantity } : item));
    else setFinishedStock((current) => current.map((item) => item.id === itemId ? { ...item, quantity: nextQuantity } : item));
    const itemName = stockType === 'Aliment' ? feed!.name : product!.name;
    const itemUnit = stockType === 'Aliment' ? feed!.unit : product!.unit;
    setMovements((current) => [{ id: `MVT-CH-${Date.now()}`, date: String(form.get('date') ?? BUSINESS_DATE), type: type === 'Entrée' ? 'Entrée aliment' : type === 'Sortie' ? 'Consommation aliment' : 'Ajustement', itemName, quantity: type === 'Ajustement' ? Math.abs(nextQuantity - currentQuantity) : quantity, unit: itemUnit, destination: String(form.get('destination') ?? '').trim(), reference: String(form.get('reference') ?? '').trim() || `MVT-CH-${Date.now()}`, operator: 'Administrateur' }, ...current]);
    setMovementOpen(false);
    notify(`Mouvement enregistré pour ${itemName}.`);
  }

  function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stockId = String(form.get('stockId') ?? '');
    const quantity = Number(form.get('quantity') ?? 0);
    const stock = finishedStock.find((item) => item.id === stockId);
    const destination = String(form.get('destination') ?? 'poulets');
    const date = String(form.get('date') ?? BUSINESS_DATE);
    const driverName = String(form.get('driverName') ?? '').trim();
    const vehicle = String(form.get('vehicle') ?? '').trim();
    if (!stock || quantity <= 0 || quantity > stock.quantity || !driverName || !vehicle || !destination) {
      notify('Vérifiez le produit, la quantité, le livreur et le véhicule.');
      return;
    }
    const movementId = `MVT-CH-${Date.now()}`;
    const deliveryId = `BL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    setFinishedStock((current) => current.map((item) => item.id === stock.id ? { ...item, quantity: item.quantity - quantity } : item).filter((item) => item.quantity > 0));
    setMovements((current) => [{ id: movementId, date, type: 'Transfert inter-unités', itemName: stock.name, quantity, unit: stock.unit, source: 'Chèvrerie', destination, reference: deliveryId, operator: 'Administrateur' }, ...current]);
    const shared = readLocal<Array<Record<string, unknown>>>(FARM_STORAGE_KEYS.interUnitMovements, []);
    writeLocal(FARM_STORAGE_KEYS.interUnitMovements, [{ id: movementId, date, from: 'chevrerie', to: destination, product: stock.name, quantity, quantityKg: stock.unit === 'kg' ? quantity : undefined, unit: stock.unit, status: 'En transit', requestedBy: 'Administrateur', requestedByUnit: 'chevrerie', supplier: 'Chèvrerie', sourceProductionId: stock.id, deliveryNote: { id: deliveryId, date, supplier: 'Chèvrerie', driverName, driverPhone: String(form.get('driverPhone') ?? '').trim(), vehicle, productionId: stock.id, sourceLabel: 'Produit de la chèvrerie', note: String(form.get('note') ?? '').trim() }, note: String(form.get('note') ?? '').trim() }, ...shared]);
    setTransferOpen(false);
    notify(`Le transfert de ${stock.name} vers ${destination} a été expédié avec le bon ${deliveryId}.`);
  }

  function exportReport() {
    const rows = [
      'SCOOPS LE REVEIL', 'Rapport chèvrerie', '',
      'Animaux', 'Référence;Nom;Boucle;Sexe;Race;Rôle;Statut;Poids',
      ...animals.map((animal) => [animal.id, animal.name, animal.tag, animal.sex, animal.breed, animal.role, animal.status, `${animal.weight} kg`].join(';')),
      '', 'Productions', 'Référence;Date;Type;Produit;Quantité;Unité;Source;Responsable',
      ...productions.map((production) => [production.id, production.date, production.type, production.productName, production.quantity, production.unit, production.source, production.operator].join(';')),
      '', 'Suivis santé', 'Référence;Date;Animal;Type;Produit;Statut;Responsable',
      ...health.map((event) => [event.id, event.date, event.animalName, event.type, event.product, event.status, event.operator].join(';')),
    ].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${rows}`], { type: 'text/csv;charset=utf-8' }));
    link.download = 'rapport-chevrerie.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    notify('Le rapport de la chèvrerie a été exporté.');
  }

  return <div className="fade-in space-y-7">
    <Header tab={tab} onAnimal={() => { setEditingAnimal(null); setAnimalOpen(true); }} onReproduction={() => setReproductionOpen(true)} onHealth={() => setHealthOpen(true)} onFeed={() => { setEditingFeed(null); setFeedOpen(true); }} onRation={() => { setEditingRation(null); setRationOpen(true); }} onProduction={() => setProductionOpen(true)} onMovement={() => { setMovementStockType('Aliment'); setMovementOpen(true); }} onTransfer={() => setTransferOpen(true)} onExport={exportReport} />
    <div className="flex items-start gap-3 rounded-xl border border-[#dcebdd] bg-[#f5faf2] px-4 py-3 text-[11px] text-[#5b8f60]"><Sprout size={15} /> La chèvrerie est une unité autonome : animaux, reproduction, santé, alimentation, productions, stocks, transferts et finances restent séparés des autres unités.</div>
    {feedback && <div className="flex items-center gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}
    {tab === 'dashboard' && <Dashboard animals={activeAnimals} females={females} males={males} breeders={breeders} lowFeeds={lowFeeds} pendingHealth={pendingHealth} milkTotal={milkTotal} finishedTotal={finishedTotal} productions={currentProductions} />}
    {tab === 'animals' && <AnimalsView animals={visibleAnimals} query={query} setQuery={setQuery} onEdit={(animal) => { setEditingAnimal(animal); setAnimalOpen(true); }} onDelete={deleteAnimal} />}
    {tab === 'reproduction' && <ReproductionView records={visibleReproduction} animals={animals} query={query} setQuery={setQuery} onNew={() => setReproductionOpen(true)} />}
    {tab === 'health' && <HealthView records={visibleHealth} query={query} setQuery={setQuery} onNew={() => setHealthOpen(true)} />}
    {tab === 'feeding' && <FeedingView feeds={visibleFeeds} rations={visibleRations} query={query} setQuery={setQuery} lowFeeds={lowFeeds} onNewFeed={() => { setEditingFeed(null); setFeedOpen(true); }} onEditFeed={(feed) => { setEditingFeed(feed); setFeedOpen(true); }} onNewRation={() => { setEditingRation(null); setRationOpen(true); }} onEditRation={(ration) => { setEditingRation(ration); setRationOpen(true); }} onArchiveRation={archiveRation} />}
    {tab === 'productions' && <ProductionsView productions={visibleProductions} query={query} setQuery={setQuery} onNew={() => setProductionOpen(true)} />}
    {tab === 'finished' && <FinishedView stock={finishedStock} onTransfer={() => setTransferOpen(true)} />}
    {tab === 'movements' && <MovementsView movements={visibleMovements} query={query} setQuery={setQuery} onNew={() => { setMovementStockType('Aliment'); setMovementOpen(true); }} />}
    {tab === 'reports' && <ReportsView animals={animals} productions={productions} health={health} feeds={feeds} onExport={exportReport} />}

    <Modal open={animalOpen} onClose={() => { setAnimalOpen(false); setEditingAnimal(null); }} title={editingAnimal ? 'Modifier une chèvre' : 'Ajouter une chèvre'}><form onSubmit={saveAnimal} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom</span><input name="name" className="input-base" defaultValue={editingAnimal?.name ?? ''} placeholder="Ex. Naya" required /></label><label className="block"><span className="field-label">N° boucle / identification</span><input name="tag" className="input-base" defaultValue={editingAnimal?.tag ?? ''} placeholder="Ex. CH-025" required /></label><label className="block"><span className="field-label">Sexe</span><select name="sex" className="input-base" defaultValue={editingAnimal?.sex ?? 'Femelle'}><option>Femelle</option><option>Mâle</option></select></label><label className="block"><span className="field-label">Race</span><input name="breed" className="input-base" defaultValue={editingAnimal?.breed ?? ''} placeholder="Naine de l’Ouest, Alpine..." required /></label><label className="block"><span className="field-label">Date de naissance</span><input name="birthDate" type="date" className="input-base" defaultValue={editingAnimal?.birthDate ?? ''} required /></label><label className="block"><span className="field-label">Rôle</span><select name="role" className="input-base" defaultValue={editingAnimal?.role ?? 'Croissance'}><option>Reproductrice</option><option>Reproducteur</option><option>Chevreau</option><option>Croissance</option><option>Engraissement</option></select></label><label className="block"><span className="field-label">Statut</span><select name="status" className="input-base" defaultValue={editingAnimal?.status ?? 'Actif'}><option>Actif</option><option>Quarantaine</option><option>Vendu</option><option>Mort</option></select></label><label className="block"><span className="field-label">Poids actuel (kg)</span><input name="weight" type="number" min="0" step="0.1" className="input-base" defaultValue={editingAnimal?.weight ?? 0} required /></label><label className="block sm:col-span-2"><span className="field-label">Origine / fournisseur</span><input name="supplier" className="input-base" defaultValue={editingAnimal?.supplier ?? ''} placeholder="Naissance interne ou fournisseur" /></label><label className="block sm:col-span-2"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[70px] resize-none" defaultValue={editingAnimal?.note ?? ''} /></label></div><ModalActions onCancel={() => setAnimalOpen(false)} label="Enregistrer la chèvre" /></form></Modal>

    <Modal open={reproductionOpen} onClose={() => setReproductionOpen(false)} title="Nouveau suivi de reproduction"><form onSubmit={saveReproduction} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Femelle</span><select name="femaleId" className="input-base" required><option value="">Choisir une femelle</option>{females.map((animal) => <option value={animal.id} key={animal.id}>{animal.name} · {animal.tag}</option>)}</select></label><label className="block"><span className="field-label">Mâle</span><select name="maleId" className="input-base" required><option value="">Choisir un mâle</option>{males.map((animal) => <option value={animal.id} key={animal.id}>{animal.name} · {animal.tag}</option>)}</select></label><label className="block"><span className="field-label">Date de saillie</span><input name="matingDate" type="date" className="input-base" defaultValue={BUSINESS_DATE} required /></label><label className="block"><span className="field-label">Mise bas prévue</span><input name="expectedBirth" type="date" className="input-base" required /></label><label className="block"><span className="field-label">Statut</span><select name="status" className="input-base"><option>Planifiée</option><option>Saillie</option><option>Mise bas</option><option>Terminée</option></select></label><label className="block"><span className="field-label">Nombre de chevreaux</span><input name="kidsCount" type="number" min="0" className="input-base" defaultValue="0" /></label><label className="block sm:col-span-2"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[70px] resize-none" placeholder="Observation de reproduction..." /></label></div><ModalActions onCancel={() => setReproductionOpen(false)} label="Enregistrer le suivi" /></form></Modal>

    <Modal open={healthOpen} onClose={() => setHealthOpen(false)} title="Nouveau suivi santé"><form onSubmit={saveHealth} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Animal</span><select name="animalId" className="input-base" required><option value="">Choisir une chèvre</option>{animals.filter((animal) => animal.status !== 'Mort').map((animal) => <option value={animal.id} key={animal.id}>{animal.name} · {animal.tag}</option>)}</select></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" className="input-base" defaultValue={BUSINESS_DATE} required /></label><label className="block"><span className="field-label">Type</span><select name="type" className="input-base"><option>Vaccination</option><option>Traitement</option><option>Contrôle</option></select></label><label className="block"><span className="field-label">Produit / observation</span><input name="product" className="input-base" placeholder="Ex. Vaccin, contrôle poids..." required /></label><label className="block"><span className="field-label">Responsable</span><input name="operator" className="input-base" placeholder="Nom du responsable" required /></label><label className="block"><span className="field-label">Statut</span><select name="status" className="input-base"><option>Réalisé</option><option>Planifié</option><option>À surveiller</option></select></label><label className="block sm:col-span-2"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[70px] resize-none" /></label></div><ModalActions onCancel={() => setHealthOpen(false)} label="Enregistrer le suivi" /></form></Modal>

    <Modal open={feedOpen} onClose={() => { setFeedOpen(false); setEditingFeed(null); }} title={editingFeed ? 'Modifier un aliment' : 'Ajouter un aliment'}><form onSubmit={saveFeed} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="field-label">Aliment / matière</span><input name="name" className="input-base" defaultValue={editingFeed?.name ?? ''} placeholder="Foin, maïs, tourteau, complément..." required /></label><label className="block"><span className="field-label">Unité</span><select name="unit" className="input-base" defaultValue={editingFeed?.unit ?? 'kg'}><option>kg</option><option>sac</option><option>litre</option><option>unité</option></select></label><label className="block"><span className="field-label">Prix d’achat unitaire (FCFA)</span><input name="purchasePrice" type="number" min="0" className="input-base" defaultValue={editingFeed?.purchasePrice ?? 0} required /></label><label className="block"><span className="field-label">Quantité actuelle</span><input name="quantity" type="number" min="0" step="0.01" className="input-base" defaultValue={editingFeed?.quantity ?? 0} required /></label><label className="block"><span className="field-label">Seuil d’alerte</span><input name="min" type="number" min="0" step="0.01" className="input-base" defaultValue={editingFeed?.min ?? 0} required /></label><label className="block"><span className="field-label">Fournisseur</span><input name="supplier" className="input-base" defaultValue={editingFeed?.supplier ?? ''} /></label><label className="block"><span className="field-label">Emplacement</span><input name="location" className="input-base" defaultValue={editingFeed?.location ?? 'Chèvrerie'} /></label></div><ModalActions onCancel={() => setFeedOpen(false)} label="Enregistrer l’aliment" /></form></Modal>

    <Modal open={rationOpen} onClose={() => { setRationOpen(false); setEditingRation(null); }} title={editingRation ? 'Modifier une ration' : 'Nouvelle ration'}><form onSubmit={saveRation} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom de la ration</span><input name="name" className="input-base" defaultValue={editingRation?.name ?? ''} placeholder="Ration entretien, lactation..." required /></label><label className="block"><span className="field-label">Cible</span><select name="target" className="input-base" defaultValue={editingRation?.target ?? 'Tout le cheptel'}><option>Tout le cheptel</option><option>Femelles gestantes</option><option>Femelles en lactation</option><option>Chevreaux</option><option>Reproducteurs</option></select></label><label className="block"><span className="field-label">Aliment principal</span><input name="feedName" className="input-base" defaultValue={editingRation?.feedName ?? ''} placeholder="Nom de l’aliment du stock" required /></label><label className="block"><span className="field-label">Quantité par animal</span><input name="quantityPerAnimal" type="number" min="0.01" step="0.01" className="input-base" defaultValue={editingRation?.quantityPerAnimal ?? 0} required /></label><label className="block"><span className="field-label">Unité</span><select name="unit" className="input-base" defaultValue={editingRation?.unit ?? 'kg'}><option>kg</option><option>sac</option><option>litre</option><option>unité</option></select></label><label className="block"><span className="field-label">Statut</span><select name="status" className="input-base" defaultValue={editingRation?.status ?? 'Active'}><option>Active</option><option>Archivée</option></select></label><label className="block sm:col-span-2"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[70px] resize-none" defaultValue={editingRation?.note ?? ''} /></label></div><ModalActions onCancel={() => setRationOpen(false)} label="Enregistrer la ration" /></form></Modal>

    <Modal open={productionOpen} onClose={() => setProductionOpen(false)} title="Enregistrer une production"><form onSubmit={saveProduction} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Type de production</span><select name="type" className="input-base"><option>Lait</option><option>Chevreaux</option><option>Fumier</option><option>Autre</option></select></label><label className="block"><span className="field-label">Nom du produit</span><input name="productName" className="input-base" placeholder="Lait de chèvre, chevreau sevré..." required /></label><label className="block"><span className="field-label">Quantité</span><input name="quantity" type="number" min="0.01" step="0.01" className="input-base" required /></label><label className="block"><span className="field-label">Unité</span><select name="unit" className="input-base"><option>litre</option><option>kg</option><option>unité</option></select></label><label className="block"><span className="field-label">Source</span><input name="source" className="input-base" placeholder="Cheptel entier ou animal identifié" defaultValue="Cheptel entier" /></label><label className="block"><span className="field-label">Responsable</span><input name="operator" className="input-base" placeholder="Nom du responsable" required /></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" className="input-base" defaultValue={BUSINESS_DATE} required /></label><label className="block"><span className="field-label">Statut</span><select name="status" className="input-base"><option>Enregistrée</option><option>Validée</option></select></label><label className="block sm:col-span-2"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[70px] resize-none" /></label></div><ModalActions onCancel={() => setProductionOpen(false)} label="Enregistrer la production" /></form></Modal>

    <Modal open={movementOpen} onClose={() => setMovementOpen(false)} title="Nouveau mouvement de stock"><form onSubmit={saveMovement} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Stock concerné</span><select name="stockType" value={movementStockType} onChange={(event) => setMovementStockType(event.target.value as 'Aliment' | 'Produit fini')} className="input-base"><option>Aliment</option><option>Produit fini</option></select></label><label className="block"><span className="field-label">Type</span><select name="type" className="input-base"><option>Entrée</option><option>Sortie</option><option>Ajustement</option></select></label></div><label className="block"><span className="field-label">Article</span><select name="itemId" className="input-base" required><option value="">Choisir un article</option>{movementStockType === 'Aliment' ? feeds.map((feed) => <option key={feed.id} value={feed.id}>{feed.name} · {formatNumber(feed.quantity)} {feed.unit}</option>) : finishedStock.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatNumber(item.quantity)} {item.unit}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Quantité</span><input name="quantity" type="number" min="0.01" step="0.01" className="input-base" required /></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" className="input-base" defaultValue={BUSINESS_DATE} required /></label></div><label className="block"><span className="field-label">Destination / motif</span><input name="destination" className="input-base" placeholder="Ration, bâtiment, inventaire..." /></label><label className="block"><span className="field-label">Référence</span><input name="reference" className="input-base" placeholder="Bon, inventaire ou note" /></label><ModalActions onCancel={() => setMovementOpen(false)} label="Enregistrer le mouvement" /></form></Modal>

    <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transférer un produit de la chèvrerie"><form onSubmit={createTransfer} className="space-y-5"><p className="muted text-[12px] leading-5">Le stock produit est diminué et le mouvement inter-unités est créé avec son bon de livraison.</p><label className="block"><span className="field-label">Produit fini</span><select name="stockId" className="input-base" required><option value="">Choisir un produit</option>{finishedStock.filter((item) => item.quantity > 0).map((item) => <option key={item.id} value={item.id}>{item.name} · {formatNumber(item.quantity)} {item.unit}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Quantité</span><input name="quantity" type="number" min="0.01" step="0.01" className="input-base" required /></label><label className="block"><span className="field-label">Destination</span><select name="destination" className="input-base"><option value="poulets">Ferme de poulets</option><option value="stocks">Magasin central</option><option value="provenderie">Provenderie</option><option value="bio">Produits bio</option><option value="pressoir">Pressoir à huile</option></select></label><label className="block sm:col-span-2"><span className="field-label">Date</span><input name="date" type="date" className="input-base" defaultValue={BUSINESS_DATE} required /></label><label className="block"><span className="field-label">Nom du livreur</span><input name="driverName" className="input-base" placeholder="Nom complet" required /></label><label className="block"><span className="field-label">Téléphone</span><input name="driverPhone" className="input-base" placeholder="Facultatif" /></label><label className="block sm:col-span-2"><span className="field-label">Véhicule / immatriculation</span><input name="vehicle" className="input-base" placeholder="Ex. Camion CE 123 AA" required /></label><label className="block sm:col-span-2"><span className="field-label">Observation</span><textarea name="note" className="input-base min-h-[70px] resize-none" /></label></div><ModalActions onCancel={() => setTransferOpen(false)} label="Expédier avec bon de livraison" /></form></Modal>
  </div>;
}

function Header({ tab, onAnimal, onReproduction, onHealth, onFeed, onRation, onProduction, onMovement, onTransfer, onExport }: { tab: GoatTab; onAnimal: () => void; onReproduction: () => void; onHealth: () => void; onFeed: () => void; onRation: () => void; onProduction: () => void; onMovement: () => void; onTransfer: () => void; onExport: () => void }) {
  const labels: Record<GoatTab, string> = { dashboard: 'Dashboard chèvrerie', animals: 'Annuaire des chèvres', reproduction: 'Reproduction', health: 'Santé du cheptel', feeding: 'Alimentation et rations', productions: 'Productions de la chèvrerie', finished: 'Stock des produits', movements: 'Mouvements de la chèvrerie', reports: 'Rapports chèvrerie' };
  return <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/selection-unite" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Changer d’unité</Link><p className="eyebrow mb-2">Unité · Chèvrerie</p><h1 className="page-title">{labels[tab]}</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">Gérez les animaux, la reproduction, la santé, l’alimentation, les productions et les transferts de la chèvrerie.</p></div><div className="flex flex-wrap gap-2">{tab === 'dashboard' && <><button className="btn-secondary" onClick={onAnimal}><Plus size={15} /> Ajouter une chèvre</button><button className="btn-primary" onClick={onProduction}><Factory size={15} /> Nouvelle production</button></>}{tab === 'animals' && <button className="btn-primary" onClick={onAnimal}><Plus size={15} /> Ajouter une chèvre</button>}{tab === 'reproduction' && <button className="btn-primary" onClick={onReproduction}><Plus size={15} /> Nouveau suivi</button>}{tab === 'health' && <button className="btn-primary" onClick={onHealth}><Plus size={15} /> Nouveau suivi santé</button>}{tab === 'feeding' && <><button className="btn-secondary" onClick={onRation}><Plus size={15} /> Nouvelle ration</button><button className="btn-primary" onClick={onFeed}><Plus size={15} /> Ajouter un aliment</button></>}{tab === 'productions' && <button className="btn-primary" onClick={onProduction}><Plus size={15} /> Enregistrer production</button>}{tab === 'finished' && <><button className="btn-secondary" onClick={onProduction}><Plus size={15} /> Nouvelle production</button><button className="btn-primary" onClick={onTransfer}><Truck size={15} /> Transférer</button></>}{tab === 'movements' && <button className="btn-primary" onClick={onMovement}><Plus size={15} /> Nouveau mouvement</button>}{tab === 'reports' && <button className="btn-primary" onClick={onExport}><Download size={15} /> Exporter le rapport</button>}</div></div>;
}

function Dashboard({ animals, females, males, breeders, lowFeeds, pendingHealth, milkTotal, finishedTotal, productions }: { animals: GoatAnimal[]; females: GoatAnimal[]; males: GoatAnimal[]; breeders: GoatAnimal[]; lowFeeds: GoatFeed[]; pendingHealth: GoatHealth[]; milkTotal: number; finishedTotal: number; productions: GoatProduction[] }) {
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><StatCard label="Cheptel actif" value={`${animals.length} tête${animals.length > 1 ? 's' : ''}`} change="données locales" detail="animaux suivis" icon={Sprout} tone="green" /><StatCard label="Femelles" value={String(females.length)} change="cheptel actif" detail="reproduction et lactation" icon={PawPrint} tone="blue" /><StatCard label="Reproducteurs" value={String(breeders.length)} change="rôles configurés" detail="mâles et femelles" icon={Activity} tone="orange" /><StatCard label="Lait du mois" value={`${formatNumber(milkTotal)} L`} change="production enregistrée" detail="août 2026" icon={ArrowUpRight} tone="purple" /><StatCard label="Alertes" value={String(lowFeeds.length + pendingHealth.length)} change={lowFeeds.length + pendingHealth.length ? 'À traiter' : 'Aucune'} detail="aliments et santé" icon={ShieldCheck} tone="purple" /></div><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Suivi du cheptel" title="État actuel" description="La chèvrerie commence avec vos propres données, sans animaux préchargés." /><div className="mt-5 space-y-3">{animals.length ? animals.slice(0, 6).map((animal) => <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3" key={animal.id}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf8ea] text-[#5b9d5b]"><Sprout size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-ink">{animal.name} · {animal.tag}</p><p className="mt-1 text-[10px] text-[#8b9891]">{animal.breed} · {animal.sex} · {animal.weight} kg</p></div><StatusBadge status={animal.status} /></div>) : <EmptyState title="Aucun animal enregistré" description="Ajoutez la première chèvre pour commencer le suivi du cheptel." />}</div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Productions récentes" title="Traçabilité" /><div className="mt-5 space-y-3">{productions.length ? productions.slice(0, 5).map((production) => <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3" key={production.id}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf3ff] text-[#6385bd]"><Factory size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-ink">{production.productName}</p><p className="mt-1 text-[10px] text-[#8b9891]">{formatDate(production.date)} · {formatNumber(production.quantity)} {production.unit}</p></div><strong className="text-[10px] text-[#5b9d5b]">{production.type}</strong></div>) : <p className="py-8 text-center text-[11px] text-[#89968f]">Aucune production enregistrée.</p>}</div><div className="mt-5 border-t border-[#edf0eb] pt-4 text-[11px] text-[#87958d]">Stock produits actuel : <strong className="text-ink">{formatNumber(finishedTotal)}</strong> unités de mesure.</div></div></div></div>;
}

function AnimalsView({ animals, query, setQuery, onEdit, onDelete }: { animals: GoatAnimal[]; query: string; setQuery: (value: string) => void; onEdit: (animal: GoatAnimal) => void; onDelete: (animal: GoatAnimal) => void }) { return <div className="surface overflow-hidden"><Toolbar query={query} setQuery={setQuery} placeholder="Rechercher une chèvre..." /><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Animal</th><th>Sexe</th><th>Race</th><th>Rôle</th><th>Naissance</th><th>Poids</th><th>Statut</th><th /></tr></thead><tbody>{animals.length ? animals.map((animal) => <tr className="table-row table-line" key={animal.id}><td><p className="font-bold text-ink">{animal.name}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{animal.id} · boucle {animal.tag}</p></td><td>{animal.sex}</td><td>{animal.breed}</td><td>{animal.role}</td><td>{formatDate(animal.birthDate)}</td><td>{formatNumber(animal.weight)} kg</td><td><StatusBadge status={animal.status} /></td><td><div className="flex gap-1"><button className="icon-btn h-8 w-8" onClick={() => onEdit(animal)} aria-label="Modifier"><Edit3 size={14} /></button><button className="icon-btn h-8 w-8 text-[#b45d5d]" onClick={() => onDelete(animal)} aria-label="Supprimer"><Trash2 size={14} /></button></div></td></tr>) : <tr><td colSpan={8} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun animal enregistré.</td></tr>}</tbody></table></div></div>; }

function ReproductionView({ records, animals, query, setQuery, onNew }: { records: GoatReproduction[]; animals: GoatAnimal[]; query: string; setQuery: (value: string) => void; onNew: () => void }) { return <div className="space-y-5"><Toolbar query={query} setQuery={setQuery} placeholder="Rechercher un suivi..." /><div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Reproduction" title="Suivis de saillie et mise bas" description={`${animals.filter((animal) => animal.sex === 'Femelle' && animal.status === 'Actif').length} femelle(s) active(s) dans le registre.`} /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Référence</th><th>Femelle</th><th>Mâle</th><th>Saillie</th><th>Mise bas prévue</th><th>Chevreaux</th><th>Statut</th></tr></thead><tbody>{records.length ? records.map((record) => <tr className="table-row table-line" key={record.id}><td className="font-bold text-ink">{record.id}</td><td>{record.femaleName}</td><td>{record.maleName}</td><td>{formatDate(record.matingDate)}</td><td>{formatDate(record.expectedBirth)}</td><td>{record.kidsCount}</td><td><StatusBadge status={record.status} /></td></tr>) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun suivi de reproduction enregistré.</td></tr>}</tbody></table></div></div></div>; }

function HealthView({ records, query, setQuery, onNew }: { records: GoatHealth[]; query: string; setQuery: (value: string) => void; onNew: () => void }) { return <div className="surface overflow-hidden"><Toolbar query={query} setQuery={setQuery} placeholder="Rechercher un suivi santé..." /><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Référence</th><th>Date</th><th>Animal</th><th>Type</th><th>Produit / observation</th><th>Responsable</th><th>Statut</th></tr></thead><tbody>{records.length ? records.map((record) => <tr className="table-row table-line" key={record.id}><td className="font-bold text-ink">{record.id}</td><td>{formatDate(record.date)}</td><td>{record.animalName}</td><td>{record.type}</td><td>{record.product}</td><td>{record.operator}</td><td><StatusBadge status={record.status} /></td></tr>) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun suivi santé enregistré.</td></tr>}</tbody></table></div></div>; }

function FeedingView({ feeds, rations, query, setQuery, lowFeeds, onNewFeed, onEditFeed, onNewRation, onEditRation, onArchiveRation }: { feeds: GoatFeed[]; rations: GoatRation[]; query: string; setQuery: (value: string) => void; lowFeeds: GoatFeed[]; onNewFeed: () => void; onEditFeed: (feed: GoatFeed) => void; onNewRation: () => void; onEditRation: (ration: GoatRation) => void; onArchiveRation: (ration: GoatRation) => void }) { return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="surface p-5"><SectionHeading eyebrow="Approvisionnement" title="Aliments et intrants" description="Stocks propres à la chèvrerie, seuils et prix d’achat." /><div className="mt-4 space-y-2">{feeds.length ? feeds.map((feed) => <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3" key={feed.id}><Boxes size={15} className={feed.quantity <= feed.min ? 'text-[#bd7737]' : 'text-[#5b9d5b]'} /><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-ink">{feed.name}</p><p className="mt-1 text-[10px] text-[#89968f]">{formatNumber(feed.quantity)} {feed.unit} · seuil {formatNumber(feed.min)}</p></div><button className="icon-btn h-8 w-8" onClick={() => onEditFeed(feed)} aria-label="Modifier l’aliment"><Edit3 size={13} /></button></div>) : <p className="py-6 text-center text-[11px] text-[#89968f]">Aucun aliment enregistré.</p>}</div>{lowFeeds.length > 0 && <p className="mt-4 rounded-lg bg-[#fff4e5] px-3 py-2 text-[10px] font-bold text-[#a66a35]">{lowFeeds.length} stock(s) sous le seuil.</p>}<button className="btn-secondary mt-4 w-full" onClick={onNewFeed}><Plus size={14} /> Ajouter un aliment</button></div><div className="surface p-5"><SectionHeading eyebrow="Rations" title="Rations actives" description="Formules distribuées selon le stade et le type d’animal." /><div className="mt-4 space-y-2">{rations.length ? rations.map((ration) => <div className="rounded-xl border border-[#edf0eb] p-3" key={ration.id}><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-bold text-ink">{ration.name}</p><p className="mt-1 text-[10px] text-[#89968f]">{ration.target} · {ration.feedName} · {ration.quantityPerAnimal} {ration.unit}/animal</p></div><StatusBadge status={ration.status} /></div><div className="mt-3 flex gap-1"><button className="icon-btn h-8 w-8" onClick={() => onEditRation(ration)} aria-label="Modifier la ration"><Edit3 size={13} /></button>{ration.status === 'Active' && <button className="icon-btn h-8 w-8 text-[#b45d5d]" onClick={() => onArchiveRation(ration)} aria-label="Archiver la ration"><Trash2 size={13} /></button>}</div></div>) : <p className="py-6 text-center text-[11px] text-[#89968f]">Aucune ration enregistrée.</p>}</div><button className="btn-primary mt-4 w-full" onClick={onNewRation}><Plus size={14} /> Nouvelle ration</button></div></div><p className="text-[10px] text-[#89968f]">Recherche active : {query || 'tous les aliments et rations'}</p></div>; }

function ProductionsView({ productions, query, setQuery, onNew }: { productions: GoatProduction[]; query: string; setQuery: (value: string) => void; onNew: () => void }) { return <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Production" title="Productions enregistrées" description="Lait, chevreaux, fumier et autres sorties de la chèvrerie." /><button className="btn-primary" onClick={onNew}><Plus size={14} /> Nouvelle production</button></div><Toolbar query={query} setQuery={setQuery} placeholder="Rechercher une production..." /><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Référence</th><th>Date</th><th>Type</th><th>Produit</th><th>Quantité</th><th>Source</th><th>Responsable</th><th>Statut</th></tr></thead><tbody>{productions.length ? productions.map((production) => <tr className="table-row table-line" key={production.id}><td className="font-bold text-ink">{production.id}</td><td>{formatDate(production.date)}</td><td>{production.type}</td><td>{production.productName}</td><td>{formatNumber(production.quantity)} {production.unit}</td><td>{production.source}</td><td>{production.operator}</td><td><StatusBadge status={production.status} /></td></tr>) : <tr><td colSpan={8} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune production enregistrée.</td></tr>}</tbody></table></div></div>; }

function FinishedView({ stock, onTransfer }: { stock: GoatFinishedStock[]; onTransfer: () => void }) { return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3">{stock.length ? stock.map((item) => <div className="surface p-5" key={item.id}><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf8ea] text-[#5b9d5b]"><Package size={18} /></span><span className="text-[12px] font-black text-[#5b9d5b]">{formatNumber(item.quantity)} {item.unit}</span></div><p className="mt-4 text-[13px] font-bold text-ink">{item.name}</p><p className="mt-1 text-[10px] text-[#8b9891]">{item.category} · dernière production : {formatDate(item.lastProduction)}</p><p className="mt-2 text-[10px] font-bold text-[#5b9d5b]">{item.sellable ? 'Disponible pour vente ou transfert' : 'Usage interne'}</p><p className="mt-3 text-[11px] font-bold text-[#5b9d5b]">{item.salePrice ? formatFCFA(item.salePrice) : 'Prix à définir'}</p><button className="btn-secondary mt-4 w-full px-3 py-2 text-[10px]" onClick={onTransfer}><Truck size={14} /> Transférer</button></div>) : <div className="md:col-span-3"><EmptyState title="Aucun produit en stock" description="Enregistrez une production pour alimenter ce stock." /></div>}</div></div>; }

function MovementsView({ movements, query, setQuery, onNew }: { movements: GoatMovement[]; query: string; setQuery: (value: string) => void; onNew: () => void }) { return <div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Traçabilité" title="Mouvements de la chèvrerie" description="Entrées, consommations, productions, ajustements et transferts." action={<button className="btn-primary" onClick={onNew}><Plus size={14} /> Nouveau mouvement</button>} /></div><Toolbar query={query} setQuery={setQuery} placeholder="Rechercher un mouvement..." /><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Type</th><th>Article</th><th>Quantité</th><th>Source</th><th>Destination</th><th>Référence</th></tr></thead><tbody>{movements.length ? movements.map((movement) => <tr className="table-row table-line" key={movement.id}><td>{formatDate(movement.date)}</td><td>{movement.type}</td><td>{movement.itemName}</td><td>{formatNumber(movement.quantity)} {movement.unit}</td><td>{movement.source ?? '—'}</td><td>{movement.destination ?? '—'}</td><td>{movement.reference || '—'}</td></tr>) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun mouvement enregistré.</td></tr>}</tbody></table></div></div>; }

function ReportsView({ animals, productions, health, feeds, onExport }: { animals: GoatAnimal[]; productions: GoatProduction[]; health: GoatHealth[]; feeds: GoatFeed[]; onExport: () => void }) { const revenueBase = productions.filter((production) => production.type === 'Lait').reduce((sum, production) => sum + production.quantity, 0); return <div className="space-y-5"><LogisticsSummary unitId="chevrerie" /><DailyTasksReport unitId="chevrerie" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Animaux actifs" value={String(animals.filter((animal) => animal.status === 'Actif').length)} change="registre" detail="cheptel" icon={Sprout} tone="green" /><StatCard label="Lait produit" value={`${formatNumber(revenueBase)} L`} change="période locale" detail="productions enregistrées" icon={ArrowUpRight} tone="blue" /><StatCard label="Suivis santé" value={String(health.length)} change="historique" detail="événements" icon={ShieldCheck} tone="orange" /><StatCard label="Valeur aliments" value={feeds.reduce((sum, feed) => sum + feed.quantity * feed.purchasePrice, 0)} change="prix d’achat" detail="stock aliments" icon={Boxes} tone="purple" /></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Analyse autonome" title="Synthèse de la chèvrerie" description="Les indicateurs sont calculés uniquement à partir des données enregistrées dans cette unité." /><div className="mt-5 space-y-4"><ReportLine label="Femelles actives" value={animals.filter((animal) => animal.status === 'Actif' && animal.sex === 'Femelle').length} total={Math.max(animals.filter((animal) => animal.status === 'Actif').length, 1)} color="green" /><ReportLine label="Mâles actifs" value={animals.filter((animal) => animal.status === 'Actif' && animal.sex === 'Mâle').length} total={Math.max(animals.filter((animal) => animal.status === 'Actif').length, 1)} color="blue" /><ReportLine label="Productions enregistrées" value={productions.length} total={Math.max(productions.length, 1)} color="orange" /></div><button className="btn-primary mt-6" onClick={onExport}><Download size={15} /> Exporter les données de la chèvrerie</button></div></div>; }

function ReportLine({ label, value, total, color }: { label: string; value: number; total: number; color: 'green' | 'blue' | 'orange' }) { return <div><div className="mb-2 flex items-center justify-between text-[11px]"><span className="font-semibold text-[#718078]">{label}</span><strong className="text-ink">{value}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#edf1eb]"><div className={`h-full rounded-full ${color === 'green' ? 'bg-[#7fcf74]' : color === 'blue' ? 'bg-[#6f9fe8]' : 'bg-[#e9975c]'}`} style={{ width: `${Math.min(value / total * 100, 100)}%` }} /></div></div>; }

function Toolbar({ query, setQuery, placeholder }: { query: string; setQuery: (value: string) => void; placeholder: string }) { return <div className="flex justify-end border-b border-[#edf0eb] px-5 py-4 sm:px-6"><div className="relative min-w-[235px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder={placeholder} /></div></div>; }

function ModalActions({ onCancel, label }: { onCancel: () => void; label: string }) { return <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button><button type="submit" className="btn-primary"><Check size={15} /> {label}</button></div>; }
