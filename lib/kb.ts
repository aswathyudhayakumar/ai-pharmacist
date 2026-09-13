import rawKb from "@/data/drug_knowledge_base.json";
import type {
  ClassDuplicationFinding,
  Contraindication,
  Drug,
  DrugInteraction,
  KnowledgeBase,
  Schedule,
  SubstitutionTrap,
} from "@/types/kb";

interface RawDrug {
  salt: string;
  brand?: string;
  class: string;
  schedule: string;
  otc: boolean;
  brand_price_inr: number;
  generic_equivalents: { brand: string; price_inr: number }[];
  notes?: string;
}

interface RawInteraction {
  a: string;
  b: string;
  severity: string;
  mechanism: string;
  effect: string;
}

interface RawClassDuplication {
  class: string;
  severity: string;
  note: string;
}

interface RawContraindication {
  salt: string;
  against_condition?: string;
  against_allergy?: string;
  severity: string;
  note: string;
}

interface RawSubstitutionTrap {
  query: string;
  trap_salt: string;
  reason: string;
  redirect: string;
}

interface RawKb {
  drugs: RawDrug[];
  interactions: RawInteraction[];
  class_duplications: RawClassDuplication[];
  contraindications: RawContraindication[];
  substitution_traps: RawSubstitutionTrap[];
  schedules: Record<string, string>;
}

function buildKnowledgeBase(): KnowledgeBase {
  const raw = rawKb as unknown as RawKb;

  const drugs: Drug[] = raw.drugs.map((d) => ({
    salt: d.salt,
    brand: d.brand,
    class: d.class,
    schedule: d.schedule as Schedule,
    otc: d.otc,
    brandPriceInr: d.brand_price_inr,
    genericEquivalents: d.generic_equivalents.map((g) => ({ brand: g.brand, priceInr: g.price_inr })),
    notes: d.notes,
  }));

  const interactions: DrugInteraction[] = raw.interactions.map((i) => ({
    a: i.a,
    b: i.b,
    severity: i.severity as DrugInteraction["severity"],
    mechanism: i.mechanism,
    effect: i.effect,
  }));

  const classDuplications = raw.class_duplications.map((c) => ({
    class: c.class,
    severity: c.severity,
    note: c.note,
  }));

  const contraindications: Contraindication[] = raw.contraindications.map((c) => ({
    salt: c.salt,
    againstCondition: c.against_condition,
    againstAllergy: c.against_allergy,
    severity: c.severity,
    note: c.note,
  }));

  const substitutionTraps: SubstitutionTrap[] = raw.substitution_traps.map((t) => ({
    query: t.query,
    trapSalt: t.trap_salt,
    reason: t.reason,
    redirect: t.redirect,
  }));

  return {
    drugs,
    interactions,
    classDuplications,
    contraindications,
    substitutionTraps,
    schedules: raw.schedules as Record<Schedule, string>,
  };
}

const knowledgeBase = buildKnowledgeBase();

export function getKnowledgeBase(): KnowledgeBase {
  return knowledgeBase;
}

export function getDrugBySalt(salt: string): Drug | undefined {
  return knowledgeBase.drugs.find((d) => d.salt.toLowerCase() === salt.toLowerCase());
}

/** Deterministic legal-schedule lookup (FR-R2) — never model-decided. */
export function getScheduleForSalt(salt: string): Schedule | undefined {
  return getDrugBySalt(salt)?.schedule;
}

export function getScheduleMeaning(schedule: Schedule): string {
  return knowledgeBase.schedules[schedule];
}

/** Interactions where both sides appear in the given salt list. */
export function findInteractionsAmong(salts: string[]): DrugInteraction[] {
  const set = new Set(salts.map((s) => s.toLowerCase()));
  return knowledgeBase.interactions.filter((i) => set.has(i.a.toLowerCase()) && set.has(i.b.toLowerCase()));
}

/** Therapeutic-class duplications among the given salts (e.g. two statins). */
export function findClassDuplicationsAmong(salts: string[]): ClassDuplicationFinding[] {
  const saltsByClass = new Map<string, string[]>();
  for (const salt of salts) {
    const drug = getDrugBySalt(salt);
    if (!drug) continue;
    const existing = saltsByClass.get(drug.class) ?? [];
    existing.push(drug.salt);
    saltsByClass.set(drug.class, existing);
  }

  const findings: ClassDuplicationFinding[] = [];
  for (const [drugClass, saltsInClass] of saltsByClass) {
    if (saltsInClass.length < 2) continue;
    const rule = knowledgeBase.classDuplications.find((c) => c.class === drugClass);
    if (rule) {
      findings.push({ class: drugClass, salts: saltsInClass, severity: rule.severity, note: rule.note });
    }
  }
  return findings;
}

/** Contraindications for candidate salts against the patient's own conditions/allergies. */
export function findContraindications(
  candidateSalts: string[],
  conditionNames: string[],
  allergySubstances: string[]
): Contraindication[] {
  const candidates = new Set(candidateSalts.map((s) => s.toLowerCase()));
  const conditions = new Set(conditionNames.map((c) => c.toLowerCase()));
  const allergies = new Set(allergySubstances.map((a) => a.toLowerCase()));

  return knowledgeBase.contraindications.filter((c) => {
    if (!candidates.has(c.salt.toLowerCase())) return false;
    const conditionHit = c.againstCondition ? conditions.has(c.againstCondition.toLowerCase()) : false;
    const allergyHit = c.againstAllergy ? allergies.has(c.againstAllergy.toLowerCase()) : false;
    return conditionHit || allergyHit;
  });
}

/** Unsafe-substitution trap for a free-text condition/symptom search (FR-S3, e.g. "diabetes medicine"). */
export function findSubstitutionTrap(query: string): SubstitutionTrap | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return knowledgeBase.substitutionTraps.find(
    (t) => q.includes(t.query.toLowerCase()) || t.query.toLowerCase().includes(q)
  );
}

export function getCheaperGenerics(salt: string) {
  return getDrugBySalt(salt)?.genericEquivalents ?? [];
}
