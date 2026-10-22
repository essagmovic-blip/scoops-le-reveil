export type PoultryServiceShift = 'jour' | 'nuit';
export type SanitaryAnswer = 'Oui' | 'Non';
export type DroppingsColor = 'Marron' | 'Rouge' | 'Blanche' | 'Verte';
export type DroppingsTexture = 'Liquide' | 'Solide';
export type RespiratoryType = 'Buccale' | 'Nasale';
export type SanitaryCheckStatus = 'Conforme' | 'À surveiller';
export type PoultryUrgentStatus = 'Déclenchée' | 'Vue' | 'Répondue' | 'Nouvelle' | 'Traitée';

/** Questionnaire utilisé par la tâche quotidienne « état général des sujets ». */
export type PoultryGeneralStateQuestionnaire = {
  subjectsVigorous: SanitaryAnswer;
  subjectsVigorousWhy: string;
  foodConsumptionNormal: SanitaryAnswer;
  foodConsumptionWhy: string;
  waterConsumptionNormal: SanitaryAnswer;
  waterConsumptionWhy: string;
  droppingsColor: DroppingsColor;
  droppingsTexture: DroppingsTexture;
  respiratoryProblems: SanitaryAnswer;
  respiratoryType: RespiratoryType | '';
  ruffledFeathers: SanitaryAnswer;
  wingsAway: SanitaryAnswer;
  cough: SanitaryAnswer;
  rattles: SanitaryAnswer;
  wheezing: SanitaryAnswer;
};

/** Checklist d’observation quotidienne d’une bande et de son bâtiment. */
export type PoultrySanitaryCheck = {
  id: string;
  date: string;
  shift: PoultryServiceShift;
  buildingId: string;
  buildingName: string;
  batchId: string;
  mobilityVigorous: SanitaryAnswer;
  foodConsumptionNormal: SanitaryAnswer;
  foodConsumptionWhy: string;
  waterConsumptionNormal?: SanitaryAnswer;
  waterConsumptionWhy?: string;
  lamenessNormal: SanitaryAnswer;
  digestiveProblems: SanitaryAnswer;
  droppingsColor: DroppingsColor;
  droppingsTexture: DroppingsTexture;
  respiratoryProblems: SanitaryAnswer;
  respiratoryTypes: RespiratoryType[];
  ruffledFeathers: SanitaryAnswer;
  wingsAway: SanitaryAnswer;
  cough: SanitaryAnswer;
  rattles: SanitaryAnswer;
  wheezing: SanitaryAnswer;
  drinkersWashed: SanitaryAnswer;
  feedersFilled: SanitaryAnswer;
  materialStored: SanitaryAnswer;
  roomClean: SanitaryAnswer;
  ventilationChecked: SanitaryAnswer;
  comment: string;
  status: SanitaryCheckStatus;
  recordedById: string;
  recordedByName: string;
  recordedAt: string;
  generalStateQuestionnaire?: PoultryGeneralStateQuestionnaire;
  urgent?: boolean;
  urgentStatus?: PoultryUrgentStatus;
  urgentAt?: string;
  urgentTaskId?: string;
  responsibleTaskId?: string;
  responsibleTaskName?: string;
  urgentViewedAt?: string;
  urgentViewedById?: string;
  urgentViewedByName?: string;
  urgentResponse?: string;
  urgentRespondedAt?: string;
  urgentRespondedById?: string;
  urgentRespondedByName?: string;
  responseDelayMinutes?: number;
};

type SanitaryStatusFields = Pick<PoultrySanitaryCheck, 'mobilityVigorous' | 'foodConsumptionNormal' | 'lamenessNormal' | 'digestiveProblems' | 'respiratoryProblems' | 'ruffledFeathers' | 'wingsAway' | 'cough' | 'rattles' | 'wheezing'>
  & Partial<Pick<PoultrySanitaryCheck, 'waterConsumptionNormal' | 'droppingsColor' | 'droppingsTexture'>>;

export function normalizePoultryUrgentStatus(status?: PoultryUrgentStatus) {
  if (status === 'Nouvelle') return 'Déclenchée' as const;
  if (status === 'Traitée') return 'Répondue' as const;
  return status ?? 'Déclenchée';
}

