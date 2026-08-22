#include "app/command_line.h"
#include "app/main_window.h"
#include <Windows.h>
#include <Ole2.h>
#include <Shellapi.h>

#include <optional>

int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
  std::optional<std::wstring> launch_path;
  int argument_count = 0;
  auto* arguments = CommandLineToArgvW(GetCommandLineW(), &argument_count);
  if (arguments && argument_count > 1) {
    launch_path = ResolveLaunchMarkdownPath(arguments[1]);
    if (!launch_path) {
      MessageBoxW(nullptr,
                  L"无法打开指定文件。\n\n请确认文件存在，并且扩展名为 .md 或 .markdown。",
                  L"lw.MD", MB_OK | MB_ICONERROR);
      LocalFree(arguments);
      return 1;
    }
  }
  if (arguments) LocalFree(arguments);

  const auto initialized = OleInitialize(nullptr);
  const int result = RunMainWindow(instance, launch_path);
  if (SUCCEEDED(initialized)) OleUninitialize();
  return result;
}
