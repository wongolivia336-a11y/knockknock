# knock knock / The Unknown Box — APP prototype spec

## Product sentence

一个不揭示盒内存在的陪伴型电子宠物。用户通过 `敲、等、触摸、倾听` 形成关系；App 把这些行为转换成回应、证据、性格线索和低压力的异步社交。

## Information architecture

## Exhibition board layout

页面被明确拆成两个并置但独立的物件：

- **Physical scene**：左侧圆形场景，负责呈现人、手、未知盒之间的一对一靠近、敲击、等待和触摸。Three.js 只负责盒体、中心信号与极小姿态反馈；p5 手绘层负责把它落回稚拙的物理感。
- **Phone app**：右侧 390 × 780 的手机框，负责承载信息架构、养成记录、徽章、盒群岛和性格轨迹。底部四项导航只属于手机，不再和实体场景共用一个 dashboard。

盒群岛页使用贴纸式插画作为空间叙事底图，避免让低细节 3D 岛屿成为视觉主体；图标入口分别对应声音、来访、关系三种低压力社交动作。

```text
我的盒子
├─ 3D 未知盒
├─ 敲 / 等 / 触摸
├─ 当前回应
└─ 机器人反馈参数

证据册
├─ 行为贴纸
├─ 性格贴纸
├─ 关系贴纸
└─ 最近的相处记录

盒群岛
├─ 我的盒子
├─ 邻居盒子
├─ 声音明信片
└─ 关系光痕

性格档案
├─ 靠近倾向
├─ 回应延迟
├─ 表达方式
├─ 社交倾向
└─ 模糊的动物倾向与相处猜想
```

## Interaction model

```text
输入：敲 / 等 / 触摸
        ↓
确定性规则：改变 bond、patience、expression、social
        ↓
反馈：中心信号、回应延迟、Web Audio 声音、极小姿态变化
        ↓
记录：evidence log
        ↓
长期结果：badge、性格解释、声音明信片
```

机器人不直接露脸。它的“身体”是盒子、中心信号、延迟和声音；Three.js 负责把状态表达成实体反馈，而不是展示一个泛化的 3D 吉祥物。

## Gamification rules

不使用金币、连续签到、排行榜和惩罚死亡。

徽章是关系证据：

- `未知的开始`：用户没有急着给它命名。
- `等到它回答`：用户完成一次等待交互。
- `第三次来访`：累计三次互动。
- `声音寄出去了`：完成一次声音明信片。

每一枚徽章应该至少改变一个后续解释或回应倾向，而不是纯装饰。

## Prototype boundary

当前是本地演示原型，不声称已经接入真实硬件、后端多人同步或真实机器人控制。数据写入浏览器 localStorage，声音使用 Web Audio API 合成，社交对象是可重复演示的邻居盒子。

## Vercel handoff

- Framework: Vite + React
- Build: `npm run build`
- Output: `dist`
- Runtime state: browser localStorage
- Static assets: `public/assets`
- Three.js scene: `src/main.jsx` 中的 `UnknownBoxScene`

