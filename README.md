# DeepSeek Harness Desktop

把 DeepSeek Harness 装进一个原生桌面窗口：**双击即可启动**，窗口里跑的是你当前 `dsh web` profile 的真实界面 —— agent 会话、工具、plan、goal、subagent、workflow……全部功能天然可用，无需二次实现。

> Everything is a plugin —— 这个仓库就是那个"窗口"。

![主界面](docs/screenshot.png)

## 特性

- 🖱️ **一键启动**：双击 exe / 快捷方式即出窗口（Codex 风格：GitHub 深色系 + 品牌蓝，可关闭）
- 🪟 原生 Electron 窗口，加载 `http://127.0.0.1:<port>` 的实时 UI
- ⌨️ 插件版支持 Web UI 里输入 `/desktop` 打开/复用窗口（同一后端只开一个）
- 🔗 外部链接走系统浏览器
- 🛑 独立版**关窗即退出后端**；插件版关窗不杀后端，停 dsh 才关窗
- 🎨 使用官方 DeepSeek 图标

## 怎么用

### 方式一：独立便携版（推荐，免安装）

1. 到 [GitHub Releases](https://github.com/Muelsysel/DeepSeek-harness-desktop-plugin/releases) 下载 `DeepSeek-Harness-Desktop-<版本>.exe`
2. 双击运行 —— 内置 dsh 后端 + 桌面窗口自动打开，无需 Node / pnpm / profile

私有数据放在 `%APPDATA%\DeepSeek-Harness-Desktop`（不碰你现有的 `$DSH_HOME` profile），**关窗即退出**。详见 [docs/adr/0004-standalone-packaged-app.md](docs/adr/0004-standalone-packaged-app.md)。

### 方式二：插件版（装进自己的 dsh profile）

前置：Node.js ≥ 22.19、pnpm。

```bat
:: 1) 一次性安装到 web profile（备份 profile\package.json 为 .bak）
bin\install.cmd

:: 2) 以后每次"点击启动"（等价于 DSH_DESKTOP_LAUNCH=1 dsh web）
bin\dsh-desktop.cmd
```

安装做了什么：

1. 用 pnpm 把本插件作为 `link:` 依赖装进 `$DSH_HOME\profiles\web`
2. 把 `dsh-desktop` 追加到 profile 的 `dsh.profile.bundles`（幂等，有备份）
3. bundle patch（`patch\desktop.bundle.yml`）插入 `desktop` 行：`autoOpen` 由 `DSH_DESKTOP_LAUNCH` 决定

使用方式：

| 方式 | 说明 |
|---|---|
| `bin\dsh-desktop.cmd` | 一键启动：`dsh web` + 自动开窗（可加参数，如 `--port 3180`） |
| Web UI 里 `/desktop` | 打开/复用当前后端的桌面窗口 |
| `bin\make-shortcut.cmd` | 在桌面创建"DeepSeek Harness 桌面版"快捷方式（无控制台，关窗即退后端） |
| `bin\uninstall.cmd` | 从 profile 移除插件（含 package.json 备份） |

> 不设置 `DSH_DESKTOP_LAUNCH` 时，普通 `dsh web` 保持"只用浏览器"的行为，不会弹窗。
> 端口：launcher 默认 `--port 0`（系统分配空闲端口，绝不和 3080 冲突）；设 `DSH_DESKTOP_PORT` 可固定端口，或直接加 `--port 3180`。

## 配置（插件版）

插件配置在 profile 的 patch 层覆盖（例如 `cordis.patch.yml` 里给 `desktop` 行写 config）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `autoOpen` | `false` | 启动时自动开窗（launcher 通过 env 置 true） |
| `title` | `DeepSeek Harness` | 窗口标题 |
| `width` / `height` | `1280` / `800` | 初始窗口尺寸 |
| `theme` | `codex` | `codex` = Codex 皮肤；`default` = 原样 UI |
| `electronArgs` | `[]` | 附加传给 Electron 的 argv（如 `--no-sandbox`） |

环境变量：`DSH_DESKTOP_LAUNCH=1` 开启 auto-open；`DSH_DESKTOP_TITLE` 覆盖标题；`DSH_DESKTOP_ELECTRON` 手动指定 electron 可执行文件路径（兜底）；`DSH_DESKTOP_DEBUG=1` 写调试日志到 `%TEMP%\dsh-desktop-debug.log`。

## 从源码构建

```bat
:: 插件（tsc 编译 + 离线 zip：源码 + lib + node_modules，解压即用）
npm install
npm run build
node scripts\package.mjs        :: → dist\DeepSeek-harness-desktop-plugin-<版本>.zip

:: 独立便携 exe
cd apps\standalone
npm install
npm run backend                  :: 把 dsh CLI + web bundles 装进 apps\standalone\backend
npx electron-builder --win portable
:: → dist\exe\DeepSeek-Harness-Desktop-<版本>.exe
```

开发命令：`npm run build` / `npm run typecheck` / `npm test`（`node --test`，50 项单测）。

## 项目结构

```
src/           插件逻辑（Cordis 插件：/desktop 命令、自动开窗、窗口管理）
desktop/       Electron 外壳（main.cjs / preload.cjs / codex.css 皮肤）
patch/         插入 profile 的 bundle 行
bin/           一键启动 / 安装 / 卸载 / 快捷方式脚本 + 官方图标
scripts/       安装脚本、离线打包（package.mjs）
apps/standalone/  独立便携版（自带 dsh 后端 + electron-builder 配置）
docs/          SPEC / ADR / ACCEPTANCE / grill 决策记录
```

## License

MIT
