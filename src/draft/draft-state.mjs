const SIDES = new Set(["ally", "enemy"]);
const ACTION_TYPES = new Set(["ban", "pick"]);

function assertSide(side) {
  if (!SIDES.has(side)) throw new Error(`无效的 Draft 阵营：${side}`);
}

function assertActionType(type) {
  if (!ACTION_TYPES.has(type)) throw new Error(`无效的 Draft 动作：${type}`);
}

function cloneState(state) {
  return structuredClone(state);
}
function getVisibleStateSnapshot(state) {
  const hiddenActions = new Set((getStage(state)?.simultaneous ? state.history : [])
    .filter((item) => item.stageIndex === state.stageIndex)
    .map((item) => `${item.type}:${item.rosterId}:${item.side}`));
  const isVisible = (type, side, rosterId) => !hiddenActions.has(`${type}:${rosterId}:${side}`);
  return {
    schemaVersion: 1,
    phase: state.phase,
    stageIndex: state.stageIndex,
    actionIndex: state.actionIndex,
    currentSide: state.currentSide,
    firstPicker: state.firstPicker,
    allyBans: state.allyBans.filter((rosterId) => isVisible("ban", "ally", rosterId)),
    enemyBans: state.enemyBans.filter((rosterId) => isVisible("ban", "enemy", rosterId)),
    allyPicks: state.allyPicks.filter((rosterId) => isVisible("pick", "ally", rosterId)),
    enemyPicks: state.enemyPicks.filter((rosterId) => isVisible("pick", "enemy", rosterId)),
    visibleActionCount: getStage(state)?.simultaneous ? state.history.filter((item) => item.stageIndex !== state.stageIndex).length : state.history.length
  };
}

function countSideBans(state, side) {
  return side === "ally" ? state.allyBans.length : state.enemyBans.length;
}

function countSidePicks(state, side) {
  return side === "ally" ? state.allyPicks.length : state.enemyPicks.length;
}

function getStage(state) {
  return state.rules.turnStages?.[state.stageIndex ?? 0] ?? null;
}

function resolveStageSide(stageSide, firstPicker) {
  if (stageSide === "first") return firstPicker;
  if (stageSide === "second") return firstPicker === "ally" ? "enemy" : "ally";
  return stageSide;
}

function stageSides(state, stage) {
  if (stage.sides?.length) return stage.sides;
  if (stage.side === "first" || stage.side === "second") {
    const resolved = resolveStageSide(stage.side, state.firstPicker);
    return resolved ? [resolved] : ["ally", "enemy"];
  }
  return stage.side ? [stage.side] : ["ally", "enemy"];
}

function stageComplete(state, stage, stageIndex = state.stageIndex) {
  const counts = state.stageActionCounts ?? [];
  const current = counts[stageIndex ?? 0] ?? 0;
  if (stage.count !== undefined) return current >= stage.count;
  const sides = stageSides(state, stage);
  const target = stage.countPerSide ?? 1;
  return sides.every((side) => {
    const actions = state.history.filter((action) => action.stageIndex === stageIndex && action.side === side);
    return actions.length >= target;
  });
}

function advanceStage(next) {
  if (!next.rules.turnStages) return;
  while (next.stageIndex < next.rules.turnStages.length && stageComplete(next, next.rules.turnStages[next.stageIndex], next.stageIndex)) {
    next.stageIndex += 1;
  }
  const stage = getStage(next);
  next.phase = stage?.type ?? next.phase;
  const sides = stage ? stageSides(next, stage) : [];
  next.currentSide = stage && !stage.simultaneous && sides.length === 1 ? sides[0] : null;
}

