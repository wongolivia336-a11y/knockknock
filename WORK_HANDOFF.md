# knock knock 工作交接日志

更新时间：2026-10-22（Asia/Shanghai）

## 1. 项目定位

这是一个“未知盒子”概念的陪伴型电子宠物 App 原型。

核心概念：用户永远不打开盒子，也不直接看见里面的宠物，只通过敲击、等待、触摸、声音、光和细小动作，逐渐认识一个不可完全确定的存在。

产品应同时呈现两个分开的对象：

1. 左侧：可点击的实体互动场景，是一个真实运行的 Three.js 场景。
2. 右侧：手机尺寸的中文 App 原型，展示养成、证据收藏、邻居社交和流动的性格隐喻。

PNG 参考图只用于确定构图和气质：左侧大场景，右侧手机 App；不能把整张 PNG 当成左侧场景背景或交互替代品。

## 2. 当前代码位置

本地项目：

`D:\.cache\codex\visualizations\2026\10\16\01a144d5-3f88-78a0-a6a1-4dccb1386d09\knock-knock-three-app`

本地开发地址：

`http://127.0.0.1:5173/`

GitHub：

`https://github.com/wongolivia336-a11y/knockknock`

当前 GitHub main：

`62fa7d9c8cab458d91671c896c4eb9e3ef7fde8b`

最新相关提交：

- `2440b71d154070d6b5506c20f76d2f8d540b4df8`：把左侧改成真正的 Three.js 宽幅场景。
- `62fa7d9c8cab458d91671c896c4eb9e3ef7fde8b`：让 WebGL 失败时也只使用纯 CSS 盒体，不退回 PNG。

注意：本地目录不是 Git 仓库，不能假设可以直接执行 `git push`。之前通过 GitHub connector 的 blob/tree/commit/ref 流程同步到 GitHub。

## 3. 已完成内容

### 左侧实体场景

文件：`src/main.jsx` 中的 `UnknownBoxScene`。

实现方式：

- Three.js WebGL renderer。
- `RoundedBoxGeometry` 构造方形未知盒和盒盖。
- OrthographicCamera，宽幅构图。
- 桌面、墙面、书、杯子、植物、阴影和暖色灯光均由 Three.js 基础几何体搭建。
- 盒体有清晰的盒盖、接缝和中心信号灯。
- 对盒体和盒盖做 raycast，点击后触发 React 交互状态。
- 反馈仅是中心信号、光强和很小的呼吸感变化；不旋转、不抖动、不跳跃、不做夸张光效。
- `ScribbleLayer` 使用 p5.js 叠加极轻的手绘线条。
- 右上角有小叉号和“薛定谔的盒子 / 看不见，但有回应”。
- WebGL 失败时，使用纯 HTML/CSS 的 `fallback-box`，不再使用 PNG 作为左侧场景。

当前场景外层：

- `.scene-stage`：16:10 宽幅矩形。
- `hand-reaching.png` 是叙事性的手绘叠层，不是场景底图。
- `presence-stickers.png` 仅用于手机内的存在感/性格线索，不应替代左侧 Three.js 场景。

### 右侧手机 App

当前为中文 UI，四个一级入口：

- 我的盒子
- 盒群岛
- 证据册
- 性格档案

主要页面和交互：

- 我的盒子：今天的回应、相处次数、已留下的章、靠近/等一会儿/记录等行动。
- 敲两下：等待约 1.8 秒后回应。
- 等一会儿：等待约 2.4 秒后生成证据和徽章。
- 摸一下：生成触摸证据，并改变回应参数。
- 盒群岛：展示盒群岛插画、听见/来访/关系入口、声音明信片和寄出声音。
- 证据册：徽章式收藏和最近留下的证据记录。
- 性格档案：使用“靠近 / 绕一圈”“回来 / 等一等”“发亮 / 很细微”“遇见 / 偶尔”等轴线，不使用 MBTI。
- 性格线索使用“像猫一样绕开”“像兔子一样突然”“小鼠似的细听”等模糊动物隐喻，但不揭示盒内真实动物。
- 状态使用 `localStorage` 保存。
- 使用 Web Audio API 合成轻量敲击声、回应声和声音明信片提示音。
- 使用 D3.js 绘制性格变化轨迹。
- 使用内联 SVG 图标，避免 Unicode 图标乱码和临时感。

