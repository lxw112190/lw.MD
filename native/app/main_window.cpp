#include "app/main_window.h"
#include "bridge/bridge_dispatcher.h"
#include "common/app_state.h"
#include "common/utf8.h"
#include "filesystem/file_service.h"
#include "images/image_service.h"
#include "recovery/recovery_service.h"
#include "resources/frontend_bundle.h"
#include "settings/settings.h"
#include "webview/webview_host.h"
#include <Shellapi.h>
#include <algorithm>
#include <filesystem>
#include <memory>
#include <nlohmann/json.hpp>
#include <stdexcept>
#include <vector>
namespace {
constexpr wchar_t kClassName[] = L"lw.MD.MainWindow";
struct State {
  std::unique_ptr<WebViewHost> webview;
  std::unique_ptr<BridgeDispatcher> bridge;
  bool maximized = false;
};
bool IsMarkdownPath(const std::filesystem::path& path) {
  auto extension = path.extension().wstring();
  for (auto& character : extension) character = static_cast<wchar_t>(towlower(character));
  return extension == L".md" || extension == L".markdown";
}
void OpenDroppedFiles(HWND window, State& state,
                      const std::vector<std::filesystem::path>& dropped_paths) {
  std::filesystem::path selected;
  std::vector<std::filesystem::path> images;
  for (const auto& path : dropped_paths) {
    if (IsMarkdownPath(path)) selected = path;
    else if (IsSupportedImagePath(path)) images.emplace_back(path);
  }
  if (selected.empty() && images.empty()) {
    MessageBoxW(window, L"请拖入 Markdown 文件或图片。", L"lw.MD", MB_OK | MB_ICONINFORMATION);
    return;
  }
  if (selected.empty()) {
    state.bridge->SetPendingImagePaths(images);
    auto paths = nlohmann::json::array();
    for (const auto& image : images) paths.push_back(WideToUtf8(image.wstring()));
    const auto message = nlohmann::json{{"type", "event"},
                                        {"name", "image.dropped"},
                                        {"payload", {{"sourcePaths", std::move(paths)}}}};
    if (!state.webview->PostJson(message.dump())) {
      throw std::runtime_error("Cannot send dropped images to editor");
    }
    return;
  }
  if (GetPropW(window, kDirtyDocumentProperty) &&
      MessageBoxW(window, L"当前文档尚未保存。\n\n确定放弃修改并打开拖入的文件吗？",
                  L"lw.MD — 未保存", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2) != IDYES) return;
  state.bridge->SetCurrentDocumentPath(selected.wstring());
  const auto message = nlohmann::json{{"type", "event"},
                                      {"name", "file.opened"},
                                      {"payload", {{"path", WideToUtf8(selected.wstring())},
                                                   {"name", WideToUtf8(selected.filename().wstring())},
                                                   {"content", ReadUtf8File(selected.wstring())}}}};
  if (!state.webview->PostJson(message.dump())) throw std::runtime_error("Cannot send dropped file to editor");
}
std::wstring FrontendContentPath() {
  wchar_t development_path[32768]{};
  const auto length = GetEnvironmentVariableW(L"LWMD_FRONTEND_DIR", development_path,
                                               static_cast<DWORD>(std::size(development_path)));
  if (length > 0 && length < std::size(development_path)) return development_path;
  return ExtractBundledFrontend().wstring();
}
SavedWindowState FitWindowToVisibleMonitor(SavedWindowState saved) {
  RECT requested{saved.left, saved.top, saved.left + saved.width,
                 saved.top + saved.height};
  MONITORINFO monitor{sizeof(monitor)};
  const auto handle = MonitorFromRect(&requested, MONITOR_DEFAULTTONEAREST);
  if (!handle || !GetMonitorInfoW(handle, &monitor)) return saved;
  const auto work_left = static_cast<int>(monitor.rcWork.left);
  const auto work_top = static_cast<int>(monitor.rcWork.top);
  const auto work_right = static_cast<int>(monitor.rcWork.right);
  const auto work_bottom = static_cast<int>(monitor.rcWork.bottom);
  const auto available_width = work_right - work_left;
  const auto available_height = work_bottom - work_top;
  saved.width = std::clamp(saved.width, std::min(640, available_width), available_width);
  saved.height =
      std::clamp(saved.height, std::min(480, available_height), available_height);
  saved.left = std::clamp(saved.left, work_left, work_right - saved.width);
  saved.top = std::clamp(saved.top, work_top, work_bottom - saved.height);
  return saved;
}
void PersistWindowState(HWND window, bool maximized) {
  WINDOWPLACEMENT placement{sizeof(placement)};
  if (!GetWindowPlacement(window, &placement)) return;
  const auto& bounds = placement.rcNormalPosition;
  SaveWindowState({bounds.left, bounds.top, bounds.right - bounds.left,
                   bounds.bottom - bounds.top, maximized});
}
LRESULT CALLBACK WindowProc(HWND window, UINT message, WPARAM wparam, LPARAM lparam) {
  auto* state = reinterpret_cast<State*>(GetWindowLongPtrW(window, GWLP_USERDATA));
  switch (message) {
    case WM_CREATE: {
      const auto* create = reinterpret_cast<CREATESTRUCTW*>(lparam);
      const auto* launch_path = create
                                    ? static_cast<const std::optional<std::wstring>*>(
                                          create->lpCreateParams)
                                    : nullptr;
      auto owned = std::make_unique<State>(); owned->webview = std::make_unique<WebViewHost>();
      auto* const webview = owned->webview.get();
      owned->bridge = std::make_unique<BridgeDispatcher>(
          window,
          [webview](const std::wstring& path,
                    BridgeDispatcher::PdfExportCompletion completion) {
            webview->ExportPdf(path, std::move(completion));
          },
          [webview](const std::wstring& path) { webview->SetDocumentFolder(path); });
      if (launch_path && *launch_path) {
        owned->bridge->SetLaunchDocumentPath(**launch_path);
      }
      state = owned.release(); SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(state));
      std::wstring folder;
      try { folder = FrontendContentPath(); }
      catch (const std::exception& error) { MessageBoxA(window, error.what(), "lw.MD", MB_OK | MB_ICONERROR); PostMessageW(window, WM_CLOSE, 0, 0); return 0; }
      if (!std::filesystem::exists(std::filesystem::path(folder) / L"index.html")) { MessageBoxW(window, L"应用前端资源不完整，请重新下载 lw.MD.exe。", L"lw.MD", MB_OK | MB_ICONERROR); PostMessageW(window, WM_CLOSE, 0, 0); return 0; }
      state->webview->Create(
          window, folder,
          [dispatcher = state->bridge.get()](const std::string& request,
                                             WebViewHost::Reply reply) {
            dispatcher->Dispatch(request, std::move(reply));
          });
      return 0;
    }
    case WM_SIZE:
      if (state) {
        if (wparam == SIZE_MAXIMIZED) state->maximized = true;
        else if (wparam == SIZE_RESTORED) state->maximized = false;
        state->webview->Resize();
      }
      return 0;
    case WM_DPICHANGED: {
      const auto* suggested = reinterpret_cast<const RECT*>(lparam);
      if (state && !state->maximized && suggested) {
        SetWindowPos(window, nullptr, suggested->left, suggested->top,
                     suggested->right - suggested->left,
                     suggested->bottom - suggested->top,
                     SWP_NOZORDER | SWP_NOACTIVATE);
      }
      if (state) state->webview->Resize();
      return 0;
    }
    case WM_DROPFILES:
      if (state) {
        const auto drop = reinterpret_cast<HDROP>(wparam);
        std::vector<std::filesystem::path> paths;
        const auto count = DragQueryFileW(drop, 0xFFFFFFFF, nullptr, 0);
        paths.reserve(count);
        for (UINT index = 0; index < count; ++index) {
          const auto length = DragQueryFileW(drop, index, nullptr, 0);
          std::wstring path(length + 1, L'\0');
          DragQueryFileW(drop, index, path.data(), length + 1);
          path.resize(length);
          paths.emplace_back(std::move(path));
        }
        try { OpenDroppedFiles(window, *state, paths); }
        catch (const std::exception& error) { MessageBoxA(window, error.what(), "lw.MD", MB_OK | MB_ICONERROR); }
        DragFinish(drop);
      }
      return 0;
    case WM_CLOSE:
      if (GetPropW(window, kDirtyDocumentProperty)) {
        if (MessageBoxW(window, L"当前文档有尚未保存的修改。\n\n确定退出并放弃这些修改吗？",
                        L"lw.MD — 未保存", MB_YESNO | MB_ICONWARNING | MB_DEFBUTTON2) != IDYES) return 0;
        try { ClearRecoverySnapshot(); }
        catch (...) {}
      }
      DestroyWindow(window); return 0;
    case WM_DESTROY:
      RemovePropW(window, kDirtyDocumentProperty);
      if (state) {
        try { PersistWindowState(window, state->maximized); }
        catch (...) {}
      }
      delete state; SetWindowLongPtrW(window, GWLP_USERDATA, 0); PostQuitMessage(0); return 0;
  } return DefWindowProcW(window, message, wparam, lparam);
}
}
int RunMainWindow(HINSTANCE instance,
                  const std::optional<std::wstring>& launch_path) {
  WNDCLASSEXW window_class{sizeof(window_class)}; window_class.lpfnWndProc = WindowProc; window_class.hInstance = instance; window_class.hCursor = LoadCursorW(nullptr, IDC_IBEAM); window_class.hbrBackground = reinterpret_cast<HBRUSH>(COLOR_WINDOW + 1); window_class.lpszClassName = kClassName;
  window_class.hIcon = static_cast<HICON>(LoadImageW(
      instance, MAKEINTRESOURCEW(1), IMAGE_ICON, GetSystemMetrics(SM_CXICON),
      GetSystemMetrics(SM_CYICON), LR_DEFAULTCOLOR | LR_SHARED));
  window_class.hIconSm = static_cast<HICON>(LoadImageW(
      instance, MAKEINTRESOURCEW(1), IMAGE_ICON, GetSystemMetrics(SM_CXSMICON),
      GetSystemMetrics(SM_CYSMICON), LR_DEFAULTCOLOR | LR_SHARED));
  if (!RegisterClassExW(&window_class)) return 1;
  std::optional<SavedWindowState> restored;
  try { restored = LoadWindowState(); }
  catch (...) {}
  if (restored) *restored = FitWindowToVisibleMonitor(*restored);
  const auto window = CreateWindowExW(
      0, kClassName, L"lw.MD — 简墨", WS_OVERLAPPEDWINDOW,
      restored ? restored->left : CW_USEDEFAULT,
      restored ? restored->top : CW_USEDEFAULT,
      restored ? restored->width : 1180, restored ? restored->height : 760,
      nullptr, nullptr, instance,
      const_cast<std::optional<std::wstring>*>(&launch_path));
  if (!window) return 1;
  DragAcceptFiles(window, TRUE);
  ShowWindow(window, restored && restored->maximized ? SW_SHOWMAXIMIZED : SW_SHOW);
  UpdateWindow(window);
  MSG message{};
  while (GetMessageW(&message, nullptr, 0, 0) > 0) {
    TranslateMessage(&message);
    DispatchMessageW(&message);
  }
  return static_cast<int>(message.wParam);
}