/** @param {object} input */
export function createDraftState(input) {
  if (!input?.draftId) throw new Error("draftId 不能为空");
  if (!input.patch) throw new Error("patch 不能为空");
  if (!input.region) throw new Error("region 不能为空");
  if (!input.rules) throw new Error("必须提供 DraftRules");
  return {
    schemaVersion: 1,
    draftId: input.draftId,
    patch: input.patch,
    region: input.region,
    mode: input.mode ?? input.rules.mode,
    phase: input.phase ?? input.rules.turnStages?.[0]?.type ?? "ban",
    currentSide: input.currentSide ?? (input.rules.turnStages?.[0]?.simultaneous ? null : null),
    firstPicker: input.firstPicker ?? null,
    actionIndex: 0,
    stageIndex: 0,
    stageActionCounts: input.rules.turnStages ? input.rules.turnStages.map(() => 0) : undefined,
    rules: structuredClone(input.rules),
    allyBans: [],
    enemyBans: [],
    allyPicks: [],
    enemyPicks: [],
    history: []
  };
}

/** @param {object} state @param {"ally" | "enemy"} side */
export function setFirstPicker(state, side) {
  assertSide(side);
  if (state.allyPicks.length > 0 || state.enemyPicks.length > 0) {
    throw new Error("选人开始后不能修改首选方");
  }
  const next = cloneState(state);
  next.firstPicker = side;
  const stage = getStage(next);
  const sides = stage ? stageSides(next, stage) : [];
  next.currentSide = stage && !stage.simultaneous && sides.length === 1 ? sides[0] : null;
  return next;
}

/** @param {object} state @param {object} action @param {object} roster */
export function validateDraftAction(state, action, roster) {
  const errors = [];
  if (!action || typeof action !== "object") return ["动作必须是对象"];
  assertActionType(action.type);
  assertSide(action.side);
  if (typeof action.rosterId !== "string" || action.rosterId.length === 0) errors.push("rosterId 不能为空");
  if (!roster?.characters?.some((character) => character.id === action.rosterId)) errors.push("角色不在当前阵容快照中");

  const ownBans = new Set(action.side === "ally" ? state.allyBans : state.enemyBans);
  const opponentBans = new Set(action.side === "ally" ? state.enemyBans : state.allyBans);
  const allyPicked = new Set(state.allyPicks);
  const enemyPicked = new Set(state.enemyPicks);
  const stage = getStage(state);
  const isClosingBan = stage?.eligibleFrom === "opponentPicks" && action.type === "ban";
  if (ownBans.has(action.rosterId) || (!stage?.allowDuplicateAcrossSides && opponentBans.has(action.rosterId))) errors.push("角色已经被 Ban");
  if (!isClosingBan && (allyPicked.has(action.rosterId) || enemyPicked.has(action.rosterId))) errors.push("角色已经被 Pick");
  if (!isClosingBan && !state.rules.allowDuplicateAcrossSides && (allyPicked.has(action.rosterId) || enemyPicked.has(action.rosterId))) errors.push("当前规则不允许双方重复选择角色");

  if (state.currentSide !== null && state.currentSide !== action.side) errors.push(`当前轮到 ${state.currentSide}，不能由 ${action.side} 操作`);
  if (state.phase !== action.type) errors.push(`当前阶段是 ${state.phase}，不能执行 ${action.type}`);

  if (action.type === "ban" && state.rules.banLimit !== null && countSideBans(state, action.side) >= state.rules.banLimit) errors.push("该阵营已达到 Ban 上限");
  if (action.type === "pick" && state.rules.teamSize !== null && countSidePicks(state, action.side) >= state.rules.teamSize) errors.push("该阵营已达到 Pick 上限");

  if (stage) {
    if (state.firstPicker === null && stage.side === "first") errors.push("尚未确定首选方");
    const allowedSides = stageSides(state, stage);
    if (stage.type !== action.type) errors.push(`当前阶段是 ${stage.type}，不能执行 ${action.type}`);
    if (!allowedSides.includes(action.side)) errors.push(`当前阶段不允许 ${action.side} 操作`);
    if (stage.countPerSide !== undefined) {
      const sideCount = state.history.filter((item) => item.stageIndex === state.stageIndex && item.side === action.side).length;
      if (sideCount >= stage.countPerSide) errors.push("该阵营已完成当前阶段动作");
    }
    if (stage.eligibleFrom === "opponentPicks") {
      const opponentPicks = action.side === "ally" ? state.enemyPicks : state.allyPicks;
      if (!opponentPicks.includes(action.rosterId)) errors.push("该阶段只能禁用对方已选择的角色");
    }
    if (stageComplete(state, stage)) errors.push("当前 Draft 阶段已经完成");
  }

  if (state.rules.strictTurnOrder && !state.rules.turnStages) {
    const expected = state.rules.turnOrder[state.actionIndex];
    if (!expected) errors.push("Draft 已达到配置的动作上限");
    else if (expected.type !== action.type || expected.side !== action.side) errors.push(`当前应执行 ${expected.side} 的 ${expected.type}`);
  }
  return errors;
}

