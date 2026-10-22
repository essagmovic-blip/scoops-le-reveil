'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowDownRight, ArrowLeft, ArrowLeftRight, ArrowRight, Boxes, Check, ChevronDown, ClipboardCheck, Download, Edit3, Factory, Package, Plus, Search, Trash2, Truck, Wheat } from 'lucide-react';
import { formatDate, formatFCFA, formatNumber } from '@/lib/format';
import { FARM_STORAGE_KEYS, readLocal, writeLocal } from '@/lib/farm-storage';
import { EmptyState } from '@/components/empty-state';
import { MiniProgress, Modal, SectionHeading, StatCard } from '@/components/ui';
import { StatusBadge } from '@/components/status-badge';
import { PRODUCTION_UNIT_CONFIG, type ProductionUnitKind } from '@/lib/production-unit-config';

type FeedTab = 'dashboard' | 'recipes' | 'materials' | 'productions' | 'finished' | 'movements';
type FeedStage = string;
type FeedForm = string;
type FeedUnit = 'kg' | 'sac' | 'litre' | 'unité';
type FeedMaterial = { id: string; name: string; unit: FeedUnit; quantity: number; min: number; purchasePrice: number; supplier: string; location: string };
type FeedIngredient = { materialId: string; name: string; quantityPer1000: number; unit: string };
type FeedRecipe = { id: string; name: string; target: string; stage: FeedStage; form: FeedForm; sellable: boolean; batchSize: number; ingredients: FeedIngredient[]; status: 'Active' | 'Archivée'; note: string };
type FeedConsumption = { materialId: string; name: string; quantity: number; unit: string; cost: number; confirmedBy?: string; confirmedAt?: string };
type FeedProduction = { id: string; date: string; recipeId: string; recipeName: string; stage: FeedStage; form: FeedForm; quantity: number; operator: string; status: 'Terminée' | 'En préparation'; cost: number; costPerKg: number; consumption: FeedConsumption[] };
type FeedFinishedStock = { id: string; recipeId: string; recipeName: string; stage: FeedStage; form: FeedForm; sellable: boolean; quantity: number; unit: 'kg'; costPerKg: number; lastProduction: string };
type FeedMovement = { id: string; date: string; type: 'Entrée matière' | 'Consommation production' | 'Transfert inter-unités' | 'Ajustement'; itemName: string; quantity: number; unit: string; source?: string; destination?: string; reference: string; operator: string };
type DraftIngredient = { materialId: string; quantityPer1000: number };

const tabs: Array<{ id: FeedTab; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'recipes', label: 'Recettes' },
  { id: 'materials', label: 'Matières premières' },
  { id: 'productions', label: 'Productions' },
  { id: 'finished', label: 'Stock aliments finis' },
  { id: 'movements', label: 'Mouvements' },
];

function unitTabLabel(kind: ProductionUnitKind, tab: FeedTab) {
  if (kind === 'bio') return tab === 'recipes' ? 'Préparations bio' : tab === 'materials' ? 'Plantes naturelles' : tab === 'finished' ? 'Stock produits bio' : tabs.find((item) => item.id === tab)?.label ?? tab;
  return tabs.find((item) => item.id === tab)?.label ?? tab;
}

