# KNOCK KNOCK / The Unknown Box

> 看不见它，但它会回应。
> 
> 敲两下，等一会儿，或靠近一点听。每一次轻微回应，都会留下一点线索。

一个没有固定动物外形的陪伴机器人网页与交互原型。它不揭示盒子里是什么，而是通过光、声音、停顿和细微动作，让用户感受一个不可见的存在正在回应。

## 在线预览与源码

- 在线预览（Vercel）：[https://knockknock-theta.vercel.app/](https://knockknock-theta.vercel.app/)
- GitHub 源码：[https://github.com/wongolivia336-a11y/knockknock](https://github.com/wongolivia336-a11y/knockknock)
- 动态光场回归修复：[commit a5ddd83](https://github.com/wongolivia336-a11y/knockknock/commit/a5ddd83e16476324cddcf9ef1e7c68fa7df72842)

## 产品命题

KNOCK KNOCK 想追问的是：**照料、回应与想象，是否足以建立情感关系？**

我们验证的是“被回应”的感受，而不是猜中盒子里像哪一种动物。猫、狗、兔子或小鼠只能作为行为隐喻，不能成为盒内身份的确认；盒体始终保持不可打开、不可被揭示的未知状态。

这版是在上次阶段汇报、老师反馈与前一轮体验走查的基础上继续收敛：让产品表达更直接，让左侧光场真正承担回应，让四种照料动作拥有不同的节奏，也让右侧 App 从视觉展示变成可以继续探索和记录的关系界面。

## PPT 方向与体验语言

- **照料 → 回应 → 相处习惯 → 暂时理解**：探索进度表达相处阶段，性格档案表达由行为线索支持的暂时理解，两者不混为一个数值。
- **看不见它，但它会回应**：不使用宠物式揭示、固定物种形象或拟人化的明确答案。
- **温暖的 Real OS × Linear 式秩序**：使用纸张、留白、清晰的信息层级和少量白边贴纸；插画用于情绪补充，不替代交互结构。
- **低压力的关系体验**：没有金币、连续签到、排行榜或惩罚机制；安静、等待和没有立即回应本身也是有效状态。

## 四种照料动作

| 动作 | 关系含义 | 视觉与声音回应 |
| --- | --- | --- |
| 敲两下 | 发出一次邀请 | 光先收缩并短暂停顿，随后再次扩散；配合两声柔和的程序化叩击 |
| 等一会儿 | 把一点时间留给它 | 光缓慢自主移动，不强行立即作答；配合低音量纸面窸窣 |
| 轻轻碰 | 接触与安抚 | 光朝触点靠近，形成清晰但柔和的核心，然后停留并弥散 |
| 听听看 | 留意细微的动静 | 光出现柔和呼吸，声音保持低而含蓄，不对应具体物种 |

## 页面结构

桌面页面由两个并置但相互独立的对象组成：

1. **左侧实体互动场景**：真实运行的 Three.js 盒体，承载靠近、触摸、停顿和光场回应。
2. **右侧手机 App 原型**：390 × 780 的信息界面，承载今日相处、探索记录、盒群岛、声音明信片和性格档案。

手机 App 的四个区域分别是：

- **我的盒子**：今日便签、当前探索、暂时的性格理解和最近线索。
- **证据册**：记录光、声音、触摸和停留，形成可回看的相处证据。
- **盒群岛**：地图、来访、关系光痕和异步声音明信片。
- **性格档案**：陪伴、探索、安静、好奇、慢热等行为倾向，始终标记为暂时理解。

## 技术实现

- **Three.js + WebGL**：`UnknownBoxScene` 使用一体成型的 `RoundedBoxGeometry` 和正交相机，盒体不使用 PNG 交互替代。
- **GLSL 多团光场**：Fragment Shader 计算多色光团、柔和 Core、扩散 Halo、表面噪声、边缘扩散和交互混色。
- **动态交互坐标**：Raycaster 返回 World Space 命中点后，通过 `box.worldToLocal()` 转为盒体 Local Space；Shader、虚拟光源和 Interaction Target 使用同一坐标系统。
- **交互状态**：明确区分 Hover、Pressed、Raycast Hit、Pointer Leave 延迟衰减和最后命中点，避免把“鼠标停住”误判成“离开盒子”。
- **光场运动**：包含 Approach、Focus、Diffusion 三个阶段，并保留自主漂移、延迟响应、点击反馈和 `prefers-reduced-motion` 支持。
- **六种预设**：颜色、强度、半径、柔软度和运动参数来自 `src/lightPresets.js`；切换预设不会重置交互逻辑。
- **声音与状态**：声音由 Web Audio API 程序化合成，互动记录、声音开关和收藏状态保存在浏览器 `localStorage`。

开发环境可在 URL 后加入 `?lightDebug=1` 查看 Raycast 命中、Pointer Local、Light Target、Light Current、Interaction Strength、Light Radius、Light Intensity、Animation Time 和 WebGL 状态。

## 本地启动

需要 Node.js 18+。

```bash
npm ci
npm run dev
```

打开 Vite 输出的本地地址。也可以使用项目外层的 `启动本地预览.bat`，它会自动进入 `knockknock-website`、安装依赖并启动开发服务。

生产构建与预览：

```bash
npm run build
npm run preview
```

## Vercel 部署

这是标准 Vite 项目：

- Framework：Vite + React
- Build Command：`npm run build`
- Output Directory：`dist`
- Runtime state：浏览器 `localStorage`
- Static assets：`public/assets`
- Three.js scene：`src/main.jsx` 中的 `UnknownBoxScene`

当前线上入口：[https://knockknock-theta.vercel.app/](https://knockknock-theta.vercel.app/)

## 原型边界

这是用于展示与体验研究的可交互网页原型，不声称已经接入真实机器人硬件、后端多人同步或真实机器人控制。群岛来访是可重复体验的匿名示例明信片，不是实时聊天或在线邻居数据；声音、收藏和相处记录均以浏览器本地状态为基础。

## 项目文档

- `PRODUCT_SPEC.md`：产品命题、信息架构和交互模型。
- `WORK_HANDOFF.md`：工作交接、当前路径和技术约束。
- `docs/interaction-spec.md`：四种照料动作与反馈语言。
- `docs/design-system.md`：视觉层级和组件原则。
- `docs/qa-report.md`：本轮体验走查与回归记录。
- `src/content/copy.js`：页面标题、动作文案和状态文案。

本项目不把盒子里的未知存在解释成某一个固定物种；它只留下可以被继续照料、继续等待和继续理解的线索。
