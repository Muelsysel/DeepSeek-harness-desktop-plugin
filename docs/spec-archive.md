# Spec Archive — dsh-desktop（开发暂告一段落存档）

> 状态：**已实现并发布（v0.1.4，开发确定暂停）**。本文是项目的收尾存档，供后续恢复开发时快速恢复上下文。词汇见 `CONTEXT.md`，架构决策见 `docs/adr/0001..0004`，仓库布局与开发规则见 `AGENTS.md`。

## Problem Statement

DeepSeek Harness 本身是一个浏览器端的 web UI（`dsh web`）。用户想要一个"桌面插件"体验：点击一个东西 → 打开一个类似 Codex 的原生窗口 → Harness 的全部能力在这个窗口里可用。浏览器优先的行为不能被破坏，环境安装不能成为门槛，窗口的生命周期必须和 Harness 后端绑定。

## Solution

一个宿主侧 Cordis 插件（`name: desktop`，`inject: [commands, webServer]`），它：

- 在 web profile 中注册 `/desktop` 人类命令：打开（或复用）一个 Electron 原生窗口，指向当前 `webServer.port` 的实时 UI——**一切功能由构造保证**（窗口加载的就是浏览器看到的同一个 UI，零重实现）。
- 支持 `autoOpen`（由 `DSH_DESKTOP_LAUNCH=1` 环境变量武装），普通 `dsh web` 保持纯浏览器行为。
- 通过一条 bundle patch 行挂进 profile；一键启动脚本在首次点击时自动注册插件（profile 不存在时自动创建最小骨架）。
- 另有**自包含安装版**（setup.exe）：打包 dsh 后端 + Electron 运行时 + 外壳（含启动闪屏），目标机器无需 Node/pnpm/dsh，后端运行在私有 `%APPDATA%` profile 下，关窗即停后端。

窗口默认白色浅色风格，`theme: codex` 切换深色 Codex 皮肤（设计令牌覆盖，非 UI fork）。窗口带启动闪屏（鲸鱼进度窗口），主窗口就绪后自动交接。

## User Stories

1. 作为普通用户，我想双击一个安装包完成安装并自动启动，以便完全不需要安装 Node.js/pnpm/DeepSeek Harness。
2. 作为普通用户，我想看到桌面快捷方式和开始菜单入口，以便从任何入口都能启动。
3. 作为普通用户，我想在首次启动看到进度闪屏，以便知道应用正在初始化而不是卡死。
4. 作为普通用户，我想关闭窗口后应用完全退出（后端随之停止），以便不留后台进程。
5. 作为 zip 用户，我想解压后即点即用（首次点击自动注册插件），以便跳过手动安装步骤。
6. 作为 zip 用户，我想通过 `create-shortcut.cmd` 或根目录快捷方式创建桌面图标，以便按我的解压位置生成正确的快捷方式。
7. 作为 zip 用户，我想通过根目录 `start.cmd` 走完引导（Node 检查 → dsh 检查 → 注册 → 快捷方式 → 启动），以便完成首次设置。
8. 作为浏览器用户，我想在 Web UI 里输入 `/desktop` 打开桌面窗口，以便不用离开 UI 就能切换形态。
9. 作为浏览器用户，我想不设置任何环境变量时 `dsh web` 不弹窗，以便保持纯浏览器工作流。
10. 作为开发者，我想通过 `npm run build` / `typecheck` / `test` 验证插件，以便以自动化方式保证质量。
11. 作为插件安装者，我想插件通过 pnpm `link:` 装进 profile 且 `dsh.profile.bundles` 幂等追加（带备份），以便可安装、可卸载、可重复。
12. 作为运维者，我想 launcher 默认 `--port 0`（系统分配端口），以便绝不与现有 3080 冲突。
13. 作为多实例用户，我想每个后端最多一个窗口（第二次 `/desktop` 复用），以便不会堆叠窗口。
14. 作为链接点击者，我想外部链接在系统浏览器打开，以便不破坏窗口内的会话。
15. 作为硬停机场景，我想 dsh 被强杀后窗口自动退出（孤儿看门狗），以便窗口不悬挂。
16. 作为深色偏好用户，我想用 `theme: codex` 获得深色 Codex 皮肤，以便符合我的观感习惯。
17. 作为无环境机器用户，我想 setup 版完全自包含运行，以便部署到未装任何开发环境的机器。
18. 作为维护者，我想仓库精简（无开发期流程文档、无本机路径快捷方式入库争议），以便仓库干净可维护。

## Implementation Decisions

