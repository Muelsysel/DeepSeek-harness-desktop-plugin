# DeepSeek Harness Desktop

把 DeepSeek Harness 装进一个原生桌面窗口：**双击即可启动**，窗口里跑的是你当前 `dsh web` profile 的真实界面 —— agent 会话、工具、plan、goal、subagent、workflow……全部功能天然可用，无需二次实现。

> Everything is a plugin —— 这个仓库就是那个"窗口"。

![主界面](docs/screenshot.png)

## 特性

- 🖱️ **一键启动**：双击桌面快捷方式即出窗口（默认白色浅色风格，可切换深色 Codex 皮肤）
- 🪟 原生 Electron 窗口，加载 `http://127.0.0.1:<port>` 的实时 UI
- ⌨️ Web UI 里输入 `/desktop` 打开/复用窗口（同一后端只开一个）
- 🔗 外部链接走系统浏览器
- 🛑 **关窗即退出后端**（app 模式）；不设置 `DSH_DESKTOP_LAUNCH` 时保持浏览器优先
- 🚀 **启动闪屏**：点图标立刻弹出鲸鱼进度窗口（下载 dsh / 启动后端 / 加载界面），主窗口就绪自动交接，首次启动不再干等黑屏
- 🧭 **首次引导**：setup 安装版自动引导「安装 DeepSeek Harness → 注册插件 → 建快捷方式」；zip 版双击根目录 `start.cmd` 按 [1/5]–[5/5] 完成
- 🐋 全程使用官方 DeepSeek 鲸鱼图标（窗口、任务栏、快捷方式、安装器）

## 怎么用

### 方式一：安装版 setup.exe（推荐，自带后端、免环境）

