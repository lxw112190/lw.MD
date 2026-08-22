# lw.MD / 简墨

[简体中文](README.md) | [English](README_EN.md)

<img src="docs/assets/lw-md-banner.png" alt="lw.MD（简墨）" width="760">

一个简洁轻量的 Windows 本地 Markdown 桌面编辑器。使用 React、TypeScript、Vditor、C++17 和 WebView2 构建，最终以单个便携 EXE 分发。

## 功能

- Vditor IR 即时渲染 Markdown 编辑
- 新建、打开、UTF-8 原子保存和另存为
- Markdown 与图片拖放、剪贴板图片粘贴
- 自动管理 Markdown 同目录下的 `assets` 图片目录
- 文档大纲、最近文件、浅色/深色/跟随系统主题
- 窗口位置、大小和最大化状态记忆
- A4 PDF 导出
- 离线前端资源，最终用户不需要安装 Node.js

> 工作区内拖入 Markdown 时，WebView2 只能读取文件内容，不能获得原始磁盘路径，因此会作为未保存文档载入，首次保存需要选择位置。拖到窗口标题栏则按原路径打开。

## 下载

- 每次 GitHub Actions 构建完成后，可在对应运行页面的 **Artifacts** 区域下载 `lw.MD-windows-x64`。
- 推送 `v*` 标签后，CI 会自动创建 GitHub Release，并附带便携 ZIP 和 SHA-256 校验文件。
- 最终用户需要 Windows 10/11 x64 和 Microsoft Edge WebView2 Evergreen Runtime。
- CI 生成的 EXE 暂未进行商业代码签名，Windows SmartScreen 可能在首次运行时显示提示。

## 开发

```powershell
npm ci --prefix app
npm run check
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

构建过程会自动生成前端生产资源、压缩为 ZIP 并嵌入 EXE。最终分发时只需发送：

```text
build\\Release\\lw.MD.exe
```

接收方不需要 `app/`、`dist/`、Node.js 或 npm。首次运行时，内嵌前端会按内容哈希安全解压到 `%LOCALAPPDATA%\\lw.MD\\frontend\\`，后续启动直接复用缓存。

项目代码主要位于 `app/` 和 `native/`。

## CI 与发布

`.github/workflows/windows.yml` 会在 Windows x64 环境执行：

1. 安装锁定的前端依赖并运行类型、规范、格式和单元测试。
2. 使用 Visual Studio 2022 构建原生 Release。
3. 运行 CTest。
4. 生成包含 EXE、中英文 README、许可证和校验值的便携包。

创建版本标签即可自动发布：

```powershell
git tag v0.3.0-beta.1
git push origin v0.3.0-beta.1
```

包含 `-beta`、`-rc` 等后缀的标签会自动发布为 GitHub Pre-release，例如 `v0.3.0-beta.1`。

如需本地调试 WebView2，可在启动前设置 `LWMD_ENABLE_DEVTOOLS=1`；正式构建默认禁用开发者工具。

## 许可证

项目源码使用 [MIT License](LICENSE)。第三方组件说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 联系与支持

- 作者：天天代码码天天
- QQ：819069052
- QQ Group：C# 人工智能实践 | 群号：758616458

如果项目对你有帮助，可以扫码支持维护：

<img src="docs/assets/sponsor.jpg" alt="微信赞助二维码" width="260">