- **插件形态**：宿主侧 Cordis 插件（`desktop`），挂 `commands` + `webServer`；`src/index.ts` 是纯适配器（仅一行调用进入 `src/desktop.ts`），全部行为逻辑在 `src/desktop.ts`（可脱离 Cordis 单测）。
- **窗口技术**：Electron。插件运行时**绝不 import electron**——只解析二进制路径并 spawn（`require("electron")` 从纯 Node 返回二进制路径；`DSH_DESKTOP_ELECTRON` 环境变量兜底覆盖）。
- **窗口生命周期**：`WindowManager` 单实例跟踪（每次 open 检查存活子进程，复用 pid）；子进程退出触发注册的 onExit 处理器；`--parent-pid` 让外壳运行孤儿看门狗（父进程死则窗口自杀）；`exitOnClose` 模式下窗口关闭触发 profile 优雅停机（复用 SIGTERM 路径）。
- **argv 契约**：Electron CLI 开关（`electronArgs`，如 `--no-sandbox`）放在主脚本路径**之前**；应用参数（`--url/--title/--theme/--size/--parent-pid`）放在**之后**。
- **导航与外链**：`setWindowOpenHandler` + `will-navigate` 按**源（origin）比较**拦截，非本后端源一律走系统浏览器。
- **皮肤机制**：`did-finish-load` / `did-navigate` 后用 `executeJavaScript` 注入 `<style>`（CSS 设计令牌覆盖，`--dsw-*`）；`insertCSS` 方案已放弃（文档已对齐实际机制）。
- **配置文件**：`Config extends WindowOptions`；`theme` 默认 `default`（浅色），`codex` 深色；schemastery schema 带默认值。
- **安装路径**：`scripts/install-profile.mjs` 用 pnpm `link:` 装依赖、追加 bundle 行（幂等 + `package.json.bak` 备份）、`--remove` 模式支持卸载；launcher 用 `--check` 退出码（0 就绪/1 需注册/2 profile 未创建）在首次点击时自动注册；profile 缺失时创建最小骨架（bundles `dsh-base` + `dsh-web-app`）。
- **安装版（自包含 app）**：`apps/standalone/main.cjs` 拥有后端生命周期——`ELECTRON_RUN_AS_NODE` + `--expose-internals` 启动捆绑的 dsh CLI（HMR 服务需要 Node internals；`node-addon-require-builtin` 在 Electron-as-node 下不加载）；从 `dsh web: http://127.0.0.1:<port>` 行解析 OS 分配端口；首次运行把捆绑 node_modules 复制进私有 profile；关窗停后端退出。
- **安装器**：NSIS（MUI2，中英双语），装到 `%LOCALAPPDATA%\Programs\DeepSeek-Harness-Desktop`（无空格路径，pnpm 拒绝含空格的 `link:` spec）；桌面/开始菜单/安装目录三处入口 + 卸载项；NSIS 编译器捆绑在 gitignored `tools/`，构建时自动获取。
- **启动闪屏**：`--splash` 模式 frameless 进度窗口（440×300，鲸鱼图标），通过共享状态文件/executeJavaScript 报告阶段（`boot` → `loading` → `ready`）；插件 launcher 用 `%TEMP%\dsh-desktop-splash.status` 喂阶段令牌。
- **图标**：官方 DeepSeek 鲸鱼图标（`bin/dsh-desktop.ico` + `.png`）用于窗口、任务栏（`app.setAppUserModelId`）、快捷方式、安装器、卸载器。
- **版本与发布**：语义化版本，release 流程为 `npm run build` → `scripts/package.mjs`（插件 zip）→ `scripts/make-setup.mjs`（setup exe）→ GitHub release（两个产物）。v0.1.4 为最终版本。

## Testing Decisions

- **测试哲学**：只测外部行为/逻辑 seams，不测实现细节；绝不 spawn 真实 Electron（通过注入的 `spawn` 录制）。
- **Seams（现有，`test/*.test.mjs`，`node --test`，共 31 条）**：
  - `webUrl(port)` — URL 构建。
  - `buildWindowArgs(url, options, parentPid?)` — argv 构造（Electron 开关与 app 参数的顺序）。
  - `resolveElectronBinary(requireFn, env)` — 二进制解析（env 覆盖 + require 兜底）。
  - `WindowManager.open/close/isOpen` — 单实例窗口生命周期（注入 spawn）。
  - `mountDesktop(ctx, config, manager)` — 命令注册、handler 结果、auto-open、teardown、exitOnClose。
  - `install-profile.mjs` — `--check` 退出码契约与 profile 骨架创建。
- **优先复用现有 seams，不新增**；改动行为时保持这些 seam 上的测试绿。
- 安装/卸载/静默安装/闪屏交接/关窗停后端等**端到端行为**在真实机器上验证（历史 ACCEPTANCE 已记录，随精简移除，git 历史可查）。

## Out of Scope

- 不重实现 Harness 任何功能——窗口加载的就是实时 profile 的 UI。
- 不做客户端侧 UI 插件/按钮（`/desktop` 命令已覆盖 UI 内启动）。
- 不做 file:// + IPC 传输（dsh 未提供）。
- 不构建已取消的 portable exe 分发（ADR-0004 只保留安装版路径）。
- 不做 Linux/macOS 原生安装器（当前为 Windows 目标）。
- 不做多窗口/多显示器布局管理。

## Further Notes

- **快速恢复开发**：先读 `CONTEXT.md`（词汇）与 `docs/adr/0001..0004`（决策），再读 `AGENTS.md`（布局 + 规则 + 命令）。测试 seam 列表见上文 Testing Decisions。
- **当前交付**：GitHub release v0.1.4 含 `DeepSeek-harness-desktop-plugin-0.1.4.zip`（插件，需 Node ≥ 22.19）与 `DeepSeek-Harness-Desktop-Setup-0.1.4.exe`（自包含安装版）。
- **已知边界**：根目录 `DeepSeek Harness 桌面版.lnk` 指向本机构建路径（v0.1.3 起重新入库作为 zip 免脚本入口）；其他解压位置用 `create-shortcut.cmd` 重建。
- **会话持久化观察**：桌面端会话曾出现"消失"现象（调查未完成即转入收尾）——下次开发若复现，从 `$DSH_HOME/sessions` 与桌面私有 home 的 `sessions/` 目录存在性入手，对照 `dsh-session-persistence-jsonl` 的 root 配置。
- **全局 mattskills**：35 个工程/流程技能已安装到 `~/.dsh/skills`（user-dsh 全局层，`dsh-skill-filesystem` 默认扫描），任何项目可用。仓库不再保留本地副本（`.agents/`、`.claude/`、`agent/` 已删除——全局安装后无需项目级副本）。
