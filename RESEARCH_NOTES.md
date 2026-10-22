# Open-source research notes

本项目只借鉴架构和交互思路，不直接复制开源项目的角色、素材或代码。

## 参考方向

### Tech-aficionado / Tamagochi---Open-Source-Game

- MIT License。
- 采用 React、Zustand、Three.js、React Three Fiber、Drei、Vite、PWA 和 Vercel 配置。
- 重要启发：把照料规则、成长、事件和 3D 表现拆开；成长和性格由持续行为形成。
- 本项目采用了类似的“确定性状态 → 3D 表达”分层，但使用自己的未知盒模型和规则。

### cconsta1 / tamagotchi

- Three.js + JavaScript + Vite。
- 直接使用 3D 机器人作为交互对象，说明 Three.js 可以承担轻量电子宠物的实体反馈。
- 本项目不复用其机器人模型；未知盒的中心信号、盒盖、声音和延迟是自己的表达系统。

### ThisIsItz / virtual-pet

- 使用 tick system、衰减值和派生 mood 组织虚拟宠物状态。
- 本项目不采用饥饿／死亡型压力机制，只保留可解释的 bond、patience、expression、social 四个方向。

### rough-stuff / rough

- MIT License。
- 用 Canvas 或 SVG 生成 sketchy hand-drawn graphics。
- 后续如果需要把更多手绘徽章由代码生成，可以引入 Rough.js；当前先用 CSS、PNG 和 Three.js 保持依赖克制。

### processing / p5.js

- p5.js 是面向艺术家、设计师、学生和教育场景的开源 creative coding 库。
- 本项目使用 p5.js 生成固定的手绘框线和回应记号，不让每一帧随机抖动，避免“动效很 AI”。

### d3 / d3.js

- D3 是开源的 data visualization 库，适合把行为数据绑定到 SVG 路径和节点。
- 本项目使用 D3 的 scale 和 line 生成性格关系轨迹；它表达的是行为历史，不是假装精确的心理测量。

## 许可证边界

当前项目只使用自有生成 PNG 和自建 Three.js 几何体。没有把上述仓库的模型、音频、贴图或角色复制进项目。

