# lw.MD / 简墨

[简体中文](README.md) | [English](README_EN.md)

[![Windows CI](https://github.com/lxw112190/lw.MD/actions/workflows/windows.yml/badge.svg)](https://github.com/lxw112190/lw.MD/actions/workflows/windows.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078d4.svg)](https://github.com/lxw112190/lw.MD/releases)

<img src="docs/assets/lw-md-banner.png" alt="lw.MD（简墨）" width="760">

**lw.MD（简墨）** 是一个简洁、轻量、本地优先的 Windows Markdown 编辑器。项目使用 React、TypeScript、Vditor、C++17 和 WebView2 构建，最终以单个便携 EXE 分发。

<img src="docs/assets/lw-md-editor.png" alt="lw.MD（简墨）主界面" width="960">

## 主要功能

- Vditor IR 即时渲染 Markdown 编辑
- 新建、打开、UTF-8 原子保存和另存为
- 查找、替换、区分大小写及上下匹配导航
- Markdown 与图片拖放、剪贴板图片粘贴
- 自动管理 Markdown 同目录下的 `assets` 图片目录
- 文档大纲、最近文件、浅色、深色及跟随系统主题
- 定时恢复快照，异常退出后可恢复未保存内容
- A4 PDF 导出
- 窗口位置、尺寸和最大化状态记忆
- Windows 右键菜单、打开方式和默认应用设置集成
- 前端资源完全离线，最终用户无需安装 Node.js
- WebView2 原生桥接来源校验、导航限制和参数校验

## 快速开始

1. 从 [Releases](https://github.com/lxw112190/lw.MD/releases) 下载最新的 `lw.MD-windows-x64.zip`。
2. 解压后运行 `lw.MD.exe`。
3. 点击“打开”，或者将 Markdown 文件拖入窗口。
4. 可在“文件 → Windows 集成…”中添加右键菜单和“打开方式”。
5. 使用“文件 → 导出 PDF”生成 A4 PDF。

运行环境：

- Windows 10/11 x64
- Microsoft Edge WebView2 Evergreen Runtime

CI 生成的 EXE 暂未进行商业代码签名，因此 Windows SmartScreen 首次运行时可能显示安全提示。

## 快捷键

| 功能 | 快捷键 |
| --- | --- |
| 新建 | `Ctrl+N` |
| 打开 | `Ctrl+O` |
| 保存 | `Ctrl+S` |
| 另存为 | `Ctrl+Shift+S` |
| 查找 | `Ctrl+F` |
| 替换 | `Ctrl+H` |
| 下一个匹配项 | `Enter` |
| 上一个匹配项 | `Shift+Enter` |
| 关闭查找面板 | `Esc` |

## 恢复快照

编辑未保存内容时，lw.MD 会在停止输入约 1.5 秒后创建恢复快照，并在内容变化时每 15 秒更新一次。

- 快照独立保存在 `%LOCALAPPDATA%\lw.MD\recovery\current.json`。
- 快照不会覆盖原 Markdown 文件。
- 异常退出后，下次启动会提示恢复或放弃快照。
- 恢复的内容仍标记为“未保存”，是否写入原文件由用户决定。
- 正常保存或明确放弃修改后，快照会自动清理。

## 拖放说明

- 拖到窗口标题栏：按原磁盘路径打开 Markdown 文件。
- 拖到编辑工作区：WebView2 只能读取文件内容，无法获得原始磁盘路径，因此会作为未保存文档载入，首次保存时需要选择位置。
- 拖入或粘贴图片：保存文档后，图片会复制到 Markdown 同目录的 `assets` 文件夹，并自动插入相对路径。

## Windows 集成

打开“文件 → Windows 集成…”可以按需注册以下功能：

- `.md` 和 `.markdown` 文件右键显示“使用 lw.MD 打开”。
- Windows“打开方式”列表显示“lw.MD 简墨”。
- 在系统默认应用设置中选择 lw.MD；程序不会自行抢占默认关联。

所有信息仅写入当前用户注册表，不需要管理员权限。Windows 11 的传统右键命令可能显示在“显示更多选项”中。

lw.MD 是便携软件。如果移动了 `lw.MD.exe`，集成窗口会显示“需要修复”，点击“修复关联”即可更新路径。也可以直接通过命令行打开带空格或中文路径的文档：

```powershell
.\lw.MD.exe "D:\文档\项目说明.md"
```

## 从源码构建

需要 Node.js 20.19+、CMake 3.22+、Visual Studio 2022 和 Windows SDK。

```powershell
npm ci --prefix app
npm run check
cmake -S . -B build -G "Visual Studio 17 2022" -A x64 -DBUILD_TESTING=ON
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

生成文件：

```text
build\Release\lw.MD.exe
```

构建过程会将前端生产资源压缩并嵌入 EXE。分发时只需提供 `lw.MD.exe`；接收方不需要 `app/`、`dist/`、Node.js 或 npm。

运行时，内嵌前端会按内容哈希解压到 `%LOCALAPPDATA%\lw.MD\frontend\`。该目录仅作为内部运行缓存，用户分发和携带的仍然只有一个 EXE。

项目代码主要位于：

- `app/`：React、TypeScript 和 Vditor 前端
- `native/`：C++17、WebView2 宿主、文件桥接、恢复服务和 Windows 集成
- `tests/`：原生文件、恢复、启动参数和隔离注册表测试
- `.github/workflows/`：Windows CI 和自动发布流程

## CI 与发布

每次推送都会执行前端检查、Release 构建和原生测试，并在 GitHub Actions 的 **Artifacts** 中生成可下载的 `lw.MD-windows-x64`。

推送与项目版本一致的 `v*` 标签后，CI 会自动创建 GitHub Release，并上传便携 ZIP 和 SHA-256 校验文件：

```powershell
git tag -a v0.3.1 -m "lw.MD v0.3.1"
git push origin v0.3.1
```

使用 `v0.3.1-beta.1`、`v0.3.1-rc.1` 等带后缀的标签时，会自动发布为 GitHub Pre-release。

如需本地调试 WebView2，可在启动前设置 `LWMD_ENABLE_DEVTOOLS=1`；正式构建默认禁用开发者工具。

## 许可证

项目源码使用 [MIT License](LICENSE)。第三方组件说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 联系与支持

- 作者：天天代码码天天
- QQ：819069052
- QQ Group：C# 人工智能实践 | 群号：758616458

如果项目对你有帮助，可以扫码支持维护：

<img src="docs/assets/sponsor.jpg" alt="微信赞助二维码" width="260">
