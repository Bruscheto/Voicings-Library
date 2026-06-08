# Voicings — TODO

> 用法：从上往下做，一次只盯一个 □。做完打勾 ✅。不用记住全部，盯着当前阶段就行。
> 时间是粗估，给你判断"这步是大是小"用的，不是 deadline。

---

## ✅ 已完成（现状盘点 2026-06）

- [x] Monorepo 搭好（Turbo + npm workspaces，apps/web + apps/admin + packages/*）
- [x] 写入链路：admin 录入工具（虚拟钢琴 + MIDI 输入 + VexFlow 五线谱 + 采样播放 + 和弦/张力自动分析）
- [x] `POST /api/voicings` 存库
- [x] 读取链路：`GET /api/voicings` + web 端能加载并播放库里的 voicing
- [x] Prisma schema（Chord / Voicing / VoicingChord / Progression）+ 本地 dev.db + seed.ts
- [x] 共享包拆分：music-engine（staff）、sampler（audio）、ui、config、data-model

**全栈闭环（DB → API → UI）双向已通。** 下面是让它"能上线 + 像样 + 对得上后端岗位"。

---

## 🅰 阶段 A：迁移到 PostgreSQL（核心目标，约半天～1 天）

> 为什么：上线需要托管数据库（SQLite 是磁盘文件，Vercel 上写不进）；PostgreSQL 是后端岗位最高频要求。
> 顺序提示：功能别再加了，先把库迁完，这样后面所有东西都跑在正式库上。

- [ ] A1. 注册一个免费 Postgres（Neon 或 Supabase 都行），拿到连接字符串 connection string（约 15 min）
- [ ] A2. 在 `packages/data-model/` 建 `.env`，把连接串放进 `DATABASE_URL=`（别提交到 git！确认 .gitignore 有 .env）（5 min）
- [ ] A3. 改 `schema.prisma`：`provider = "sqlite"` → `"postgresql"`，`url = env("DATABASE_URL")`（5 min）
- [ ] A4. 跑 `npx prisma migrate dev --name init` 在 Postgres 上建表（取代之前的 db push）（15 min）
- [ ] A5. 跑 `npm run seed:import`（或 prisma seed）把种子数据灌进新库（15 min）
- [ ] A6. 本地启动 admin + web，验证：录一个 voicing → 刷新 web 能看到（30 min）
- [ ] A7. 收尾：删掉 dev.db，确认 SQLite 痕迹清干净（10 min）

✅ 完成标志：本地连着云端 Postgres，录入和读取都正常。

---

## 🅱 阶段 B：让它能上线 + 像样（约半天，性价比最高）

> 为什么：有个线上链接 = 能发给创始人/放简历；README = 别人点开 repo 第一眼。

- [ ] B1. 把 `apps/web` 部署到 Vercel，连上 Postgres 环境变量，拿到 live URL（约 1 h）
- [ ] B2. 写 README：一句话讲它是什么 + 技术栈列表 + 一张截图或 GIF（录 admin 钢琴工具）+ 本地怎么跑（约 1 h）
- [ ] B3.（可选）admin 工具加个简单口令/环境变量保护，别让公开 URL 谁都能写库（约 30 min）

✅ 完成标志：有一个能打开的网址 + 一个让人看懂的 README。

---

## 🅲 阶段 C：web 从"验证页"升级成真正的 Library（约 2～3 天，主要前端活）

> 现在 apps/web 顶上还写着 "Risk Assessment"，是当初的技术 demo。这步把它变成计划里的浏览库。

- [ ] C1. 做一个 voicing 列表页：卡片展示（和弦名 + 五线谱缩略图 + tags）（约 半天）
- [ ] C2. 加按和弦/quality 的筛选（先用 Postgres 简单查询，别上 Algolia）（约 半天）
- [ ] C3. voicing 详情页：大五线谱 + 音名列表 + 播放（约 半天）
- [ ] C4. 首页换成正经着陆页 + 搜索入口（约 半天）

✅ 完成标志：陌生人能进来搜和弦、点开看、听一遍，全程不用你解释。

---

## 🅳 阶段 D：打磨（不急，做到这里就很能拿出手了）

> 旧 TODO 里的采样/五线谱事项收在这里，等核心跑通再回来。

- [ ] D1. 录/生成真实钢琴采样，放到 `apps/admin/public/samples/piano/`，替换合成器兜底
- [ ] D2. `packages/sampler` 改成：本地采样优先 → CDN → 振荡器兜底，并在 UI 显示加载状态
- [ ] D3. `packages/music-engine` 渲染器支持从 schema 读 clef/register 提示，自动选谱表
- [ ] D4. 写一个测试清单：覆盖 `seed:dry-run`、`seed:import`、admin 播放
- [ ] D5.（远期）MIDI 导入解析 spike，对应计划里的 "Song Import Lab"

---

## 🎯 给简历/申请用的一句话（迁完 A 之后就能写）

> "用 Next.js + TypeScript + PostgreSQL 独立搭建的全栈音乐 Web 应用，支持 MIDI 键盘输入、实时五线谱渲染与和弦分析，数据通过 Prisma 持久化。"

（这句话和 MuCue 的 Software Engineer 岗位要求几乎逐字对上。）
