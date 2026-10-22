export type PoultryProtocolType = 'eau' | 'aliment';

export type PoultryProtocol = {
  id: string;
  type: PoultryProtocolType;
  /** Un protocole opérationnel est affecté à un seul bâtiment. */
  buildingId?: string;
  buildingName?: string;
  name: string;
  steps: string[];
  version: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type PoultryProtocolTaskFields = {
  unitId?: string;
  category?: string;
  assignedBuildingId?: string;
  protocol?: string[];
  protocolId?: string;
  protocolVersion?: number;
};

type PoultryProtocolInstanceFields = PoultryProtocolTaskFields & {
  status?: string;
};

type PoultryProtocolBuilding = { id: string; name: string };

const PROTOCOL_TYPES: PoultryProtocolType[] = ['eau', 'aliment'];

const DEFAULT_STEPS: Record<PoultryProtocolType, string[]> = {
  eau: [
    'Rincer les abreuvoirs',
    'Vérifier la propreté de l’éponge',
    'Donner une eau propre',
    'Contrôler l’accès des sujets à l’eau',
  ],
  aliment: [
    'Vérifier les mangeoires',
    'Remuer les copeaux si nécessaire',
    'Contrôler la prise alimentaire',
  ],
};

export function poultryProtocolTypeForCategory(category?: string): PoultryProtocolType | undefined {
  if (category === 'service-eau') return 'eau';
  if (category === 'service-aliment') return 'aliment';
  return undefined;
}

export function poultryProtocolTypeLabel(type: PoultryProtocolType) {
  return type === 'eau' ? 'Eau' : 'Aliment';
}

export function poultryProtocolDefaultSteps(type: PoultryProtocolType) {
  return [...DEFAULT_STEPS[type]];
}

/** Retourne uniquement le protocole actif du bâtiment demandé. */
export function getActivePoultryProtocol(protocols: PoultryProtocol[], type: PoultryProtocolType, buildingId?: string) {
  return protocols
    .filter((protocol) => protocol.type === type && protocol.active && (buildingId ? protocol.buildingId === buildingId : !protocol.buildingId))
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt) || second.version - first.version)[0];
}

function cleanSteps(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((step) => step.trim()).filter(Boolean);
}

function normalizeProtocol(value: Partial<PoultryProtocol>, fallbackType: PoultryProtocolType, now: string): PoultryProtocol | null {
  const type = value.type === 'eau' || value.type === 'aliment' ? value.type : fallbackType;
  const steps = cleanSteps(value.steps);
  return {
    id: String(value.id || `PROTO-POULETS-${type.toUpperCase()}`),
    type,
    buildingId: String(value.buildingId || ''),
    buildingName: String(value.buildingName || ''),
    name: String(value.name || `Protocole ${poultryProtocolTypeLabel(type)}`),
    steps: steps.length ? steps : poultryProtocolDefaultSteps(type),
    version: Math.max(1, Math.floor(Number(value.version) || 1)),
    active: value.active !== false,
    createdAt: String(value.createdAt || now),
    updatedAt: String(value.updatedAt || value.createdAt || now),
  };
}

/**
 * Initialise les protocoles par bâtiment lorsqu'aucune ancienne configuration
 * globale ne doit être réutilisée. Les anciens protocoles sans bâtiment sont
 * conservés, mais ne sont jamais appliqués automatiquement à un bâtiment.
 */
