# CatBoost 训练数据生成

## 对局记录 v2

`src/draft/draft-state.mjs` 会在每个 BP 动作写入 `visibleState`。它表示动作发生前用户在游戏中可以看到的状态，包括：

- 当前阶段、阶段序号、动作序号和当前操作方；
- 已公开的我方/对方选择和禁用；
- 随机首选方；
- 已公开动作数量。

同时禁用阶段会隐藏同一阶段已经写入本地的另一方动作，避免生成训练集时把同步操作泄漏给模型。连续选人阶段不会隐藏先前已经公开的选择。

对局记录的 `schemaVersion` 已升级为 `2`。旧记录仍可以读取和保存，但没有 `visibleState` 的旧动作会被训练数据生成器跳过，不能自动补造不可见信息。

## 生成命令

将页面导出的 `star-savior-match-history-YYYY-MM-DD.json` 放入本地后执行：

```bash
npm run training:catboost -- --input ./match-history.json --output-dir ./data/training/catboost
```

也可以限定版本和服务器：

```bash
npm run training:catboost -- --input ./match-history.json --output-dir ./data/training/catboost --patch 2026-09-17-a-study-in-gray --region asia
```

输出文件：

- `draft-actions.tsv`：每个有动作前快照的 BP 动作一行；
- `draft-actions.cd`：CatBoost 列类型描述；
- `summary.json`：样本数量、标签分布和跳过数量；
- `README.zh-CN.md`：输出目录说明。

## 标签和切分

标签 `1` 表示我方获胜，标签 `0` 表示对方获胜。平局、未知结果和无效对局默认不输出。每一行包含 `draft_id` 分组列；训练集、验证集和测试集必须按 `draft_id` 分组切分，不能把同一局的不同动作拆到不同集合。

生成器只使用动作前的公开状态和当前实际动作，不使用最终阵容、最终禁用或赛后备注作为特征，从数据层面减少结果泄漏。
