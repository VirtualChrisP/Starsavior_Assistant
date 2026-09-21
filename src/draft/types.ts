export type DraftSide = "ally" | "enemy";
export type DraftActionType = "ban" | "pick";
export type DraftStageSide = DraftSide | "first" | "second";

export interface DraftAction {
  type: DraftActionType;
  side: DraftSide;
  rosterId: string;
  at?: string;
  stageIndex?: number;
}

export interface DraftTurnRule {
  type: DraftActionType;
  side: DraftSide;
}

export interface DraftStageRule {
  id: string;
  type: DraftActionType;
  side?: DraftStageSide;
  sides?: DraftSide[];
  count?: number;
  countPerSide?: number;
  simultaneous?: boolean;
  eligibleFrom?: "opponentPicks";
}

export interface DraftRules {
  id: string;
  mode: string;
  strictTurnOrder: boolean;
  allowDuplicateAcrossSides: boolean;
  teamSize: number | null;
  banLimit: number | null;
  turnOrder: DraftTurnRule[];
  turnStages?: DraftStageRule[];
  firstPickerMode?: "random";
}

export interface DraftState {
  schemaVersion: number;
  draftId: string;
  patch: string;
  region: string;
  mode: string;
  phase: DraftActionType;
  currentSide: DraftSide | null;
  firstPicker: DraftSide | null;
  actionIndex: number;
  stageIndex?: number;
  stageActionCounts?: number[];
  rules: DraftRules;
  allyBans: string[];
  enemyBans: string[];
  allyPicks: string[];
  enemyPicks: string[];
  history: DraftAction[];
}
