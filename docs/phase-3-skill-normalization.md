# 阶段 3：技能数据标准化

## 已完成

- `data/skills.normalized.json`：180 个 Tychara 技能的统一中间层；
- `data/skills.normalized.schema.json`：标准化技能结构约束；
- `tools/normalize-tychara-skills.mjs`：从公开英文技能原文抽取标准字段；
- `tools/validate-normalized-skills.mjs`：标准化数据校验器；
- Draft 详情弹窗显示标准化后的目标、冷却状态和标签。

## 统一字段

每个技能现在包含：

- `type`：`passive`、`basic`、`special`、`hyper`；
- `target`：自身、单体敌人、全体敌人、单体队友、全体队友或未知；
- `cooldown`：从基础描述读取到的冷却，未出现时保留 `null`；
- `effects`：伤害、治疗、增益、减益、控制、驱散、行动条、韧性伤害、触发等；
- `tags`：用于后续推荐的功能标签；
- `descriptionEn`：原始英文描述；
- `descriptionZh`：已人工结构化的中文说明，当前只覆盖已有知识库技能；
- `parsing`：自动解析可信度、冷却来源和人工复核标记。

## 当前边界

自动抽取完成不等于游戏事实已经确认。当前 180 个技能中有 171 个被标记为需要人工复核，原因主要是条件触发、层数、不可驱散、比例伤害和基础描述中未出现冷却。只有完成复核并补充中文效果后，技能才应进入正式推荐评分或回合模拟。

运行校验：

```text
npm run validate:skills
npm test
```
