# lw.MD / Jianmo

[简体中文](README.md) | [English](README_EN.md)

<img src="docs/assets/lw-md-banner.png" alt="lw.MD / Jianmo" width="760">

A clean and reliable local Markdown editor for Windows. It is built with React, TypeScript, Vditor, C++17, and WebView2, and distributed as a single portable EXE.

## Features

- Instant-rendering Markdown editing with Vditor IR mode
- New, open, atomic UTF-8 save, and Save As operations
- Drag and drop for Markdown files and images, plus clipboard image pasting
- Automatic management of the `assets` image directory beside each Markdown document
- Document outline, recent files, and light, dark, or system-following themes
- Persistent window position, size, and maximized state
- A4 PDF export
- Fully offline frontend assets; end users do not need Node.js

> When a Markdown file is dropped into the workspace, WebView2 can read its contents but cannot obtain its original disk path. The file is therefore loaded as an unsaved document and requires a location on first save. Dropping it onto the window title bar opens it from its original path.

## Download

- After each GitHub Actions build, download `lw.MD-windows-x64` from the **Artifacts** section of the corresponding workflow run.
- Pushing a `v*` tag automatically creates a GitHub Release with a portable ZIP and its SHA-256 checksum file.
- End users need Windows 10/11 x64 and the Microsoft Edge WebView2 Evergreen Runtime.
- CI-generated executables are not commercially code-signed, so Windows SmartScreen may display a warning on first launch.

## Development

```powershell
npm ci --prefix app
npm run check
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure
```

The build automatically generates the production frontend, compresses it into a ZIP archive, and embeds it in the executable. The only file required for distribution is:

```text
build\\Release\\lw.MD.exe
```

Recipients do not need `app/`, `dist/`, Node.js, or npm. On first launch, the embedded frontend is safely extracted by content hash to `%LOCALAPPDATA%\\lw.MD\\frontend\\`; subsequent launches reuse the cache.

The main project code is located in `app/` and `native/`.

## CI and Releases

`.github/workflows/windows.yml` runs the following steps on Windows x64:

1. Install locked frontend dependencies and run type, lint, formatting, and unit checks.
2. Build the native Release configuration with Visual Studio 2022.
3. Run CTest.
4. Create a portable package containing the EXE, Chinese and English READMEs, licenses, and checksums.

Create and push a version tag to publish a release automatically:

```powershell
git tag v0.3.0-beta.1
git push origin v0.3.0-beta.1
```

Tags with suffixes such as `-beta` or `-rc` are automatically published as GitHub pre-releases, for example `v0.3.0-beta.1`.

To debug WebView2 locally, set `LWMD_ENABLE_DEVTOOLS=1` before launching the application. Developer tools are disabled by default in production builds.

## License

The project source code is licensed under the [MIT License](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party component notices.

## Contact and Support

- Author: 天天代码码天天
- QQ: 819069052
- QQ Group: C# Artificial Intelligence Practice | Group ID: 758616458

If this project is helpful to you, scan the QR code to support its maintenance:

<img src="docs/assets/sponsor.jpg" alt="WeChat sponsorship QR code" width="260">
