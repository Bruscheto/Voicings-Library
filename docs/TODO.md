# Voicings — TODO

更新于 2026-10-01。按当前状态安排后续工作；数据库写入与历史重写单独确认。

## 已完成

- [x] pnpm 11.18.0 + Turborepo monorepo，两个 Next.js 15 app。
- [x] Neon PostgreSQL + Prisma；voicing 存储为可移调的 shape，和弦解释由 harmony 引擎统一计算。
- [x] MIDI / 虚拟键盘录入、自动分析、重复检测、保存与读取。
- [x] 和弦搜索、结构分组、按调查看 voicing、音名/度数、播放和 ii-V-I 连接。
- [x] 和弦引擎重构与五线谱碰撞修复已合并。
- [x] 安全依赖补丁：Next.js 15.5.27；完整 pnpm audit 无漏洞。
- [x] GitHub CI：format、lint、typecheck、单元测试、coverage、Chromium e2e；首次远程运行通过。
- [x] README 已有产品介绍、技术栈、截图、本地 pnpm/PostgreSQL 配置与命令。

## 阶段 B：公开演示

- [x] B1. apps/web 已部署到 [Vercel](https://voicings-library.vercel.app/)，使用加密的 Neon 生产环境变量；搜索、移调、ii-V-I 和只读 API 已验证。
- [x] B2. README 已加入线上链接与实际线上截图。
- [x] B3. admin 加 Basic Auth；页面和两个 API 都验权，未配置凭证时拒绝访问，跨源写入被拒绝。

仅发布 web。admin 保持本地使用；未来另行部署时必须配置口令并使用 HTTPS。

## 仓库历史

- [ ] 检查 Git 历史中的 packages/data-model/prisma/dev.db 是否包含敏感数据。
- [ ] 根据检查结果决定是否重写历史；force-push 必须先获得明确同意。

## 后续功能

- [ ] Practice mode：围绕已实现的 gradeAttempt 增加练习界面与流程。
- [ ] 自有钢琴采样；当前已有远程采样、加载状态和振荡器兜底。
- [ ] MIDI 导入 spike，明确格式与数据边界后再实现。

## 后续运维

- [ ] 为 public web 配置单独的数据库只读角色。
- [ ] 按需要接入 Dependabot 和独立的 data-model 单元/集成测试。
