import { getLegalDraftActions } from "./draft-state.mjs";

/**
 * 阶段 2 的规则引擎只做硬约束和候选过滤，不计算胜率。
 */

/** @param {object} state @param {object} roster @param {object} knowledgeBase */
export function getDraftCandidates(state, roster, knowledgeBase) {
  const legalActions = getLegalDraftActions(state, roster);
  const byRosterId = new Map(roster.characters.map((character) => [character.id, character]));
  const byKnowledgeRosterId = new Map(
    knowledgeBase.characters
      .filter((character) => character.rosterId !== null)
      .map((character) => [character.rosterId, character])
  );
  return legalActions.map((action) => {
    const rosterCharacter = byRosterId.get(action.rosterId);
    const knowledgeCharacter = byKnowledgeRosterId.get(action.rosterId) ?? null;
    return {
      ...action,
      rosterCharacter,
      knowledgeCharacter,
      dataCompleteness: knowledgeCharacter?.dataCompleteness ?? "metadata-only",
      usableForSimulation: knowledgeCharacter?.skills?.length > 0
    };
  });
}

/** @param {object} state @param {object} roster @param {object} knowledgeBase */
export function summarizeDraftRisks(state, roster, knowledgeBase) {
  const candidates = getDraftCandidates(state, roster, knowledgeBase);
  const risks = [];
  if (state.rules.teamSize === null) risks.push({ code: "TEAM_SIZE_UNCONFIRMED", message: "尚未确认队伍人数，当前不能判断阵容是否已完成" });
  if (!state.rules.strictTurnOrder) risks.push({ code: "TURN_ORDER_UNCONFIRMED", message: "尚未确认亚服真实 Ban/Pick 顺序，当前使用宽松模式" });
  if (state.rules.firstPickerMode === "random" && state.firstPicker === null) risks.push({ code: "FIRST_PICKER_UNCONFIRMED", message: "尚未记录本局随机首选方，首轮选人暂不能推进" });
  if (candidates.length === 0) risks.push({ code: "NO_LEGAL_ACTION", message: "当前阶段没有合法动作" });
  if (candidates.every((candidate) => !candidate.usableForSimulation)) risks.push({ code: "SKILLS_INCOMPLETE", message: "当前可选角色尚未录入可模拟的技能数据" });
  return risks;
}
