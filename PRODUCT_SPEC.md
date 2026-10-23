# knock knock / The Unknown Box — APP prototype spec

## Product sentence

一个没有固定动物外形的陪伴机器人。用户通过 `敲、等、触摸、倾听` 照料一个不可见的存在；它以光、声音和细微动作回应，App 将这些片刻整理成相处线索、暂时的行为理解与低压力的异步明信片。

产品要追问：照料、回应与想象，是否足以建立情感关系？我们验证“被回应”的感受，而不是验证它像哪一种动物。动物只能作为行为隐喻，盒内身份始终不揭晓。

## Information architecture

## Exhibition board layout

页面被明确拆成两个并置但独立的物件：

- **Physical scene**：左侧真实 Three.js 场景，呈现对一体成型乳白圆角方盒的敲击、等待、触摸与倾听。盒体不拆盖、不画接缝或独立信号点；内部 GLSL 光场随靠近、停留与回应改变。
- **Phone app**：右侧 390 × 780 的手机框，负责承载信息架构、养成记录、徽章、盒群岛和性格轨迹。底部四项导航只属于手机，不再和实体场景共用一个 dashboard。

盒群岛页使用贴纸式插画作为空间叙事底图，避免让低细节 3D 岛屿成为视觉主体；图标入口分别对应声音、来访、关系三种低压力社交动作。

```text
我的盒子
├─ 3D 未知盒
├─ 敲 / 等 / 触摸
├─ 光、声音与细微动作回应
└─ 今日的相处片刻

证据册
├─ 行为贴纸
├─ 性格贴纸
├─ 关系贴纸
└─ 最近的相处记录

盒群岛
├─ 我的盒子
├─ 群岛地图
├─ 今日来访与主人留言
├─ 异步声音明信片
└─ 关系光痕

性格档案
├─ 陪伴、探索、安静、好奇等行为倾向
├─ 由互动证据支持的暂时理解
└─ 可变化的行为隐喻（不是物种鉴定）
```

## Interaction model

```text
输入：敲 / 等 / 触摸 / 倾听 / 离开与重逢
        ↓
确定性规则：改变 bond、patience、expression、social
        ↓
反馈：光的位置与扩散、回应延迟、Web Audio 细微声音、轻微运动
        ↓
记录：evidence log
        ↓
长期结果：badge、性格解释、声音明信片
```

机器人不直接露脸，也没有被确认的动物身份。它以盒体、光、延迟、声音和细微动作表现存在感；Three.js 与 GLSL 负责把互动状态转成可感知的反馈，而不是展示一个泛化吉祥物。

## Gamification rules

不使用金币、连续签到、排行榜和惩罚死亡。

徽章是关系证据：

- `未知的开始`：用户没有急着给它命名。
- `等到它回答`：用户完成一次等待交互。
- `第三次来访`：累计三次互动。
- `声音寄出去了`：完成一次声音明信片。

每一枚徽章应该至少改变一个后续解释或回应倾向，而不是纯装饰。

## Prototype boundary

当前是可交互网页原型，不声称已经接入真实硬件、后端多人同步或真实机器人控制。相处记录、声音开关和收藏写入浏览器 localStorage；声音由 Web Audio API 程序化合成；群岛来访为可重复体验的示例明信片，不是实时聊天或在线邻居数据。

## Vercel handoff

- Framework: Vite + React
- Build: `npm run build`
- Output: `dist`
- Runtime state: browser localStorage
- Static assets: `public/assets`
- Three.js scene: `src/main.jsx` 中的 `UnknownBoxScene`
