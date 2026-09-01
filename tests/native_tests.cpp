#include "app/command_line.h"
#include "associations/file_association.h"
#include "common/dpi.h"
#include "common/dpi_window.h"
#include "dragdrop/file_drop_target.h"
#include "filesystem/file_service.h"
#include "filesystem/file_revision.h"
#include "images/image_service.h"
#include "recovery/recovery_service.h"
#include "resources/frontend_cache.h"
#include "settings/settings.h"

#include <Windows.h>
#include <ShlObj_core.h>
#include <chrono>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <nlohmann/json.hpp>
#include <string>
#include <vector>

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

int TestWindowStateRoundTrip() {
  const SavedWindowState saved{120, 80, 1770, 1140, false, 144};
  const auto persisted = SaveWindowState(nlohmann::json::object(), saved);
  const auto loaded = LoadWindowState(persisted);
  if (!loaded) return 22;
  if (loaded->width != saved.width || loaded->height != saved.height) return 23;
  if (loaded->dpi != saved.dpi) return 24;
  return 0;
}

int TestInvalidWindowDpiFallsBackToDefault() {
  const SavedWindowState invalid{120, 80, 1770, 1140, false, 0};
  const auto persisted = SaveWindowState(nlohmann::json::object(), invalid);
  const auto loaded = LoadWindowState(persisted);
  if (!loaded) return 25;
  if (loaded->dpi != kDefaultDpi) return 26;
  return 0;
}

int TestDpiSuggestedRectIsApplied() {
  const auto window = CreateWindowExW(
      0, L"STATIC", L"lw.MD DPI test", WS_OVERLAPPEDWINDOW, 0, 0, 320, 240,
      nullptr, nullptr, GetModuleHandleW(nullptr), nullptr);
  if (!window) return 27;

  ShowWindow(window, SW_MAXIMIZE);
  UpdateWindow(window);
  const RECT suggested{100, 120, 940, 760};
  const auto applied = ApplyDpiSuggestedRect(window, &suggested);
  RECT actual{};
  const auto read = GetWindowRect(window, &actual);
  DestroyWindow(window);

  if (!applied || !read) return 28;
  if (actual.left != suggested.left || actual.top != suggested.top ||
      actual.right != suggested.right || actual.bottom != suggested.bottom) {
    return 29;
  }
  return 0;
}

int TestDroppedFilePathExtraction() {
  const std::wstring markdown = L"C:\\文档\\首图.md";
  const std::wstring image = L"C:\\文档\\resources\\封面.png";
  std::wstring names;
  names.append(markdown);
  names.push_back(L'\0');
  names.append(image);
  names.push_back(L'\0');
  names.push_back(L'\0');

  std::vector<unsigned char> storage(sizeof(DROPFILES) +
                                     names.size() * sizeof(wchar_t));
  auto* header = reinterpret_cast<DROPFILES*>(storage.data());
  *header = {};
  header->pFiles = sizeof(DROPFILES);
  header->fWide = TRUE;
  std::memcpy(storage.data() + sizeof(DROPFILES), names.data(),
              names.size() * sizeof(wchar_t));

  const auto paths =
      ExtractDroppedFilePaths(reinterpret_cast<HDROP>(storage.data()));
  if (paths.size() != 2) return 30;
  if (paths[0] != std::filesystem::path(markdown)) return 31;
  if (paths[1] != std::filesystem::path(image)) return 32;
  return 0;
}

