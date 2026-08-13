# dsh-desktop — DeepSeek Harness 桌面插件

一个 DeepSeek Harness 插件：**点击即启动一个类似 Codex 的原生桌面窗口**，窗口里跑的是你当前 `dsh web` profile 的真实界面 —— 所以 harness 的**全部功能**（agent 会话、工具、plan、goal、subagent、workflow……）在窗口里天然可用，无需任何二次实现。

Everything is a plugin —— 这个插件就是那个"窗口"。

## 效果

- 🖱️ 双击 `bin\dsh-desktop.cmd`（或桌面快捷方式）→ 启动 `dsh web` 并自动弹出桌面窗口
- 🪟 窗口是 Electron 原生窗口，加载 `http://127.0.0.1:<port>` 的实时 UI
- 🎨 Codex 皮肤：深色 GitHub 系配色 + 蓝色主色（通过 `--dsw-*` 设计令牌覆盖实现，可关闭）
- ⌨️ 在 Web UI 里输入 `/desktop` 也能打开窗口（同一后端只开一个窗口）
- 🔗 外部链接走系统浏览器；关闭窗口不会杀掉 dsh 后端

## 快速开始

前置：Node.js ≥ 22.19、pnpm（安装到 profile 用）。

```bat
:: 1) 一次性安装到 web profile（备份 profile\package.json 为 .bak）
bin\install.cmd

:: 2) 以后每次"点击启动"
bin\dsh-desktop.cmd            :: 等价于 DSH_DESKTOP_LAUNCH=1 dsh web
```

安装做了什么：

1. 用 pnpm 把本插件作为 `file:` 依赖装进 `$DSH_HOME\profiles\web`
2. 把 `dsh-desktop` 追加到 profile 的 `dsh.profile.bundles`（幂等，有备份）
3. bundle patch（`patch\desktop.bundle.yml`）插入 `desktop` 行：`autoOpen` 由 `DSH_DESKTOP_LAUNCH` 决定

> 不设置 `DSH_DESKTOP_LAUNCH` 时，普通 `dsh web` 保持"只用浏览器"的行为，不会弹窗。

## 用法

| 方式 | 说明 |
|---|---|
| `bin\dsh-desktop.cmd` | 一键启动：`dsh web` + 自动开窗（可加参数，如 `--port 3180`） |
| Web UI 里 `/desktop` | 打开/复用当前后端的桌面窗口 |
| `bin\uninstall.cmd` | 从 profile 移除插件（含 package.json 备份） |

## 配置

插件配置在 profile 的 patch 层覆盖（例如 `cordis.patch.yml` 里给 `desktop` 行写 config）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `autoOpen` | `false` | 启动时自动开窗（launcher 通过 env 置 true） |
| `title` | `DeepSeek Harness` | 窗口标题 |
| `width` / `height` | `1280` / `800` | 初始窗口尺寸 |
| `theme` | `codex` | `codex` = Codex 皮肤；`default` = 原样 UI |
| `electronArgs` | `[]` | 附加传给 Electron 的 argv（如 `--no-sandbox`） |

环境变量：`DSH_DESKTOP_LAUNCH=1` 开启 auto-open；`DSH_DESKTOP_TITLE` 覆盖标题；`DSH_DESKTOP_ELECTRON` 手动指定 electron 可执行文件路径（兜底）。

## 开发者

- 架构与决策：`docs/grill.md`（grilling 记录）、`docs/adr/`、`CONTEXT.md`（领域词汇）
- 规格与验收：`docs/SPEC.md`
- 命令：`npm run build` / `npm test` / `npm run typecheck`
- 给 agent 的说明：`AGENTS.md`

开发/验收流程遵循 mattpocock skills（`grill-me` → `to-spec` → `tdd` → `code-review`），已安装于 `.agents/skills` 与 `.claude`。

## License

MIT
