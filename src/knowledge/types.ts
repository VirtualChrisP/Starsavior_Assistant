export type VerificationLevel =
  | "confirmed-public"
  | "observed-public"
  | "assumption"
  | "unknown";

export interface CharacterStats {
  attack?: number | null;
  vitality?: number | null;
  defense?: number | null;
  speed: number | null;
  criticalHitRate?: number | null;
  criticalDamage?: number | null;
  effectHit?: number | null;
  effectResistance?: number | null;
  hitRate?: number | null;
}

export interface CharacterRecord {
  id: string;
  rosterId: string | null;
  name: string;
  aliases: string[];
  rarity?: string | null;
  class?: string | null;
  element: string | null;
  roles: string[];
  tags: string[];
  stats: CharacterStats | null;
  skills: string[];
  verification: VerificationLevel;
  dataCompleteness?: "full-public-page" | "partial-public-page" | "metadata-only";
  sources?: string[];
}

export interface SkillEffect {
  type: string;
  [key: string]: unknown;
}

export interface SkillRecord {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  target: string;
  cooldown?: number | null;
  resourceCost?: number | null;
  effects: SkillEffect[];
  descriptionZh?: string;
  levelScaling?: string[];
  verification: VerificationLevel;
  sources?: string[];
}

export interface EffectDefinition {
  id: string;
  name: string;
  category: string;
  parameters: string[];
  verification: VerificationLevel;
}

export interface KnowledgeSource {
  type: string;
  url: string;
  verifiedInClient?: boolean;
}

export interface KnowledgeBase {
  schemaVersion: number;
  datasetStatus: string;
  lastReviewed: string;
  patch: string | null;
  region: string | null;
  source: KnowledgeSource[];
  notes: string[];
  characters: CharacterRecord[];
  skills: SkillRecord[];
  effectsCatalog: EffectDefinition[];
}
