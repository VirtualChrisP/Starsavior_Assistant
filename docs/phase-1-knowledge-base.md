# 阶段 1：知识库实现

## 目标

将角色、技能和效果关系从文档约定变成可读取、可校验、可按版本扩展的本地知识库，为后续规则引擎和回合模拟器提供稳定输入。

## 已实现内容

- `data/knowledge-base.json`：统一知识库数据文件。
- `data/knowledge-base.schema.json`：知识库结构约束。
- `data/roster.asia-2026-09-17.json`：当前公开亚服目标版本的 55 人阵容快照。
- `data/tychara.characters.json`：从 Tychara 角色列表和详情页导入的公开头像、全身像、基础属性和英文技能原文。
- `data/tychara.schema.json`：Tychara 公开资料结构约束。
- `data/roster.schema.json`：阵容快照的结构约束。
- `src/knowledge/knowledge-base.mjs`：运行时校验、角色查询、技能查询和推荐候选过滤。
- `src/knowledge/roster.mjs`：阵容快照校验、角色 ID 查询和同名版本查询。
- `src/knowledge/types.ts`：供桌面端使用的 TypeScript 类型定义。
- `tools/validate-knowledge.mjs`：无需第三方依赖的命令行校验器。
- `test/knowledge-base.test.mjs`：知识库结构、查询和引用完整性测试。

## 当前数据边界

当前基线目标是亚服 2026-09-17 的 `A Study in Gray` 线上版本。已经导入 19 个角色、36 个技能和 11 类效果，其中 9 名角色具有完整公开角色页数据。公开角色资料主要来自韩服/日服数据库，因此仍统一标记为 `observed-public`。当前边界如下：

- `listRecommendationCandidates` 当前返回空数组；
- 未确认数据可以被查询和展示，但不会进入正式推荐；
- Omega、Tanya、Claire、Charlotte、Bell Rhys、Asherah、Lacy、Smile 和 Luna 已录入完整公开技能页摘要；
- Scarlet、Harley 已录入公开基础属性，技能仍待补全；
- 其余角色为元数据占位，等待公开角色页和亚服客户端验证；
- Tychara 当前角色列表已导入 49 个详情页和 180 个技能条目；当前 55 人亚服阵容中 51 个条目可以映射到 Tychara 详情页，4 个没有对应页面的条目保持占位；
- Tychara 资料仅作为公开展示和详情查看来源，不自动覆盖阶段 1 中已经人工结构化的中文技能效果；
- `effectsCatalog` 是内部建模词汇，不代表游戏事实已经确认。
- 2026-09-23 已宣布但尚未生效的角色平衡更新保存在 `data/patches/2026-09-23-savior-balance-announced.json`，不会自动应用到当前基线。
- 技能知识库通过 `rosterId` 关联 55 人阵容快照；同名异版本角色必须使用独立 ID。

## 使用方式

在项目根目录运行：

```text
npm run validate:knowledge
npm run validate:roster
npm test
```

新增角色或技能时，先更新 `data/knowledge-base.json`，再运行校验和测试。所有角色、技能和效果都必须填写可信度标记；技能的 `ownerId` 必须引用已存在的角色，角色中的技能 ID 也必须反向存在。

## 阶段 1 验收标准

- 知识库和 55 人阵容快照可以被程序加载和校验；
- 角色、技能和效果具有稳定 ID；
- 数据按版本和地区预留字段；
- 未确认角色不会进入正式推荐候选；
- 错误引用、重复 ID 和无效可信度会被测试捕获。