### 视觉方向

- 暖白、米白、低饱和橘红、淡黄、灰蓝和粉色。
- 纸张、手绘、稚拙、克制。
- 不使用荧光色、玻璃拟态、大面积渐变或夸张 AI 卡片。
- 文字尽量像产品叙事，不要出现开发说明、技术标签或信息架构注释。
- 盒子必须是方形/圆角方体，不要重新改成巨型灯笼或圆形产品。

## 4. 主要文件

- `src/main.jsx`：React、Three.js、p5.js、D3.js 和所有交互状态。
- `src/styles.css`：整体排版、左侧场景、手机框和四个页面的视觉样式。
- `public/assets/box-island.png`：盒群岛手机页面插画。
- `public/assets/presence-stickers.png`：手、眼睛、耳朵、盒子等存在感线索贴纸。
- `public/assets/hand-reaching.png`：左侧场景的手绘手叠层。
- `public/assets/evidence-scraps.png`：证据/收藏类插画素材。
- `public/assets/personality-stickers.png`：性格贴纸素材。
- `public/assets/unknown-box-home.png`、`unknown-box-response.png`：旧素材，不能用来替代左侧实时 Three.js 场景。
- `public/assets/hero-room.png`：之前生成的环境参考图，目前不应作为左侧场景贴图。

## 5. 验证结果

已执行：

```powershell
npm run build
```

结果：通过。Vite 有一个 JS chunk 大于 500 kB 的提示，但不是构建失败。

浏览器截图验证使用 Edge headless + SwiftShader：

`C:\Users\HP\AppData\Local\Temp\qa-v6-three-scene.png`

截图确认：

- 左侧 Three.js 场景正常渲染。
- 方形盒子、盒盖、桌面道具和手绘叠层可见。
- 右侧手机框正常显示。
- 中文导航和中文正文正常显示。
- 画面没有明显抖动式动效。

## 6. 未完成 / 下一步优先级

按优先级继续：

1. 亲自点测三个左侧动作和手机四个一级导航，确认状态变化、声音和徽章生成没有竞态问题。
2. 进一步把左侧手部从 PNG 叙事叠层升级为 Three.js 的简化手部模型（如果时间允许）；但不能牺牲当前构图，也不能让场景变成粗糙的 AI 3D 模型。
3. 优化手机在 1280px、1024px、移动端宽度下的可读性，尤其是小字号正文。
4. 解决 Web Audio 每次创建新 AudioContext 的资源管理问题，可以考虑复用单一 AudioContext。
5. 清理旧的未使用 CSS（例如旧的 `.round-scene-shell` 规则），但不要在没有截图验证时大范围重构。
6. 如果要继续扩展社交，不要做公开排行榜；优先做慢速的声音明信片、偶尔来访和匿名盒子关系。
7. 如果要部署 Vercel，使用 Vite 配置：Build Command `npm run build`，Output Directory `dist`。

## 7. 不可违反的设计约束

- 左侧主体必须是真实的 Three.js/第三方工具搭建的可交互场景，不得直接放一张 PNG 充当场景。
- PNG 可以作为手机里的插画、贴纸或叙事叠层，但不能冒充实时 3D 场景。
- 不要加入抖动、震屏、夸张爆闪或巨型光效。
- 不要把猫、狗、兔、鼠做成盒内真实宠物揭示；它们只能是行为性格隐喻。
- 不要重新加入 MBTI、性格类型标签或开发说明性文字。
- App 继续保持中文为主，不要中英混排。
- 不要覆盖原始素材，不要删除用户已有内容。
- 修改后必须至少执行 `npm run build`，并优先用浏览器截图检查。

## 8. 接手后的最小启动流程

```powershell
Set-Location 'D:\.cache\codex\visualizations\2026\10\16\01a144d5-3f88-78a0-a6a1-4dccb1386d09\knock-knock-three-app'
npm install
npm run dev
```

然后访问：`http://127.0.0.1:5173/`

开始修改前先阅读本文件、`README.md`、`src/main.jsx` 和 `src/styles.css`。


