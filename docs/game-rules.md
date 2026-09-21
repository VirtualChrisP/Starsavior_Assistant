# Star Savior 游戏规则基线

> 状态：阶段 0 草案
> 最后检查：2026-09-20
> 范围：BP 助手所需的规则，不是完整的游戏百科

## 可信度标记

- `confirmed-public`：公开来源明确提到，但在写入可执行逻辑前仍需在客户端验证。
- `observed-public`：出现在公开攻略、视频或文章中，可作为种子信息，但不是权威数据。
- `assumption`：项目暂时假设，不能在未确认时直接驱动正式推荐。
- `unknown`：目前尚未确认。

## 当前公开资料显示的 PvP 信息

| 项目 | 当前信息 | 可信度 | 来源和验证要求 |
|---|---|---|---|
| PvP 模式 | 公开资料描述了 Async Arena 和 Ranked Arena。 | `confirmed-public` | [Star Savior DB PvP 机制](https://starsavior-db.pages.dev/mechanics/)；需要在当前客户端确认。 |
| Ranked 形式 | Ranked Arena 被描述为带 Draft 阶段的实时 PvP。 | `confirmed-public` | [Star Savior DB PvP 机制](https://starsavior-db.pages.dev/mechanics/)。 |
| Draft 计时 | 公开资料列出了 Ranked Arena 的 20 秒回合计时和 5 秒延迟。 | `confirmed-public` | [Star Savior DB PvP 机制](https://starsavior-db.pages.dev/mechanics/)；需要录制一局实际 Draft 验证。 |
| Ranked 标准化 | 公开资料列出了 Ranked Arena 的固定等级 200 和共鸣 10。 | `confirmed-public` | [Star Savior DB PvP 机制](https://starsavior-db.pages.dev/mechanics/)；需要确认是否适用于目标队列和版本。 |
| PvP 数值缩放 | 公开资料描述了基础属性和部分养成来源在 PvP 中使用独立缩放。 | `confirmed-public` | [Star Savior DB PvP 机制](https://starsavior-db.pages.dev/mechanics/)；具体倍率验证前不写入固定逻辑。 |
| 行动顺序 | Turn Speed 决定行动顺序；公开资料描述了 PvP 首回合速度随机化。 | `confirmed-public` | [Star Savior DB 行动顺序机制](https://starsavior-db.pages.dev/mechanics/)；需要确认随机范围及是否已改动。 |
| 轮换 Ban | 公开资料描述了高段位 PvP 的每周轮换 Ban 目标。 | `confirmed-public` | [Star Savior DB PvP 机制](https://starsavior-db.pages.dev/mechanics/)；需要确认段位门槛和当前赛季规则。 |
| Draft 示例 | 一篇公开 Ranked Match 记录展示了包含 Lacy、Bellis、Seira、Taya、Emily、Claire、Roberta、Muriel 和 Bunny Girl Charle 的连续 Ban/Pick。 | `observed-public` | [Vortex Ranked Match 示例](https://vortexgaming.io/en/postdetail/714181)；使用前需要人工查看视频并转录。 |

## 暂不实现的规则

以下信息仍未知，必须在正式实现前通过客户端确认：

- 每个 Ranked 段位和队列的完整 Ban/Pick 顺序。
- 每方最终选择的角色数量。
- 是否允许双方选择相同角色。
- Draft 阶段是否有位置、队长或队伍槽位限制。
- 精确的目标选择和同优先级处理规则。
- PvP 的伤害、治疗、控制和属性缩放公式。
- 装备、Stellar Archive、Tactics、Star Link 或其他养成系统是否影响目标 Ranked 队列。
- 目标账号使用的版本号和地区差异。
- 游戏和赛事规则是否允许第三方悬浮窗或屏幕采集。

## 阶段 0 验收标准

当每一行规则都满足以下任一条件时，本文件才算完成最终确认：

1. 有客户端验证记录和截图/录像；
2. 有权威来源；
3. 已明确决定将其作为项目假设，并在配置中标记。