/** @param {object} state @param {object} action @param {object} roster */
export function applyDraftAction(state, action, roster) {
  const errors = validateDraftAction(state, action, roster);
  if (errors.length > 0) throw new Error(`Draft 动作不合法：${errors.join("；")}`);
  const next = cloneState(state);
  const normalized = { ...action, at: action.at ?? new Date().toISOString() };
  if (action.type === "ban") {
    next[`${action.side}Bans`].push(action.rosterId);
  } else {
    next[`${action.side}Picks`].push(action.rosterId);
  }
  next.history.push({ ...normalized, stageIndex: next.stageIndex, visibleState: getVisibleStateSnapshot(state) });
  next.actionIndex += 1;
  if (next.stageActionCounts) next.stageActionCounts[next.stageIndex] += 1;
  if (next.rules.turnStages) advanceStage(next);
  if (next.rules.strictTurnOrder && !next.rules.turnStages) {
    const nextTurn = next.rules.turnOrder[next.actionIndex];
    next.phase = nextTurn?.type ?? next.phase;
    next.currentSide = nextTurn?.side ?? null;
  }
  return next;
}

/** @param {object} state */
export function undoDraftAction(state) {
  if (state.history.length === 0) return state;
  const previous = cloneState(state);
  const action = previous.history.pop();
  const collection = `${action.type === "ban" ? action.side + "Bans" : action.side + "Picks"}`;
  previous[collection].pop();
  previous.actionIndex = Math.max(0, previous.actionIndex - 1);
  if (previous.stageActionCounts && action.stageIndex !== undefined) previous.stageActionCounts[action.stageIndex] = Math.max(0, previous.stageActionCounts[action.stageIndex] - 1);
  if (previous.rules.turnStages) {
    previous.stageIndex = action.stageIndex ?? 0;
    const stage = getStage(previous);
    previous.phase = stage?.type ?? previous.phase;
    const sides = stage ? stageSides(previous, stage) : [];
    previous.currentSide = stage && !stage.simultaneous && sides.length === 1 ? sides[0] : null;
  }
  if (previous.rules.strictTurnOrder && !previous.rules.turnStages) {
    const previousTurn = previous.rules.turnOrder[previous.actionIndex];
    previous.phase = previousTurn?.type ?? previous.phase;
    previous.currentSide = previousTurn?.side ?? null;
  }
  return previous;
}

/** @param {object} state @param {object} roster */
export function getLegalDraftActions(state, roster) {
  const actions = [];
  const stage = getStage(state);
  const sides = stage ? stageSides(state, stage) : (state.currentSide ? [state.currentSide] : ["ally", "enemy"]);
  for (const side of sides) {
    for (const character of roster.characters) {
      const action = { type: state.phase, side, rosterId: character.id };
      if (validateDraftAction(state, action, roster).length === 0) actions.push(action);
    }
  }
  return actions;
}

/** @param {object} state */
export function getDraftProgress(state) {
  const stage = getStage(state);
  return {
    actionCount: state.history.length,
    banCount: state.allyBans.length + state.enemyBans.length,
    pickCount: state.allyPicks.length + state.enemyPicks.length,
    stageIndex: state.stageIndex,
    stageComplete: stage ? stageComplete(state, stage) : false,
    complete: state.rules.turnStages
      ? state.stageIndex >= state.rules.turnStages.length
      : state.rules.strictTurnOrder
      ? state.actionIndex >= state.rules.turnOrder.length
      : state.rules.teamSize !== null && state.allyPicks.length >= state.rules.teamSize && state.enemyPicks.length >= state.rules.teamSize
  };
}