export function sanitaryCheckStatus(check: SanitaryStatusFields): SanitaryCheckStatus {
  const requiresAttention = check.mobilityVigorous === 'Non'
    || check.foodConsumptionNormal === 'Non'
    || check.waterConsumptionNormal === 'Non'
    || check.lamenessNormal === 'Non'
    || check.digestiveProblems === 'Oui'
    || check.droppingsColor === 'Rouge'
    || check.droppingsColor === 'Blanche'
    || check.droppingsColor === 'Verte'
    || check.droppingsTexture === 'Liquide'
    || check.respiratoryProblems === 'Oui'
    || check.ruffledFeathers === 'Oui'
    || check.wingsAway === 'Oui'
    || check.cough === 'Oui'
    || check.rattles === 'Oui'
    || check.wheezing === 'Oui';
  return requiresAttention ? 'À surveiller' : 'Conforme';
}

export function poultryGeneralStateStatus(questionnaire: PoultryGeneralStateQuestionnaire): SanitaryCheckStatus {
  return sanitaryCheckStatus({
    mobilityVigorous: questionnaire.subjectsVigorous,
    foodConsumptionNormal: questionnaire.foodConsumptionNormal,
    waterConsumptionNormal: questionnaire.waterConsumptionNormal,
    lamenessNormal: 'Oui',
    digestiveProblems: questionnaire.droppingsColor !== 'Marron' || questionnaire.droppingsTexture === 'Liquide' ? 'Oui' : 'Non',
    droppingsColor: questionnaire.droppingsColor,
    droppingsTexture: questionnaire.droppingsTexture,
    respiratoryProblems: questionnaire.respiratoryProblems,
    ruffledFeathers: questionnaire.ruffledFeathers,
    wingsAway: questionnaire.wingsAway,
    cough: questionnaire.cough,
    rattles: questionnaire.rattles,
    wheezing: questionnaire.wheezing,
  });
}

export type UrgentPoultryCheckContext = {
  taskId: string;
  date: string;
  shift: PoultryServiceShift;
  buildingId: string;
  buildingName: string;
  batchId: string;
  recordedById: string;
  recordedByName: string;
  recordedAt: string;
};

