# KNOCK KNOCK 6.0 QA Report

日期：2026-10-23

## 已执行

- `npm.cmd run build`：通过。
- `git diff --check`：通过；仅有既有 Git 忽略文件权限提示。
- Edge headless + SwiftShader：1440 × 1000 与 390 × 844 截图通过。
- Edge `--dump-dom`：确认存在 Three.js canvas（`data-engine="three.js r186"`），未退回静态 PNG 场景。
- 线上部署走查：确认桌面首屏、手机框、四 Tab 入口、滚动和六种光场存在；线上版本的深层交互仍需在下一次 Preview 部署后复核。

## 本轮重点回归

- 探索时间线：五阶段状态、阶段详情、锁定阶段不提前暴露发现。
- 性格详情：按证据 `supports` 过滤，不使用全部证据数量。
- 群岛：听见、来访、关系、寄出声音均有实际界面结果。
- 明信片：预设选择、发送确认、本地延迟回信。
- 弹层：最大高度与内部滚动，避免手机边界溢出。
- 响应式：窄屏站点导航可横向滚动，主标题和场景保持可见。

## 仍需关注

1. 不同真实 GPU / 浏览器上的 GLSL 色彩和性能。
2. 真实触摸设备上的 Three.js pointer 事件和音频解锁。
3. Vercel Preview 合并后对四 Tab 深层路径做一次端到端点击回归。
4. JS bundle 仍约 873 kB，当前仅为构建警告，不阻塞交付。

