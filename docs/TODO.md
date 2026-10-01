# Voicings — TODO

> 用法：从上往下做，一次只盯一个 □。做完打勾 ✅。
> 最近更新：2026-10-01

---

## ✅ 已完成

- [x] Monorepo：pnpm workspaces + Turbo（`apps/web`、`apps/admin`、`packages/*`）
- [x] 和弦引擎 `packages/harmony`：音符 ⇄ 和弦读法、级数、guide tone、结构分类（shell / rootless A·B / drop 2·3 / quartal / UST）、声部进行（PR #1）
- [x] voicing 按可移调形状存储（`intervals` + `VoicingReading`），一个形状覆盖 12 个调
- [x] Postgres（Neon）迁移完成，`voicings:reanalyze` 0 问题
- [x] 公开站点：Chord Finder（打字或弹奏）、ii–V–I 路径（大调/小调，可替换某一步）、Library 浏览与筛选
- [x] 五线谱音符/临时记号碰撞修复（PR #2）
- [x] 依赖漏洞清零（`pnpm audit` 0）
- [x] CI：format、lint、typecheck、单元测试、覆盖率、Playwright e2e（PGlite 临时库）
- [x] 部署：<https://voicings-library.vercel.app>，admin 有口令保护
- [x] 网站视觉改版：统一 header、明暗主题、卡片键盘预览（PR #3）
- [x] seed 从 17 行扩充到 79 行：shell、rootless、close、drop 2（全转位）、drop 3、UST、双手 spread、三和弦、quartal；常见同形异名（Cm7 ≡ Eb6、Cm7b5 ≡ Ebm6、G13 ≡ Dm6/9）作为第二读法

---

## 🅰 现在：和弦读法的可能性排序

> 现状：`detectChord` 只给出启发式分数，排序有时反直觉（C·E·A 把 Am/C 排在 C6 前面，还会出现 `GMaj6add11/C` 这类罕见名字），UI 也看不出哪个读法最常见、哪个最少见。

- [ ] A1. 写 openspec 提案：分数 → 概率（softmax）+ 和弦常见度先验（quality / tension 的使用频率）
- [ ] A2. harmony：`detectChord` 每个读法返回 `probability` 和常见度档位（常见 / 少见 / 罕见），加测试
- [ ] A3. web Finder「Play a chord」和 admin 录入面板显示概率条与档位
- [ ] A4. 用现有 seed 的作者标注做回归：作者的主读法应排第一

---

## 🅱 内容

- [ ] B1. 作者审一遍新 seed（`docs/data/voicings-seed.csv` 第 19 行起），确认后跑 `pnpm run seed:import` 写入线上库
- [ ] B2. 处理 2 行 `draft`（So What Stack、Drop 2 Dominant）：重新录入或确认引擎读法
- [ ] B3. 补小调 ii–V–I 的 drop 2 / spread 版本，以及 7sus4(b9)、mMaj7 drop 2 等空缺

---

## 🅲 之后

- [ ] C1. 练习模式 `/practice`：回放 voicing 或路径 + 节拍器 + 按功能评分（`gradeAttempt` / `gradeExact` 已在 harmony 里）。需要 MIDI 键盘时再做
- [ ] C2. 真实钢琴采样：本地采样优先 → CDN → 振荡器兜底，UI 显示加载状态
- [ ] C3. 更多进行：I–vi–ii–V、turnaround、blues；路径模型已支持，只缺内容
- [ ] C4.（远期）MIDI 导入解析，对应计划里的 "Song Import Lab"