export function ProvenderieView({ initialTab = 'dashboard', kind = 'provenderie' }: { initialTab?: FeedTab; kind?: ProductionUnitKind }) {
  const tab = initialTab;
  const config = PRODUCTION_UNIT_CONFIG[kind];
  const storage = config.storage;
  const [recipes, setRecipes] = useState<FeedRecipe[]>([]);
  const [materials, setMaterials] = useState<FeedMaterial[]>([]);
  const [productions, setProductions] = useState<FeedProduction[]>([]);
  const [finishedStock, setFinishedStock] = useState<FeedFinishedStock[]>([]);
  const [movements, setMovements] = useState<FeedMovement[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [query, setQuery] = useState('');
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [productionOpen, setProductionOpen] = useState(false);
  const [materialEntryOpen, setMaterialEntryOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<FeedMaterial | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<FeedRecipe | null>(null);
  const [draftIngredients, setDraftIngredients] = useState<DraftIngredient[]>([]);
  const [productionRecipeId, setProductionRecipeId] = useState('');
  const [productionQuantity, setProductionQuantity] = useState(0);
  const [confirmedIngredients, setConfirmedIngredients] = useState<Record<string, { quantity: number; confirmedBy: string; confirmedAt: string }>>({});

  useEffect(() => {
    setRecipes(readLocal(storage.recipes, [] as FeedRecipe[]));
    setMaterials(readLocal(storage.materials, [] as FeedMaterial[]));
    setProductions(readLocal(storage.productions, [] as FeedProduction[]));
    setFinishedStock(readLocal(storage.finishedStock, [] as FeedFinishedStock[]));
    setMovements(readLocal(storage.movements, [] as FeedMovement[]));
    setHydrated(true);
  }, [kind, storage.recipes, storage.materials, storage.productions, storage.finishedStock, storage.movements]);
  useEffect(() => { if (hydrated) writeLocal(storage.recipes, recipes); }, [recipes, hydrated, storage.recipes]);
  useEffect(() => { if (hydrated) writeLocal(storage.materials, materials); }, [materials, hydrated, storage.materials]);
  useEffect(() => { if (hydrated) writeLocal(storage.productions, productions); }, [productions, hydrated, storage.productions]);
  useEffect(() => { if (hydrated) writeLocal(storage.finishedStock, finishedStock); }, [finishedStock, hydrated, storage.finishedStock]);
  useEffect(() => { if (hydrated) writeLocal(storage.movements, movements); }, [movements, hydrated, storage.movements]);

  const activeRecipes = recipes.filter((recipe) => recipe.status === 'Active');
  const criticalMaterials = materials.filter((material) => material.quantity <= material.min);
  const finishedTotal = finishedStock.reduce((sum, item) => sum + item.quantity, 0);
  const currentMonth = '2026-08';
  const monthProductions = productions.filter((production) => production.date.startsWith(currentMonth));
  const monthProductionTotal = monthProductions.reduce((sum, production) => sum + production.quantity, 0);
  const monthCost = monthProductions.reduce((sum, production) => sum + production.cost, 0);
  const visibleRecipes = recipes.filter((recipe) => `${recipe.id} ${recipe.name} ${recipe.target}`.toLowerCase().includes(query.toLowerCase()));
  const visibleMaterials = materials.filter((material) => `${material.id} ${material.name} ${material.supplier}`.toLowerCase().includes(query.toLowerCase()));
  const visibleProductions = productions.filter((production) => `${production.id} ${production.recipeName} ${production.operator}`.toLowerCase().includes(query.toLowerCase()));

  function notify(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(''), 4200);
  }

  function openNewRecipe() {
    setEditingRecipe(null);
    setDraftIngredients([]);
    setRecipeOpen(true);
  }

  function openEditRecipe(recipe: FeedRecipe) {
    setEditingRecipe(recipe);
    setDraftIngredients(recipe.ingredients.map((ingredient) => ({ materialId: ingredient.materialId, quantityPer1000: ingredient.quantityPer1000 })));
    setRecipeOpen(true);
  }

  function deleteRecipe(recipe: FeedRecipe) {
    if (productions.some((production) => production.recipeId === recipe.id)) {
      setRecipes((current) => current.map((item) => item.id === recipe.id ? { ...item, status: 'Archivée' } : item));
      notify(`La recette « ${recipe.name} » a été archivée car elle possède déjà une production.`);
      return;
    }
    if (!window.confirm(`Supprimer définitivement la recette « ${recipe.name} » ?`)) return;
    setRecipes((current) => current.filter((item) => item.id !== recipe.id));
    notify(`La recette « ${recipe.name} » a été supprimée.`);
  }

  function addIngredient() {
    setDraftIngredients((current) => [...current, { materialId: materials[0]?.id ?? '', quantityPer1000: 0 }]);
  }

  function updateIngredient(index: number, key: keyof DraftIngredient, value: string | number) {
    setDraftIngredients((current) => current.map((ingredient, position) => position === index ? { ...ingredient, [key]: value } : ingredient));
  }

  function removeIngredient(index: number) {
    setDraftIngredients((current) => current.filter((_, position) => position !== index));
  }

  function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const target = String(form.get('target') ?? config.targets[0]);
    const stage = String(form.get('stage') ?? config.stages[0]) as FeedStage;
    const feedForm = String(form.get('form') ?? config.forms[0]) as FeedForm;
    const sellable = form.get('sellable') === 'on';
    const batchSize = Number(form.get('batchSize') ?? 1000);
    const note = String(form.get('note') ?? '').trim();
    if (!name || batchSize <= 0) return;
    const ingredients: FeedIngredient[] = draftIngredients.filter((draft) => draft.materialId && Number(draft.quantityPer1000) > 0).map((draft) => {
      const material = materials.find((item) => item.id === draft.materialId);
      return { materialId: draft.materialId, name: material?.name ?? 'Matière', quantityPer1000: Number(draft.quantityPer1000), unit: material?.unit ?? 'kg' };
    });
    const recipe: FeedRecipe = { id: editingRecipe?.id ?? `REC-${Date.now()}`, name, target, stage, form: feedForm, sellable, batchSize, ingredients, status: editingRecipe?.status ?? 'Active', note };
    setRecipes((current) => editingRecipe ? current.map((item) => item.id === editingRecipe.id ? recipe : item) : [recipe, ...current]);
    setRecipeOpen(false);
    setEditingRecipe(null);
    notify(`La recette « ${name} » a été ${editingRecipe ? 'modifiée' : 'créée'}.`);
  }

  function saveMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const unit = String(form.get('unit') ?? 'kg') as FeedUnit;
    const quantity = Number(form.get('quantity') ?? 0);
    const min = Number(form.get('min') ?? 0);
    const purchasePrice = Number(form.get('purchasePrice') ?? 0);
    const supplier = String(form.get('supplier') ?? '').trim();
    const location = String(form.get('location') ?? `Magasin ${config.name.toLowerCase()}`).trim();
    if (!name || quantity < 0 || min < 0 || purchasePrice < 0) return;
    const material: FeedMaterial = { id: editingMaterial?.id ?? `MAT-${Date.now()}`, name, unit, quantity, min, purchasePrice, supplier, location };
    setMaterials((current) => editingMaterial ? current.map((item) => item.id === editingMaterial.id ? material : item) : [material, ...current]);
    setMaterialOpen(false);
    setEditingMaterial(null);
    notify(`La matière « ${name} » a été ${editingMaterial ? 'modifiée' : 'ajoutée'}.`);
  }

  function createMaterialEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const materialId = String(form.get('materialId') ?? '');
    const quantity = Number(form.get('quantity') ?? 0);
    const date = String(form.get('date') ?? '2026-08-13');
    const reference = String(form.get('reference') ?? '').trim() || 'Entrée matière';
    const material = materials.find((item) => item.id === materialId);
    if (!material || quantity <= 0) return;
    setMaterials((current) => current.map((item) => item.id === material.id ? { ...item, quantity: item.quantity + quantity } : item));
    setMovements((current) => [{ id: `MVT-${Date.now()}`, date, type: 'Entrée matière', itemName: material.name, quantity, unit: material.unit, source: String(form.get('supplier') ?? '').trim() || 'Fournisseur', destination: 'Stock matières premières', reference, operator: 'Administrateur' }, ...current]);
    setMaterialEntryOpen(false);
    notify(`${formatNumber(quantity)} ${material.unit} de ${material.name} ont été ajoutés au stock matières.`);
  }

  function openProduction() {
    const recipe = activeRecipes[0];
    setProductionRecipeId(recipe?.id ?? '');
    setProductionQuantity(recipe?.batchSize ?? 0);
    setConfirmedIngredients({});
    setProductionOpen(true);
  }

  const selectedProductionRecipe = recipes.find((recipe) => recipe.id === productionRecipeId);
  const requiredIngredients = selectedProductionRecipe ? selectedProductionRecipe.ingredients.map((ingredient) => { const material = materials.find((item) => item.id === ingredient.materialId); return { ...ingredient, name: material?.name ?? ingredient.name, required: productionQuantity / selectedProductionRecipe.batchSize * ingredient.quantityPer1000, available: material?.quantity ?? 0, unit: material?.unit ?? ingredient.unit }; }) : [];
  const missingIngredients = requiredIngredients.filter((ingredient) => !confirmedIngredients[ingredient.materialId] || confirmedIngredients[ingredient.materialId].quantity <= 0);

  function confirmIngredient(materialId: string, quantity: number) {
    const required = requiredIngredients.find((ingredient) => ingredient.materialId === materialId);
    if (!required || quantity < required.required || quantity <= 0) { notify(`Quantité insuffisante pour ${required?.name ?? 'cet ingrédient'}. Requis : ${formatNumber(required?.required ?? 0)}.`); return; }
    const material = materials.find((item) => item.id === materialId);
    if (!material || material.quantity < quantity) { notify(`Stock insuffisant pour ${required?.name ?? 'cet ingrédient'}.`); return; }
    const confirmedBy = getCurrentOperatorName();
    setMaterials((current) => current.map((item) => item.id === materialId ? { ...item, quantity: item.quantity - quantity } : item));
    setConfirmedIngredients((current) => ({ ...current, [materialId]: { quantity, confirmedBy, confirmedAt: new Date().toISOString() } }));
  }

  function unconfirmIngredient(materialId: string) {
    const checked = confirmedIngredients[materialId];
    if (!checked) return;
    setMaterials((current) => current.map((item) => item.id === materialId ? { ...item, quantity: item.quantity + checked.quantity } : item));
    setConfirmedIngredients((current) => { const next = { ...current }; delete next[materialId]; return next; });
  }

  function resetConfirmedIngredients() {
    Object.entries(confirmedIngredients).forEach(([materialId, checked]) => setMaterials((current) => current.map((item) => item.id === materialId ? { ...item, quantity: item.quantity + checked.quantity } : item)));
    setConfirmedIngredients({});
  }

  function cancelProduction() {
    Object.entries(confirmedIngredients).forEach(([materialId, checked]) => setMaterials((current) => current.map((item) => item.id === materialId ? { ...item, quantity: item.quantity + checked.quantity } : item)));
    setConfirmedIngredients({});
    setProductionOpen(false);
  }

  function createProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipe = recipes.find((item) => item.id === productionRecipeId);
    const quantity = productionQuantity;
    const date = String(form.get('date') ?? '2026-08-13');
    const operator = String(form.get('operator') ?? getCurrentOperatorName()).trim();
    if (!recipe || quantity <= 0 || missingIngredients.length > 0) { notify(`Confirmez encore ${missingIngredients.length} ingrédient(s) avant de lancer la production.`); return; }
    const consumption: FeedConsumption[] = requiredIngredients.map((ingredient) => { const checked = confirmedIngredients[ingredient.materialId]; const material = materials.find((item) => item.id === ingredient.materialId); return { materialId: ingredient.materialId, name: ingredient.name, quantity: checked.quantity, unit: ingredient.unit, cost: checked.quantity * Number(material?.purchasePrice ?? 0), confirmedBy: checked.confirmedBy, confirmedAt: checked.confirmedAt }; });
    const cost = consumption.reduce((sum, item) => sum + item.cost, 0);
    const production: FeedProduction = { id: `PROD-${Date.now()}`, date, recipeId: recipe.id, recipeName: recipe.name, stage: recipe.stage, form: recipe.form, quantity, operator, status: 'Terminée', cost, costPerKg: quantity ? cost / quantity : 0, consumption };
    setProductions((current) => [production, ...current]);
    setFinishedStock((current) => {
      const existing = current.find((item) => item.recipeId === recipe.id);
      if (!existing) return [{ id: `FIN-${Date.now()}`, recipeId: recipe.id, recipeName: recipe.name, stage: recipe.stage, form: recipe.form, sellable: recipe.sellable, quantity, unit: 'kg', costPerKg: production.costPerKg, lastProduction: date }, ...current];
      const totalQuantity = existing.quantity + quantity;
      return current.map((item) => item.id === existing.id ? { ...item, quantity: totalQuantity, costPerKg: totalQuantity ? (existing.quantity * existing.costPerKg + cost) / totalQuantity : production.costPerKg, lastProduction: date } : item);
    });
    setMovements((current) => [...consumption.map((item) => ({ id: `MVT-${Date.now()}-${item.materialId}`, date, type: 'Consommation production' as const, itemName: item.name, quantity: item.quantity, unit: item.unit, source: item.name, destination: recipe.name, reference: production.id, operator })), ...current]);
    setConfirmedIngredients({});
    setProductionOpen(false);
    notify(`${quantity} kg de « ${recipe.name} » ont été produits. Coût : ${formatFCFA(cost)}.`);
  }

  function createTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stockId = String(form.get('stockId') ?? '');
    const quantity = Number(form.get('quantity') ?? 0);
    const date = String(form.get('date') ?? '2026-08-13');
    const destination = String(form.get('destination') ?? 'poulets');
    const note = String(form.get('note') ?? '').trim();
    const stock = finishedStock.find((item) => item.id === stockId);
    if (!stock || quantity <= 0 || quantity > stock.quantity) {
      notify('Transfert impossible : vérifiez l’aliment fini et la quantité disponible.');
      return;
    }
    const movementId = `MVT-${Date.now()}`;
    setFinishedStock((current) => current.map((item) => item.id === stock.id ? { ...item, quantity: item.quantity - quantity } : item).filter((item) => item.quantity > 0));
    setMovements((current) => [{ id: movementId, date, type: 'Transfert inter-unités', itemName: stock.recipeName, quantity, unit: stock.unit, source: config.name, destination, reference: note || 'Transfert interne', operator: 'Administrateur' }, ...current]);
    const shared = readLocal(FARM_STORAGE_KEYS.interUnitMovements, [] as Array<{ id: string; date: string; from: string; to: string; product: string; quantity: number; unit: string; status: 'Demandée' | 'En transit' | 'Réceptionné' | 'Annulé'; requestedBy: string; note: string }>);
    writeLocal(FARM_STORAGE_KEYS.interUnitMovements, [{ id: movementId, date, from: kind, to: destination, product: stock.recipeName, quantity, unit: stock.unit, status: 'En transit', requestedBy: 'Administrateur', note: note || 'Transfert de stock fini' }, ...shared]);
    setTransferOpen(false);
    notify(`${quantity} kg de ${stock.recipeName} ont été transférés vers ${destination}.`);
  }

  return <div className="fade-in space-y-7"><Header tab={tab} kind={kind} config={config} onNewRecipe={openNewRecipe} onNewMaterial={() => { setEditingMaterial(null); setMaterialOpen(true); }} onMaterialEntry={() => setMaterialEntryOpen(true)} onNewProduction={openProduction} onTransfer={() => setTransferOpen(true)} /><div className="flex items-start gap-3 rounded-xl border border-[#dcebdd] bg-[#f5faf2] px-4 py-3 text-[11px] text-[#5b8f60]"><Boxes size={15} /> {kind === 'bio' ? 'Les plantes et matières naturelles sont gérées séparément des préparations bio finies. Une préparation consomme le stock végétal et alimente le stock fini.' : 'Les matières premières et les aliments finis sont gérés dans deux stocks distincts. Une production consomme le stock matières et alimente le stock fini.'}</div>{feedback && <div className="flex items-start gap-2 rounded-xl border border-[#cde8c7] bg-[#effaeb] px-4 py-3 text-[12px] font-semibold text-[#4d8f51]"><Check size={14} />{feedback}</div>}{tab === 'dashboard' && <Dashboard recipes={activeRecipes} materials={materials} productions={productions} finishedStock={finishedStock} monthProductionTotal={monthProductionTotal} monthCost={monthCost} criticalMaterials={criticalMaterials} kind={kind} />} {tab === 'recipes' && <RecipesView recipes={visibleRecipes} materials={materials} query={query} setQuery={setQuery} onNew={openNewRecipe} onEdit={openEditRecipe} onDelete={deleteRecipe} />} {tab === 'materials' && <MaterialsView materials={visibleMaterials} query={query} setQuery={setQuery} kind={kind} onNew={() => { setEditingMaterial(null); setMaterialOpen(true); }} onEdit={(material) => { setEditingMaterial(material); setMaterialOpen(true); }} />} {tab === 'productions' && <ProductionsView productions={visibleProductions} query={query} setQuery={setQuery} onNew={openProduction} />} {tab === 'finished' && <FinishedView stock={finishedStock} kind={kind} onTransfer={() => setTransferOpen(true)} />} {tab === 'movements' && <MovementsView movements={movements} kind={kind} />}
    <Modal open={recipeOpen} onClose={() => { setRecipeOpen(false); setEditingRecipe(null); }} title={editingRecipe ? 'Modifier une recette' : 'Nouvelle recette'}><form onSubmit={saveRecipe} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Nom de la recette</span><input name="name" className="input-base" defaultValue={editingRecipe?.name ?? ''} placeholder="Ex. Poulet croissance" required /></label><label className="block"><span className="field-label">Destination</span><select name="target" className="input-base" defaultValue={editingRecipe?.target ?? config.targets[0]}>{config.targets.map((target) => <option key={target}>{target}</option>)}</select></label><label className="block"><span className="field-label">Phase d’aliment</span><select name="stage" className="input-base" defaultValue={editingRecipe?.stage ?? config.stages[0]}>{config.stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label><label className="block"><span className="field-label">Présentation</span><select name="form" className="input-base" defaultValue={editingRecipe?.form ?? config.forms[0]}>{config.forms.map((form) => <option key={form}>{form}</option>)}</select></label><label className="block"><span className="field-label">Base de fabrication (kg)</span><input name="batchSize" type="number" min="1" step="1" className="input-base" defaultValue={editingRecipe?.batchSize ?? 1000} required /></label><label className="flex items-center gap-2 rounded-xl border border-[#e6ede5] px-3 py-3 text-[11px] font-semibold text-[#65766c]"><input name="sellable" type="checkbox" defaultChecked={editingRecipe?.sellable ?? true} className="h-3.5 w-3.5 accent-[#5da561]" /> Vendable aux clients externes</label></div><div><div className="mb-3 flex items-center justify-between"><div><span className="field-label mb-0">Ingrédients pour la base</span><p className="mt-1 text-[10px] text-[#87958d]">La quantité est exprimée par base de fabrication.</p></div><button type="button" className="btn-secondary px-3 py-2 text-[10px]" onClick={addIngredient}><Plus size={13} /> Ajouter une matière</button></div><div className="space-y-2">{draftIngredients.map((ingredient, index) => <div className="flex items-center gap-2" key={`${ingredient.materialId}-${index}`}><select value={ingredient.materialId} onChange={(event) => updateIngredient(index, 'materialId', event.target.value)} className="input-base"><option value="">Choisir une matière</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name} · {material.unit}</option>)}</select><input type="number" min="0" step="0.01" value={ingredient.quantityPer1000} onChange={(event) => updateIngredient(index, 'quantityPer1000', Number(event.target.value))} className="input-base w-[140px]" placeholder="Quantité" /><button type="button" className="icon-btn h-9 w-9" onClick={() => removeIngredient(index)} aria-label="Supprimer la matière">×</button></div>)}{!draftIngredients.length && <p className="rounded-xl border border-dashed border-[#dce8db] px-4 py-5 text-center text-[11px] text-[#89968f]">Aucun ingrédient ajouté. Vous pourrez quand même créer la recette.</p>}</div></div><label className="block"><span className="field-label">Note</span><textarea name="note" className="input-base min-h-[70px] resize-none" defaultValue={editingRecipe?.note ?? ''} placeholder="Observation, usage, qualité..." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setRecipeOpen(false)}>Annuler</button><button className="btn-primary" type="submit"><Check size={15} /> Enregistrer la recette</button></div></form></Modal>
    <Modal open={materialEntryOpen} onClose={() => setMaterialEntryOpen(false)} title={kind === 'bio' ? 'Entrée de plantes naturelles' : 'Entrée de matières premières'}><form onSubmit={createMaterialEntry} className="space-y-5"><p className="muted text-[12px] leading-5">Cette opération augmente uniquement le stock des {kind === 'bio' ? 'plantes et matières naturelles' : 'matières premières'} destinées à la fabrication. Elle crée une trace d’entrée dans les mouvements.</p><label className="block"><span className="field-label">Matière</span><select name="materialId" className="input-base" required><option value="">Choisir une matière</option>{materials.map((material) => <option key={material.id} value={material.id}>{material.name} · stock actuel {formatNumber(material.quantity)} {material.unit}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Quantité reçue</span><input name="quantity" type="number" min="0.01" step="0.01" className="input-base" placeholder="1000" required /></label><label className="block"><span className="field-label">Date d’entrée</span><input name="date" type="date" defaultValue="2026-08-13" className="input-base" required /></label></div><label className="block"><span className="field-label">Fournisseur</span><input name="supplier" className="input-base" placeholder="Nom du fournisseur" /></label><label className="block"><span className="field-label">Référence / bon de réception</span><input name="reference" className="input-base" placeholder="Ex. BR-2026-001" /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMaterialEntryOpen(false)}>Annuler</button><button className="btn-primary" type="submit"><Check size={15} /> Enregistrer l’entrée</button></div></form></Modal>
    <Modal open={materialOpen} onClose={() => { setMaterialOpen(false); setEditingMaterial(null); }} title={editingMaterial ? `Modifier · ${config.materialsTitle}` : `Ajouter · ${config.materialsTitle}`}><form onSubmit={saveMaterial} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="field-label">{kind === 'bio' ? 'Nom de la plante ou matière naturelle' : 'Nom de la matière'}</span><input name="name" className="input-base" defaultValue={editingMaterial?.name ?? ''} placeholder={config.materialPlaceholder} required /></label><label className="block"><span className="field-label">Unité</span><select name="unit" className="input-base" defaultValue={editingMaterial?.unit ?? 'kg'}><option>kg</option><option>sac</option><option>litre</option><option>unité</option></select></label><label className="block"><span className="field-label">Prix d’achat unitaire (FCFA)</span><input name="purchasePrice" type="number" min="0" className="input-base" defaultValue={editingMaterial?.purchasePrice ?? 0} required /></label><label className="block"><span className="field-label">Quantité disponible</span><input name="quantity" type="number" min="0" step="0.01" className="input-base" defaultValue={editingMaterial?.quantity ?? 0} required /></label><label className="block"><span className="field-label">Seuil d’alerte</span><input name="min" type="number" min="0" step="0.01" className="input-base" defaultValue={editingMaterial?.min ?? 0} required /></label><label className="block"><span className="field-label">Fournisseur</span><input name="supplier" className="input-base" defaultValue={editingMaterial?.supplier ?? ''} placeholder="Nom du fournisseur" /></label><label className="block"><span className="field-label">Emplacement</span><input name="location" className="input-base" defaultValue={editingMaterial?.location ?? `Magasin ${config.name.toLowerCase()}`} /></label></div><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setMaterialOpen(false)}>Annuler</button><button className="btn-primary" type="submit"><Check size={15} /> Enregistrer</button></div></form></Modal>
    <Modal open={productionOpen} onClose={cancelProduction} title="Lancer une production"><form onSubmit={createProduction} className="space-y-5"><p className="muted text-[12px] leading-5">Chaque ingrédient doit être confirmé visuellement comme prélevé avant le lancement. La confirmation débite immédiatement le stock puis laisse une trace de l’opérateur et de l’heure.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="field-label">Recette</span><select name="recipeId" className="input-base" value={productionRecipeId} onChange={(event) => { const recipe = recipes.find((item) => item.id === event.target.value); setProductionRecipeId(event.target.value); setProductionQuantity(recipe?.batchSize ?? 0); resetConfirmedIngredients(); }} required><option value="">Choisir une recette</option>{activeRecipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name} · base {recipe.batchSize} kg</option>)}</select></label><label className="block"><span className="field-label">Quantité à fabriquer (kg)</span><input name="quantity" type="number" min="1" step="1" className="input-base" value={productionQuantity || ''} onChange={(event) => { if (Object.keys(confirmedIngredients).length) { notify('Annulez les prélèvements confirmés avant de changer la quantité.'); return; } setProductionQuantity(Number(event.target.value)); }} placeholder="1000" required /></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-13" className="input-base" required /></label><label className="block sm:col-span-2"><span className="field-label">Responsable</span><input name="operator" className="input-base" placeholder="Nom du responsable" defaultValue={getCurrentOperatorName()} required /></label></div>{selectedProductionRecipe && <div><div className="mb-3 flex items-center justify-between"><div><span className="field-label mb-0">Prélèvements requis</span><p className="mt-1 text-[10px] text-[#87958d]">{missingIngredients.length ? `${missingIngredients.length} ingrédient(s) restent à confirmer.` : 'Tous les ingrédients sont confirmés.'}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${missingIngredients.length ? 'bg-[#fdeceb] text-[#bd5c5c]' : 'bg-[#edf8e9] text-[#5b9d5b]'}`}>{missingIngredients.length ? 'Incomplet' : 'Complet'}</span></div><div className="space-y-2">{requiredIngredients.map((ingredient) => { const checked = confirmedIngredients[ingredient.materialId]; return <div key={ingredient.materialId} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center ${checked ? 'border-[#bfe2b8] bg-[#f0faed]' : 'border-[#f0c6c3] bg-[#fff7f6]'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${checked ? 'bg-[#dff3d9] text-[#4d9352]' : 'bg-[#fde1df] text-[#bd5c5c]'}`}>{checked ? <Check size={15} /> : <AlertTriangle size={15} />}</span><span className="min-w-0 flex-1"><strong className="block text-[11px] text-ink">{ingredient.name}</strong><small className="mt-1 block text-[10px] text-[#718078]">Requis : {formatNumber(ingredient.required)} {ingredient.unit} · Stock avant : {formatNumber(ingredient.available)} {ingredient.unit}</small>{checked && <small className="mt-1 block text-[9px] text-[#4d9352]">Confirmé par {checked.confirmedBy} à {new Date(checked.confirmedAt).toLocaleString('fr-FR')}</small>}</span>{checked ? <button type="button" className="btn-secondary px-2.5 py-1.5 text-[10px]" onClick={() => unconfirmIngredient(ingredient.materialId)}>Annuler le prélèvement</button> : <button type="button" className="btn-primary px-2.5 py-1.5 text-[10px]" onClick={() => confirmIngredient(ingredient.materialId, ingredient.required)}>Confirmer le prélèvement</button>}</div>; })}</div></div>}{!selectedProductionRecipe && <p className="rounded-xl border border-dashed border-[#dce8db] p-4 text-center text-[11px] text-[#89968f]">Choisissez une recette pour afficher les ingrédients nécessaires.</p>}<div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={cancelProduction}>Annuler</button><button className="btn-primary disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={!selectedProductionRecipe || missingIngredients.length > 0}><Factory size={15} /> {missingIngredients.length ? `Il manque ${missingIngredients.length} prélèvement(s)` : 'Lancer la production'}</button></div></form></Modal>
    <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transférer un aliment fini"><form onSubmit={createTransfer} className="space-y-5"><p className="muted text-[12px] leading-5">Le transfert réduit le stock fini de la provenderie et crée une trace inter-unités.</p><label className="block"><span className="field-label">Aliment fini</span><select name="stockId" className="input-base" required><option value="">Choisir un aliment</option>{finishedStock.map((item) => <option key={item.id} value={item.id}>{item.recipeName} · disponible {formatNumber(item.quantity)} kg</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="field-label">Quantité (kg)</span><input name="quantity" type="number" min="1" step="1" className="input-base" placeholder="500" required /></label><label className="block"><span className="field-label">Date</span><input name="date" type="date" defaultValue="2026-08-13" className="input-base" /></label></div><label className="block"><span className="field-label">Destination</span><select name="destination" className="input-base"><option value="poulets">Ferme de poulets</option><option value="stocks">Magasin central</option></select></label><label className="block"><span className="field-label">Référence / note</span><textarea name="note" className="input-base min-h-[70px] resize-none" placeholder="Ex. Approvisionnement bande LP-..." /></label><div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setTransferOpen(false)}>Annuler</button><button className="btn-primary" type="submit"><Truck size={15} /> Valider le transfert</button></div></form></Modal>
  </div>;
}