export function seedPoultryProtocols(existing: PoultryProtocol[], templates: Array<PoultryProtocolTaskFields> = [], buildings: PoultryProtocolBuilding[] = [], now = new Date()) {
  const nowIso = now.toISOString();
  const normalized = existing.map((protocol) => normalizeProtocol(protocol, protocol.type, nowIso)).filter((protocol): protocol is PoultryProtocol => protocol !== null);
  const result = [...normalized];
  const validBuildings = buildings.filter((building, index, list) => building.id && list.findIndex((item) => item.id === building.id) === index);

  if (!validBuildings.length) {
    for (const type of PROTOCOL_TYPES) {
      if (getActivePoultryProtocol(result, type) || result.some((protocol) => protocol.type === type)) continue;
      result.push({ id: `PROTO-POULETS-${type.toUpperCase()}`, type, buildingId: '', buildingName: '', name: `Protocole ${poultryProtocolTypeLabel(type)}`, steps: poultryProtocolDefaultSteps(type), version: 1, active: true, createdAt: nowIso, updatedAt: nowIso });
    }
    return result;
  }

  for (const type of PROTOCOL_TYPES) {
    const hasUnassignedLegacy = result.some((protocol) => protocol.type === type && !protocol.buildingId);
    for (const building of validBuildings) {
      if (getActivePoultryProtocol(result, type, building.id) || hasUnassignedLegacy) continue;
      const source = templates.find((template) => template.unitId === 'poulets' && template.assignedBuildingId === building.id && poultryProtocolTypeForCategory(template.category) === type && cleanSteps(template.protocol).length)
        ?? templates.find((template) => template.unitId === 'poulets' && poultryProtocolTypeForCategory(template.category) === type && cleanSteps(template.protocol).length);
      result.push({
        id: `PROTO-POULETS-${type.toUpperCase()}-${building.id}`,
        type,
        buildingId: building.id,
        buildingName: building.name,
        name: `Protocole ${poultryProtocolTypeLabel(type)} · ${building.name}`,
        steps: source ? cleanSteps(source.protocol) : poultryProtocolDefaultSteps(type),
        version: 1,
        active: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  return result;
}

/** Lie chaque modèle de service au protocole actif de son bâtiment. */
export function linkPoultryTaskTemplates<T extends PoultryProtocolTaskFields>(templates: T[], protocols: PoultryProtocol[]) {
  return templates.map((template) => {
    if (template.unitId !== 'poulets') return template;
    const type = poultryProtocolTypeForCategory(template.category);
    const protocol = type && template.assignedBuildingId ? getActivePoultryProtocol(protocols, type, template.assignedBuildingId) : undefined;
    if (!protocol) return template;
    return {
      ...template,
      protocolId: protocol.id,
      protocolVersion: protocol.version,
      protocol: [...protocol.steps],
    };
  });
}

/** Met à jour uniquement les instances ouvertes du même bâtiment. */
export function linkPoultryPendingTaskInstances<T extends PoultryProtocolInstanceFields>(instances: T[], protocols: PoultryProtocol[]) {
  return instances.map((instance) => {
    if (instance.unitId !== 'poulets' || !['À faire', 'En cours'].includes(instance.status ?? '')) return instance;
    const type = poultryProtocolTypeForCategory(instance.category);
    const protocol = type && instance.assignedBuildingId ? getActivePoultryProtocol(protocols, type, instance.assignedBuildingId) : undefined;
    if (!protocol) return instance;
    return {
      ...instance,
      protocolId: protocol.id,
      protocolVersion: protocol.version,
      protocol: [...protocol.steps],
    };
  });
}

/** Applique une nouvelle version au bâtiment et au type concernés. */
export function applyPoultryProtocolChange<T extends PoultryProtocolTaskFields>(protocol: PoultryProtocol, templates: T[], instances: Array<PoultryProtocolInstanceFields>) {
  const templatesNext = linkPoultryTaskTemplates(templates, [protocol]);
  const instancesNext = instances.map((instance) => {
    const matches = Boolean(protocol.buildingId)
      && instance.unitId === 'poulets'
      && instance.assignedBuildingId === protocol.buildingId
      && (instance.protocolId === protocol.id || poultryProtocolTypeForCategory(instance.category) === protocol.type)
      && ['À faire', 'En cours'].includes(instance.status ?? '');
    if (!matches) return instance;
    return {
      ...instance,
      protocolId: protocol.id,
      protocolVersion: protocol.version,
      protocol: [...protocol.steps],
    };
  });
  return { templates: templatesNext, instances: instancesNext };
}