1. 到 [GitHub Releases](https://github.com/Muelsysel/DeepSeek-harness-desktop-plugin/releases) 下载 `DeepSeek-Harness-Desktop-Setup-<版本>.exe`
2. 双击安装（免管理员），安装完成自动启动
3. **无需安装 Node.js / pnpm / DeepSeek Harness**——后端和 Electron 运行时全部内置；首次启动闪屏显示进度（内置依赖初始化），之后秒开

安装位置：`%LOCALAPPDATA%\Programs\DeepSeek-Harness-Desktop`（无空格路径），桌面快捷方式带鲸鱼图标，开始菜单含卸载入口。私有数据放在 `%APPDATA%\DeepSeek-Harness-Desktop`（不碰你的 `$DSH_HOME` profile），**关窗即退出**。

### 方式二：zip 便携版（免安装，需本机 Node.js）

1. 下载 `DeepSeek-harness-desktop-plugin-<版本>.zip` 并解压（需 Node.js ≥ 22.19，**必须**；pnpm 无需手动安装，注册时自动装）
2. 双击根目录 **`start.cmd`**，按 [1/5]–[5/5] 完成首次设置：
   - [1/5] 检查 Node.js
   - [2/5] 检查 DeepSeek Harness（dsh CLI）；未安装时由 launcher 自动通过 `npx @deepseek-ai/dsh web` 获取（首次联网下载，之后秒起）
   - [3/5] 注册本插件到 `$DSH_HOME\profiles\web`
   - [4/5] 创建桌面快捷方式（可选，鲸鱼图标）
   - [5/5] 启动桌面窗口

也可以跳过引导：直接双击 `bin\dsh-desktop.cmd`，首次点击会自动注册插件再启动。注册过一次之后，每次点快捷方式都是秒开。

### 方式三：手动装进已有 dsh profile（进阶）

前置：Node.js ≥ 22.19（**必须**）、pnpm（无需手动装，注册时自动安装）。

```bat
:: 1) （可选）一次性安装到 web profile——不装也行：直接点启动，首次会自动注册
bin\install.cmd

:: 2) 以后每次"点击启动"（等价于 DSH_DESKTOP_LAUNCH=1 dsh web）
bin\dsh-desktop.cmd
```

安装做了什么：

1. 用 pnpm 把本插件作为 `link:` 依赖装进 `$DSH_HOME\profiles\web`
2. 把 `dsh-desktop` 追加到 profile 的 `dsh.profile.bundles`（幂等，有备份）
3. bundle patch（`patch\desktop.bundle.yml`）插入 `desktop` 行：`autoOpen` 由 `DSH_DESKTOP_LAUNCH` 决定

> 也可以跳过 install.cmd：`bin\dsh-desktop.cmd` 首次点击时会检测插件是否已注册（`install-profile.mjs --check`：0 就绪 / 1 需注册 / 2 profile 尚未创建），未注册就自动注册一次再启动（profile 不存在会自动创建最小骨架）——**zip 解压后即点即用**。

使用方式：

| 方式 | 说明 |
|---|---|
| 安装版 setup.exe | **自带后端**：免 Node/pnpm/dsh，闪屏进度，首次初始化后秒开 |
| zip 版 + `start.cmd`（根目录） | 插件方式：需 Node.js ≥ 22.19，首次引导 [1/5]–[5/5] 后秒开 |
| `bin\dsh-desktop.cmd` | 一键启动：`dsh web` + 自动开窗（可加参数，如 `--port 3180`）；未注册时首次自动注册 |
| `create-shortcut.cmd`（根目录） | 随时补建桌面快捷方式（鲸鱼图标） |
| Web UI 里 `/desktop` | 打开/复用当前后端的桌面窗口 |
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
| `theme` | `default` | `default` = 白色浅色风格；`codex` = 深色 Codex 皮肤 |
| `electronArgs` | `[]` | 附加传给 Electron 的 argv（如 `--no-sandbox`） |

环境变量：`DSH_DESKTOP_LAUNCH=1` 开启 auto-open；`DSH_DESKTOP_TITLE` 覆盖标题；`DSH_DESKTOP_ELECTRON` 手动指定 electron 可执行文件路径（兜底）；`DSH_DESKTOP_DEBUG=1` 写调试日志到 `%TEMP%\dsh-desktop-debug.log`。

## 从源码构建

```bat
:: 插件 zip（tsc 编译 + 离线 zip：源码 + lib + node_modules，解压即用）
npm install
npm run build
node scripts\package.mjs        :: → dist\DeepSeek-harness-desktop-plugin-<版本>.zip

:: 安装版 setup.exe（NSIS 安装器：打包自包含 app —— 内置 dsh 后端 + Electron + 闪屏，
:: 目标机器免 Node/pnpm/dsh；首次构建自动下载 NSIS 编译器到 tools\）
node scripts\make-setup.mjs     :: → dist\DeepSeek-Harness-Desktop-Setup-<版本>.exe
```

开发命令：`npm run build` / `npm run typecheck` / `npm test`（`node --test`）。

## 项目结构

```
src/           插件逻辑（Cordis 插件：/desktop 命令、自动开窗、窗口管理）
desktop/       Electron 外壳（main.cjs / preload.cjs / codex.css 皮肤 / splash.html）
patch/         插入 profile 的 bundle 行
bin/           一键启动 / 安装 / 卸载 / 快捷方式脚本 + 官方图标
apps/standalone/ 自包含桌面 app 源码（后端拥有的 main.cjs + bundled backend/，打包进 setup.exe）
scripts/       安装脚本、离线打包（package.mjs）、安装器构建（make-setup.mjs）、快捷方式（make-shortcut.ps1）
setup/         NSIS 安装器脚本（desktop-setup.nsi）
start.cmd      根目录首次引导向导（zip 版入口）
create-shortcut.cmd  根目录补建桌面快捷方式
tools/         本地 NSIS 编译器（gitignored，构建时自动下载）
docs/          SPEC / ADR / ACCEPTANCE / grill 决策记录
```

## License

MIT
