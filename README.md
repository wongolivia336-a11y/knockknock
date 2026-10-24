# knock knock / The Unknown Box

一个关于照料、回应与想象的陪伴机器人原型。盒子里没有被揭晓的动物形态；用户通过敲击、等待、触摸和倾听，感受光、声音与细微动作，并在日常相处中形成暂时的理解。

## 当前交付入口

- GitHub 源码：[wongolivia336-a11y/knockknock](https://github.com/wongolivia336-a11y/knockknock)
- Vercel 在线预览：[knockknock-theta.vercel.app](https://knockknock-theta.vercel.app/)
- 本次视觉修复分支：[feature/priority-visual-repair-20261024](https://github.com/wongolivia336-a11y/knockknock/tree/feature/priority-visual-repair-20261024)
- 本次视觉修复 Preview：[Vercel Preview](https://knockknock-git-feature-prio-f9a3d5-wongolivia336-a11ys-projects.vercel.app)
- 盒体光场回归修复分支：[fix/restore-box-light-field-20261024](https://github.com/wongolivia336-a11y/knockknock/tree/fix/restore-box-light-field-20261024)
- 盒体光场回归修复 Preview：[Vercel Preview](https://knockknock-git-fix-restore-d98618-wongolivia336-a11ys-projects.vercel.app)
- 本地开发入口：`http://127.0.0.1:4175/`（端口占用时以 Vite 终端输出为准）
- 本地启动：运行项目外层的 `启动本地预览.bat`，或执行 `npm ci` 后 `npm run dev -- --host 127.0.0.1`

2026-10-23 已完成动态光场回归修复：Hover 跟随、局部坐标 Raycast、点击聚焦/弥散、延迟响应、自主漂移、六种预设联动和开发调试面板均已保留并验证。

2026-10-24 已完成优先视觉修复：盒体外壳调整为独立的 cream-white matte ivory 材质，动态光场仍参与最终 shader 合成；盒群岛改为由现有透明贴纸组成的三岛拼贴，并用独立语义热点连接听见、来访和关系路径。

2026-10-24 已完成盒体光场回归修复：恢复上一版细腻的多色光场与交互反馈，仅将盒体视觉放大 1.12 倍；保留 RoundedBoxGeometry 参数，取消场景 Canvas 对下方交互卡片的裁切遮罩关系。

## 已实现

- Three.js 一体成型圆角长方体：没有独立盒盖、可见接缝或信号点，柔光从乳白外壳内缓慢浮现。
- GLSL 多团光场：低频色彩、柔和核心与扩散光晕随触摸位置和回应节奏变化。
- 四种照料动作：敲两下、等一会儿、轻轻碰、听听看；对应手势、沙沙声、轻叩和含蓄的低鸣。
- 点击／触摸盒体：触发“靠近 → 轻微回应”的反馈。
- `敲`：两下敲击的概念事件，等待 1.8 秒后回应。
- `等`：等待 2.4 秒，让回应有停顿；沙漏轻摇，伴随原创合成的轻微纸声。
- `触摸`：生成触摸证据，改变回应参数。
- Web Audio API 程序化生成轻敲、纸面窸窣与模糊回响，不依赖外部音频文件，也不以可识别的动物叫声替盒内存在定种。
- 养成状态：bond、patience、expression、social，使用 localStorage 保存。
- 徽章：还没命名、它等了一会儿、第三次来访、一段声音。
- 四个 App 区域：我的盒子、盒群岛、证据册、性格档案。
- 桌面版拆分为两个互不混淆的对象：左侧独立的宽幅实体场景，右侧 390 × 780 手机 App；手机内部只保留用户需要的词。
- PNG 参考图只用于确定“左侧实体场景 + 右侧手机 App”的构图关系；左侧实际场景由 Three.js 实时搭建，不使用 PNG 贴图替代交互。
- 盒群岛以透明纸张贴纸组成三座相互关联的岛屿；装饰图层与独立语义热点分离，来访入口展示邻居主人捎来的异步声音明信片，可试听并收进本地收藏。
- 抽象陪伴、敲击手势、沙漏、轻触和倾听贴纸作为局部视觉素材；性格符号保持行为隐喻，不指向具体物种。
- 视觉方向为清晰的 Linear 式信息秩序、轻量 Real OS 质感、温暖纸张和少量白边贴纸；玻璃效果仅用于小控件，不覆盖主要内容。

## 本地启动

需要 Node.js 18+。

```bash
npm install
npm run dev
```

打开 Vite 输出的本地地址。生产构建：

```bash
npm run build
npm run preview
```

## Vercel

这是标准 Vite 项目：Build Command 使用 `npm run build`，Output Directory 使用 `dist`。项目已设置 `base: './'`，静态资源可以在 Vercel 路径下正常使用。

## 设计与技术决策

- 养成规则与 Three.js 展示分离，先写入确定性状态，再由 3D 画面表达。
- 不做“宠物突然跳出来”的揭示；机器人反馈只通过中心光、延迟、声音和很小的姿态变化表达。
- 不把徽章做成金币式奖励；徽章记录关系证据，并改变后续的性格解释。
- 不复制任何开源项目素材；互动声音由 Web Audio API 原创合成。
- 性格页记录的是行为倾向，不是动物鉴定。猫、狗、兔子或小鼠只可作为行为隐喻，绝不确认盒内身份。
- 产品验证的是“被回应”的感受，而不是它像哪一种动物；不是把宠物藏起来，而是让被回应的感觉可信。