function Header({ tab, kind, config, onNewRecipe, onNewMaterial, onMaterialEntry, onNewProduction, onTransfer }: { tab: FeedTab; kind: ProductionUnitKind; config: typeof PRODUCTION_UNIT_CONFIG[ProductionUnitKind]; onNewRecipe: () => void; onNewMaterial: () => void; onMaterialEntry: () => void; onNewProduction: () => void; onTransfer: () => void }) { return <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><Link href="/selection-unite" className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold text-[#6c8176] hover:text-forest">← Changer d’unité</Link><p className="eyebrow mb-2">{config.eyebrow}</p><h1 className="page-title">{tab === 'dashboard' ? `Dashboard ${config.name.toLowerCase()}` : unitTabLabel(kind, tab)}</h1><p className="muted mt-2 max-w-2xl text-[13px] leading-5">{config.description}</p></div><div className="flex flex-wrap gap-2">{tab === 'recipes' && <button className="btn-primary" onClick={onNewRecipe}><Plus size={15} /> Nouvelle recette</button>}{tab === 'materials' && <><button className="btn-secondary" onClick={onNewMaterial}><Plus size={15} /> {kind === 'bio' ? 'Nouvelle plante' : 'Nouvelle matière'}</button><button className="btn-primary" onClick={onMaterialEntry}><ArrowDownRight size={15} /> Entrée matière</button></>}{tab === 'productions' && <button className="btn-primary" onClick={onNewProduction}><Factory size={15} /> Lancer une production</button>}{tab === 'finished' && <button className="btn-primary" onClick={onTransfer}><Truck size={15} /> Transférer vers une unité</button>}{tab === 'dashboard' && <><button className="btn-secondary" onClick={onNewMaterial}><Plus size={15} /> {kind === 'bio' ? 'Plante naturelle' : 'Matière première'}</button><button className="btn-primary" onClick={onNewProduction}><Factory size={15} /> Nouvelle production</button></>}</div></div>; }

function Dashboard({ recipes, materials, productions, finishedStock, monthProductionTotal, monthCost, criticalMaterials, kind }: { recipes: FeedRecipe[]; materials: FeedMaterial[]; productions: FeedProduction[]; finishedStock: FeedFinishedStock[]; monthProductionTotal: number; monthCost: number; criticalMaterials: FeedMaterial[]; kind: ProductionUnitKind }) { const config = PRODUCTION_UNIT_CONFIG[kind]; const totalFinished = finishedStock.reduce((sum, item) => sum + item.quantity, 0); return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Production du mois" value={`${formatNumber(monthProductionTotal)} kg`} change={productions.length ? `${productions.length} production(s)` : 'Aucune donnée'} detail="saisie locale" icon={Factory} tone="green" /><StatCard label={kind === 'bio' ? 'Préparations actives' : 'Recettes actives'} value={String(recipes.length)} change={recipes.length ? 'prêtes à produire' : 'À créer'} detail={config.name} icon={ClipboardCheck} tone="blue" /><StatCard label={kind === 'bio' ? 'Plantes critiques' : 'Matières critiques'} value={String(criticalMaterials.length)} change={criticalMaterials.length ? 'À réapprovisionner' : 'Aucune alerte'} detail="seuils configurés" icon={AlertTriangle} tone="orange" /><StatCard label={config.finishedTitle} value={`${formatNumber(totalFinished)} kg`} change={finishedStock.length ? `${finishedStock.length} référence(s)` : 'Aucun stock'} detail="disponible" icon={Package} tone="purple" /></div><div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]"><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Performance" title="Productions récentes" description="Les quantités et coûts viennent des productions enregistrées." /><div className="mt-5 space-y-4">{productions.slice(0, 4).length ? productions.slice(0, 4).map((production) => <div className="flex items-center gap-3 rounded-xl border border-[#edf0eb] p-3" key={production.id}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff3e4] text-[#be7839]"><Wheat size={16} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-[11px] font-bold text-ink">{production.recipeName}</p><strong className="text-[11px] text-ink">{formatNumber(production.quantity)} kg</strong></div><p className="mt-1 text-[10px] text-[#8b9891]">{production.stage} · {production.form} · {formatDate(production.date)} · {formatFCFA(production.costPerKg)} / kg · {production.operator}</p><div className="mt-2"><MiniProgress value={Math.min(production.quantity / 5000 * 100, 100)} color="orange" label="Volume fabriqué" right={`${formatNumber(production.quantity)} kg`} /></div></div></div>) : <EmptyState title="Aucune production enregistrée" description="Créez une recette puis lancez la première fabrication de la provenderie." />}</div></div><div className="surface p-5 sm:p-6"><SectionHeading eyebrow="Alertes" title="Matières premières" /><div className="mt-5 space-y-3">{criticalMaterials.length ? criticalMaterials.slice(0, 5).map((material) => <div className="flex items-center gap-3 rounded-xl border border-[#f0dfc4] bg-[#fff9ed] p-3" key={material.id}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffeccf] text-[#bd7937]"><Boxes size={15} /></span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-ink">{material.name}</p><p className="mt-1 text-[10px] text-[#9a7651]">{formatNumber(material.quantity)} {material.unit} · seuil {formatNumber(material.min)}</p></div><span className="text-[10px] font-bold text-[#bd7737]">{formatFCFA(material.purchasePrice)}</span></div>) : <div className="rounded-xl border border-dashed border-[#dce8db] p-6 text-center text-[11px] text-[#89968f]">Aucune matière sous le seuil.</div>}</div></div></div><div className="surface p-5 sm:p-6"><div className="flex items-center justify-between"><SectionHeading eyebrow="Coût de fabrication" title="Coût moyen du mois" description="Calculé à partir des matières consommées et de leur prix d’achat." /><strong className="text-[20px] font-black text-forest">{monthProductionTotal ? formatFCFA(monthCost / monthProductionTotal) : '—'} / kg</strong></div><div className="mt-6 h-3 overflow-hidden rounded-full bg-[#edf1eb]"><div className="h-full rounded-full bg-[#e9975c]" style={{ width: `${monthProductionTotal ? Math.min(monthCost / monthProductionTotal / 1000 * 100, 100) : 0}%` }} /></div><div className="mt-2 flex justify-between text-[10px] text-[#8b9891]"><span>Coût réel enregistré</span><span>{monthProductionTotal ? `${formatFCFA(monthCost)} au total` : 'Aucune production'}</span></div></div></div>; }

function RecipesView({ recipes, materials, query, setQuery, onNew, onEdit, onDelete }: { recipes: FeedRecipe[]; materials: FeedMaterial[]; query: string; setQuery: (value: string) => void; onNew: () => void; onEdit: (recipe: FeedRecipe) => void; onDelete: (recipe: FeedRecipe) => void }) { return <div className="space-y-5"><Toolbar query={query} setQuery={setQuery} placeholder="Rechercher une recette..." /><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{recipes.length ? recipes.map((recipe) => <div className="surface p-5" key={recipe.id}><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff3e4] text-[#be7839]"><Wheat size={18} /></span><StatusBadge status={recipe.status} /></div><div className="mt-4 flex items-start justify-between gap-3"><div><p className="text-[13px] font-bold text-ink">{recipe.name}</p><p className="mt-1 text-[10px] text-[#8b9891]">{recipe.target} · {recipe.stage} · {recipe.form} · base {formatNumber(recipe.batchSize)} kg</p><p className="mt-2 text-[10px] font-bold text-[#5b9d5b]">{recipe.sellable ? 'Vente externe autorisée' : 'Usage interne'}</p></div><div className="flex gap-1"><button className="icon-btn h-8 w-8" onClick={() => onEdit(recipe)} aria-label="Modifier la recette"><Edit3 size={14} /></button><button className="icon-btn h-8 w-8 text-[#b45d5d]" onClick={() => onDelete(recipe)} aria-label="Supprimer la recette"><Trash2 size={14} /></button></div></div><div className="mt-4 space-y-2">{recipe.ingredients.length ? recipe.ingredients.map((ingredient) => <div className="flex justify-between text-[10px] text-[#718078]" key={ingredient.materialId}><span>{ingredient.name}</span><strong>{formatNumber(ingredient.quantityPer1000)} {ingredient.unit}</strong></div>) : <p className="text-[10px] text-[#9aa59f]">Aucun ingrédient détaillé.</p>}</div><p className="mt-4 border-t border-[#edf0eb] pt-3 text-[10px] text-[#89968f]">{recipe.note || `${materials.length} matière(s) disponibles dans le catalogue.`}</p></div>) : <div className="md:col-span-2 xl:col-span-3"><EmptyState title="Aucune recette enregistrée" description="Créez votre première formule de provenderie." action={<button className="btn-primary" onClick={onNew}><Plus size={15} /> Créer une recette</button>} /></div>}</div></div>; }

function MaterialsView({ materials, query, setQuery, kind, onNew, onEdit }: { materials: FeedMaterial[]; query: string; setQuery: (value: string) => void; kind: ProductionUnitKind; onNew: () => void; onEdit: (material: FeedMaterial) => void }) { const config = PRODUCTION_UNIT_CONFIG[kind]; return <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Approvisionnement" title={config.materialsTitle} description={config.materialsDescription} /><div className="relative min-w-[220px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher une matière..." /></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Matière</th><th>Fournisseur</th><th>Quantité</th><th>Seuil</th><th>Prix achat</th><th>Emplacement</th><th /></tr></thead><tbody>{materials.length ? materials.map((material) => <tr className="table-row table-line" key={material.id}><td><p className="font-bold text-ink">{material.name}</p><p className="mt-1 text-[10px] text-[#9aa59f]">{material.id}</p></td><td>{material.supplier || '—'}</td><td className={material.quantity <= material.min ? 'font-bold text-[#bd7737]' : 'font-bold text-ink'}>{formatNumber(material.quantity)} {material.unit}</td><td>{formatNumber(material.min)} {material.unit}</td><td>{formatFCFA(material.purchasePrice)}</td><td>{material.location}</td><td><button className="icon-btn h-8 w-8" onClick={() => onEdit(material)} aria-label="Modifier la matière"><Edit3 size={14} /></button></td></tr>) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune matière première enregistrée. Ajoutez le premier stock.</td></tr>}</tbody></table></div></div>; }

function ProductionsView({ productions, query, setQuery, onNew }: { productions: FeedProduction[]; query: string; setQuery: (value: string) => void; onNew: () => void }) { return <div className="surface overflow-hidden"><div className="flex items-center justify-between border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Fabrication" title="Lots de production" description="Chaque lot conserve sa recette, son coût et les matières consommées." /><div className="relative min-w-[220px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder="Rechercher une production..." /></div></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Référence</th><th>Date</th><th>Recette</th><th>Type</th><th>Quantité</th><th>Coût total</th><th>Coût / kg</th><th>Responsable</th><th>Statut</th></tr></thead><tbody>{productions.length ? productions.map((production) => <tr className="table-row table-line" key={production.id}><td className="font-bold text-ink">{production.id}</td><td>{formatDate(production.date)}</td><td>{production.recipeName}</td><td>{production.stage} · {production.form}</td><td>{formatNumber(production.quantity)} kg</td><td>{formatFCFA(production.cost)}</td><td>{formatFCFA(production.costPerKg)}</td><td>{production.operator}</td><td><StatusBadge status={production.status} /></td></tr>) : <tr><td colSpan={9} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucune production enregistrée.</td></tr>}</tbody></table></div></div>; }

function FinishedView({ stock, kind, onTransfer }: { stock: FeedFinishedStock[]; kind: ProductionUnitKind; onTransfer: () => void }) { const config = PRODUCTION_UNIT_CONFIG[kind]; return <div className="space-y-5"><div className="mb-4"><p className="eyebrow">Stock fini</p><h2 className="mt-1 text-[19px] font-semibold text-ink">{config.finishedTitle}</h2><p className="muted mt-1 text-[12px]">Produits fabriqués, disponibles pour transfert ou vente externe.</p></div><div className="grid gap-4 md:grid-cols-3">{stock.length ? stock.map((item) => <div className="surface p-5" key={item.id}><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf8ea] text-[#5b9d5b]"><Package size={18} /></span><span className="text-[12px] font-black text-[#5b9d5b]">{formatNumber(item.quantity)} kg</span></div><p className="mt-4 text-[13px] font-bold text-ink">{item.recipeName}</p><p className="mt-1 text-[10px] text-[#8b9891]">{item.stage} · {item.form} · dernière production : {formatDate(item.lastProduction)}</p><p className="mt-2 text-[10px] font-bold text-[#5b9d5b]">{item.sellable ? 'Disponible pour vente externe' : 'Réservé à l’usage interne'}</p><p className="mt-3 text-[11px] font-bold text-[#5b9d5b]">{formatFCFA(item.costPerKg)} / kg</p><button className="btn-secondary mt-4 w-full px-3 py-2 text-[10px]" onClick={onTransfer}><Truck size={14} /> Transférer</button></div>) : <div className="md:col-span-3"><EmptyState title="Aucun aliment fini en stock" description="Lancez une production pour alimenter le stock fini." /></div>}</div></div>; }

function MovementsView({ movements, kind }: { movements: FeedMovement[]; kind: ProductionUnitKind }) { const config = PRODUCTION_UNIT_CONFIG[kind]; return <div className="surface overflow-hidden"><div className="border-b border-[#edf0eb] px-5 py-5 sm:px-6"><SectionHeading eyebrow="Traçabilité" title={`Mouvements de ${config.name.toLowerCase()}`} description={kind === 'bio' ? 'Entrées de plantes, consommations de préparation et transferts de produits bio.' : 'Consommations de matières et transferts inter-unités.'} /></div><div className="table-scroll"><table className="w-full text-left"><thead><tr className="table-head"><th>Date</th><th>Type</th><th>Article</th><th>Quantité</th><th>Source</th><th>Destination</th><th>Référence</th></tr></thead><tbody>{movements.length ? movements.map((movement) => <tr className="table-row table-line" key={movement.id}><td>{formatDate(movement.date)}</td><td><span className={`font-bold ${movement.type === 'Transfert inter-unités' ? 'text-[#6385bd]' : 'text-[#bd7737]'}`}>{movement.type}</span></td><td>{movement.itemName}</td><td>{formatNumber(movement.quantity)} {movement.unit}</td><td>{movement.source ?? '—'}</td><td>{movement.destination ?? '—'}</td><td>{movement.reference}</td></tr>) : <tr><td colSpan={7} className="px-6 py-14 text-center text-[11px] text-[#89968f]">Aucun mouvement enregistré.</td></tr>}</tbody></table></div></div>; }

function Toolbar({ query, setQuery, placeholder }: { query: string; setQuery: (value: string) => void; placeholder: string }) { return <div className="flex justify-end"><div className="relative min-w-[240px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="input-base h-9 rounded-lg bg-[#fbfcfa] pl-9 text-[11px]" placeholder={placeholder} /></div></div>; }

function getCurrentOperatorName() {
  if (typeof document === 'undefined') return 'Administrateur';
  const part = document.cookie.split('; ').find((item) => item.startsWith('agroflux_user_name='));
  return part ? decodeURIComponent(part.slice('agroflux_user_name='.length)) : 'Administrateur';
}
