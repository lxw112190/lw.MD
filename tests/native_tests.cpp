#include "app/command_line.h"
#include "associations/file_association.h"
#include "common/dpi.h"
#include "filesystem/file_service.h"
#include "images/image_service.h"
#include "recovery/recovery_service.h"

#include <Windows.h>
#include <filesystem>
#include <iostream>
#include <string>

namespace {
int TestFileAssociationsInIsolatedRegistry() {
  const auto sandbox_path =
      L"Software\\lw.MD\\Tests\\FileAssociations-" +
      std::to_wstring(GetCurrentProcessId());
  HKEY sandbox = nullptr;
  if (RegCreateKeyExW(HKEY_CURRENT_USER, sandbox_path.c_str(), 0, nullptr,
                      REG_OPTION_NON_VOLATILE, KEY_ALL_ACCESS, nullptr,
                      &sandbox, nullptr) != ERROR_SUCCESS) {
    return 15;
  }
  if (RegOverridePredefKey(HKEY_CURRENT_USER, sandbox) != ERROR_SUCCESS) {
    RegCloseKey(sandbox);
    RegDeleteTreeW(HKEY_CURRENT_USER, sandbox_path.c_str());
    return 16;
  }

  int result = 0;
  try {
    RegisterMarkdownFileAssociations();
    const auto registered = GetMarkdownFileAssociationStatus();
    if (!registered.registered || !registered.current ||
        registered.registered_executable_path !=
            registered.executable_path) {
      result = 17;
    } else {
      UnregisterMarkdownFileAssociations();
      const auto removed = GetMarkdownFileAssociationStatus();
      if (removed.registered || removed.current) result = 18;
    }
  } catch (...) {
    result = 19;
  }

  RegOverridePredefKey(HKEY_CURRENT_USER, nullptr);
  RegCloseKey(sandbox);
  RegDeleteTreeW(HKEY_CURRENT_USER, sandbox_path.c_str());
  RegDeleteKeyW(HKEY_CURRENT_USER, L"Software\\lw.MD\\Tests");
  RegDeleteKeyW(HKEY_CURRENT_USER, L"Software\\lw.MD");
  return result;
}
}  // namespace

int main() {
  if (ScaleDpiValue(1180, 96, 144) != 1770) return 20;
  if (ScaleDpiValue(1770, 144, 96) != 1180) return 21;

  wchar_t temporary_root[MAX_PATH]{};
  if (!GetTempPathW(MAX_PATH, temporary_root)) return 1;
  const auto directory = std::filesystem::path(temporary_root) / L"lw-md-native-tests";
  std::filesystem::create_directories(directory);
  const auto file = directory / L"中文-atomic.md";
  const std::string first = "# 简墨\n第一版";
  const std::string second = "# 简墨\n第二版 ✓";
  WriteUtf8FileAtomically(file.wstring(), first);
  const auto launch_path = ResolveLaunchMarkdownPath(file.wstring());
  if (!launch_path || *launch_path != file.lexically_normal().wstring()) return 12;
  if (ResolveLaunchMarkdownPath((directory / L"missing.md").wstring()) ||
      ResolveLaunchMarkdownPath((directory / L"unsupported.txt").wstring())) {
    return 13;
  }
  const auto association_command = BuildAssociationOpenCommand(
      L"C:\\Program Files\\lw.MD\\lw.MD.exe");
  if (association_command !=
      L"\"C:\\Program Files\\lw.MD\\lw.MD.exe\" \"%1\"") {
    return 14;
  }
  if (const auto association_result =
          TestFileAssociationsInIsolatedRegistry()) {
    return association_result;
  }
  if (ReadUtf8File(file.wstring()) != first) return 2;
  WriteUtf8FileAtomically(file.wstring(), second);
  if (ReadUtf8File(file.wstring()) != second) return 3;
  if (std::filesystem::exists(file.wstring() + L".lw-md.tmp")) return 4;
  const auto image = SaveImageData(
      file.wstring(), "image/png",
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");
  if (!std::filesystem::exists(image.absolute_path)) return 5;
  if (image.relative_path.rfind(L"./assets/", 0) != 0) return 6;
  const auto source = directory / L"测试 图片.png";
  std::filesystem::copy_file(image.absolute_path, source);
  const auto imported = ImportImageFiles(file.wstring(), {source.wstring(), source.wstring()});
  if (imported.size() != 2 || imported[0].relative_path == imported[1].relative_path) return 7;
  if (!IsSupportedImagePath(L"示例.JPEG") || IsSupportedImagePath(L"示例.txt")) return 8;
  const auto snapshot_path = directory / L"recovery" / L"current.json";
  SaveRecoverySnapshotTo(
      snapshot_path,
      RecoverySnapshot{file.wstring(), "中文-atomic.md", "未保存的恢复内容", 123456U});
  if (ReadUtf8File(file.wstring()) != second) return 9;
  const auto snapshot = LoadRecoverySnapshotFrom(snapshot_path);
  if (!snapshot || snapshot->document_path != file.wstring() ||
      snapshot->name != "中文-atomic.md" ||
      snapshot->content != "未保存的恢复内容" ||
      snapshot->saved_at != 123456U) return 10;
  ClearRecoverySnapshotAt(snapshot_path);
  if (std::filesystem::exists(snapshot_path)) return 11;
  std::filesystem::remove_all(directory);
  std::cout << "native file tests passed\n";
  return 0;
}