/** Transforme la saisie de la tâche en alerte sanitaire urgente lisible par RH. */
export function urgentPoultrySanitaryCheck(context: UrgentPoultryCheckContext, questionnaire: PoultryGeneralStateQuestionnaire): PoultrySanitaryCheck {
  const reasons = [
    questionnaire.subjectsVigorous === 'Non' ? `Sujets peu vifs : ${questionnaire.subjectsVigorousWhy}` : '',
    questionnaire.foodConsumptionNormal === 'Non' ? `Consommation alimentaire anormale : ${questionnaire.foodConsumptionWhy}` : '',
    questionnaire.waterConsumptionNormal === 'Non' ? `Consommation d’eau anormale : ${questionnaire.waterConsumptionWhy}` : '',
    questionnaire.droppingsColor !== 'Marron' || questionnaire.droppingsTexture === 'Liquide' ? `Fientes : ${questionnaire.droppingsColor}, ${questionnaire.droppingsTexture.toLowerCase()}.` : '',
    questionnaire.respiratoryProblems === 'Oui' ? `Problème respiratoire${questionnaire.respiratoryType ? ` · respiration ${questionnaire.respiratoryType.toLowerCase()}` : ''}.` : '',
    questionnaire.ruffledFeathers === 'Oui' ? 'Plumes ébouriffées.' : '',
    questionnaire.wingsAway === 'Oui' ? 'Ailes détachées du corps.' : '',
    questionnaire.cough === 'Oui' ? 'Toux observée.' : '',
    questionnaire.rattles === 'Oui' ? 'Râles observés.' : '',
    questionnaire.wheezing === 'Oui' ? 'Sifflements observés.' : '',
  ].filter(Boolean);
  return {
    id: `SAN-URGENT-${context.taskId}`,
    date: context.date,
    shift: context.shift,
    buildingId: context.buildingId,
    buildingName: context.buildingName,
    batchId: context.batchId,
    mobilityVigorous: questionnaire.subjectsVigorous,
    foodConsumptionNormal: questionnaire.foodConsumptionNormal,
    foodConsumptionWhy: questionnaire.foodConsumptionWhy,
    waterConsumptionNormal: questionnaire.waterConsumptionNormal,
    waterConsumptionWhy: questionnaire.waterConsumptionWhy,
    lamenessNormal: 'Oui',
    digestiveProblems: questionnaire.droppingsColor !== 'Marron' || questionnaire.droppingsTexture === 'Liquide' ? 'Oui' : 'Non',
    droppingsColor: questionnaire.droppingsColor,
    droppingsTexture: questionnaire.droppingsTexture,
    respiratoryProblems: questionnaire.respiratoryProblems,
    respiratoryTypes: questionnaire.respiratoryType ? [questionnaire.respiratoryType] : [],
    ruffledFeathers: questionnaire.ruffledFeathers,
    wingsAway: questionnaire.wingsAway,
    cough: questionnaire.cough,
    rattles: questionnaire.rattles,
    wheezing: questionnaire.wheezing,
    drinkersWashed: 'Oui',
    feedersFilled: 'Oui',
    materialStored: 'Oui',
    roomClean: 'Oui',
    ventilationChecked: 'Oui',
    comment: reasons.length ? reasons.join('\n') : 'État général saisi : aucune anomalie détaillée, transmission urgente demandée par le protocole.',
    status: poultryGeneralStateStatus(questionnaire),
    recordedById: context.recordedById,
    recordedByName: context.recordedByName,
    recordedAt: context.recordedAt,
    generalStateQuestionnaire: questionnaire,
    urgent: true,
    urgentStatus: 'Déclenchée',
    urgentAt: context.recordedAt,
    urgentTaskId: context.taskId,
    responsibleTaskId: context.recordedById,
    responsibleTaskName: context.recordedByName,
  };
}

export function sanitaryCheckAlerts(check: Pick<PoultrySanitaryCheck, 'mobilityVigorous' | 'foodConsumptionNormal' | 'lamenessNormal' | 'digestiveProblems' | 'droppingsColor' | 'droppingsTexture' | 'respiratoryProblems' | 'respiratoryTypes' | 'ruffledFeathers' | 'wingsAway' | 'cough' | 'rattles' | 'wheezing'> & Partial<Pick<PoultrySanitaryCheck, 'foodConsumptionWhy' | 'waterConsumptionNormal' | 'waterConsumptionWhy'>>) {
  const alerts: string[] = [];
  if (check.mobilityVigorous === 'Non') alerts.push('Mobilité faible ou sujets peu vifs.');
  if (check.foodConsumptionNormal === 'Non') alerts.push(`Consommation alimentaire anormale${check.foodConsumptionWhy ? ` · ${check.foodConsumptionWhy}` : ''}.`);
  if (check.waterConsumptionNormal === 'Non') alerts.push(`Consommation d’eau anormale${check.waterConsumptionWhy ? ` · ${check.waterConsumptionWhy}` : ''}.`);
  if (check.lamenessNormal === 'Non') alerts.push('Boiterie observée.');
  if (check.digestiveProblems === 'Oui' || check.droppingsColor !== 'Marron' || check.droppingsTexture === 'Liquide') alerts.push(`Problèmes digestifs · fientes ${check.droppingsColor.toLowerCase()}, texture ${check.droppingsTexture.toLowerCase()}.`);
  if (check.respiratoryProblems === 'Oui') alerts.push(`Problèmes respiratoires${check.respiratoryTypes.length ? ` · ${check.respiratoryTypes.join(' / ').toLowerCase()}` : ''}.`);
  if (check.ruffledFeathers === 'Oui') alerts.push('Plumes ébouriffées.');
  if (check.wingsAway === 'Oui') alerts.push('Ailes détachées du corps.');
  if (check.cough === 'Oui') alerts.push('Toux observée.');
  if (check.rattles === 'Oui') alerts.push('Râles observés.');
  if (check.wheezing === 'Oui') alerts.push('Sifflements observés.');
  return alerts;
}