int TestFrontendCacheCleanup(const std::filesystem::path& test_root) {
  const auto cache_root = test_root / L"frontend-cache";
  std::filesystem::create_directories(cache_root);
  const auto now = std::filesystem::file_time_type::clock::now();
  const auto create_version = [&](const wchar_t* name, int age_hours) {
    const auto path = cache_root / name;
    std::filesystem::create_directories(path);
    std::ofstream(path / L"index.html") << "cached";
    std::error_code error;
    std::filesystem::last_write_time(
        path, now - std::chrono::hours(age_hours), error);
    return error ? std::filesystem::path{} : path;
  };

  const auto current = create_version(L"aaaaaaaaaaaaaaaa", 96);
  const auto recent_one = create_version(L"bbbbbbbbbbbbbbbb", 1);
  const auto recent_two = create_version(L"cccccccccccccccc", 2);
  const auto recent_three = create_version(L"dddddddddddddddd", 3);
  const auto stale = create_version(L"eeeeeeeeeeeeeeee", 72);
  if (current.empty() || recent_one.empty() || recent_two.empty() ||
      recent_three.empty() || stale.empty()) {
    return 36;
  }

  const auto unrelated = cache_root / L"not-a-payload-hash";
  std::filesystem::create_directories(unrelated);
  const auto hash_named_file = cache_root / L"ffffffffffffffff";
  std::ofstream(hash_named_file) << "not a directory";

  CleanupStaleFrontendCaches(cache_root, current, now);
  if (!std::filesystem::exists(current)) return 37;
  if (!std::filesystem::exists(recent_one) ||
      !std::filesystem::exists(recent_two)) {
    return 38;
  }
  if (!std::filesystem::exists(recent_three)) return 39;
  if (std::filesystem::exists(stale)) return 40;
  if (!std::filesystem::exists(unrelated)) return 41;
  if (!std::filesystem::exists(hash_named_file)) return 42;

  CleanupStaleFrontendCaches(cache_root / L"missing", current, now);
  if (!std::filesystem::exists(current)) return 43;
  return 0;
}
}  // namespace

int main() {
  if (ScaleDpiValue(1180, 96, 144) != 1770) return 20;
  if (ScaleDpiValue(1770, 144, 96) != 1180) return 21;
  if (const auto window_state_result = TestWindowStateRoundTrip()) {
    return window_state_result;
  }
  if (const auto invalid_dpi_result = TestInvalidWindowDpiFallsBackToDefault()) {
    return invalid_dpi_result;
  }
  if (const auto dpi_rect_result = TestDpiSuggestedRectIsApplied()) {
    return dpi_rect_result;
  }
  if (const auto drop_result = TestDroppedFilePathExtraction()) {
    return drop_result;
  }

  wchar_t temporary_root[MAX_PATH]{};
  if (!GetTempPathW(MAX_PATH, temporary_root)) return 1;
  const auto directory = std::filesystem::path(temporary_root) / L"lw-md-native-tests";
  std::filesystem::create_directories(directory);
  if (const auto cache_cleanup_result = TestFrontendCacheCleanup(directory)) {
    return cache_cleanup_result;
  }
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
  const auto first_revision = GetFileRevision(file.wstring());
  if (first_revision.size != first.size() ||
      FileRevisionHashHex(first_revision).size() != 64U) {
    return 44;
  }
  WriteUtf8FileAtomically(file.wstring(), second);
  if (ReadUtf8File(file.wstring()) != second) return 3;
  bool conflict_detected = false;
  try {
    SaveUtf8FileChecked(file.wstring(), "must not overwrite", first_revision);
  } catch (const std::runtime_error& error) {
    conflict_detected = std::string(error.what()) == "FILE_CONFLICT";
  }
  if (!conflict_detected || ReadUtf8File(file.wstring()) != second) return 45;
  const auto second_revision = GetFileRevision(file.wstring());
  const auto checked_revision =
      SaveUtf8FileChecked(file.wstring(), "checked save", second_revision);
  if (!SameFileContent(checked_revision, GetFileRevision(file.wstring())) ||
      ReadUtf8File(file.wstring()) != "checked save") {
    return 46;
  }
  if (std::filesystem::exists(file.wstring() + L".lw-md.tmp")) return 4;
  const auto writable_attributes = GetFileAttributesW(file.c_str());
  if (writable_attributes == INVALID_FILE_ATTRIBUTES ||
      !SetFileAttributesW(file.c_str(),
                          writable_attributes | FILE_ATTRIBUTE_READONLY)) {
    return 33;
  }
  const std::string read_only_update = "# 简墨\n只读文件更新";
  WriteUtf8FileAtomically(file.wstring(), read_only_update);
  if (ReadUtf8File(file.wstring()) != read_only_update) return 34;
  const auto preserved_attributes = GetFileAttributesW(file.c_str());
  if (preserved_attributes == INVALID_FILE_ATTRIBUTES ||
      (preserved_attributes & FILE_ATTRIBUTE_READONLY) == 0) {
    return 35;
  }
  SetFileAttributesW(file.c_str(),
                     preserved_attributes & ~FILE_ATTRIBUTE_READONLY);
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
  if (ReadUtf8File(file.wstring()) != read_only_update) return 9;
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
